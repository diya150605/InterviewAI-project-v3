/* ---------- Nav ---------- */
const navToggle = document.getElementById("navToggle");
const mobileMenu = document.getElementById("mobileMenu");
navToggle.addEventListener("click", () => mobileMenu.classList.toggle("open"));
mobileMenu.querySelectorAll("a,button").forEach(el =>
  el.addEventListener("click", () => mobileMenu.classList.remove("open"))
);

/* ---------- FAQ ---------- */
document.querySelectorAll(".faq-item button").forEach(q =>
  q.addEventListener("click", () => q.parentElement.classList.toggle("open"))
);

/* ---------- App data ---------- */
const companies = ["Google","Microsoft","Amazon","Meta","Apple","TCS","Infosys","Wipro","Startup"];
const rounds = ["Technical","HR & Behavioral","DSA","System Design","Case Study"];
const industries = ["Technology","Finance","Healthcare","Marketing","Operations","Data Science"];
const difficulties = ["Easy","Medium","Hard"];
const questions = [
  "Design a URL shortener like bit.ly. Walk me through your system architecture.",
  "How would you handle 1 million concurrent users on a single service?",
  "Explain the CAP theorem with a real-world example.",
  "What is the difference between SQL and NoSQL databases? Which would you choose for a high-traffic social media platform?",
  "Describe your most challenging technical problem and how you solved it."
];
const flowSteps = ["setup","camera","session","results"];
const GOOGLE_CLIENT_ID = "191409163288-uq8ip7psjjvh53n9vjrrmacd4b3riv28.apps.googleusercontent.com";
let googleTokenClient = null;
const ADMIN_EMAIL = "admin@interviewai.com";
const ADMIN_PASSWORD = "admin@123";
const API_BASE = "http://127.0.0.1:8000/api";
const HISTORY = [
  { company:"Google", round:"Technical", score:88, date:"Today, 4:10 PM", duration:"18 min", cheats:0 },
  { company:"TCS", round:"HR & Behavioral", score:73, date:"Yesterday, 11:02 AM", duration:"14 min", cheats:1 },
  { company:"Microsoft", round:"DSA", score:91, date:"Mar 2", duration:"22 min", cheats:0 },
  { company:"Infosys", round:"Technical", score:58, date:"Feb 27", duration:"10 min", cheats:2 },
  { company:"Amazon", round:"System Design", score:80, date:"Feb 24", duration:"25 min", cheats:0 },
];
const BADGES = [
  { icon:"🔥", label:"7-Day Streak", earned:true },
  { icon:"🏆", label:"First 90+", earned:true },
  { icon:"🎯", label:"DSA Master", earned:true },
  { icon:"⭐", label:"Perfect Score", earned:false },
];
const MISSIONS = [
  { icon:"⚡", title:"Warm-up sprint", detail:"Complete one interview round", reward:120 },
  { icon:"🧠", title:"Think out loud", detail:"Use a hint-free answer", reward:80 },
  { icon:"🎯", title:"Beat your best", detail:"Score 85 or higher", reward:160 }
];

function scoreColor(s){ return s>=80 ? "var(--green)" : s>=60 ? "var(--warn)" : "var(--danger)"; }

/* ---------- App state ---------- */
const demo = document.getElementById("demo");
const demoShell = document.getElementById("demoShell");
const demoBody = document.getElementById("demoBody");

const app = {
  authed: false,
  pendingView: "home",
  view: "login",           // login | signup | admin-login | home | history | resume | profile | setup | camerastep | session | results
  company: "Google", round: "Technical", industry: "Technology", difficulty: "Medium", question: 0,
  historyFilter: "All", sessionScore: 88, sessionXp: 120, history: []
};
app.answer = "";
app.answerFeedback = null;
app.timerSeconds = 300;
app.timerId = null;
app.recognition = null;
app.isListening = false;
// Admin state (frontend demo only)
app.adminAuthenticated = false;
app.adminView = 'overview'; // overview | students | questions | companies | interviews | analytics | settings
app.adminUserName = 'Admin';

function syncUserNameFromStorage(){
  const storedUser = JSON.parse(localStorage.getItem('interviewaiUser') || '{}');
  if (storedUser && storedUser.name) {
    app.userName = storedUser.name;
  } else if (storedUser && storedUser.email) {
    app.userName = displayNameFromEmail(storedUser.email);
  } else {
    app.userName = app.userName || 'User';
  }
}

async function refreshUserNameFromSession(){
  const token = getSessionToken();
  if (!token) {
    syncUserNameFromStorage();
    return;
  }

  try {
    const payload = await authRequest('/me', null, 'GET');
    const currentUser = payload.user || {};
    if (currentUser.name) {
      app.userName = currentUser.name;
      const storedUser = JSON.parse(localStorage.getItem('interviewaiUser') || '{}');
      localStorage.setItem('interviewaiUser', JSON.stringify({ ...storedUser, ...currentUser }));
    }
  } catch (error) {
    syncUserNameFromStorage();
  }
}

function displayNameFromEmail(email){
  if(!email) return "User";
  const local = email.split("@")[0];
  const parts = local.replace(/[._\-]+/g,' ').split(' ').filter(Boolean);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}
function firstName(name){ return name ? name.split(' ')[0] : 'User'; }
function getDashboardStats(){
  const interviews = app.history;
  const scores = interviews.map(item => Number(item.score)).filter(Number.isFinite);
  const xp = interviews.reduce((total, item) => total + (Number(item.xp) || 0), 0);
  const dates = new Set(interviews.map(item => item.completedAt).filter(Boolean).map(value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-CA");
  }).filter(Boolean));
  const today = new Date();
  const todayKey = today.toLocaleDateString("en-CA");
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = yesterday.toLocaleDateString("en-CA");
  let streak = 0;
  if (dates.has(todayKey) || dates.has(yesterdayKey)) {
    const cursor = new Date(dates.has(todayKey) ? today : yesterday);
    while (dates.has(cursor.toLocaleDateString("en-CA"))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return {
    sessions: interviews.length,
    average: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0,
    best: scores.length ? Math.max(...scores) : 0,
    xp,
    streak
  };
}
function getProgress(){
  const xp = getDashboardStats().xp;
  const level = Math.floor(xp / 500) + 1;
  return {xp, level, current:xp % 500, next:500};
}

function getStoredUsers(){
  return JSON.parse(localStorage.getItem("interviewaiUsers") || "[]");
}

function saveStoredUsers(users){
  localStorage.setItem("interviewaiUsers", JSON.stringify(users));
}

function getSessionToken(){
  return localStorage.getItem("interviewaiSessionToken");
}

function saveSession(user, token){
  localStorage.setItem("interviewaiSessionToken", token);
  localStorage.setItem("interviewaiUser", JSON.stringify(user));
  app.userName = user.name || displayNameFromEmail(user.email);
  app.authed = true;
}

async function authRequest(path, body, method = "POST"){
  const headers = {"Content-Type":"application/json"};
  const token = getSessionToken();
  if (token) headers["X-Session-Token"] = token;
  const response = await fetch(`${API_BASE}${path}`, {method, headers, body: body ? JSON.stringify(body) : undefined});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Authentication request failed");
  return payload;
}

async function restoreSession(){
  if (!getSessionToken()) {
    app.authed = false;
    app.view = "login";
    render();
    return;
  }

  try {
    const payload = await authRequest("/me", null, "GET");
    saveSession(payload.user, getSessionToken());
    await loadInterviewHistory();
    app.view = "home";
    render();
  } catch {
    localStorage.removeItem("interviewaiSessionToken");
    app.authed = false;
    app.view = "login";
    render();
  }
}

async function loadInterviewHistory(){
  if (!getSessionToken()) return;
  try {
    const payload = await authRequest("/interviews", null, "GET");
    app.history = payload.interviews.map(item => ({
      company:item.company, round:item.round, score:item.score,
      xp:item.xp, completedAt:item.created_at,
      date:new Date(item.created_at.replace(" ", "T") + "Z").toLocaleString([], {month:"short", day:"numeric"}),
      duration:item.duration, cheats:0
    }));
  } catch {
    app.history = [];
  }
}

async function saveInterview(){
  try {
    await authRequest("/interviews", {
      company:app.company, round:app.round, industry:app.industry,
      difficulty:app.difficulty, score:app.sessionScore, xp:app.sessionXp
    });
    await loadInterviewHistory();
  } catch (error) {
    console.error("Could not save interview:", error);
  }
}

function historyData(){
  return app.history;
}

function evaluateAnswer(answer){
  const text = answer.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const concepts = ["scale", "cache", "database", "queue", "latency", "trade", "availability", "complexity", "api", "monitor"];
  const matched = concepts.filter(term => text.toLowerCase().includes(term));
  const score = Math.max(25, Math.min(96, 35 + Math.min(words, 70) * 0.45 + matched.length * 5));
  const rounded = Math.round(score);
  return {
    score: rounded,
    matched,
    message: words < 25 ? "Add more detail: explain your approach, trade-offs, and why you chose it." : matched.length >= 2 ? "Strong structure. You covered useful engineering concepts and trade-offs." : "Good start. Add scale, failure cases, or measurable trade-offs to strengthen the answer."
  };
}

function formatTimer(seconds){
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function stopInterviewTimer(){
  if (app.timerId) window.clearInterval(app.timerId);
  app.timerId = null;
}

function startInterviewTimer(){
  stopInterviewTimer();
  app.timerId = window.setInterval(() => {
    app.timerSeconds = Math.max(0, app.timerSeconds - 1);
    const timer = document.getElementById("sessionTimer");
    if (timer) {
      timer.textContent = formatTimer(app.timerSeconds);
      timer.classList.toggle("timer-warning", app.timerSeconds <= 60);
    }
    if (app.timerSeconds === 0) {
      stopInterviewTimer();
      const status = document.getElementById("voiceStatus");
      if (status) status.textContent = "Time is up. Submit your answer to continue.";
    }
  }, 1000);
}

function toggleSpeechRecognition(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = document.getElementById("micBtn");
  const status = document.getElementById("voiceStatus");
  const input = document.getElementById("answerInput");
  if (!SpeechRecognition || !button || !input) {
    if (status) status.textContent = "Voice typing is not supported in this browser.";
    return;
  }
  if (app.isListening && app.recognition) {
    app.recognition.stop();
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  let finalTranscript = app.answer ? `${app.answer} ` : "";
  recognition.onstart = () => {
    app.isListening = true;
    button.classList.add("listening");
    button.textContent = "■";
    if (status) status.textContent = "Listening... speak your answer";
  };
  recognition.onresult = event => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) finalTranscript += `${transcript} `;
      else interim += transcript;
    }
    input.value = `${finalTranscript}${interim}`.trim();
    input.dispatchEvent(new Event("input", {bubbles:true}));
  };
  recognition.onerror = () => { if (status) status.textContent = "Voice input stopped. You can continue typing."; };
  recognition.onend = () => {
    app.isListening = false;
    app.recognition = null;
    button.classList.remove("listening");
    button.textContent = "🎙";
    if (status && status.textContent.startsWith("Listening")) status.textContent = "Voice input ready";
  };
  app.recognition = recognition;
  recognition.start();
}

function rememberUser(user){
  const users = getStoredUsers();
  const existing = users.findIndex(item => item.email.toLowerCase() === user.email.toLowerCase());
  if (existing >= 0) users[existing] = {...users[existing], ...user};
  else users.push(user);
  saveStoredUsers(users);
}

function openApp(targetView, authMode = null){
  demo.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  if (authMode === "login" || authMode === "signup" || authMode === "admin-login") {
    app.view = authMode;
    app.pendingView = "home";
    render();
    return;
  }

  if (app.authed) {
    app.view = targetView || "home";
    app.pendingView = null;
    render();
    return;
  }

  const selectedMode = authMode || "login";
  app.view = selectedMode;
  app.pendingView = "home";
  render();
}
function closeApp(){
  stopInterviewTimer();
  if (app.recognition) app.recognition.stop();
  demo.classList.add("hidden");
  document.body.style.overflow = "";
}
document.querySelectorAll("[data-open-demo]").forEach(btn =>
  btn.addEventListener("click", () => openApp(btn.dataset.demoStep, btn.dataset.authMode || "signup"))
);
if (new URLSearchParams(window.location.search).get("admin") === "login") {
  openApp("home", "admin-login");
}
document.getElementById("demoClose").addEventListener("click", closeApp);
demo.addEventListener("click", e => { if (e.target === demo) closeApp(); });
app.view = "login";
restoreSession();

/* ---------- Shared bits ---------- */
function optionGrid(list, current, key){
  return `<div class="opt-grid">${list.map(v =>
    `<div class="option ${current===v?"active":""}" data-key="${key}" data-val="${v}">${v}</div>`
  ).join("")}</div>`;
}
function fieldBox(label, iconChar, placeholder, type, id){
  const autocomplete = "off";
  const fieldName = id === "authName" ? "name" : id;
  return `<div class="field"><label>${label}</label><div class="field-box"><span>${iconChar}</span>
    <input id="${id}" name="${fieldName}" autocomplete="${autocomplete}" type="${type}" placeholder="${placeholder}">
    ${type==="password" ? `<button type="button" id="${id}Toggle">👁</button>` : ""}
  </div></div>`;
}

function validateAuthInput(email, password, isSignup, name){
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address.");
    return false;
  }

  if (password.length < 8) {
    alert("Password must be at least 8 characters long.");
    return false;
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    alert("Password must contain both letters and numbers.");
    return false;
  }

  if (isSignup && !name.trim()) {
    alert("Please enter your full name.");
    return false;
  }

  return true;
}

function handleGoogleCredential(response){
  const payload = JSON.parse(atob(response.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  app.userName = payload.name || displayNameFromEmail(payload.email);
  app.authed = true;
  app.view = "home";
  app.pendingView = null;
  render();
}

async function handleGoogleToken(response){
  try {
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${response.access_token}` }
    });
    if (!profileResponse.ok) throw new Error("Unable to read Google profile");
    const profile = await profileResponse.json();
    rememberUser({
      name: profile.name || displayNameFromEmail(profile.email),
      email: profile.email,
      provider: "google"
    });
    await loadInterviewHistory();
    app.userName = profile.name || displayNameFromEmail(profile.email);
    app.authed = true;
    app.view = "home";
    app.pendingView = null;
    render();
  } catch (error) {
    alert("Google sign-in could not be completed. Please try again.");
  }
}

function renderGoogleButton(){
  const googleButton = document.getElementById("authGoogle");
  if (!googleButton) return;
  if (!window.google || !window.google.accounts) {
    googleButton.textContent = "Loading Google sign-in...";
    window.setTimeout(renderGoogleButton, 300);
    return;
  }
  googleButton.innerHTML = "";
  googleButton.className = "google-button-wrap";
  if (!window.google.accounts.oauth2) {
    googleButton.textContent = "Google sign-in is unavailable";
    return;
  }
  googleButton.innerHTML = '<span class="g-dot google-g">G</span>Continue with Google';
  googleButton.className = "auth-google";
  googleTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "openid email profile",
    callback: handleGoogleToken,
    error_callback: error => {
      const message = error.type === "popup_failed_to_open"
        ? "Google sign-in popup was blocked. Please allow popups for this site and try again."
        : "Google sign-in is not configured for this website origin. Add http://localhost:8000 in Google Cloud Console and try again.";
      googleButton.textContent = message;
      window.setTimeout(renderGoogleButton, 3500);
    }
  });
  googleButton.addEventListener("click", () => googleTokenClient.requestAccessToken({ prompt: "select_account" }));
}

/* ---------- Render dispatcher ---------- */
function render(){
  const isAuthView = app.view === "login" || app.view === "signup" || app.view === "admin-login";
  const appMode = (app.authed || app.adminAuthenticated) && !isAuthView;
  demo.classList.toggle("app-mode", appMode);
  demoShell.classList.toggle("auth-mode", isAuthView);
  demoShell.classList.toggle("app-mode", appMode);

  syncUserNameFromStorage();

  if (isAuthView) return renderAuth();
  // Admin portal takes precedence when admin is authenticated
  if (app.adminAuthenticated) return renderAdmin();
  if (["setup","camerastep","session","results"].includes(app.view)) return renderPractice();
  return renderDashboard();
}

/* ---------- Auth ---------- */
function renderAuth(){
  const isSignup = app.view === "signup";
  if (app.view === 'admin-login') return renderAdminLogin();
  demoBody.innerHTML = `
    <div class="auth-wrap">
      <h3>${isSignup ? "Create account" : "Welcome back"}</h3>
      <p class="muted">${isSignup ? "Start your interview prep journey." : "Sign in to continue practicing."}</p>
      <form id="authForm" autocomplete="off">
        ${isSignup ? fieldBox("Full name","👤","Arjun Patel","text","authName") : ""}
        ${fieldBox("Email","✉️","arjun@email.com","email","authEmail")}
        ${fieldBox("Password","🔒","••••••••","password","authPass")}
        <button type="submit" class="auth-submit" id="authSubmit">${isSignup ? "Create account" : "Sign in"}</button>
      </form>
      <div class="auth-switch">
        ${isSignup ? "Already have an account?" : "New here?"}
        <span id="authSwitch">${isSignup ? "Sign in" : "Create account"}</span>
      </div>
    </div>
  `;
  document.querySelectorAll("#authForm input").forEach(input => { input.value = ""; });
  const passToggle = document.getElementById("authPassToggle");
  if (passToggle) passToggle.addEventListener("click", () => {
    const inp = document.getElementById("authPass");
    inp.type = inp.type === "password" ? "text" : "password";
  });
  document.getElementById("authSwitch").addEventListener("click", () => { app.view = isSignup ? "login" : "signup"; render(); });
  const doLogin = async () => {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPass").value.trim();
    const name = isSignup ? document.getElementById("authName").value.trim() : "";

    if (!email || !password) {
      alert("Please fill in all required fields before continuing.");
      return;
    }

    if (!validateAuthInput(email, password, isSignup, name)) {
      return;
    }

    const submit = document.getElementById("authSubmit");
    submit.disabled = true;
    submit.textContent = isSignup ? "Creating account..." : "Signing in...";
    if (!isSignup && email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      try {
        const adminPayload = await authRequest("/admin/login", {email, password});
        localStorage.setItem("interviewaiAdminToken", adminPayload.token);
        localStorage.setItem("interviewaiAdminAuthenticated", "true");
        window.location.href = "admin.html";
      } catch (error) {
        alert(error.message);
        submit.disabled = false;
        submit.textContent = "Sign in";
      }
      return;
    }
    try {
      const payload = await authRequest(isSignup ? "/register" : "/login", isSignup ? {name, email, password} : {email, password});
      saveSession(payload.user, payload.token);
      await loadInterviewHistory();
    } catch (error) {
      alert(error.message);
      submit.disabled = false;
      submit.textContent = isSignup ? "Create account" : "Sign in";
      return;
    }

    app.view = "home";
    app.pendingView = null;
    window.location.href = "dashboard.html";
  };
  document.getElementById("authForm").addEventListener("submit", event => {
    event.preventDefault();
    doLogin();
  });
}

/* ---------- Admin auth (demo) ---------- */
function renderAdminLogin(){
  demoBody.innerHTML = `
    <div class="auth-wrap">
      <h3>Admin sign in</h3>
      <p class="muted">Sign in to access the Admin Portal.</p>
      ${fieldBox("Admin email","✉️","you@company.com","email","adminEmail")}
      ${fieldBox("Password","🔒","••••••••","password","adminPass")}
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="auth-submit" id="adminSubmit">Sign in</button>
        <button class="btn btn-ghost" id="adminBack">Back</button>
      </div>
    </div>
  `;
  const passToggle = document.getElementById("adminPassToggle");
  if (passToggle) passToggle.addEventListener("click", () => {
    const inp = document.getElementById('adminPass'); if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  document.getElementById("adminBack").addEventListener("click", () => { app.view = 'login'; render(); });
  document.getElementById("adminSubmit").addEventListener("click", () => {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPass').value.trim();
    if (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD){
      authRequest('/admin/login', {email, password: pass}).then(payload => {
        localStorage.setItem('interviewaiAdminToken', payload.token);
        localStorage.setItem('interviewaiAdminAuthenticated', 'true');
        window.location.href = 'admin.html';
      }).catch(error => alert(error.message));
    } else {
      alert('Invalid email or password.');
    }
  });
}

/* ---------- Admin shell & pages ---------- */
function renderAdmin(){
  demoBody.innerHTML = `
    <div class="app-layout">
      <div class="app-sidebar">
        <div class="side-link ${app.adminView==='overview'?'active':''}" data-admin="overview">🏠  Dashboard</div>
        <div class="side-link ${app.adminView==='students'?'active':''}" data-admin="students">👥  Students</div>
        <div class="side-link ${app.adminView==='questions'?'active':''}" data-admin="questions">❓  Questions</div>
        <div class="side-link ${app.adminView==='companies'?'active':''}" data-admin="companies">🏢  Companies</div>
        <div class="side-link ${app.adminView==='interviews'?'active':''}" data-admin="interviews">📋  Interviews</div>
        <div class="side-link ${app.adminView==='analytics'?'active':''}" data-admin="analytics">📈  Analytics</div>
        <div class="side-link ${app.adminView==='settings'?'active':''}" data-admin="settings">⚙️  Settings</div>
        <div class="side-link" id="adminLogoutBtn">⎋  Logout</div>
      </div>
      <div class="app-main" id="adminMain">
      </div>
    </div>
  `;
  demoBody.querySelectorAll('[data-admin]').forEach(el => el.addEventListener('click', () => { app.adminView = el.dataset.admin; render(); }));
  document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);
  const main = document.getElementById('adminMain');
  // topbar
  main.innerHTML = `<div class="admin-top"><div class="admin-title"><div class="logo"><span class="logo-mark">🧠</span><div><div style="font-weight:700">InterviewAI</div><div class="admin-badge">Admin Portal</div></div></div></div><div class="admin-profile"><div style="text-align:right"><div style="font-weight:700">${app.adminUserName}</div><div class="small-muted">Administrator</div></div><div class="dash-avatar">A</div></div></div>`;
  // page content
  const content = document.createElement('div');
  content.style.marginTop = '12px';
  if (app.adminView === 'overview') content.innerHTML = adminOverviewView();
  if (app.adminView === 'students') content.innerHTML = adminStudentsView();
  if (app.adminView === 'questions') content.innerHTML = adminQuestionsView();
  if (app.adminView === 'companies') content.innerHTML = adminCompaniesView();
  if (app.adminView === 'interviews') content.innerHTML = adminInterviewsView();
  if (app.adminView === 'analytics') content.innerHTML = adminAnalyticsView();
  if (app.adminView === 'settings') content.innerHTML = adminSettingsView();
  main.appendChild(content);

  // wire up interactive elements that were rendered
  wireAdminActions();
}

function adminLogout(){
  const ok = confirm('Sign out of admin portal?');
  if (!ok) return;
  app.adminAuthenticated = false; app.adminView = 'overview'; app.view = 'login'; render();
}

/* ---------- Demo admin data (derived from existing arrays) ---------- */
const demoStudents = [
  {id:1,name:'Arjun Patel',email:'arjun@example.com',interviews:24,avg:81,status:'Active'},
  {id:2,name:'Priya Singh',email:'priya@example.com',interviews:12,avg:72,status:'Active'},
  {id:3,name:'Samir Gupta',email:'samir@example.com',interviews:6,avg:63,status:'Disabled'},
];

let adminQuestions = questions.map((q,i)=>({id:i+1,text:q,company:companies[i%companies.length],round:rounds[i%rounds.length],difficulty:difficulties[i%difficulties.length]}));
// Add 2 additional admin panel questions
adminQuestions.push(
  {id:adminQuestions.length+1,text:"Explain the SOLID principles with examples from your coding experience.",company:"Google",round:"Technical",difficulty:"Hard"},
  {id:adminQuestions.length+2,text:"How do you approach debugging and optimization in production environments?",company:"Microsoft",round:"Technical",difficulty:"Hard"}
);

let demoInterviews = HISTORY.map((h,i)=>({id:i+1,student:demoStudents[i%demoStudents.length].name,company:h.company,round:h.round,difficulty:difficulties[i%difficulties.length],score:h.score,date:h.date,status:h.cheats>0? 'Flagged':'Complete'}));

/* ---------- Admin render helpers ---------- */
function adminOverviewView(){
  const totalStudents = demoStudents.length;
  const totalInterviews = demoInterviews.length;
  const avgScore = Math.round(demoInterviews.reduce((s,i)=>s+i.score,0)/Math.max(1,demoInterviews.length));
  const activeUsers = demoStudents.filter(s=>s.status==='Active').length;
  return `
    <div class="admin-stats">
      <div class="admin-stat"><b>${totalStudents}</b><small class="small-muted">Total Students</small></div>
      <div class="admin-stat"><b>${totalInterviews}</b><small class="small-muted">Total Interviews</small></div>
      <div class="admin-stat"><b style="color:var(--green)">${avgScore}%</b><small class="small-muted">Average Score</small></div>
      <div class="admin-stat"><b>${activeUsers}</b><small class="small-muted">Active Users</small></div>
    </div>
    <div class="dash-card"><b class="hd">Recent Interview Activity</b>
      <table class="table">
        <thead><tr><th>Student</th><th>Company</th><th>Round</th><th>Score</th><th>Date</th></tr></thead>
        <tbody>${demoInterviews.slice(0,6).map(r=>`<tr><td>${r.student}</td><td>${r.company}</td><td>${r.round}</td><td><span class="tag">${r.score}%</span></td><td class="small-muted">${r.date}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 380px;gap:12px;margin-top:12px">
      <div class="dash-card"><b class="hd">Recent Students</b>
        <table class="table"><thead><tr><th>Name</th><th>Email</th><th>Interviews</th></tr></thead><tbody>${demoStudents.map(s=>`<tr><td>${s.name}</td><td class="small-muted">${s.email}</td><td>${s.interviews}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="dash-card"><b class="hd">Top Performing Students</b>
        ${demoStudents.sort((a,b)=>b.avg-a.avg).slice(0,3).map(s=>`<div style="padding:8px 0"><b>${s.name}</b><div class="small-muted">Avg ${s.avg}% · ${s.interviews} interviews</div></div>`).join('')}
      </div>
    </div>
  `;
}

function adminStudentsView(){
  return `
    <div class="dash-card"><b class="hd">Manage students</b>
      <table class="table"><thead><tr><th>Student Name</th><th>Email</th><th>Total Interviews</th><th>Average Score</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${demoStudents.map(s=>`<tr data-id="${s.id}"><td>${s.name}</td><td class="small-muted">${s.email}</td><td>${s.interviews}</td><td><b style="color:${scoreColor(s.avg)}">${s.avg}%</b></td><td>${s.status}</td><td><button class="action-btn" data-act="view">View</button><button class="action-btn" data-act="edit">Edit</button><button class="action-btn" data-act="toggle">${s.status==='Active'?'Deactivate':'Activate'}</button></td></tr>`).join('')}</tbody></table>
    </div>
  `;
}

function adminQuestionsView(){
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b class="hd">Question management</b><div><button class="btn btn-ghost" id="importQuestions">Import</button><button class="btn btn-primary" id="addQuestion">Add Question</button></div></div>
    <div class="dash-card">
      <table class="table"><thead><tr><th>Question</th><th>Company</th><th>Round</th><th>Difficulty</th><th>Actions</th></tr></thead>
      <tbody>${adminQuestions.map(q=>`<tr data-id="${q.id}"><td style="max-width:420px">${q.text}</td><td>${q.company}</td><td>${q.round}</td><td>${q.difficulty}</td><td><button class="action-btn" data-act="edit">Edit</button><button class="action-btn" data-act="del">Delete</button></td></tr>`).join('')}</tbody></table>
    </div>
    <div id="adminModal" class="hidden"></div>
  `;
}

function adminCompaniesView(){
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b class="hd">Companies</b><div><button class="btn btn-primary" id="addCompany">Add Company</button></div></div>
    <div class="dash-card">
      <table class="table"><thead><tr><th>Company</th><th>Actions</th></tr></thead>
      <tbody>${companies.map((c,i)=>`<tr data-id="${i}"><td>${c}</td><td><button class="action-btn" data-act="edit">Edit</button><button class="action-btn" data-act="del">Delete</button></td></tr>`).join('')}</tbody></table>
    </div>
  `;
}

function adminInterviewsView(){
  return `
    <div class="dash-card"><b class="hd">Interviews</b>
      <table class="table"><thead><tr><th>Student</th><th>Company</th><th>Round</th><th>Difficulty</th><th>Score</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>${demoInterviews.map(i=>`<tr><td>${i.student}</td><td>${i.company}</td><td>${i.round}</td><td>${i.difficulty}</td><td><span class="tag">${i.score}%</span></td><td class="small-muted">${i.date}</td><td>${i.status}</td></tr>`).join('')}</tbody></table>
    </div>
  `;
}

function adminAnalyticsView(){
  const total = demoInterviews.length;
  const avg = Math.round(demoInterviews.reduce((s,i)=>s+i.score,0)/Math.max(1,total));
  const tech = demoInterviews.filter(i=>i.round==='Technical').length;
  const hr = demoInterviews.filter(i=>i.round==='HR & Behavioral').length;
  const dsa = demoInterviews.filter(i=>i.round==='DSA').length;
  const most = Object.entries(demoInterviews.reduce((acc,i)=>{acc[i.company]=(acc[i.company]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1])[0]||['N/A',0];
  return `
    <div style="display:flex;gap:12px;margin-bottom:12px">
      <div class="dash-card" style="flex:1"><b class="hd">Total Interviews</b><div style="font-size:26px;margin-top:10px">${total}</div></div>
      <div class="dash-card" style="width:220px"><b class="hd">Average Score</b><div style="font-size:26px;margin-top:10px;color:var(--green)">${avg}%</div></div>
      <div class="dash-card" style="width:220px"><b class="hd">Most Selected</b><div style="font-size:18px;margin-top:10px">${most[0]} · ${most[1]}</div></div>
    </div>
    <div style="display:flex;gap:12px">
      <div class="dash-card" style="flex:1"><b class="hd">Interview Types</b>
        <div style="display:flex;gap:8px;margin-top:12px"><div style="flex:1"><div class="small-muted">Technical</div><div style="height:10px;background:var(--border);border-radius:6px;margin-top:6px"><div style="width:${Math.round((tech/total)*100)}%;height:100%;background:var(--grad);border-radius:6px"></div></div></div>
        <div style="flex:1"><div class="small-muted">HR</div><div style="height:10px;background:var(--border);border-radius:6px;margin-top:6px"><div style="width:${Math.round((hr/total)*100)}%;height:100%;background:var(--accent);border-radius:6px"></div></div></div>
        <div style="flex:1"><div class="small-muted">DSA</div><div style="height:10px;background:var(--border);border-radius:6px;margin-top:6px"><div style="width:${Math.round((dsa/total)*100)}%;height:100%;background:var(--blue);border-radius:6px"></div></div></div></div>
      </div>
      <div class="dash-card" style="width:320px"><b class="hd">Scores distribution</b>
        ${[90,80,70,60,50].map(s=>`<div style="display:flex;justify-content:space-between;margin-top:8px"><div class="small-muted">≥ ${s}%</div><div style="width:60%"><div style="height:8px;background:var(--border);border-radius:6px"><div style="width:${Math.round((demoInterviews.filter(i=>i.score>=s).length/total)*100)}%;height:100%;background:var(--grad);border-radius:6px"></div></div></div></div>`).join('')}
      </div>
    </div>
  `;
}

function adminSettingsView(){
  return `
    <div class="dash-card"><b class="hd">Admin settings</b>
      <div style="max-width:520px"><div class="field"><label>Admin name</label><div class="field-box"><input id="adminName" value="${app.adminUserName}"></div></div>
      <div class="field"><label>Admin email</label><div class="field-box"><input id="adminEmailSet" value="${ADMIN_EMAIL}" type="email"></div></div>
      <div class="field"><label>Change password</label><div class="field-box"><input id="adminPassSet" type="password" placeholder="••••••••"><button id="adminPassSetToggle">👁</button></div></div>
      <div style="display:flex;gap:10px;margin-top:12px"><button class="btn btn-primary" id="saveAdminSettings">Save changes</button><button class="btn btn-ghost" id="adminSignOut">Logout</button></div></div>
    </div>
  `;
}

function wireAdminActions(){
  // Students actions
  document.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', e => {
    const act = btn.dataset.act; const tr = btn.closest('tr'); if (!tr) return; const id = tr.dataset.id;
    if (act === 'toggle') {
      const st = demoStudents.find(s=>String(s.id)===String(id)); if (!st) return; st.status = st.status==='Active'?'Disabled':'Active'; render();
    }
    if (act === 'edit') { alert('Edit action (demo)'); }
    if (act === 'view') { alert('View student (demo)'); }
    if (act === 'del') {
      // delete question or company
      if (tr.parentElement && tr.parentElement.parentElement && tr.parentElement.parentElement.querySelector('th') && tr.parentElement.parentElement.querySelector('th').textContent.includes('Company')){
        const idx = Array.from(tr.parentElement.children).indexOf(tr); companies.splice(idx,1); render();
      } else {
        const qid = Number(tr.dataset.id); adminQuestions = adminQuestions.filter(q=>q.id!==qid); render();
      }
    }
  }));

  // Add question
  const addQ = document.getElementById('addQuestion'); if (addQ) addQ.addEventListener('click', () => openQuestionModal());
  const addC = document.getElementById('addCompany'); if (addC) addC.addEventListener('click', () => {
    const name = prompt('New company name'); if (!name) return; companies.push(name); render();
  });
  const importBtn = document.getElementById('importQuestions'); if (importBtn) importBtn.addEventListener('click', ()=>alert('Import not available in demo'));

  // Admin modal handlers
  const modal = document.getElementById('adminModal'); if (modal && !modal._bound){ modal._bound = true; modal.addEventListener('click', e => { if (e.target.classList.contains('modal-cancel')) modal.classList.add('hidden'); }); }

  const saveBtn = document.getElementById('saveAdminSettings'); if (saveBtn) saveBtn.addEventListener('click', ()=>{ app.adminUserName = document.getElementById('adminName').value||app.adminUserName; alert('Settings saved (demo)'); render(); });
  const signOut = document.getElementById('adminSignOut'); if (signOut) signOut.addEventListener('click', adminLogout);
}

function openQuestionModal(editId){
  const modal = document.getElementById('adminModal'); if (!modal) return;
  const q = editId ? adminQuestions.find(x=>x.id===editId) : {text:'',company:companies[0]||'',round:rounds[0]||'',difficulty:difficulties[1]||''};
  modal.innerHTML = `<div style="position:fixed;inset:0;display:grid;place-items:center;z-index:120"><div style="width:640px;background:var(--void);border:1px solid var(--border);padding:20px;border-radius:12px"><h3>${editId?'Edit':'Add'} question</h3><div class="field"><label>Question</label><div class="field-box"><input id="qText" value="${q.text}"></div></div><div class="field"><label>Company</label><div class="field-box"><select id="qCompany">${companies.map(c=>`<option${c===q.company?' selected':''}>${c}</option>`).join('')}</select></div></div><div class="field"><label>Round</label><div class="field-box"><select id="qRound">${rounds.map(r=>`<option${r===q.round?' selected':''}>${r}</option>`).join('')}</select></div></div><div class="field"><label>Difficulty</label><div class="field-box"><select id="qDiff">${difficulties.map(d=>`<option${d===q.difficulty?' selected':''}>${d}</option>`).join('')}</select></div></div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-primary" id="qSave">${editId?'Save':'Add'} question</button><button class="btn btn-ghost modal-cancel">Cancel</button></div></div></div>`;
  modal.classList.remove('hidden');
  document.getElementById('qSave').addEventListener('click', ()=>{
    const txt = document.getElementById('qText').value.trim(); const comp = document.getElementById('qCompany').value; const rnd = document.getElementById('qRound').value; const diff = document.getElementById('qDiff').value;
    if (!txt){ alert('Please enter a question'); return; }
    if (editId){ const qq = adminQuestions.find(x=>x.id===editId); qq.text=txt;qq.company=comp;qq.round=rnd;qq.difficulty=diff; }
    else { adminQuestions.push({id:(adminQuestions.length?Math.max(...adminQuestions.map(q=>q.id))+1:1),text:txt,company:comp,round:rnd,difficulty:diff}); }
    modal.classList.add('hidden'); render();
  });
}


/* ---------- Dashboard shell (sidebar + main, desktop pattern) ---------- */
async function renderDashboard(){
  await refreshUserNameFromSession();

  const links = [
    { key:"home", label:"⌂  Home" },
    { key:"history", label:"◷  History" },
    { key:"resume", label:"▣  Resume" },
    { key:"profile", label:"◉  Profile" },
  ];
  demoBody.innerHTML = `
    <div class="app-layout">
      <div class="app-sidebar">
        ${links.map(l => `<div class="side-link ${app.view===l.key?"active":""}" data-nav="${l.key}">${l.label}</div>`).join("")}
        <div class="side-practice" id="sidePractice">🎙 Start mock interview</div>
        <div class="side-user" id="sideUser">
          <div class="dash-avatar">${app.userName ? app.userName.charAt(0).toUpperCase() : 'A'}</div>
          <div><b>${app.userName || 'User'}</b><small>Log out</small></div>
        </div>
      </div>
      <div class="app-main" id="appMain"></div>
    </div>
  `;
  demoBody.querySelectorAll("[data-nav]").forEach(el =>
    el.addEventListener("click", () => { app.view = el.dataset.nav; render(); })
  );
  document.getElementById("sidePractice").addEventListener("click", () => { app.view = "setup"; app.question = 0; render(); });
  document.getElementById("sideUser").addEventListener("click", () => {
    const shouldLogout = window.confirm("Are you sure you want to log out?");
    if (shouldLogout) {
      authRequest("/logout").catch(() => {});
      localStorage.removeItem("interviewaiSessionToken");
      app.authed = false;
      app.view = "login";
      render();
    }
  });

  const main = document.getElementById("appMain");
  if (app.view === "home") main.innerHTML = homeView();
  if (app.view === "history") main.innerHTML = historyView();
  if (app.view === "resume") main.innerHTML = resumeView();
  if (app.view === "profile") main.innerHTML = profileView();
  const missionStart = document.getElementById("missionStart");
  if (missionStart) missionStart.addEventListener("click", () => { app.view = "setup"; app.question = 0; render(); });

  if (app.view === "history") {
    demoBody.querySelectorAll("[data-filter]").forEach(el =>
      el.addEventListener("click", () => { app.historyFilter = el.dataset.filter; render(); })
    );
  }
  if (app.view === "resume") {
    const uploadButton = document.getElementById("uploadBtn");
    const uploadFile = document.getElementById("uploadFile");
    const uploadStatus = document.getElementById("uploadStatus");
    if (uploadButton && uploadFile) {
      uploadButton.addEventListener("click", () => uploadFile.click());
      uploadFile.addEventListener("change", () => {
        const file = uploadFile.files[0];
        if (!file) return;
        if (!/\.pdf$|\.docx$/i.test(file.name)) {
          uploadStatus.textContent = "Please upload a PDF or DOCX resume.";
          uploadFile.value = "";
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          uploadStatus.textContent = "Please choose a file smaller than 5MB.";
          uploadFile.value = "";
          return;
        }
        uploadStatus.textContent = `${file.name} selected. Only files that contain resume information can be analyzed.`;
      });
    }
  }
}

function homeView(){
  const stats = getDashboardStats();
  const progress = getProgress();
  const mission = MISSIONS[0];
  const currentUserName = app.userName || JSON.parse(localStorage.getItem('interviewaiUser') || '{}').name || 'User';
  const streakLabel = stats.streak === 1 ? "1-day streak" : `${stats.streak}-day streak`;
  const streakMessage = stats.streak ? "Keep practicing daily to extend it." : "Complete an interview today to start your streak.";
  return `
    <div class="app-main-head"><div><div class="eyebrow app-eyebrow">Your training base</div><h3>Good morning, ${firstName(currentUserName)} 👋</h3><div class="muted">One focused round today beats ten rushed ones.</div></div><div class="level-pill"><span>LVL ${progress.level}</span><b>${progress.xp} XP</b></div></div>
    <div class="xp-card">
      <div class="xp-card-top"><div><b>Interview readiness</b><small>${progress.current} / ${progress.next} XP to level ${progress.level + 1}</small></div><strong>${Math.round(progress.current / progress.next * 100)}%</strong></div>
      <div class="xp-track"><i style="width:${Math.max(4, Math.round(progress.current / progress.next * 100))}%"></i></div>
    </div>
    <div class="dash-card" style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#ffa50220,#ff6b9d10);border-color:#ffa50250">
      <span style="font-size:22px">🔥</span>
      <div><b style="display:block">${streakLabel}</b><small class="muted">${streakMessage}</small></div>
      <strong style="margin-left:auto;color:var(--warn);font:700 20px 'Space Grotesk'">${stats.streak}</strong>
    </div>
    <div class="mission-card"><div class="mission-icon">${mission.icon}</div><div><small>DAILY MISSION · +${mission.reward} XP</small><b>${mission.title}</b><span>${mission.detail}</span></div><button class="mission-action" id="missionStart">Play →</button></div>
    <div style="display:flex;gap:12px;margin:16px 0">
      <div class="dash-stat" style="flex:1"><b>${stats.sessions}</b><small>SESSIONS</small></div>
      <div class="dash-stat" style="flex:1"><b style="color:var(--green)">${stats.average}%</b><small>AVG SCORE</small></div>
      <div class="dash-stat" style="flex:1"><b style="color:var(--blue)">${stats.best}%</b><small>BEST</small></div>
    </div>
    <div class="dash-card"><b class="hd">Focus areas</b>
      <div class="dash-focus-row"><div><b>System Design</b><small>Practice architecture diagrams</small></div><strong>62%</strong></div>
      <div class="dash-focus-row"><div><b>Time Complexity</b><small>Review Big-O for sorting</small></div><strong>58%</strong></div>
      <div class="dash-focus-row"><div><b>Behavioral STAR</b><small>Structure answers with STAR method</small></div><strong>71%</strong></div>
    </div>
    <div class="dash-card"><b class="hd">Recent sessions</b>
      ${historyData().slice(0,3).map(h => `<div class="hist-row"><div class="hist-left"><div class="hist-ic">🏢</div><div><b>${h.company} · ${h.round}</b><small>${h.date}</small></div></div><span class="score-badge" style="background:${scoreColor(h.score)}22;color:${scoreColor(h.score)}">${h.score}%</span></div>`).join("")}
    </div>
  `;
}

function historyView(){
  const filters = ["All","Technical","DSA","HR & Behavioral"];
  const records = historyData();
  const rows = records.filter(h => app.historyFilter==="All" || h.round===app.historyFilter);
  const today = new Date();
  const week = Array.from({length:7}, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toLocaleDateString("en-CA");
    const scores = records.filter(item => item.completedAt && new Date(item.completedAt).toLocaleDateString("en-CA") === key).map(item => Number(item.score)).filter(Number.isFinite);
    return {score:scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0, label:date.toLocaleDateString([], {weekday:"short"}).slice(0,1)};
  });
  return `
    <div class="app-main-head"><div><h3>Session history</h3><div class="muted">${records.length} sessions completed</div></div></div>
    <div class="chip-row" style="margin-bottom:18px">${filters.map(f => `<span class="chip-sm ${app.historyFilter===f?"active":""}" data-filter="${f}">${f}</span>`).join("")}</div>
    <div class="weekly-chart dash-card">
      <b class="hd">This week's scores</b>
      <div class="chart-bars">${week.map(day => `<div class="chart-column"><div class="chart-bar ${day.score?"filled":"empty"}" style="height:${day.score?Math.max(14,day.score*.7):6}px"></div><small>${day.label}</small></div>`).join("")}</div>
    </div>
    <div class="dash-card">
      ${rows.map(h => `<div class="hist-row"><div class="hist-left"><div class="hist-ic">🏢</div><div><b>${h.company} · ${h.round}</b><small>${h.date} · ${h.duration}${h.cheats>0 ? ` · <span style="color:var(--danger)">⚠ ${h.cheats} flag${h.cheats>1?"s":""}</span>`:""}</small></div></div><span class="score-badge" style="background:${scoreColor(h.score)}22;color:${scoreColor(h.score)}">${h.score}%</span></div>`).join("")}
    </div>
  `;
}

function resumeView(){
  return `
    <div class="app-main-head"><div><h3>Resume analyzer</h3><div class="muted">Upload your CV to get personalized interview questions.</div></div></div>
    <div class="dash-card" style="text-align:center;padding:38px 20px">
      <div style="font-size:42px;margin-bottom:10px">📄</div>
      <b>Drop your resume here</b>
      <p class="muted" style="margin-top:6px">PDF or DOCX · Max 5MB</p>
      <input id="uploadFile" type="file" accept=".pdf,.docx" hidden>
      <button class="btn btn-ghost" style="margin-top:14px" id="uploadBtn">Upload resume</button>
      <small id="uploadStatus" class="muted"></small>
    </div>
    <div class="dash-card"><b class="hd">Skills detected</b><p class="muted">Upload your resume to analyze your skills.</p></div>
  `;
}

function profileView(){
  const stats = getDashboardStats();
  const roundStats = rounds.map(round => {
    const records = app.history.filter(item => item.round === round);
    const scores = records.map(item => Number(item.score)).filter(Number.isFinite);
    return {r:round, a:scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0, s:records.length};
  }).filter(item => item.s);
  return `
    <div class="profile-header"><div class="profile-avatar">${(app.userName || 'A').charAt(0).toUpperCase()}</div><div><h3>${app.userName || 'Arjun Patel'}</h3><div class="muted">Engineering student · Placement prep</div></div><button class="profile-settings" aria-label="Profile settings">⚙</button></div>
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div class="dash-stat" style="flex:1"><b>${stats.sessions}</b><small>SESSIONS</small></div>
      <div class="dash-stat" style="flex:1"><b>${stats.average}%</b><small>AVG SCORE</small></div>
      <div class="dash-stat" style="flex:1"><b>${stats.streak}d</b><small>STREAK</small></div>
    </div>
    <b class="hd profile-section-title" style="display:block;margin-bottom:10px">Badges</b>
    <div class="badge-row" style="margin-bottom:20px">
      ${BADGES.map(b => `<div class="badge ${b.earned?"earned":"dim"}"><div class="ic">${b.icon}</div><span>${b.label}</span></div>`).join("")}
    </div>
    <div class="dash-card"><b class="hd">Performance by round</b>
      ${roundStats
        .map(x => `<div class="hist-row"><span style="flex:1;font-size:12.5px;color:var(--muted)">${x.r}</span><span style="font-size:10.5px;color:var(--faint);margin-right:12px">${x.s} sessions</span><span class="score-badge" style="background:${scoreColor(x.a)}22;color:${scoreColor(x.a)}">${x.a}%</span></div>`).join("")}
      ${roundStats.length ? "" : `<p class="muted">Complete an interview to see performance by round.</p>`}
    </div>
    <div class="dash-card">
      <b class="hd">Settings</b>
      <div class="settings-row"><span>🔔</span><span class="grow">Notifications</span><span class="muted">›</span></div>
      <div class="settings-row"><span>💼</span><span class="grow">Target companies</span><span class="muted">›</span></div>
      <div class="settings-row"><span>🛡</span><span class="grow">Privacy & data</span><span class="muted">›</span></div>
      <div class="settings-row"><span>🌙</span><span class="grow">Dark mode</span><div class="toggle-on"></div></div>
    </div>
  `;
}

/* ---------- Practice flow (setup -> camera -> session -> results) ---------- */
function renderPractice(){
  const stepKey = app.view === "camerastep" ? "camera" : app.view;
  const idx = flowSteps.indexOf(stepKey);
  const dots = flowSteps.map((s,i) => `<span class="demo-step-dot ${i<=idx?"done":""}"></span>`).join("");

  let content = "", footer = "";

  if (app.view === "setup") {
    content = `
      <h3>Set up your session</h3>
      <p class="muted">Choose your target company, round and difficulty — or use your resume instead.</p>
      <div class="opt-block"><div class="opt-label">Target company</div>${optionGrid(companies, app.company, "company")}</div>
      <div class="opt-block"><div class="opt-label">Interview round</div>${optionGrid(rounds, app.round, "round")}</div>
      <div class="opt-block"><div class="opt-label">Industries</div>${optionGrid(industries, app.industry, "industry")}</div>
      <div class="opt-block"><div class="opt-label">Difficulty</div>${optionGrid(difficulties, app.difficulty, "difficulty")}</div>
    `;
    footer = `<button class="btn btn-ghost" id="backHome">← Back to dashboard</button><button class="btn btn-primary" id="toCamera">Continue →</button>`;
  }
  else if (app.view === "camerastep") {
    content = `
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:50px;margin-bottom:14px">📷</div>
        <h3>Camera access needed</h3>
        <p class="muted" style="max-width:440px;margin:8px auto 22px">This interview requires your camera to simulate a face-to-face session and monitor integrity.</p>
        <div class="dash-card" style="text-align:left;max-width:420px;margin:0 auto">
          <p style="padding:6px 0">🛡 Face must remain visible</p>
          <p style="padding:6px 0">🛡 No other faces in frame</p>
          <p style="padding:6px 0">🛡 Looking away may be flagged</p>
        </div>
      </div>
    `;
    footer = `<button class="btn btn-ghost" id="backSetup">← Back</button><button class="btn btn-primary" id="toSession">Enable camera & start →</button>`;
  }
  else if (app.view === "session") {
    const isLast = app.question === questions.length - 1;
    content = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-weight:700">${app.company} · ${app.round}</div>
          <div class="muted" style="font-size:13px">Question ${app.question+1} of ${questions.length}</div>
        </div>
        <div id="sessionTimer" class="session-timer">${formatTimer(app.timerSeconds)}</div>
      </div>
      <div class="question-progress"><span style="width:${((app.question + 1) / questions.length) * 100}%"></span></div>

      <div class="session-layout">
        <div class="question-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="display:flex;gap:12px;align-items:center">
              <div class="dash-avatar" style="width:44px;height:44px">🧠</div>
              <div>
                <div style="font-weight:700">AI Interviewer</div>
                <div class="muted" style="font-size:13px">Monitoring</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;color:var(--faint)">Round</span></div>
          </div>

          <div class="question-card" style="margin-bottom:14px;border-radius:12px;padding:18px;border:1px solid rgba(255,255,255,0.04);background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent)">
            <div style="font-size:16px;line-height:1.6;color:#edf0ff">${questions[app.question]}</div>
          </div>

          <div class="answer-composer">
            <div class="answer-composer-head"><label for="answerInput">Your answer</label><span id="answerCount">0 words</span></div>
            <textarea id="answerInput" placeholder="Think out loud. Explain your approach, trade-offs, and edge cases...">${app.answer}</textarea>
            <button class="btn btn-primary answer-submit" id="submitAnswer">Evaluate answer</button>
          </div>
          ${app.answerFeedback ? `<div class="answer-feedback"><div class="feedback-score" style="color:${scoreColor(app.answerFeedback.score)}">${app.answerFeedback.score}<small>/100</small></div><div><b>${app.answerFeedback.message}</b><small>${app.answerFeedback.matched.length ? `Concepts detected: ${app.answerFeedback.matched.join(", ")}` : "No core concepts detected yet."}</small></div></div>` : ""}

          <a href="#" class="hint-link" style="color:var(--muted);display:inline-block;margin-bottom:8px">Show hint</a>
          <div class="hint-box" style="margin-top:10px;padding:14px;border-radius:10px;background:var(--surfaceL);border:1px solid var(--border);color:var(--muted)">
            <div style="display:flex;gap:8px;align-items:flex-start"><div style="font-size:18px">💡</div><div>I would approach this by first identifying the core requirements, constraints and expected traffic patterns...</div></div>
          </div>

          <div style="text-align:center;margin-top:20px">
            <button class="mic" id="micBtn" title="Start voice typing" type="button" style="width:82px;height:82px;border-radius:999px;display:inline-grid;place-items:center;font-size:25px;">🎙</button>
            <div class="muted" id="voiceStatus" style="margin-top:10px">Voice input ready</div>
            <div style="margin-top:8px;color:var(--muted);font-size:12px">•••</div>
          </div>
        </div>

        <div class="session-camera">
          <div class="camera-panel">
            <div class="camera-header">
              <div class="monitoring-pill"><span class="dot"></span>Monitoring</div>
              <div class="you-pill"><div class="you-ic">👤</div><div class="you-text">You</div></div>
            </div>
            <div class="camera-label">CAMERA PREVIEW</div>
            <div class="camera-frame" style="margin-top:12px">
              <div class="camera-screen">
                <div class="camera-inner">
                  <div class="camera-visual"><div class="camera-avatar">👤</div></div>
                </div>
              </div>
            </div>
            <div class="camera-caption"><span class="shield">🛡</span><span>AI is monitoring your video and audio for a fair interview experience.</span></div>
          </div>
        </div>
      </div>
    `;
    footer = `<button class="btn btn-ghost" id="backCamera">← Back</button><button class="btn btn-primary" id="nextQ" ${app.answerFeedback ? "" : "disabled"}>${isLast ? "Finish & see results →" : "Next question →"}</button>`;
  }
  else if (app.view === "results") {
    const progress = getProgress();
    content = `
      <div class="results-kicker">ROUND CLEARED · +${app.sessionXp} XP</div><h3>Session complete</h3>
      <p class="muted" style="margin-bottom:6px">${app.company} · ${app.round}</p>
      <div class="score-ring"><div><strong>${app.sessionScore}</strong><small>/ 100</small></div></div>
      <div class="result-reward"><span>🏆</span><div><b>Strong momentum</b><small>You are ${progress.current} XP away from level ${progress.level + 1}.</small></div></div>
      <div class="demo-grid2">
        <div class="dash-card"><b class="hd">Score breakdown</b>
          <p style="display:flex;justify-content:space-between;font-size:13px">Technical depth <b>90%</b></p><div class="bar"><i style="width:90%"></i></div>
          <p style="display:flex;justify-content:space-between;font-size:13px">Communication <b>85%</b></p><div class="bar"><i style="width:85%"></i></div>
          <p style="display:flex;justify-content:space-between;font-size:13px">Problem solving <b>88%</b></p><div class="bar"><i style="width:88%"></i></div>
          <p style="display:flex;justify-content:space-between;font-size:13px">Confidence <b>82%</b></p><div class="bar"><i style="width:82%"></i></div>
        </div>
        <div class="dash-card"><b class="hd">✨ AI feedback</b><p class="muted">Strong explanation overall. Next time, mention partition tolerance and horizontal sharding strategies.</p></div>
      </div>
    `;
    footer = `<button class="btn btn-ghost" id="restart">Practice again</button><button class="btn btn-primary" id="toHome">Back to dashboard</button>`;
  }

  demoBody.innerHTML = `<div class="demo-steps">${dots}</div><div class="demo-content">${content}</div><div class="demo-footer-bar">${footer}</div>`;
  // add a class so CSS can apply session-specific styles inside the overlay
  if (app.view === 'session') demoBody.classList.add('session-view'); else demoBody.classList.remove('session-view');

  demoBody.querySelectorAll(".option").forEach(o => o.addEventListener("click", () => { app[o.dataset.key] = o.dataset.val; render(); }));
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
  const answerInput = document.getElementById("answerInput");
  if (answerInput) {
    const answerCount = document.getElementById("answerCount");
    const updateAnswer = () => {
      app.answer = answerInput.value;
      if (answerCount) answerCount.textContent = `${app.answer.trim() ? app.answer.trim().split(/\s+/).length : 0} words`;
    };
    answerInput.addEventListener("input", updateAnswer);
    updateAnswer();
  }
  on("submitAnswer", () => {
    if (!app.answer.trim()) return;
    app.answerFeedback = evaluateAnswer(app.answer);
    app.sessionScore = app.answerFeedback.score;
    render();
  });
  on("backHome", () => { app.view = "home"; render(); });
  on("toCamera", () => { app.view = "camerastep"; render(); });
  on("backSetup", () => { app.view = "setup"; render(); });
  on("toSession", () => { app.view = "session"; app.question = 0; app.answer = ""; app.answerFeedback = null; app.timerSeconds = 300; render(); startInterviewTimer(); });
  on("backCamera", () => { stopInterviewTimer(); app.view = "camerastep"; render(); });
  on("micBtn", toggleSpeechRecognition);

  // hint toggle
  document.querySelectorAll('.hint-link').forEach(h => h.addEventListener('click', e => {
    e.preventDefault();
    const box = h.nextElementSibling;
    if (!box) return;
    box.classList.toggle('open');
    h.textContent = box.classList.contains('open') ? 'Hide hint' : 'Show hint';
  }));
  on("nextQ", async () => {
    if (app.question === questions.length - 1) {
      stopInterviewTimer();
      app.sessionScore = Math.min(99, 82 + Math.floor(Math.random() * 13));
      await saveInterview();
      app.view = "results";
    } else {
      app.question++;
      app.answer = "";
      app.answerFeedback = null;
    }
    render();
  });
  on("restart", () => { app.view = "setup"; app.answer = ""; app.answerFeedback = null; render(); });
  on("toHome", () => { app.view = "home"; render(); });
}
