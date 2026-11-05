# InterviewAI

A browser-based AI interview practice experience with company tracks, mock interview rounds, XP progression, badges, and feedback.

## Run locally

Use Python 3.11 or newer:

```powershell
python main.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

The server uses MySQL. Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` before starting it. Passwords are stored with PBKDF2-SHA256 hashes and server-side session tokens.

## Authentication API

- `POST /api/register` with `{ "name", "email", "password" }`
- `POST /api/login` with `{ "email", "password" }`
- `POST /api/admin/login` with `{ "email", "password" }` for the admin portal
- `GET /api/admin/data` with `X-Admin-Token` to load real users and interview records
- `POST /api/logout` with `X-Session-Token`
- `GET /api/me` with `X-Session-Token`
- `POST /api/interviews` with `X-Session-Token` to save a completed round
- `GET /api/interviews` with `X-Session-Token` to load the signed-in user's history

Google OAuth still requires the Google OAuth client to allow the exact local origin you use, such as `http://127.0.0.1:8000`.

During a mock interview, the five-minute timer runs live. The microphone button uses the browser Speech Recognition API when supported and places the transcript into the answer editor; typing remains available in all browsers.
