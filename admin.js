const API_BASE = 'http://127.0.0.1:8000/api';
const content = document.getElementById('content');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const titles = {
  overview: ['Overview', 'A clear view of your real interview platform data.'],
  students: ['Students', 'Every registered user from the database.'],
  companies: ['Companies', 'Manage target company tracks.'],
  interviews: ['Interviews', 'Every completed test with its real date and score.'],
  analytics: ['Analytics', 'Track real platform performance and practice trends.'],
  settings: ['Settings', 'Manage the administrator workspace.'],
  'student-review': ['Candidate Review', 'Full student performance and interview summary.']
};
const rounds = ['Aptitude', 'Technical', 'HR & Behavioral', 'DSA', 'System Design', 'Case Study'];
const companySeeds = [
  { name: 'Google', questions: [
    { text: 'Explain how you would design a reliable API for a Technology product at Google.', round: 'Technical', difficulty: 'Medium' },
    { text: 'Tell me about a difficult team situation and how you handled it.', round: 'HR & Behavioral', difficulty: 'Medium' },
    { text: 'Explain how binary search works and when it cannot be used.', round: 'DSA', difficulty: 'Medium' },
    { text: 'Design a URL shortener and explain storage, scale, and availability decisions.', round: 'System Design', difficulty: 'Hard' },
    { text: 'A product has falling user engagement. How would you investigate the cause?', round: 'Case Study', difficulty: 'Medium' },
    { text: 'A train travels 180 km in 3 hours. What is its average speed?', round: 'Aptitude', difficulty: 'Easy' }
  ] },
  { name: 'Microsoft', questions: [
    { text: 'How would you secure authentication and session management for a production app?', round: 'Technical', difficulty: 'Hard' },
    { text: 'Describe a time you received critical feedback and what you changed afterward.', round: 'HR & Behavioral', difficulty: 'Medium' },
    { text: 'Explain how you would solve a two-sum problem and handle duplicate values.', round: 'DSA', difficulty: 'Medium' },
    { text: 'How would you scale a web application from thousands to millions of users?', round: 'System Design', difficulty: 'Hard' },
    { text: 'A service is slower after a release. Explain your investigation plan.', round: 'Case Study', difficulty: 'Medium' },
    { text: 'What is 15% of 240?', round: 'Aptitude', difficulty: 'Easy' }
  ] },
  { name: 'Amazon', questions: [
    { text: 'How would you handle retries without creating duplicate operations?', round: 'Technical', difficulty: 'Hard' },
    { text: 'Describe a time you had to prioritize competing deadlines.', round: 'HR & Behavioral', difficulty: 'Medium' },
    { text: 'How would you detect a cycle in a linked list?', round: 'DSA', difficulty: 'Medium' },
    { text: 'Design a notification system for a large user base.', round: 'System Design', difficulty: 'Hard' },
    { text: 'A company wants to reduce customer support costs. What data would you analyze?', round: 'Case Study', difficulty: 'Medium' },
    { text: 'If 5 workers finish a task in 12 days, how many days will 10 workers take at the same rate?', round: 'Aptitude', difficulty: 'Easy' }
  ] },
  { name: 'Meta', questions: [
    { text: 'What are the benefits and trade-offs of caching?', round: 'Technical', difficulty: 'Medium' },
    { text: 'Describe a disagreement with a teammate and how you reached a solution.', round: 'HR & Behavioral', difficulty: 'Medium' },
    { text: 'How would you find the longest substring without repeating characters?', round: 'DSA', difficulty: 'Hard' },
    { text: 'Design a chat system and explain message delivery and failure handling.', round: 'System Design', difficulty: 'Hard' },
    { text: 'A feature has high usage but low retention. How would you analyze it?', round: 'Case Study', difficulty: 'Medium' },
    { text: 'A product marked at 800 is sold at a 10% discount. What is the selling price?', round: 'Aptitude', difficulty: 'Easy' }
  ] },
  { name: 'Apple', questions: [
    { text: 'How would you validate and sanitize user input in an application?', round: 'Technical', difficulty: 'Medium' },
    { text: 'Describe a time you had to learn a new skill quickly.', round: 'HR & Behavioral', difficulty: 'Medium' },
    { text: 'How would you merge overlapping intervals efficiently?', round: 'DSA', difficulty: 'Hard' },
    { text: 'Design a file upload service with validation, storage, and secure downloads.', round: 'System Design', difficulty: 'Hard' },
    { text: 'How would you decide whether to launch a new feature with limited resources?', round: 'Case Study', difficulty: 'Medium' },
    { text: 'Find the next number: 3, 6, 12, 24, __.', round: 'Aptitude', difficulty: 'Easy' }
  ] },
  { name: 'TCS', questions: [
    { text: 'Explain transactions and isolation levels.', round: 'Technical', difficulty: 'Medium' },
    { text: 'How do you handle pressure during an important deadline?', round: 'HR & Behavioral', difficulty: 'Medium' },
    { text: 'When would you choose a hash map over sorting for a lookup problem?', round: 'DSA', difficulty: 'Medium' },
    { text: 'Design an interview platform that stores sessions and results reliably.', round: 'System Design', difficulty: 'Hard' },
    { text: 'A project is over budget and behind schedule. What actions would you recommend?', round: 'Case Study', difficulty: 'Medium' },
    { text: 'The ratio of boys to girls is 3:2. If there are 25 students, how many are boys?', round: 'Aptitude', difficulty: 'Easy' }
  ] }
];
const additionalPracticeQuestions = [
  { text: 'Describe normalization in relational databases and when denormalization helps.', round: 'Technical', difficulty: 'Medium' },
  { text: 'Tell me about an achievement you are proud of and how you measured its impact.', round: 'HR & Behavioral', difficulty: 'Medium' },
  { text: 'How would you find the kth largest element in an unsorted array?', round: 'DSA', difficulty: 'Hard' },
  { text: 'Design a rate limiter for a public API.', round: 'System Design', difficulty: 'Hard' }
];
let users = [];
let interviews = [];
let adminLastUpdated = null;
let selectedStudentId = null;
let currentAdminView = 'overview';
let selectedCompanyIndex = null;
function loadCompanies() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('adminCompanies') || 'null'); } catch (error) { saved = null; }
  let tracks = Array.isArray(saved) && saved.length
    ? saved.map(company => {
      const name = typeof company === 'string' ? company : company.name;
      const questions = typeof company === 'string' ? [] : company.questions;
      const seeded = companySeeds.find(item => item.name.toLowerCase() === String(name || '').toLowerCase());
      return { name: name || 'Company', questions: Array.isArray(questions) && questions.length ? questions : (seeded ? [...seeded.questions] : []) };
    })
    : JSON.parse(JSON.stringify(companySeeds));
  if (localStorage.getItem('adminQuestionMigration') !== 'done') {
    let legacyQuestions = [];
    try { legacyQuestions = JSON.parse(localStorage.getItem('adminQuestions') || '[]'); } catch (error) { legacyQuestions = []; }
    if (legacyQuestions.length && tracks[0]) {
      tracks[0].questions.push(...legacyQuestions.map(question => ({ ...question, round: question.round || 'Technical', difficulty: question.difficulty || 'Medium' })));
    }
    localStorage.setItem('adminQuestionMigration', 'done');
  }
  if (localStorage.getItem('adminPracticeQuestionSeedVersion') !== '2') {
    for (const track of tracks) {
      if (!companySeeds.some(seed => seed.name.toLowerCase() === track.name.toLowerCase())) continue;
      const existingQuestions = new Set(track.questions.map(question => `${question.round}:${question.text}`));
      for (const question of additionalPracticeQuestions) {
        const key = `${question.round}:${question.text}`;
        if (!existingQuestions.has(key)) track.questions.push({ ...question });
      }
    }
    localStorage.setItem('adminPracticeQuestionSeedVersion', '2');
  }
  localStorage.setItem('adminCompanies', JSON.stringify(tracks));
  return tracks;
}
let companies = loadCompanies();

function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
function card(title, body, action = '') { return `<section class="card"><div class="card-head"><h2>${title}</h2>${action}</div>${body}</section>`; }
function table(headers, rows) { return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="10" class="muted">No records found.</td></tr>'}</tbody></table></div>`; }
function scoreClass(score) { return Number(score) >= 80 ? 'tag' : ''; }
function avgScore() { return interviews.length ? Math.round(interviews.reduce((sum, item) => sum + Number(item.score || 0), 0) / interviews.length) : 0; }

function overview() {
  return `<div class="stats"><div class="stat"><b>${users.length}</b><span>Registered users</span></div><div class="stat"><b>${interviews.length}</b><span>Completed interviews</span></div><div class="stat"><b style="color:var(--green)">${avgScore()}%</b><span>Average score</span></div><div class="stat"><b>${users.filter(item => item.interviews > 0).length}</b><span>Active learners</span></div></div>${card('Recent interview activity', table(['Student', 'Email', 'Company', 'Round', 'Score', 'Completed at'], interviews.slice(0, 10).map(item => `<tr><td>${esc(item.student)}</td><td class="muted">${esc(item.email)}</td><td>${esc(item.company)}</td><td>${esc(item.round)}</td><td><span class="${scoreClass(item.score)}">${item.score}%</span></td><td class="muted">${formatDate(item.created_at)}</td></tr>`).join('')))}${card('Newest registered users', table(['Name', 'Email', 'Provider', 'Registered at', 'Interviews'], users.slice(0, 10).map(item => `<tr><td>${esc(item.name)}</td><td class="muted">${esc(item.email)}</td><td>${esc(item.provider)}</td><td class="muted">${formatDate(item.created_at)}</td><td>${item.interviews}</td></tr>`).join('')))}`;
}
function students() {
  return card('All registered users', table(['Name', 'Email', 'Provider', 'Registered at', 'Interviews', 'Average score'], users.map(item => `<tr><td><button class="link-btn" data-student-id="${item.id}">${esc(item.name)}</button></td><td class="muted">${esc(item.email)}</td><td>${esc(item.provider)}</td><td class="muted">${formatDate(item.created_at)}</td><td>${item.interviews}</td><td>${item.average_score}%</td></tr>`).join('')));
}
function studentReview() {
  const student = users.find(item => Number(item.id) === Number(selectedStudentId));
  if (!student) {
    return card('Candidate review', `<p class="muted">No student selected.</p><button class="btn primary" data-back-to-students>Back to students</button>`);
  }
  const studentInterviews = interviews.filter(item => item.email === student.email);
  const averageScore = studentInterviews.length ? Math.round(studentInterviews.reduce((sum, item) => sum + Number(item.score || 0), 0) / studentInterviews.length) : 0;
  const companySummary = [...new Set(studentInterviews.map(item => item.company))];
  return `
    <div class="candidate-review-wrap">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; gap:12px;">
        <div>
          <h2 style="margin:0 0 6px;">${esc(student.name)}</h2>
          <p class="muted" style="margin:0;">${esc(student.email)} · ${esc(student.provider)}</p>
        </div>
        <button class="btn primary" data-back-to-students>Back to students</button>
      </div>
      ${card('Candidate overview', `
        <div class="stats">
          <div class="stat"><b>${studentInterviews.length}</b><span>Total interviews</span></div>
          <div class="stat"><b style="color:var(--green)">${averageScore}%</b><span>Avg score</span></div>
          <div class="stat"><b>${companySummary.length}</b><span>Companies</span></div>
          <div class="stat"><b>${formatDate(student.created_at)}</b><span>Joined</span></div>
        </div>
      `)}
      ${card('Interview history', table(['Company', 'Round', 'Difficulty', 'Score', 'XP', 'Date'], studentInterviews.length ? studentInterviews.map(item => `<tr><td>${esc(item.company)}</td><td>${esc(item.round)}</td><td>${esc(item.difficulty)}</td><td><span class="${scoreClass(item.score)}">${item.score}%</span></td><td>${item.xp}</td><td class="muted">${formatDate(item.created_at)}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No interviews found for this student.</td></tr>'))}
    </div>
  `;
}
function interviewsView() { return card('All completed interviews', table(['Student', 'Email', 'Company', 'Round', 'Industry', 'Difficulty', 'Score', 'XP', 'Completed at'], interviews.map(item => `<tr><td>${esc(item.student)}</td><td class="muted">${esc(item.email)}</td><td>${esc(item.company)}</td><td>${esc(item.round)}</td><td>${esc(item.industry)}</td><td>${esc(item.difficulty)}</td><td><span class="${scoreClass(item.score)}">${item.score}%</span></td><td>${item.xp}</td><td class="muted">${formatDate(item.created_at)}</td></tr>`).join(''))); }
function analytics() {
  const totalInterviews = interviews.length;
  const colorLegend = [
    { label: 'Low', color: 'linear-gradient(90deg, #7aa2ff, #4f79ff)' },
    { label: 'Moderate', color: 'linear-gradient(90deg, #ffb066, #f28c28)' },
    { label: 'High', color: 'linear-gradient(90deg, #4ad6a4, #20bf73)' }
  ];

  return `
    <div class="stats">
      <div class="stat"><b>${totalInterviews}</b><span>Total interviews</span></div>
      <div class="stat"><b style="color:var(--green)">${avgScore()}%</b><span>Average score</span></div>
      ${rounds.slice(0, 2).map(round => `<div class="stat"><b>${interviews.filter(item => item.round === round).length}</b><span>${round}</span></div>`).join('')}
    </div>
    ${card('Round distribution', `
      <div class="legend-row" style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; color:#b9c8d8; font-size:13px;">
        ${colorLegend.map(item => `<span style="display:inline-flex; align-items:center; gap:6px;"><i style="display:inline-block; width:12px; height:12px; border-radius:4px; background:${item.label === 'Low' ? '#7aa2ff' : item.label === 'Moderate' ? '#f28c28' : '#20bf73'};"></i>${item.label} activity</span>`).join('')}
      </div>
      ${rounds.map(round => {
        const count = interviews.filter(item => item.round === round).length;
        const share = totalInterviews ? (count / totalInterviews) * 100 : 0;
        let barColor = '#7aa2ff';
        let level = 'Low activity';
        if (share >= 50) { barColor = '#20bf73'; level = 'High activity'; }
        else if (share >= 20) { barColor = '#f28c28'; level = 'Moderate activity'; }

        return `
          <div class="setting">
            <div>
              <strong>${round}</strong>
              <small>${count} completed sessions · ${share.toFixed(0)}% of all interviews</small>
            </div>
            <div style="width:42%">
              <div class="bar">
                <i style="width:${Math.max(share, count === 0 ? 2 : 8)}%; background:${barColor};"></i>
              </div>
            </div>
            <span style="font-size:11px; color:#8ea8c7; min-width:90px; text-align:right;">${level}</span>
          </div>
        `;
      }).join('')}
    `)}
  `;
}
function companiesView() {
  const selectedCompany = companies[selectedCompanyIndex];
  const companyRows = companies.map((company, index) => `<tr><td><strong>${esc(company.name)}</strong></td><td>${company.questions.length} questions</td><td><button class="btn primary" data-manage-company="${index}">Manage questions</button> <button class="btn danger" data-delete-company="${index}">Remove</button></td></tr>`).join('');
  const companyList = card('Company tracks', table(['Company', 'Question count', 'Actions'], companyRows), '<button class="btn primary" id="addCompany">Add company</button>');
  if (!selectedCompany) return companyList;
  const questionRows = selectedCompany.questions.map((question, index) => `<tr><td>${esc(question.text)}</td><td>${esc(question.round)}</td><td>${esc(question.difficulty)}</td><td><button class="btn danger" data-delete-company-question="${index}">Delete</button></td></tr>`).join('');
  const questionForm = `<form id="companyQuestionForm"><div class="field"><label for="companyQuestionText">Question</label><input id="companyQuestionText" name="text" maxlength="500" required></div><div class="field"><label for="companyQuestionRound">Interview round</label><select id="companyQuestionRound" name="round">${rounds.map(round => `<option>${esc(round)}</option>`).join('')}</select></div><div class="field"><label for="companyQuestionDifficulty">Difficulty</label><select id="companyQuestionDifficulty" name="difficulty"><option>Easy</option><option selected>Medium</option><option>Hard</option></select></div><button class="btn primary" type="submit">Add question</button></form>`;
  return `${companyList}${card(`${esc(selectedCompany.name)} questions`, `${table(['Question', 'Round', 'Difficulty', 'Actions'], questionRows)}${questionForm}`)}<button class="btn" id="closeCompanyQuestions">Back to companies</button>`;
}
function settings() { return card('Admin settings', `<div class="field"><label>Admin name</label><input id="settingsName" value="${esc(localStorage.getItem('adminName') || 'Admin')}"></div><div class="field"><label>Admin email</label><input value="admin@interviewai.com" disabled></div><button class="btn primary" id="saveSettings">Save changes</button>`); }

function render(view = currentAdminView) {
  currentAdminView = view in titles ? view : 'overview';
  const [title, subtitle] = titles[currentAdminView]; pageTitle.textContent = title; pageSubtitle.textContent = subtitle;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === currentAdminView));
  const views = { overview, students, companies: companiesView, interviews: interviewsView, analytics, settings, 'student-review': studentReview };
  content.innerHTML = views[currentAdminView]();
  if (adminLastUpdated) {
    const stamp = document.querySelector('#adminStatusStamp');
    if (stamp) stamp.textContent = `Last updated: ${formatDate(adminLastUpdated)}`;
  }
  wire(currentAdminView);
}
function wire(view) {
  document.querySelectorAll('[data-student-id]').forEach(button => {
    button.addEventListener('click', () => {
      selectedStudentId = Number(button.dataset.studentId);
      render('student-review');
    });
  });

  document.querySelectorAll('[data-back-to-students]').forEach(button => {
    button.addEventListener('click', () => {
      selectedStudentId = null;
      render('students');
    });
  });

  document.getElementById('addCompany')?.addEventListener('click', () => {
    const value = prompt('Company name:');
    if (value?.trim()) { companies.push({ name: value.trim(), questions: [] }); localStorage.setItem('adminCompanies', JSON.stringify(companies)); render(view); }
  });
  document.querySelectorAll('[data-manage-company]').forEach(button => button.addEventListener('click', event => {
    selectedCompanyIndex = Number(event.currentTarget.dataset.manageCompany);
    render(view);
  }));
  document.querySelectorAll('[data-delete-company]').forEach(button => button.addEventListener('click', event => {
    const removedIndex = Number(event.currentTarget.dataset.deleteCompany);
    companies.splice(removedIndex, 1);
    if (selectedCompanyIndex === removedIndex) selectedCompanyIndex = null;
    else if (selectedCompanyIndex > removedIndex) selectedCompanyIndex -= 1;
    localStorage.setItem('adminCompanies', JSON.stringify(companies));
    render(view);
  }));
  document.getElementById('companyQuestionForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    companies[selectedCompanyIndex].questions.push({
      text: String(formData.get('text')).trim(),
      round: String(formData.get('round')),
      difficulty: String(formData.get('difficulty'))
    });
    localStorage.setItem('adminCompanies', JSON.stringify(companies));
    render(view);
  });
  document.querySelectorAll('[data-delete-company-question]').forEach(button => button.addEventListener('click', event => {
    companies[selectedCompanyIndex].questions.splice(Number(event.currentTarget.dataset.deleteCompanyQuestion), 1);
    localStorage.setItem('adminCompanies', JSON.stringify(companies));
    render(view);
  }));
  document.getElementById('closeCompanyQuestions')?.addEventListener('click', () => { selectedCompanyIndex = null; render(view); });
  document.getElementById('saveSettings')?.addEventListener('click', () => { localStorage.setItem('adminName', document.getElementById('settingsName').value.trim() || 'Admin'); document.getElementById('adminName').textContent = localStorage.getItem('adminName'); alert('Settings saved.'); });
}
async function loadAdminData() {
  const token = localStorage.getItem('interviewaiAdminToken');
  if (!token) { window.location.href = 'index.html?admin=login'; return; }
  content.innerHTML = `
    <section class="card">
      <h2>Loading admin data</h2>
      <p class="muted">Fetching users, interviews, and admin analytics...</p>
      <div id="adminStatusStamp" class="muted">Please wait...</div>
    </section>
  `;
  try {
    const response = await fetch(`${API_BASE}/admin/data`, { headers: { 'X-Admin-Token': token } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Unable to load admin data');
    users = payload.users || [];
    interviews = payload.interviews || [];
    adminLastUpdated = new Date().toISOString();
    render(currentAdminView);
  } catch (error) {
    content.innerHTML = `<section class="card"><h2>Admin data unavailable</h2><p class="muted">${esc(error.message)}</p><button class="btn primary" id="retryAdmin">Retry</button></section>`;
    document.getElementById('retryAdmin')?.addEventListener('click', loadAdminData);
  }
}
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
  currentAdminView = button.dataset.view;
  render(currentAdminView);
}));
document.getElementById('refreshAdminData')?.addEventListener('click', () => loadAdminData());
document.getElementById('logout').addEventListener('click', () => { localStorage.removeItem('interviewaiAdminAuthenticated'); localStorage.removeItem('interviewaiAdminToken'); window.location.href = 'index.html'; });
if (localStorage.getItem('interviewaiAdminAuthenticated') !== 'true') window.location.href = 'index.html?admin=login'; else { document.getElementById('adminName').textContent = localStorage.getItem('adminName') || 'Admin'; loadAdminData(); }
