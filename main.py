import hashlib
import hmac
import base64
import binascii
import html
import json
import os
import re
import secrets
import zipfile
import zlib
from email.parser import BytesParser
from email.policy import default
from io import BytesIO
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import mysql.connector
from mysql.connector import Error as MySQLError

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None

HOST = "127.0.0.1"
PORT = 8000
PBKDF2_ITERATIONS = 310_000
DB_NAME = os.getenv("DB_NAME", "interviewai")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@interviewai.com").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin@123")
ADMIN_TOKENS = set()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": DB_NAME,
    "charset": "utf8mb4",
    "autocommit": True,
    "raise_on_warnings": True,
}


def connection():
    return mysql.connector.connect(**DB_CONFIG)


def initialize_database():
    db = connection()
    cursor = db.cursor()
    try:
        try:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(255),
                    password_salt VARCHAR(255),
                    provider VARCHAR(50) NOT NULL DEFAULT 'email',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    token VARCHAR(255) PRIMARY KEY,
                    user_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS interviews (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    company VARCHAR(255) NOT NULL,
                    round_name VARCHAR(255) NOT NULL,
                    industry VARCHAR(255) NOT NULL,
                    difficulty VARCHAR(255) NOT NULL,
                    score INT NOT NULL,
                    xp INT NOT NULL,
                    duration VARCHAR(50) NOT NULL DEFAULT '18 min',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
                """
            )
        except mysql.connector.Error as exc:
            if exc.errno != 1050:
                raise
    finally:
        cursor.close()
        db.close()


def password_hash(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return salt.hex(), digest.hex()


def password_matches(password, salt_hex, digest_hex):
    _, digest = password_hash(password, bytes.fromhex(salt_hex))
    return hmac.compare_digest(digest, digest_hex)


def public_user(row):
    return {"id": row["id"], "name": row["name"], "email": row["email"], "provider": row["provider"]}


def extract_pdf_text(content):
    text_parts = []
    streams = list(re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", content, re.DOTALL))
    if not streams:
        streams = [re.match(rb"(.*)", content, re.DOTALL)]
    for match in streams:
        if not match:
            continue
        stream = match.group(1)
        try:
            stream = zlib.decompress(stream)
        except zlib.error:
            pass
        for value in re.findall(rb"\((?:\\.|[^)])*\)", stream):
            value = value[1:-1]
            value = re.sub(rb"\\([()\\])", rb"\1", value)
            text_parts.append(value.decode("latin-1", errors="ignore"))
        for value in re.findall(rb"<([0-9A-Fa-f\s]{4,})>", stream):
            value = re.sub(rb"\s+", b"", value)
            if len(value) % 2:
                value += b"0"
            try:
                decoded = bytes.fromhex(value.decode("ascii"))
                text_parts.append(decoded.decode("utf-16-be", errors="ignore") if b"\x00" in decoded else decoded.decode("latin-1", errors="ignore"))
            except (ValueError, UnicodeDecodeError):
                continue
    return " ".join(text_parts)


def extract_resume_text(filename, content):
    extension = os.path.splitext(filename.lower())[1]
    if extension == ".pdf":
        text = extract_pdf_text(content)
    elif extension == ".docx":
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
            text = html.unescape(re.sub(r"<[^>]+>", " ", xml))
        except (KeyError, zipfile.BadZipFile):
            raise ValueError("That DOCX file could not be read")
    elif extension == ".doc":
        raise ValueError("Old .doc files are not supported. Save the resume as PDF or DOCX and try again.")
    else:
        raise ValueError("Please upload a PDF or DOCX resume")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 20:
        raise ValueError("No readable text was found. Try a text-based PDF or DOCX file.")
    return text


def looks_like_resume(text):
    normalized = text.lower()
    section_terms = {
        "summary": ("summary", "profile", "objective"),
        "experience": ("experience", "employment", "work history"),
        "education": ("education", "academic", "university", "college"),
        "skills": ("skills", "technical skills", "technologies"),
        "projects": ("projects", "project experience"),
    }
    section_count = sum(
        any(term in normalized for term in terms)
        for terms in section_terms.values()
    )
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text))
    has_phone = bool(re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", text))
    has_experience = any(term in normalized for term in section_terms["experience"])
    has_education = any(term in normalized for term in section_terms["education"])
    return has_email and has_phone and section_count >= 3 and (has_experience or has_education)


def analyze_skills(text):
    skill_terms = {
        "JavaScript / React": [r"\bjavascript\b", r"\breact(?:\.js)?\b", r"\btypescript\b"],
        "Python": [r"\bpython\b", r"\bdjango\b", r"\bflask\b"],
        "Node.js / Backend": [r"\bnode(?:\.js|js)\b", r"\bexpress(?:\.js)?\b"],
        "SQL / Databases": [r"\bsql\b", r"\bmysql\b", r"\bpostgres(?:ql)?\b", r"\bmongodb\b"],
        "System Design": [r"\bsystem design\b", r"\bdistributed systems?\b", r"\bmicroservices?\b", r"\bscalability\b"],
        "Data Structures & Algorithms": [r"\bdata structures?\b", r"\balgorithms?\b", r"\bleetcode\b", r"\bbig[- ]o\b"],
        "Cloud / DevOps": [r"\baws\b", r"\bazure\b", r"\bgcp\b", r"\bdocker\b", r"\bkubernetes\b", r"\bci/cd\b"],
        "Communication": [r"\bleadership\b", r"\bpresentation skills?\b", r"\bteamwork\b", r"\bcommunication skills?\b"]
    }
    normalized = text.lower()
    results = []
    for name, terms in skill_terms.items():
        matches = sum(len(re.findall(term, normalized)) for term in terms)
        if matches:
            results.append({"name": name, "score": min(100, 35 + matches * 13)})
    return sorted(results, key=lambda item: item["score"], reverse=True)


def analyze_ats(text, skills):
    normalized = text.lower()
    words = re.findall(r"[a-zA-Z0-9+#./-]+", text)
    checks = []
    score = 0
    contact_ok = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)) and bool(re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", text))
    checks.append({"label": "Contact information", "passed": contact_ok})
    score += 15 if contact_ok else 0
    sections = {
        "Professional summary": ["summary", "profile", "objective"],
        "Experience": ["experience", "employment", "work history"],
        "Education": ["education", "academic", "university", "college"],
        "Skills": ["skills", "technical skills", "technologies"],
        "Projects": ["projects", "project experience"]
    }
    for label, terms in sections.items():
        passed = any(term in normalized for term in terms)
        checks.append({"label": label, "passed": passed})
        score += 6 if passed else 0
    action_verbs = ["built", "created", "developed", "designed", "implemented", "led", "improved", "reduced", "increased", "automated", "managed"]
    action_count = sum(normalized.count(verb) for verb in action_verbs)
    has_metrics = bool(re.search(r"\b\d+(?:\.\d+)?\s*(?:%|years?|months?|users?|ms|seconds?|hours?|projects?| team|k\+|m\+)?\b", normalized))
    length_ok = 300 <= len(words) <= 1000
    checks.extend([
        {"label": "Action-oriented bullet points", "passed": action_count >= 3},
        {"label": "Measurable achievements", "passed": has_metrics},
        {"label": "ATS-friendly length", "passed": length_ok}
    ])
    score += min(10, action_count * 2) + (15 if has_metrics else 0) + (10 if length_ok else 0) + (10 if skills else 0)
    suggestions = []
    if not contact_ok:
        suggestions.append("Add a professional email address and phone number at the top.")
    for check in checks[1:6]:
        if not check["passed"]:
            suggestions.append(f"Add a clear {check['label'].lower()} section.")
    if action_count < 3:
        suggestions.append("Start bullet points with strong action verbs such as built, improved, led, or automated.")
    if not has_metrics:
        suggestions.append("Add measurable outcomes, such as percentages, time saved, users served, or project scale.")
    if not length_ok:
        suggestions.append("Keep the resume between 300 and 1,000 words for reliable ATS parsing.")
    if not skills:
        suggestions.append("Add a dedicated skills section with keywords matching the jobs you want.")
    return {"score": min(100, score), "ready": score >= 85 and contact_ok and not suggestions, "checks": checks, "suggestions": suggestions}


class AppHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Session-Token, X-Admin-Token")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def session_user(self):
        token = self.headers.get("X-Session-Token")
        if not token:
            return None
        db = connection()
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT users.* FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.token = %s",
                (token,),
            )
            return cursor.fetchone()
        finally:
            cursor.close()
            db.close()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Session-Token, X-Admin-Token")
        self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            if path == "/api/resume":
                self.analyze_resume()
                return
            if path == "/api/proctor/analyze":
                self.analyze_proctor_frame(self.read_json())
                return
            data = self.read_json()
            if path == "/api/admin/login":
                self.admin_login(data)
            elif path == "/api/register":
                self.register(data)
            elif path == "/api/login":
                self.login(data)
            elif path == "/api/logout":
                self.logout()
            elif path == "/api/interviews":
                self.create_interview(data)
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "Endpoint not found"})
        except (ValueError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid request"})
        except MySQLError as error:
            print(f"MySQL error: {error}")
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Database error"})
        except Exception as error:
            print(f"API error: {error}")
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Server error"})

    def analyze_resume(self):
        content_type = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        message = BytesParser(policy=default).parsebytes(
            f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + body
        )
        upload = next((part for part in message.iter_attachments() if part.get_filename()), None)
        if upload is None:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Please attach a resume file"})
            return
        filename = upload.get_filename()
        content = upload.get_payload(decode=True) or b""
        if len(content) > 5 * 1024 * 1024:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Resume must be 5MB or smaller"})
            return
        try:
            text = extract_resume_text(filename, content)
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        if not looks_like_resume(text):
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": "Uploaded file is not a valid resume. Please upload a resume with contact information and sections such as Experience, Education, and Skills."
            })
            return
        skills = analyze_skills(text)
        self.send_json(HTTPStatus.OK, {"filename": filename, "text": text, "skills": skills, "ats": analyze_ats(text, skills)})

    def analyze_proctor_frame(self, data):
        if cv2 is None or np is None:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "AI proctoring is not installed. Run: pip install opencv-python"})
            return
        image_data = str(data.get("image", ""))
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        if not image_data:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "A valid camera frame is required"})
            return
        try:
            image_bytes = base64.b64decode(image_data)
            if not image_bytes:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "A valid camera frame is required"})
                return
            image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        except (ValueError, TypeError, binascii.Error, cv2.error):
            image = None
        if image is None:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "A valid camera frame is required"})
            return
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        cascade_constructor = cv2.CascadeClassifier
        cascade = cascade_constructor(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        face_count = len(faces)
        safe = face_count == 1
        self.send_json(HTTPStatus.OK, {"safe": safe, "face_count": face_count, "face_visible": face_count > 0, "message": "One face detected" if safe else ("No face detected" if face_count == 0 else "Only one face is allowed")})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/admin/data":
            self.admin_data()
            return
        if path == "/api/me":
            user = self.session_user()
            if not user:
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Not signed in"})
            else:
                self.send_json(HTTPStatus.OK, {"user": public_user(user)})
            return
        if path == "/api/interviews":
            user = self.session_user()
            if not user:
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Not signed in"})
                return
            db = connection()
            cursor = db.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT id, company, round_name AS `round`, industry, difficulty, score, xp, duration, created_at FROM interviews WHERE user_id = %s ORDER BY id DESC",
                    (user["id"],),
                )
                rows = cursor.fetchall()
            finally:
                cursor.close(); db.close()
            self.send_json(HTTPStatus.OK, {"interviews": rows})
            return
        super().do_GET()

    def admin_login(self, data):
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if not hmac.compare_digest(email, ADMIN_EMAIL) or not hmac.compare_digest(password, ADMIN_PASSWORD):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Invalid admin credentials"})
            return
        token = secrets.token_urlsafe(32)
        ADMIN_TOKENS.add(token)
        self.send_json(HTTPStatus.OK, {"token": token, "admin": {"email": ADMIN_EMAIL}})

    def admin_data(self):
        if self.headers.get("X-Admin-Token") not in ADMIN_TOKENS:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Admin authentication required"})
            return
        db = connection()
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT u.id, u.name, u.email, u.provider, u.created_at, COUNT(i.id) AS interviews, COALESCE(ROUND(AVG(i.score)), 0) AS average_score FROM users u LEFT JOIN interviews i ON i.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC"
            )
            users = cursor.fetchall()
            cursor.execute(
                "SELECT i.id, u.name AS student, u.email, i.company, i.round_name AS round, i.industry, i.difficulty, i.score, i.xp, i.duration, i.created_at FROM interviews i JOIN users u ON u.id = i.user_id ORDER BY i.created_at DESC"
            )
            interviews = cursor.fetchall()
            self.send_json(HTTPStatus.OK, {"users": users, "interviews": interviews})
        finally:
            cursor.close(); db.close()

    def register(self, data):
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if not name or not email or len(password) < 8:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Name, email, and an 8-character password are required"})
            return
        salt, digest = password_hash(password)
        db = connection()
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute(
                "INSERT INTO users (name, email, password_hash, password_salt) VALUES (%s, %s, %s, %s)",
                (name, email, digest, salt),
            )
            user_id = cursor.lastrowid
            token = secrets.token_urlsafe(32)
            cursor.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user_id))
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            self.send_json(HTTPStatus.CREATED, {"user": public_user(user), "token": token})
        except MySQLError as error:
            if "Duplicate entry" in str(error):
                self.send_json(HTTPStatus.CONFLICT, {"error": "An account with this email already exists. Please sign in instead."})
            else:
                raise
        finally:
            cursor.close(); db.close()

    def login(self, data):
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        db = connection()
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
            if not user:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "No account found with this email. Please register first."})
                return
            if user["provider"] != "email":
                self.send_json(HTTPStatus.CONFLICT, {"error": "This account was created with Google. Please continue with Google."})
                return
            if not password_matches(password, user["password_salt"], user["password_hash"]):
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Incorrect password. Please try again."})
                return
            token = secrets.token_urlsafe(32)
            cursor.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user["id"]))
            self.send_json(HTTPStatus.OK, {"user": public_user(user), "token": token})
        finally:
            cursor.close(); db.close()

    def logout(self):
        token = self.headers.get("X-Session-Token")
        if token:
            db = connection()
            cursor = db.cursor()
            try:
                cursor.execute("DELETE FROM sessions WHERE token = %s", (token,))
            finally:
                cursor.close(); db.close()
        self.send_json(HTTPStatus.OK, {"ok": True})

    def create_interview(self, data):
        user = self.session_user()
        if not user:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Not signed in"})
            return
        required = ["company", "round", "industry", "difficulty", "score", "xp"]
        if any(key not in data for key in required):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Interview details are incomplete"})
            return
        db = connection()
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute(
                "INSERT INTO interviews (user_id, company, round_name, industry, difficulty, score, xp, duration) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (user["id"], str(data["company"]), str(data["round"]), str(data["industry"]), str(data["difficulty"]), int(data["score"]), int(data["xp"]), str(data.get("duration", "18 min"))),
            )
            interview_id = cursor.lastrowid
            cursor.execute("SELECT * FROM interviews WHERE id = %s", (interview_id,))
            row = cursor.fetchone()
            self.send_json(HTTPStatus.CREATED, {"interview": row})
        finally:
            cursor.close(); db.close()


if __name__ == "__main__":
    initialize_database()
    print(f"InterviewAI running at http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), AppHandler).serve_forever()
