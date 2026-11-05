const savedUser = JSON.parse(localStorage.getItem('interviewaiUser') || '{}');
let userName = savedUser.name || 'User';

function syncUserNameFromStorage() {
  const storedUser = JSON.parse(localStorage.getItem('interviewaiUser') || '{}');
  if (storedUser && storedUser.name) {
    userName = storedUser.name;
  } else if (storedUser && storedUser.email) {
    const local = storedUser.email.split('@')[0];
    userName = local ? local.replace(/[._\-]+/g, ' ').split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'User';
  } else {
    userName = 'User';
  }
}

function updateUserNameUI() {
  const nameEl = document.getElementById('userName');
  const welcomeEl = document.getElementById('welcomeText');
  if (nameEl) nameEl.textContent = userName || 'User';
  if (welcomeEl) {
    const first = (userName || 'User').split(' ')[0] || 'User';
    welcomeEl.textContent = `Good morning, ${first} 👋`;
  }
}

async function refreshUserName() {
  syncUserNameFromStorage();

  const token = localStorage.getItem('interviewaiSessionToken');
  if (!token) {
    updateUserNameUI();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: { 'X-Session-Token': token }
    });

    if (!response.ok) throw new Error('Session invalid');
    const payload = await response.json();
    const serverUser = payload.user || {};
    if (serverUser.name) {
      userName = serverUser.name;
      const currentUser = JSON.parse(localStorage.getItem('interviewaiUser') || '{}');
      localStorage.setItem('interviewaiUser', JSON.stringify({ ...currentUser, ...serverUser }));
    }
  } catch (error) {
    const storedUser = JSON.parse(localStorage.getItem('interviewaiUser') || '{}');
    userName = storedUser.name || 'User';
  }

  updateUserNameUI();
}

const mainPanel = document.getElementById('dashboardContent');
const homeMarkup = mainPanel ? mainPanel.innerHTML : '';
const API_BASE = 'http://127.0.0.1:8000/api';
const TOTAL_QUESTIONS = 10;
const ANALYSIS_VERSION = 3;
let historyRecords = [];
const practiceState = { step: 'setup', company: 'Google', round: 'Technical', industry: 'Technology', difficulty: 'Medium' };
practiceState.resumeAnalysis = null;
practiceState.resumeMode = false;
const triviaCategoryMap = {
  'Science: Computers': 18,
  'Science: Mathematics': 19,
  'General Knowledge': 9,
  'Entertainment: Film': 11,
  'Entertainment: Music': 12,
  'Sports': 21,
  'Geography': 22,
  'History': 23,
  'Politics': 24,
  'Animals': 27
};
practiceState.questions = [];
practiceState.questionIndex = 0;
practiceState.answer = '';
practiceState.sessionPoints = 0;
practiceState.questionResults = [];
practiceState.skipCurrent = false;
practiceState.result = null;
let activeMission = false;
let profileSetting = null;
let cameraStream = null;
let proctorTimer = null;
let proctorBusy = false;
let latestProctorStatus = null;
let speechRecognition = null;
let speechAnswer = '';
let speechInterim = '';
let speechStopPromise = null;
let isListening = false;
let answerSubmissionPending = false;
let questionTimerId = null;
let questionTimeLeft = 50;
const practiceOptions = {
  company: ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'TCS', 'Infosys', 'Wipro', 'Startup'],
  round: ['Aptitude', 'Technical', 'HR & Behavioral', 'DSA', 'System Design', 'Case Study'],
  industry: ['Technology', 'Finance', 'Healthcare', 'Marketing', 'Operations', 'Data Science'],
  difficulty: ['Easy', 'Medium', 'Hard']
};

const aptitudeBank = [
  ['A train travels 180 km in 3 hours. What is its average speed?', ['45 km/h', '60 km/h', '75 km/h', '90 km/h'], 1],
  ['What is 15% of 240?', ['24', '30', '36', '42'], 2],
  ['If 5 workers finish a task in 12 days, how many days will 10 workers take at the same rate?', ['3', '6', '12', '24'], 1],
  ['A product marked at 800 is sold at a 10% discount. What is the selling price?', ['720', '730', '740', '760'], 0],
  ['Find the next number: 3, 6, 12, 24, __.', ['30', '36', '48', '54'], 2],
  ['The ratio of boys to girls is 3:2. If there are 25 students, how many are boys?', ['10', '12', '15', '18'], 2],
  ['What is the simple interest on 5,000 at 8% per year for 2 years?', ['400', '800', '1,000', '1,200'], 1],
  ['A bag has 3 red and 2 blue balls. What is the probability of drawing a blue ball?', ['1/5', '2/5', '3/5', '1/2'], 1],
  ['If x + 7 = 19, what is x?', ['10', '11', '12', '13'], 2],
  ['What is the average of 12, 18, and 24?', ['16', '18', '20', '22'], 1],
  ['A can complete work in 10 days and B in 15 days. How long together?', ['5 days', '6 days', '8 days', '12 days'], 1],
  ['What is the remainder when 47 is divided by 5?', ['1', '2', '3', '4'], 3],
  ['A clock shows 3:00. What is the angle between the hands?', ['60°', '90°', '120°', '180°'], 1],
  ['If 2x - 5 = 13, what is x?', ['4', '7', '9', '11'], 2],
  ['A car uses 8 litres for 100 km. How much for 250 km?', ['16 L', '18 L', '20 L', '24 L'], 2],
  ['Which number is divisible by both 3 and 5?', ['25', '35', '45', '50'], 2],
  ['A shop gains 20% on an item costing 500. What is the selling price?', ['550', '580', '600', '620'], 2],
  ['Find the missing number: 2, 5, 10, 17, 26, __.', ['35', '36', '37', '38'], 2],
  ['If today is Monday, what day will it be after 45 days?', ['Tuesday', 'Wednesday', 'Thursday', 'Friday'], 2],
  ['A family spends 70% of its income. If income is 40,000, savings are?', ['8,000', '10,000', '12,000', '14,000'], 0],
  ['What is the LCM of 6 and 8?', ['12', '18', '24', '48'], 2],
  ['A 120 m long train passes a pole in 6 seconds. Speed in km/h?', ['60', '72', '80', '90'], 1],
  ['If 4 pens cost 60, what do 7 pens cost?', ['90', '100', '105', '120'], 2],
  ['What is the square root of 144?', ['10', '11', '12', '14'], 2],
  ['A number increased by 25% becomes 250. What was it?', ['180', '200', '210', '225'], 1],
  ['How many ways can the letters A and B be arranged?', ['1', '2', '3', '4'], 1],
  ['If 3/5 of a number is 36, what is the number?', ['50', '60', '72', '90'], 1],
  ['What is the median of 4, 9, 2, 7, 5?', ['4', '5', '6', '7'], 1],
  ['A pipe fills a tank in 4 hours. What fraction fills in 1 hour?', ['1/2', '1/3', '1/4', '1/8'], 2],
  ['What is 2^5?', ['10', '16', '25', '32'], 3],
  ['A class has 18 girls and 12 boys. What percentage are girls?', ['40%', '50%', '60%', '75%'], 2],
  ['Find the odd one out: 8, 27, 64, 100, 125.', ['8', '27', '100', '125'], 2],
  ['If a:b = 4:7 and b = 21, what is a?', ['8', '12', '14', '16'], 1],
  ['What is the perimeter of a square with side 9 cm?', ['18 cm', '27 cm', '36 cm', '81 cm'], 2],
  ['A 500 item has 18% GST. What is the total price?', ['518', '580', '590', '618'], 1],
  ['Which is the next prime number after 29?', ['30', '31', '33', '35'], 1],
  ['A person walks 5 km north and 5 km east. Straight distance is?', ['5 km', '7.07 km', '10 km', '25 km'], 1],
  ['If 40% of a number is 28, what is the number?', ['56', '60', '70', '72'], 2],
  ['What is the compound amount on 100 at 10% for one year?', ['100', '105', '110', '120'], 2],
  ['A class average is 20 for 5 students. What is their total?', ['25', '80', '100', '125'], 2],
  ['If all roses are flowers and some flowers fade, which conclusion is certain?', ['All roses fade', 'Some roses may fade', 'No roses fade', 'All flowers are roses'], 1]
];

const technicalPrompts = [
  'Explain how you would design a reliable API for a {industry} product at {company}.',
  'How would you validate and sanitize user input in a {industry} application?',
  'Compare arrays and linked lists, and give a practical use case for each.',
  'Explain the difference between a process and a thread.',
  'How would you find duplicate values efficiently in a large dataset?',
  'Describe normalization in relational databases and when denormalization helps.',
  'How would you secure authentication and session management for a production app?',
  'Explain time complexity and analyze binary search.',
  'How would you debug a slow endpoint in a {company} service?',
  'What are the benefits and trade-offs of caching?',
  'Explain REST versus event-driven communication.',
  'How would you handle retries without creating duplicate operations?',
  'Describe indexing in a database and its effect on writes.',
  'How would you test a service before releasing it?',
  'Explain inheritance, composition, and when you prefer composition.',
  'How would you design pagination for millions of records?',
  'What causes a memory leak and how would you investigate one?',
  'Explain transactions and isolation levels.',
  'How would you make a web page accessible to keyboard and screen-reader users?',
  'Describe a CI/CD pipeline for a {industry} application.',
  'How would you model roles and permissions?',
  'Explain optimistic and pessimistic locking.',
  'How would you protect an API from abuse and traffic spikes?',
  'What is the purpose of logging, metrics, and tracing?',
  'How would you migrate a database schema without downtime?',
  'Explain queues and when they improve system reliability.',
  'How would you design a file upload feature securely?',
  'What is eventual consistency and when is it acceptable?',
  'How would you reduce frontend bundle size?',
  'Describe a strategy for handling configuration and secrets.',
  'How would you choose between SQL and NoSQL for a new product?',
  'Explain immutability and why it can simplify application state.',
  'How would you investigate an intermittent production failure?',
  'What makes an automated test valuable and maintainable?',
  'How would you design notifications for a large user base?',
  'Explain idempotency with an example from payments or orders.',
  'How would you review a pull request for correctness and maintainability?',
  'Describe a threat model for a {industry} platform.',
  'How would you handle backward compatibility in a public API?',
  'Design a small service for {company} and explain its main trade-offs.'
];

const roundPromptBanks = {
  'HR & Behavioral': [
    'Tell me about a difficult team situation and how you handled it.',
    'Describe a time you received critical feedback and what you changed afterward.',
    'Tell me about a project that failed or changed direction. What did you learn?',
    'Describe a time you had to prioritize competing deadlines.',
    'Why do you want to work in this role and what kind of team helps you do your best work?',
    'Tell me about an achievement you are proud of and how you measured its impact.',
    'Describe a disagreement with a teammate and how you reached a solution.',
    'Tell me about a time you showed leadership without having formal authority.',
    'Describe a time you had to learn a new skill quickly.',
    'Tell me about a decision you made with incomplete information.',
    'How do you handle pressure during an important deadline?',
    'Describe how you collaborate with someone whose working style is different from yours.'
  ],
  DSA: [
    'Find the time and space complexity of a solution that searches for duplicates in an array.',
    'Explain how you would solve a two-sum problem and handle duplicate values.',
    'When would you choose a hash map over sorting for a lookup problem?',
    'Explain breadth-first search and depth-first search with a practical example.',
    'How would you find the longest substring without repeating characters?',
    'Explain how binary search works and when it cannot be used.',
    'How would you detect a cycle in a linked list?',
    'Compare a heap, stack, queue, and priority queue with use cases.',
    'How would you merge overlapping intervals efficiently?',
    'Explain recursion and identify when dynamic programming is useful.',
    'How would you find the kth largest element in an unsorted array?',
    'Compare adjacency lists and adjacency matrices for graph storage.'
  ],
  'System Design': [
    'Design a URL shortener and explain storage, scale, and availability decisions.',
    'Design a notification system for a large user base.',
    'Design a file upload service with validation, storage, and secure downloads.',
    'Design a chat system and explain message delivery and failure handling.',
    'How would you scale a web application from thousands to millions of users?',
    'Explain caching, replication, and load balancing in a production system.',
    'Design an interview platform that stores sessions and results reliably.',
    'Explain the trade-offs between SQL and NoSQL for a growing product.',
    'Design a rate limiter for a public API.',
    'Design a search service and explain indexing and freshness.',
    'How would you make a service resilient to a regional outage?',
    'Design an analytics pipeline for interview performance data.'
  ],
  'Case Study': [
    'A product has falling user engagement. How would you investigate the cause?',
    'A company wants to reduce customer support costs. What data would you analyze?',
    'How would you decide whether to launch a new feature with limited resources?',
    'A service is slower after a release. Explain your investigation plan.',
    'How would you define success metrics for a new interview preparation product?',
    'A project is over budget and behind schedule. What actions would you recommend?',
    'How would you compare two vendors for an important business system?',
    'What questions would you ask before recommending a solution to a client?',
    'A feature has high usage but low retention. How would you analyze it?',
    'How would you prioritize three product improvements with limited engineering time?',
    'A team reports conflicting data about a problem. How would you establish the facts?',
    'How would you estimate the business impact of an automation project?'
  ]
};

const questionDifficultyGuide = {
  Easy: 'Answer with core concepts and one simple example.',
  Medium: 'Include trade-offs, edge cases, and a practical example.',
  Hard: 'Discuss scale, failure modes, security, and measurable trade-offs.'
};

function questionHistoryKey() {
  return `interviewaiAskedQuestions:${savedUser.email || 'guest'}`;
}

function readAskedQuestions() {
  try {
    const stored = JSON.parse(localStorage.getItem(questionHistoryKey()) || '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch (error) {
    return {};
  }
}

function rememberQuestions(round, prompts) {
  const history = readAskedQuestions();
  history[round] = [...new Set([...(history[round] || []), ...prompts])];
  localStorage.setItem(questionHistoryKey(), JSON.stringify(history));
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function decodeHtmlEntities(value) {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = value || '';
  return textArea.value;
}

function triviaDifficulty(level) {
  return String(level || 'Medium').toLowerCase();
}

async function fetchTriviaQuestions() {
  const url = `${TRIVIA_API_BASE}&difficulty=${triviaDifficulty(practiceState.difficulty)}`;
  const history = readAskedQuestions();
  const asked = new Set(history.Aptitude || []);

  try {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok || !payload || payload.response_code !== 0 || !Array.isArray(payload.results) || !payload.results.length) {
      throw new Error('Trivia API returned no questions.');
    }

    const freshResults = payload.results.filter(item => !asked.has(decodeHtmlEntities(item.question)));
    const selectedResults = freshResults.length >= TOTAL_QUESTIONS ? freshResults : payload.results;
    if (freshResults.length < TOTAL_QUESTIONS) localStorage.removeItem(questionHistoryKey());
    const questions = selectedResults.slice(0, TOTAL_QUESTIONS).map((item) => {
      const correctAnswer = decodeHtmlEntities(item.correct_answer);
      const incorrectAnswers = (item.incorrect_answers || []).map(answer => decodeHtmlEntities(answer));
      const choices = shuffleArray([correctAnswer, ...incorrectAnswers]);
      const questionText = decodeHtmlEntities(item.question);
      return {
        question: questionText,
        options: choices,
        answer: choices.indexOf(correctAnswer),
        correctAnswer,
        expectedAnswer: correctAnswer,
        historyKey: questionText
      };
    });
    rememberQuestions('Aptitude', questions.map(question => question.historyKey));
    return questions;
  } catch (error) {
    console.warn('Trivia API failed, using local fallback:', error);
    const shuffledPool = shuffleArray(aptitudeBank);
    const fallback = shuffledPool.slice(0, Math.min(TOTAL_QUESTIONS, aptitudeBank.length)).map(([question, options, answer]) => ({
      question,
      options: [...options],
      answer,
      correctAnswer: options[answer],
      expectedAnswer: options[answer],
      historyKey: question
    }));
    rememberQuestions('Aptitude', fallback.map(item => item.historyKey));
    return fallback;
  }
}

async function buildQuestionSet() {
  if (practiceState.round === 'Aptitude') {
    const shuffledPool = shuffleArray(aptitudeBank);
    return shuffledPool.slice(0, TOTAL_QUESTIONS).map(([question, options, answer]) => ({
      question,
      options: [...options],
      answer,
      correctAnswer: options[answer],
      expectedAnswer: options[answer]
    }));
  }

  let prompts = roundPromptBanks[practiceState.round] || technicalPrompts;
  if (practiceState.resumeMode && practiceState.resumeAnalysis) {
    const skills = (practiceState.resumeAnalysis.skills || []).map(skill => skill.name).filter(Boolean);
    const resumeQuestions = skills.map(skill => `Your resume highlights ${skill}. Explain your hands-on experience with it, one project where you used it, and a technical challenge you solved.`);
    const resumeText = String(practiceState.resumeAnalysis.text || '').replace(/\s+/g, ' ').trim();
    if (resumeText) {
      resumeQuestions.unshift(`Review the projects, experience, and achievements in this resume and explain the strongest one, your exact contribution, and the result: "${resumeText.slice(0, 600)}"`);
    }
    prompts = [...resumeQuestions, ...prompts];
  }
  const history = readAskedQuestions();
  const previouslyAsked = new Set(history[practiceState.round] || []);
  let shuffledPrompts = shuffleArray(prompts);
  let freshPrompts = shuffledPrompts.filter(prompt => !previouslyAsked.has(prompt));
  if (freshPrompts.length < TOTAL_QUESTIONS) {
    localStorage.removeItem(questionHistoryKey());
    freshPrompts = shuffledPrompts;
  }
  const selectedPrompts = freshPrompts.slice(0, TOTAL_QUESTIONS);
  rememberQuestions(practiceState.round, selectedPrompts);
  return selectedPrompts.map((prompt, index) => {
    const question = prompt.replace('{company}', practiceState.company).replace('{industry}', practiceState.industry);
    return {
      question,
      options: null,
      answer: null,
      expectedAnswer: expectedAnswerForPrompt(question)
    };
  });
}

function expectedAnswerForPrompt(prompt) {
  const text = String(prompt || '').toLowerCase();

  if (text.includes('database') && text.includes('index')) {
    return 'Indexes speed up read-heavy queries by creating an ordered lookup structure, which helps WHERE, ORDER BY, and JOIN operations. The trade-off is that every INSERT, UPDATE, and DELETE must also update the index, so writes become slower and storage usage increases.';
  }
  if ((text.includes('inheritance') || text.includes('composition')) && (text.includes('prefer composition') || text.includes('composition')) ) {
    return 'Inheritance models an "is-a" relationship and is useful for small, stable hierarchies. Composition models a "has-a" relationship, which is easier to extend, test, and change without creating fragile parent-child coupling, so it is usually preferred for flexible systems.';
  }
  if (text.includes('rest') && text.includes('event')) {
    return 'REST is synchronous and resource-oriented, usually exposing HTTP endpoints with clear request/response contracts. Event-driven systems are asynchronous and decouple producers and consumers, which is better for high-volume workflows, retry tolerance, and eventual consistency.';
  }
  if (text.includes('backward compatibility') || text.includes('public api')) {
    return 'Backward compatibility means older clients keep working while the API evolves. A safe approach is to version the API, add fields without removing old ones, deprecate endpoints gradually, and keep clear migration guidance for integrators.';
  }
  if (text.includes('pull request')) {
    return 'A strong code review checks correctness, security, performance, maintainability, and test coverage. I would look for edge cases, API contracts, readability, and whether the change adds a clear explanation and validation for the intended behavior.';
  }
  if (text.includes('memory leak')) {
    return 'A memory leak happens when memory is allocated but no longer released, often because references remain after the object is no longer needed. I would look for long-lived references, listeners, global caches, or unclosed resources and verify with profiling and heap snapshots.';
  }
  if (text.includes('cache')) {
    return 'Caching reduces latency and repeated work by storing frequent results in memory or a distributed layer. The key trade-off is staleness: cached data can become outdated, so a good design includes TTLs, invalidation policies, and monitoring for cache misses.';
  }
  if (text.includes('authentication') || text.includes('session') || text.includes('secure')) {
    return 'Authentication should verify identity using strong credentials and hashed passwords or secure tokens. Session management should use short-lived tokens, secure cookies or refresh flows, strict transport security, and rotation/revocation for compromised sessions.';
  }
  if (text.includes('transaction') || text.includes('isolation')) {
    return 'Transactions ensure atomicity, consistency, isolation, and durability so related updates either all succeed or all fail together. Different isolation levels trade correctness against concurrency, with stricter isolation reducing anomalies but increasing contention.';
  }
  if (text.includes('pagination')) {
    return 'Pagination should avoid loading all records at once by using cursor-based or offset-based slicing with a limit and stable ordering. A good design also returns metadata like total count and handles next-page consistency, filtering, and large data sets efficiently.';
  }
  if (text.includes('accessibility') || text.includes('screen-reader') || text.includes('keyboard')) {
    return 'Accessible interfaces use semantic HTML, clear focus states, meaningful labels, keyboard support, and sufficient color contrast. They also ensure screen readers can understand the content and that people can navigate without a mouse.';
  }
  if (text.includes('test') && !text.includes('test')) {
    return 'Good tests validate behavior at the correct level and catch regressions without being brittle. I would use unit tests for logic, integration tests for service boundaries, and a small set of end-to-end tests for critical user journeys.';
  }
  if (text.includes('queue')) {
    return 'Queues decouple producers from consumers, making systems more resilient to spikes and failures. They help absorb bursts of traffic, support retries, and allow background processing without blocking user-facing requests.';
  }
  if (text.includes('migrate') || text.includes('schema')) {
    return 'A safe migration plan includes backward-compatible schema changes, incremental rollout, verification, and rollback steps. I would avoid breaking reads or writes, use feature flags when needed, and validate data integrity before removing the old path.';
  }
  return 'A strong answer should directly address the question, explain the approach step by step, mention relevant trade-offs or risks, and give a practical example.';
}

function isAptitudeSession() {
  return practiceState.round === 'Aptitude';
}

function scoreWrittenAnswer(question, answer) {
  const normalizedAnswer = answer.toLowerCase().replace(/[^a-z0-9+#./-]/g, ' ');
  if (!normalizedAnswer.trim()) return 0;
  const stopWords = new Set(['about', 'after', 'again', 'because', 'before', 'being', 'could', 'explain', 'from', 'given', 'have', 'how', 'into', 'make', 'more', 'that', 'their', 'there', 'these', 'this', 'under', 'what', 'when', 'where', 'which', 'would', 'your']);
  const keywords = question.toLowerCase()
    .replace(/[^a-z0-9+#./-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 5 && !stopWords.has(word));
  const matches = new Set(keywords.filter(keyword => normalizedAnswer.includes(keyword)));
  if (!matches.size) return 0;
  if (matches.size === 1 || normalizedAnswer.trim().split(/\s+/).length < 12) return 0.5;
  return 1;
}

function levelForXp(xp) {
  return Math.floor((Number(xp) || 0) / 500) + 1;
}

function authHeaders() {
  const token = localStorage.getItem('interviewaiSessionToken');
  return token ? { 'X-Session-Token': token } : {};
}

function localHistoryKey() {
  return `interviewaiHistory:${savedUser.email || 'guest'}`;
}

function readLocalHistory() {
  try {
    const records = JSON.parse(localStorage.getItem(localHistoryKey()) || '[]');
    return Array.isArray(records) ? records : [];
  } catch (error) {
    return [];
  }
}

function writeLocalHistory(record) {
  const records = [record, ...readLocalHistory().filter(item => item.id !== record.id)];
  localStorage.setItem(localHistoryKey(), JSON.stringify(records.slice(0, 50)));
}

function replaceLocalHistoryRecord(previousId, record) {
  const records = readLocalHistory().filter(item => item.id !== previousId && item.id !== record.id);
  localStorage.setItem(localHistoryKey(), JSON.stringify([record, ...records].slice(0, 50)));
}

function dateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA');
}

function dashboardStats() {
  const scores = historyRecords.map(record => Number(record.score)).filter(Number.isFinite);
  const xp = historyRecords.reduce((total, record) => total + (Number(record.xp) || 0), 0);
  const dates = new Set(historyRecords.map(record => dateKey(record.created_at)).filter(Boolean));
  const today = new Date();
  const todayKey = dateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);
  let streak = 0;
  if (dates.has(todayKey) || dates.has(yesterdayKey)) {
    const cursor = new Date(dates.has(todayKey) ? today : yesterday);
    while (dates.has(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return {
    sessions: historyRecords.length,
    average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    best: scores.length ? Math.max(...scores) : 0,
    xp,
    streak
  };
}

const focusAreaMap = {
  Aptitude: { title: 'Aptitude', description: 'Practice quantitative and logical reasoning.' },
  Technical: { title: 'Technical fundamentals', description: 'Review core technical concepts and explanations.' },
  DSA: { title: 'Data Structures & Algorithms', description: 'Practice problem solving, algorithms, and complexity.' },
  'System Design': { title: 'System Design', description: 'Practice architecture diagrams and trade-offs.' },
  'HR & Behavioral': { title: 'Behavioral STAR', description: 'Structure answers with the Situation, Task, Action, Result method.' },
  'Case Study': { title: 'Case Study', description: 'Practice structured analysis and recommendations.' }
};

function renderFocusAreas() {
  const focusAreas = document.getElementById('focusAreas');
  if (!focusAreas) return;
  const scoresByRound = new Map();
  historyRecords.forEach(record => {
    const score = Number(record.score);
    if (!focusAreaMap[record.round] || !Number.isFinite(score)) return;
    const scores = scoresByRound.get(record.round) || [];
    scores.push(score);
    scoresByRound.set(record.round, scores);
  });
  if (!scoresByRound.size) {
    focusAreas.innerHTML = '<p class="empty-state">Complete an interview to get personalized focus areas.</p>';
    return;
  }
  const rankedAreas = [...scoresByRound.entries()]
    .map(([round, scores]) => ({ round, score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) }))
    .sort((first, second) => first.score - second.score)
    .slice(0, 3);
  focusAreas.innerHTML = rankedAreas.map(area => {
    const details = focusAreaMap[area.round];
    return `<div class="focus-row"><div><strong>${details.title}</strong><small>${details.description}</small></div><span>${area.score}%</span></div>`;
  }).join('');
}

function renderLiveDashboard() {
  const stats = dashboardStats();
  const level = levelForXp(stats.xp);
  const current = stats.xp % 500;
  const percent = Math.round(current / 500 * 100);
  const levelEl = document.getElementById('levelValue');
  if (levelEl) levelEl.textContent = `LVL ${level}`;
  const xpEl = document.getElementById('xpValue');
  if (xpEl) xpEl.textContent = `${stats.xp} XP`;
  const progressText = document.getElementById('xpProgressText');
  if (progressText) progressText.textContent = `${current} / 500 XP to level ${level + 1}`;
  const percentEl = document.getElementById('xpPercent');
  if (percentEl) percentEl.textContent = `${percent}%`;
  const progressBar = document.querySelector('.xp-bar i');
  if (progressBar) progressBar.style.width = `${Math.max(0, percent)}%`;
  const streakLabel = document.getElementById('streakLabel');
  if (streakLabel) streakLabel.textContent = `${stats.streak}-day streak`;
  const streakMessage = document.getElementById('streakMessage');
  if (streakMessage) streakMessage.textContent = stats.streak ? 'Keep practicing daily to extend it.' : 'Complete an interview today to start your streak.';
  const streakValue = document.getElementById('streakValue');
  if (streakValue) streakValue.textContent = stats.streak;
  const sessionCount = document.getElementById('sessionCount');
  if (sessionCount) sessionCount.textContent = stats.sessions;
  const averageScore = document.getElementById('averageScore');
  if (averageScore) averageScore.textContent = `${stats.average}%`;
  const bestScore = document.getElementById('bestScore');
  if (bestScore) bestScore.textContent = `${stats.best}%`;
  renderFocusAreas();
  const recent = document.getElementById('recentSessions');
  if (recent) {
    recent.innerHTML = historyRecords.slice(0, 3).map(record => `<div class="session-item"><div class="session-left"><span class="session-ic">🏢</span><div><strong>${record.company} · ${record.round}</strong><small>${formatDate(record.created_at)} · ${record.duration} · ${Math.round(Number(record.score) / 100 * TOTAL_QUESTIONS)}/${TOTAL_QUESTIONS} marks · Level ${levelForXp(record.xp)}</small></div></div><span class="score-pill ${record.score >= 80 ? 'success' : 'warning'}">${record.score}%</span></div>`).join('') || '<p class="empty-state">No interviews completed yet.</p>';
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleString([], { month: 'short', day: 'numeric' });
}

async function loadDashboardData() {
  await refreshUserName();

  const localRecords = readLocalHistory();
  const token = localStorage.getItem('interviewaiSessionToken');
  if (!token) {
    historyRecords = localRecords;
    renderLiveDashboard();
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/interviews`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Unable to load interview history');
    const payload = await response.json();
    const serverRecords = payload.interviews || [];
    const serverIds = new Set(serverRecords.map(record => String(record.id)));
    historyRecords = [...serverRecords, ...localRecords.filter(record => !serverIds.has(String(record.id)))];
  } catch (error) {
    console.error(error);
    historyRecords = localRecords;
  }
  renderLiveDashboard();
}

updateUserNameUI();

function pageHeader(title, subtitle) {
  return `<header class="page-heading"><div><span class="eyebrow">InterviewAI workspace</span><h1>${title}</h1><p>${subtitle}</p></div><button class="back-home" data-page="home">← Dashboard</button></header>`;
}

function resumeStorageKey() {
  return `interviewaiResume:${savedUser.email || 'guest'}`;
}

function getSavedResumeAnalysis() {
  const keys = [resumeStorageKey(), 'interviewaiResumeLatest'];
  for (const key of keys) {
    try {
      const analysis = JSON.parse(localStorage.getItem(key) || 'null');
      if (analysis && analysis.analysisVersion === ANALYSIS_VERSION && (analysis.text || (analysis.skills && analysis.skills.length))) return analysis;
    } catch (error) {
      localStorage.removeItem(key);
    }
  }
  return null;
}

function historyMarkup(filter = 'All sessions') {
  const roundFilter = filter === 'Behavioral' ? 'HR & Behavioral' : filter;
  const records = filter === 'All sessions' ? historyRecords : historyRecords.filter(record => record.round === roundFilter);
  return `${pageHeader('Session history', 'Review your practice rounds and track your progress over time.')}
    <section class="filter-row">${['All sessions', 'Aptitude', 'Technical', 'DSA', 'Behavioral'].map(name => `<button class="filter-chip ${name === filter ? 'active' : ''}" data-history-filter="${name}">${name}</button>`).join('')}</section>
    <section class="info-card history-card full-history"><h3>All sessions</h3>
      ${records.map(record => `<div class="session-item"><div class="session-left"><span class="session-ic">🏢</span><div><strong>${record.company} · ${record.round}</strong><small>${formatDate(record.created_at)} · ${record.duration} · ${Math.round(Number(record.score) / 100 * TOTAL_QUESTIONS)}/${TOTAL_QUESTIONS} marks · Level ${levelForXp(record.xp)} · ${record.difficulty}</small></div></div><span class="score-pill ${record.score >= 80 ? 'success' : 'warning'}">${record.score}%</span></div>`).join('') || `<p class="empty-state">No ${filter === 'All sessions' ? '' : filter + ' '}interviews completed yet.</p>`}
    </section>`;
}

function resumeMarkup() {
  const savedAnalysis = getSavedResumeAnalysis();
  return `${pageHeader('Resume analyzer', 'Upload your CV to get personalized interview questions.')}
    <section class="info-card upload-card"><div class="upload-icon">📄</div><h3>Drop your resume here</h3><p>PDF or DOCX · Max 5MB</p><input id="resumeFile" type="file" accept=".pdf,.docx" hidden><button class="primary-action" id="uploadResume">${savedAnalysis ? 'Choose another resume' : 'Choose resume'}</button><small id="resumeStatus" class="resume-status">${savedAnalysis ? `${savedAnalysis.filename} analyzed successfully.` : ''}</small></section>
    <section class="info-card"><h3>ATS resume check</h3><div id="resumeAts">${savedAnalysis && savedAnalysis.ats ? atsMarkup(savedAnalysis.ats) : '<p class="empty-state">Your ATS score and recommendations will appear here after analysis.</p>'}</div></section>
    <section class="info-card"><h3>Skills detected</h3><div id="resumeSkills">${savedAnalysis ? resumeSkillsMarkup(savedAnalysis.skills || []) : '<p class="empty-state">Choose a resume to analyze your skills.</p>'}</div></section>`;
}

function resumeSkillsMarkup(skills) {
  if (!skills.length) return '<p class="empty-state">The resume was analyzed, but no recognized technical or communication skills were found. Try a text-based PDF or DOCX.</p>';
  return skills.map(skill => `<div class="skill-row"><span>${skill.name} <b>${skill.score}%</b></span><i style="width:${skill.score}%"></i></div>`).join('');
}

function atsMarkup(ats) {
  const status = ats.ready ? 'Ready to send' : 'Changes recommended';
  const statusClass = ats.ready ? 'ats-ready' : 'ats-needs-work';
  const checks = (ats.checks || []).map(check => `<li class="${check.passed ? 'check-pass' : 'check-fail'}">${check.passed ? '✓' : '×'} ${check.label}</li>`).join('');
  const suggestions = (ats.suggestions || []).map(item => `<li>${item}</li>`).join('');
  return `<div class="ats-summary"><div><strong class="ats-score">${ats.score}%</strong><small>ATS match score</small></div><span class="ats-status ${statusClass}">${status}</span></div><ul class="ats-checks">${checks}</ul>${suggestions ? `<div class="ats-suggestions"><strong>Suggested changes</strong><ul>${suggestions}</ul></div>` : '<p class="ats-success">Your resume passed the main ATS checks and is ready to send to a company.</p>'}`;
}

function profileMarkup() {
  const initial = userName.charAt(0).toUpperCase();
  const notificationsEnabled = localStorage.getItem('interviewaiNotifications') !== 'off';
  const practicePreference = localStorage.getItem('interviewaiPracticePreference') || 'Not selected';
  const testHistory = historyRecords.map(record => `<div class="session-item"><div class="session-left"><span class="session-ic">🏢</span><div><strong>${record.round} · ${record.company}</strong><small>${formatDate(record.created_at)} · ${record.duration} · ${Math.round(Number(record.score) / 100 * TOTAL_QUESTIONS)}/${TOTAL_QUESTIONS} marks · ${record.difficulty}</small></div></div><span class="score-pill ${record.score >= 80 ? 'success' : 'warning'}">${record.score}%</span></div>`).join('');
  const settingDetails = profileSetting === 'notifications'
    ? '<div class="setting-detail">Notifications are currently stored only in this browser. They do not share your interview answers with other users.</div>'
    : profileSetting === 'preferences'
      ? `<div class="setting-detail">Choose your preferred interview focus: <button class="preference-choice" data-preference="Technical">Technical</button><button class="preference-choice" data-preference="HR & Behavioral">HR & Behavioral</button><button class="preference-choice" data-preference="DSA">DSA</button><button class="preference-choice" data-preference="System Design">System Design</button></div>`
      : profileSetting === 'privacy'
        ? '<div class="setting-detail"><strong>Your privacy and safety</strong><p>Your resume analysis and local interview history are stored in this browser. Camera and microphone are used only during an active interview and stop when the interview ends. You can clear local data below.</p><button class="danger-action" id="clearProfileData">Clear local resume and interview data</button></div>'
        : '';
  return `${pageHeader('Your profile', 'Manage your account and keep your preparation focused.')}
    <section class="profile-summary info-card"><div class="large-avatar">${initial}</div><div><h2 id="profileName">${userName}</h2><p>Engineering student · Placement prep</p></div><button class="secondary-action" id="editProfile">Edit profile</button></section>
    <div class="stats-row"><div class="mini-stat"><strong>${dashboardStats().sessions}</strong><small>SESSIONS</small></div><div class="mini-stat"><strong class="success">${dashboardStats().average}%</strong><small>AVG SCORE</small></div><div class="mini-stat"><strong class="warning">Level ${levelForXp(dashboardStats().xp)}</strong><small>CURRENT LEVEL</small></div></div>
    <section class="info-card"><h3>All completed tests</h3>${testHistory || '<p class="empty-state">Complete an interview to see all your test results here.</p>'}</section>
    <section class="info-card"><h3>Settings</h3><div class="settings-item" id="notificationsSetting"><span>🔔</span><strong>Notifications</strong><span>${notificationsEnabled ? 'On' : 'Off'}</span></div><div class="settings-item" id="preferencesSetting"><span>🎯</span><strong>Practice preferences</strong><span>${practicePreference}</span></div><div class="settings-item" id="privacySetting"><span>🛡</span><strong>Privacy & safety</strong><span>View</span></div>${settingDetails}</section>`;
}

function optionCards(key) {
  return practiceOptions[key].map(value => `<button type="button" class="practice-option ${practiceState[key] === value ? 'active' : ''}" data-practice-key="${key}" data-practice-value="${value}">${value}</button>`).join('');
}

function practiceMarkup() {
  if (practiceState.step === 'results') {
    const result = practiceState.result;
    return `${pageHeader('Test result', `${result.company} · ${result.round} · ${result.difficulty}`)}
      <section class="info-card result-card">
        <div class="result-kicker">TEST COMPLETED</div>
        <h2>${result.round} result</h2>
        <div class="result-score"><strong>${result.marks}</strong><span>/ ${TOTAL_QUESTIONS} marks</span></div>
        <div class="result-summary"><div><small>Score</small><strong>${result.score}%</strong></div><div><small>Level</small><strong>Level ${result.level}</strong></div><div><small>XP earned</small><strong>+${result.xp} XP</strong></div></div>
        <p class="result-message">Your result has been saved and your Home, History, and Profile dashboard data has been refreshed.</p>
        <section class="answer-review"><h3>Answer review</h3>${(result.questionResults || []).map((item, index) => `<div class="answer-review-item"><strong>${index + 1}) ${item.status}</strong><p>${item.question}</p><small>Your answer: ${item.userAnswer || 'Skipped'}</small><small>Correct answer: ${item.expectedAnswer}</small></div>`).join('')}</section>
        <div class="practice-actions"><button class="secondary-action" id="viewHistory">View history</button><button class="primary-action" id="resultDashboard">Back to dashboard →</button></div>
      </section>`;
  }
  if (practiceState.step === 'session') {
    const currentQuestion = practiceState.questions[practiceState.questionIndex];
    const questionNumber = practiceState.questionIndex + 1;
    const questionPrompt = isAptitudeSession()
      ? `<div class="interview-question"><div class="question-header-row"><span>${questionNumber}) ${currentQuestion.question}</span><span class="interview-timer timer-inline" id="questionTimer">⏱ 00:50</span></div></div>`
      : `<div class="voice-only-prompt"><div class="question-header-row"><button type="button" class="replay-question" id="replayQuestion" title="Hear question again">🔊 Replay question</button><span class="interview-timer timer-inline" id="questionTimer">⏱ 00:50</span></div><strong>AI interviewer</strong><div class="question-readout">${currentQuestion.question}</div><small>The question is shown here for reading as well. Answer naturally when the microphone starts listening.</small></div>`;
    const answerControl = isAptitudeSession()
      ? `<div class="mcq-options">${currentQuestion.options.map((option, index) => `<label class="mcq-option"><input type="radio" name="aptitudeAnswer" value="${index}"><span>${String.fromCharCode(65 + index)}. ${option}</span></label>`).join('')}</div>`
      : `<div class="voice-answer"><div class="voice-status" id="voiceStatus">Press the microphone and answer naturally.</div><p id="liveTranscript" class="live-transcript">${speechAnswer || 'Your spoken answer will appear here.'}</p><button type="button" class="mic-button" id="micButton">🎙 Start speaking</button></div>`;
    return `${pageHeader(`${practiceState.company} · ${practiceState.round}`, 'Live adaptive interview')}
      <div class="practice-progress"><span class="done"></span><span class="done"></span><span class="done"></span></div>
      <section class="live-interview">
        <div class="live-interview-top"><div><strong>AI Interviewer</strong><small>Question ${questionNumber} of ${TOTAL_QUESTIONS} · ${isAptitudeSession() ? 'MCQ' : 'Live voice interview'} · Camera and microphone monitoring</small></div><span class="interview-timer">${practiceState.difficulty}</span></div>
        <div class="proctor-layout"><div class="session-camera"><video id="cameraVideo" autoplay muted playsinline></video><div class="proctor-status" id="proctorStatus">Checking camera...</div></div><div class="proctor-checks"><strong>Integrity monitor</strong><span>One face visible</span><span>Camera stays active</span></div></div>
        <div class="question-meta">Placement track: ${practiceState.company} · ${practiceState.industry}</div>
        ${questionPrompt}
        <label class="answer-label">${isAptitudeSession() ? 'Choose one answer' : 'Speak your answer'}</label>
        ${answerControl}
        <div class="practice-actions"><button class="secondary-action" id="backToCamera">← Back</button><button class="secondary-action" id="skipQuestion">Skip</button><button class="primary-action" id="submitPracticeAnswer">${questionNumber === TOTAL_QUESTIONS ? 'Finish test →' : 'Next question →'}</button></div>
      </section>`;
  }
  if (practiceState.step === 'camera') {
    return `${pageHeader('Camera check', 'Prepare your workspace before the interview begins.')}
      <div class="practice-progress"><span class="done"></span><span class="done"></span><span></span></div>
      <section class="camera-check info-card"><div class="camera-check-icon">📷</div><h2>Camera and microphone access needed</h2><p>This interview uses your camera for face monitoring and your microphone for live spoken answers.</p><div class="camera-rules"><div>🛡 Face must remain visible</div><div>🛡 No other faces in frame</div><div>🎙 Microphone must stay active</div></div><div class="camera-preview"><video id="cameraCheckVideo" autoplay muted playsinline></video><small id="cameraCheckStatus">Camera and microphone preview will start after permission.</small></div><div class="practice-actions"><button class="secondary-action" id="backToSetup">← Back</button><button class="primary-action" id="startInterview">Enable camera & microphone →</button></div></section>`;
  }
  return `${pageHeader('Set up your session', practiceState.resumeMode ? 'Your next interview will use the skills found in your resume.' : 'Choose your target company, round, industry and difficulty.')}
    ${activeMission ? '<div class="mission-banner">⚡ <strong>Warm-up sprint</strong><span>Complete this interview round to earn +120 XP.</span></div>' : ''}
    <div class="practice-progress"><span class="done"></span><span></span><span></span></div>
    <section class="practice-options">
      <div class="practice-group"><h3>Target company</h3><div class="practice-grid companies">${optionCards('company')}</div></div>
      <div class="practice-group"><h3>Interview round</h3><div class="practice-grid">${optionCards('round')}</div></div>
      <div class="practice-group"><h3>Industry</h3><div class="practice-grid">${optionCards('industry')}</div></div>
      <div class="practice-group"><h3>Difficulty</h3><div class="practice-grid difficulty">${optionCards('difficulty')}</div></div>
    </section>
    <section class="info-card interview-ready"><span class="setup-icon">🎙</span><div><h3>Ready when you are</h3><p>Your AI interviewer will ask realistic questions and give feedback on your answers.</p></div><div class="practice-actions"><button class="secondary-action" id="useResumeInterview">Use my resume</button><button class="primary-action" id="beginInterview">Continue →</button></div></section>`;
}

function stopQuestionTimer() {
  if (questionTimerId) {
    clearInterval(questionTimerId);
    questionTimerId = null;
  }
}

function startQuestionTimer() {
  stopQuestionTimer();
  questionTimeLeft = 50;
  const timerElement = document.getElementById('questionTimer');
  if (timerElement) timerElement.textContent = `⏱ 00:${String(questionTimeLeft).padStart(2, '0')}`;

  questionTimerId = window.setInterval(() => {
    questionTimeLeft -= 1;
    if (timerElement) {
      const safeLeft = Math.max(questionTimeLeft, 0);
      timerElement.textContent = `⏱ 00:${String(safeLeft).padStart(2, '0')}`;
    }

    if (questionTimeLeft <= 0) {
      stopQuestionTimer();
      practiceState.skipCurrent = true;
      const submitButton = document.getElementById('submitPracticeAnswer');
      if (submitButton) submitButton.click();
    }
  }, 1000);
}

function renderPage(page, historyFilter = 'All sessions') {
  syncUserNameFromStorage();
  updateUserNameUI();

  if (!mainPanel) return;
  if (practiceState.step !== 'session') stopQuestionTimer();
  mainPanel.innerHTML = page === 'home' ? homeMarkup : page === 'history' ? historyMarkup(historyFilter) : page === 'resume' ? resumeMarkup() : page === 'profile' ? profileMarkup() : practiceMarkup();
  if (practiceState.step === 'session' && cameraStream) attachCameraPreview();
  if (page === 'home') renderLiveDashboard();
  if (practiceState.step === 'session') {
    startQuestionTimer();
    if (!isAptitudeSession()) {
      window.setTimeout(() => speakCurrentQuestion(), 150);
    }
  }
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  document.querySelectorAll('[data-page]').forEach(item => item.addEventListener('click', () => renderPage(item.dataset.page)));
  document.querySelectorAll('[data-history-filter]').forEach(button => button.addEventListener('click', () => renderPage('history', button.dataset.historyFilter)));
  const missionPlay = document.getElementById('missionPlay');
  if (missionPlay) missionPlay.addEventListener('click', () => {
    activeMission = true;
    practiceState.step = 'setup';
    renderPage('practice');
  });
  const editProfile = document.getElementById('editProfile');
  if (editProfile) editProfile.addEventListener('click', () => {
    const name = window.prompt('Enter your name:', userName);
    if (!name || !name.trim()) return;
    const storedUser = JSON.parse(localStorage.getItem('interviewaiUser') || '{}');
    storedUser.name = name.trim();
    localStorage.setItem('interviewaiUser', JSON.stringify(storedUser));
    userName = name.trim();
    renderPage('profile');
  });
  const notificationsSetting = document.getElementById('notificationsSetting');
  if (notificationsSetting) notificationsSetting.addEventListener('click', () => {
    const enabled = localStorage.getItem('interviewaiNotifications') !== 'off';
    localStorage.setItem('interviewaiNotifications', enabled ? 'off' : 'on');
    profileSetting = 'notifications';
    renderPage('profile');
  });
  const preferencesSetting = document.getElementById('preferencesSetting');
  if (preferencesSetting) preferencesSetting.addEventListener('click', () => {
    profileSetting = 'preferences';
    renderPage('profile');
  });
  const privacySetting = document.getElementById('privacySetting');
  if (privacySetting) privacySetting.addEventListener('click', () => {
    profileSetting = 'privacy';
    renderPage('profile');
  });
  document.querySelectorAll('[data-preference]').forEach(button => button.addEventListener('click', event => {
    localStorage.setItem('interviewaiPracticePreference', event.currentTarget.dataset.preference);
    profileSetting = 'preferences';
    renderPage('profile');
  }));
  const clearProfileData = document.getElementById('clearProfileData');
  if (clearProfileData) clearProfileData.addEventListener('click', () => {
    if (!window.confirm('Clear saved resume analysis and local interview history?')) return;
    localStorage.removeItem(resumeStorageKey());
    localStorage.removeItem('interviewaiResumeLatest');
    localStorage.removeItem(localHistoryKey());
    historyRecords = [];
    profileSetting = 'privacy';
    renderPage('profile');
  });
  const useResumeInterview = document.getElementById('useResumeInterview');
  if (useResumeInterview) useResumeInterview.addEventListener('click', () => {
    const savedAnalysis = getSavedResumeAnalysis();
    if (!savedAnalysis) {
      alert('Please upload and analyze your resume first.');
      renderPage('resume');
      return;
    }
    practiceState.resumeAnalysis = savedAnalysis;
    practiceState.resumeMode = true;
    practiceState.round = 'Technical';
    renderPage('practice');
  });
  const uploadResume = document.getElementById('uploadResume');
  const resumeFile = document.getElementById('resumeFile');
  const resumeStatus = document.getElementById('resumeStatus');
  if (uploadResume && resumeFile) {
    uploadResume.addEventListener('click', () => resumeFile.click());
    resumeFile.addEventListener('change', async () => {
      const file = resumeFile.files[0];
      if (!file) return;
      localStorage.removeItem(resumeStorageKey());
      localStorage.removeItem('interviewaiResumeLatest');
      document.getElementById('resumeAts').innerHTML = '<p class="empty-state">A valid resume is required before ATS analysis.</p>';
      document.getElementById('resumeSkills').innerHTML = '<p class="empty-state">Skills will appear after a valid resume is analyzed.</p>';
      if (!/\.(pdf|docx)$/i.test(file.name)) {
        resumeStatus.textContent = 'Invalid file. Please upload a resume in PDF or DOCX format.';
        resumeStatus.classList.remove('success-message');
        resumeStatus.classList.add('error-message');
        resumeFile.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        resumeStatus.textContent = 'Please choose a file smaller than 5MB.';
        resumeStatus.classList.remove('success-message');
        resumeStatus.classList.add('error-message');
        resumeFile.value = '';
        return;
      }
      uploadResume.disabled = true;
      uploadResume.textContent = 'Analyzing...';
      resumeStatus.textContent = `${file.name} selected.`;
      resumeStatus.classList.remove('success-message', 'error-message');
      const formData = new FormData();
      formData.append('resume', file);
      try {
        const response = await fetch(`${API_BASE}/resume`, { method: 'POST', headers: authHeaders(), body: formData });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Resume analysis failed');
        const savedAnalysis = {...payload, analysisVersion: ANALYSIS_VERSION};
        localStorage.setItem(resumeStorageKey(), JSON.stringify(savedAnalysis));
        localStorage.setItem('interviewaiResumeLatest', JSON.stringify(savedAnalysis));
        document.getElementById('resumeAts').innerHTML = atsMarkup(payload.ats || {score: 0, ready: false, checks: [], suggestions: ['ATS analysis was not returned. Please try again.']});
        document.getElementById('resumeSkills').innerHTML = resumeSkillsMarkup(payload.skills || []);
        resumeStatus.textContent = `${payload.filename} analyzed successfully.`;
        resumeStatus.classList.add('success-message');
        resumeStatus.classList.remove('error-message');
        uploadResume.disabled = false;
        uploadResume.textContent = 'Choose another resume';
      } catch (error) {
        resumeStatus.textContent = error.message;
        resumeStatus.classList.add('error-message');
        resumeStatus.classList.remove('success-message');
        uploadResume.disabled = false;
        uploadResume.textContent = 'Choose resume';
      }
    });
  }
  document.querySelectorAll('[data-practice-key]').forEach(button => button.addEventListener('click', () => {
    practiceState[button.dataset.practiceKey] = button.dataset.practiceValue;
    renderPage('practice');
  }));
  const beginInterview = document.getElementById('beginInterview');
  if (beginInterview) beginInterview.addEventListener('click', () => { practiceState.step = 'camera'; renderPage('practice'); });
  const backToSetup = document.getElementById('backToSetup');
  if (backToSetup) backToSetup.addEventListener('click', () => { stopCameraMonitoring(); practiceState.step = 'setup'; renderPage('practice'); });
  const startInterview = document.getElementById('startInterview');
  if (startInterview) startInterview.addEventListener('click', startCameraAndInterview);
  const micButton = document.getElementById('micButton');
  if (micButton) micButton.addEventListener('click', toggleSpeechRecognition);
  const replayQuestion = document.getElementById('replayQuestion');
  if (replayQuestion) replayQuestion.addEventListener('click', speakCurrentQuestion);
  const skipQuestion = document.getElementById('skipQuestion');
  if (skipQuestion) skipQuestion.addEventListener('click', () => {
    practiceState.skipCurrent = true;
    document.getElementById('submitPracticeAnswer')?.click();
  });
  const backToCamera = document.getElementById('backToCamera');
  if (backToCamera) backToCamera.addEventListener('click', () => { stopCameraMonitoring(); practiceState.step = 'camera'; renderPage('practice'); });
  const submitPracticeAnswer = document.getElementById('submitPracticeAnswer');
  if (submitPracticeAnswer) submitPracticeAnswer.addEventListener('click', async () => {
    if (answerSubmissionPending) return;
    answerSubmissionPending = true;
    const skipped = practiceState.skipCurrent;
    if (!skipped && (!latestProctorStatus || !latestProctorStatus.safe)) {
      answerSubmissionPending = false;
      return;
    }
    const currentQuestion = practiceState.questions[practiceState.questionIndex];
    let points = 0;
    let status = 'Wrong';
    let userAnswer = '';
    if (skipped) {
      await stopSpeechRecognition();
      status = 'Skipped';
    } else if (isAptitudeSession()) {
      const selected = document.querySelector('input[name="aptitudeAnswer"]:checked');
      if (!selected) {
        answerSubmissionPending = false;
        return;
      }
      userAnswer = currentQuestion.options[Number(selected.value)];
      points = Number(selected.value) === currentQuestion.answer ? 1 : 0;
      status = points === 1 ? 'Correct' : 'Wrong';
    } else {
      await stopSpeechRecognition();
      const answer = speechAnswer.trim();
      if (!answer) {
        answerSubmissionPending = false;
        updateVoiceUI('No speech was captured. Start speaking again, then submit your answer.');
        if (!questionTimerId) startQuestionTimer();
        return;
      }
      practiceState.answer = answer;
      userAnswer = answer;
      points = scoreWrittenAnswer(currentQuestion.question, answer);
      status = points === 1 ? 'Correct' : points === 0.5 ? 'Partially correct' : 'Wrong';
      await speakAnswerFeedback(answer, points);
    }
    stopQuestionTimer();
    practiceState.skipCurrent = false;
    practiceState.questionResults.push({ question: currentQuestion.question, status, userAnswer, expectedAnswer: currentQuestion.expectedAnswer || 'Review the question and explain the correct approach.' });
    practiceState.sessionPoints += points;
    if (practiceState.questionIndex === TOTAL_QUESTIONS - 1) {
      const marks = Math.round(practiceState.sessionPoints);
      const score = Math.round(marks / TOTAL_QUESTIONS * 100);
      const xp = 120;
      stopCameraMonitoring();
      const localRecord = {
        id: `local-${Date.now()}`,
        company: practiceState.company,
        round: practiceState.round,
        industry: practiceState.industry,
        difficulty: practiceState.difficulty,
        score,
        xp,
        duration: `${TOTAL_QUESTIONS} questions`,
        created_at: new Date().toISOString()
      };
      writeLocalHistory(localRecord);
      if (localStorage.getItem('interviewaiSessionToken')) {
        try {
          const saveResponse = await fetch(`${API_BASE}/interviews`, { method: 'POST', headers: {...authHeaders(), 'Content-Type': 'application/json'}, body: JSON.stringify({company: practiceState.company, round: practiceState.round, industry: practiceState.industry, difficulty: practiceState.difficulty, score, xp, duration: `${TOTAL_QUESTIONS} questions`}) });
          if (saveResponse.ok) {
            const savedPayload = await saveResponse.json();
            const savedRecord = savedPayload.interview;
            if (savedRecord) replaceLocalHistoryRecord(localRecord.id, savedRecord);
          }
        } catch (error) {
          console.error('Interview saved locally; server save failed:', error);
        }
        await loadDashboardData();
      } else {
        await loadDashboardData();
      }
      practiceState.result = { company: practiceState.company, round: practiceState.round, difficulty: practiceState.difficulty, marks, score, xp, level: levelForXp(dashboardStats().xp), questionResults: practiceState.questionResults };
      practiceState.step = 'results';
      practiceState.questions = [];
      practiceState.questionIndex = 0;
      practiceState.sessionPoints = 0;
      practiceState.questionResults = [];
      practiceState.skipCurrent = false;
      practiceState.answer = '';
      speechAnswer = '';
      speechInterim = '';
      answerSubmissionPending = false;
      renderPage('practice');
      return;
    }
    practiceState.questionIndex += 1;
    practiceState.answer = '';
    speechAnswer = '';
    speechInterim = '';
    answerSubmissionPending = false;
    renderPage('practice');
  });
  const resultDashboard = document.getElementById('resultDashboard');
  if (resultDashboard) resultDashboard.addEventListener('click', () => { practiceState.step = 'setup'; practiceState.result = null; renderPage('home'); });
  const viewHistory = document.getElementById('viewHistory');
  if (viewHistory) viewHistory.addEventListener('click', () => { practiceState.result = null; renderPage('history'); });
}

async function requestCamera(videoElement) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera access requires HTTPS or localhost.');
  if (!cameraStream) cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: true });
  videoElement.srcObject = cameraStream;
  await videoElement.play();
}

async function analyzeCurrentFrame(videoElement) {
  if (!videoElement.videoWidth) throw new Error('Camera is not ready yet.');
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  canvas.getContext('2d').drawImage(videoElement, 0, 0);
  const response = await fetch(`${API_BASE}/proctor/analyze`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: canvas.toDataURL('image/jpeg', 0.72) })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'AI proctoring is unavailable.');
  return payload;
}

function stopCameraMonitoring() {
  if (proctorTimer) clearInterval(proctorTimer);
  proctorTimer = null;
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  stopSpeechRecognition();
  window.speechSynthesis.cancel();
}

function attachCameraPreview() {
  const video = document.getElementById('cameraVideo');
  if (!video || !cameraStream) return;
  video.srcObject = cameraStream;
  video.play().catch(() => {});
}

function updateProctorStatus(status) {
  latestProctorStatus = status;
  const statusElement = document.getElementById('proctorStatus');
  if (!statusElement) return;
  statusElement.textContent = status.safe ? `✓ ${status.message}` : `⚠ ${status.message}`;
  statusElement.className = `proctor-status ${status.safe ? 'safe' : 'unsafe'}`;
  const micButton = document.getElementById('micButton');
  if (micButton && !status.safe && !isListening) micButton.disabled = true;
  if (micButton && status.safe) micButton.disabled = false;
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.onstart = () => updateVoiceUI('AI is speaking. Listen, then press the microphone to answer.');
  const finished = new Promise(resolve => {
    let settled = false;
    let timeoutId;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve();
    };
    timeoutId = window.setTimeout(finish, 5000);
    utterance.onend = () => {
      updateVoiceUI('Your turn. Press the microphone and answer naturally.');
      finish();
    };
    utterance.onerror = finish;
  });
  window.speechSynthesis.speak(utterance);
  return finished;
}

function speakCurrentQuestion() {
  const question = practiceState.questions[practiceState.questionIndex];
  if (!question) return;

  const questionText = `${practiceState.questionIndex + 1}. ${question.question}`;
  const promptBox = document.querySelector('.question-readout');
  if (promptBox) promptBox.textContent = questionText;

  speakText(questionText).then(() => {
    window.setTimeout(() => startSpeechRecognition(), 300);
  });
}

function updateVoiceUI(message) {
  const status = document.getElementById('voiceStatus');
  const transcript = document.getElementById('liveTranscript');
  const button = document.getElementById('micButton');
  if (status) status.textContent = message;
  if (transcript) transcript.textContent = `${speechAnswer}${speechInterim}`.trim() || 'Your spoken answer will appear here.';
  if (button) button.textContent = isListening ? '⏹ Stop speaking' : '🎙 Start speaking';
}

function stopSpeechRecognition() {
  const recognition = speechRecognition;
  if (!recognition) {
    isListening = false;
    return Promise.resolve();
  }
  if (speechStopPromise) return speechStopPromise;
  speechStopPromise = new Promise(resolve => {
    let settled = false;
    let timeoutId;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (speechInterim.trim()) speechAnswer += `${speechInterim.trim()} `;
      speechInterim = '';
      if (speechRecognition === recognition) speechRecognition = null;
      isListening = false;
      speechStopPromise = null;
      updateVoiceUI('Answer captured. Continue when ready.');
      resolve();
    };
    const previousOnEnd = recognition.onend;
    recognition.onend = event => {
      if (previousOnEnd) previousOnEnd.call(recognition, event);
      finish();
    };
    timeoutId = window.setTimeout(finish, 1200);
    try {
      recognition.stop();
    } catch (error) {
      finish();
    }
  });
  return speechStopPromise;
}

function toggleSpeechRecognition() {
  if (isListening) {
    stopSpeechRecognition().then(() => updateVoiceUI('Answer captured. You can continue speaking or submit your answer.'));
    return;
  }
  startSpeechRecognition();
}

function startSpeechRecognition() {
  if (isListening || speechStopPromise) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    updateVoiceUI('Speech recognition is unavailable. Use Google Chrome on localhost.');
    return;
  }
  const recognition = new Recognition();
  speechRecognition = recognition;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onstart = () => {
    isListening = true;
    updateVoiceUI('Listening... speak your answer.');
  };
  recognition.onresult = event => {
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) speechAnswer += `${transcript} `;
      else interim += transcript;
    }
    speechInterim = interim;
    const transcriptElement = document.getElementById('liveTranscript');
    if (transcriptElement) transcriptElement.textContent = `${speechAnswer}${interim}`.trim() || 'Your spoken answer will appear here.';
  };
  recognition.onerror = event => {
    isListening = false;
    updateVoiceUI(event.error === 'not-allowed' ? 'Microphone permission was blocked.' : `Microphone error: ${event.error}`);
  };
  recognition.onend = () => {
    if (speechInterim.trim()) speechAnswer += `${speechInterim.trim()} `;
    speechInterim = '';
    isListening = false;
    if (speechRecognition === recognition) speechRecognition = null;
    if (document.getElementById('micButton')) updateVoiceUI('Answer captured. Continue when ready.');
  };
  try {
    recognition.start();
  } catch (error) {
    isListening = false;
    updateVoiceUI('Press the microphone button to start speaking.');
  }
}

function speakAnswerFeedback(answer, points) {
  const feedback = points === 1
    ? 'Good answer. It addressed important parts of the question. Let us continue.'
    : points === 0.5
      ? 'Partially relevant answer. Add more technical detail and a concrete example.'
      : 'This answer did not match the question closely. Review the topic and try to explain the correct approach.';
  return speakText(feedback);
}

async function startCameraAndInterview() {
  const button = document.getElementById('startInterview');
  const status = document.getElementById('cameraCheckStatus');
  button.disabled = true;
  button.textContent = 'Checking camera...';
  try {
    const video = document.getElementById('cameraCheckVideo');
    await requestCamera(video);
    const result = await analyzeCurrentFrame(video);
    if (!result.safe) throw new Error(result.message);
    latestProctorStatus = result;
    practiceState.questions = await buildQuestionSet();
    practiceState.questionIndex = 0;
    practiceState.sessionPoints = 0;
    practiceState.questionResults = [];
    practiceState.skipCurrent = false;
    practiceState.answer = '';
    speechAnswer = '';
    practiceState.step = 'session';
    renderPage('practice');
    startProctorMonitoring();
  } catch (error) {
    if (status) status.textContent = error.message;
    button.disabled = false;
    button.textContent = 'Enable camera & start →';
  }
}

function startProctorMonitoring() {
  if (!cameraStream) return;
  attachCameraPreview();
  proctorTimer = setInterval(async () => {
    if (proctorBusy) return;
    proctorBusy = true;
    const video = document.getElementById('cameraVideo');
    try {
      if (!video || !video.videoWidth) throw new Error('Camera preview is not ready.');
      updateProctorStatus(await analyzeCurrentFrame(video));
    } catch (error) { updateProctorStatus({ safe: false, message: error.message }); }
    proctorBusy = false;
  }, 2500);
}

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => renderPage(item.dataset.page)));
const startMockInterview = document.querySelector('.start-btn');
if (startMockInterview) startMockInterview.addEventListener('click', () => renderPage('practice'));
const homeMissionPlay = document.getElementById('missionPlay');
if (homeMissionPlay) homeMissionPlay.addEventListener('click', () => {
  activeMission = true;
  practiceState.step = 'setup';
  renderPage('practice');
});

const logout = document.querySelector('.user-card');
if (logout) {
  logout.addEventListener('click', () => {
    localStorage.removeItem('interviewaiSessionToken');
    localStorage.removeItem('interviewaiUser');
    window.location.href = 'index.html';
  });
}

loadDashboardData();
