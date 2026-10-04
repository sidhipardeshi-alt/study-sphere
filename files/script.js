'use strict';
/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'English', 'Computer Science'];

/* ---------- State ---------- */
let tasks = load('ss_tasks', []);
let notes = load('ss_notes', []);
let goals = load('ss_goals', []);
let timetable = load('ss_timetable', []);
let sessions = load('ss_sessions', { count: 0, minutes: 0 });
let progress = load('ss_progress', Object.fromEntries(SUBJECTS.map(s => [s, 0])));
let taskFilter = 'all';
let editingNote = null;

/* ---------- Dashboard ---------- */
function overall() { return Math.round(SUBJECTS.reduce((a, s) => a + (+progress[s] || 0), 0) / SUBJECTS.length); }
function renderStats() {
  $('stTotal').textContent = tasks.length;
  $('stDone').textContent = tasks.filter(t => t.done).length;
  $('stHours').textContent = (sessions.minutes / 60).toFixed(1);
  $('stGoals').textContent = goals.filter(g => !g.done).length;
  $('stProg').textContent = overall() + '%';
  $('overallBar').style.width = overall() + '%';
  $('sessionCount').textContent = sessions.count;
}

/* ---------- Tasks ---------- */
function renderTasks() {
  const list = tasks.filter(t => taskFilter === 'all' || (taskFilter === 'pending' && !t.done) ||
    (taskFilter === 'completed' && t.done) || (taskFilter === 'high' && t.priority === 'High'));
  $('taskList').innerHTML = list.length ? list.map(taskCard).join('') : '<p class="meta">No tasks here yet.</p>';
  renderStats();
}
function taskCard(t) {
  return `<div class="card item ${t.done ? 'done' : ''}"><h3>${esc(t.name)}</h3>
  <span class="tag">${esc(t.subject)}</span><span class="tag ${t.priority}">${t.priority}</span>
  <div class="meta">Due: ${t.due || 'No date'}</div>
  <div class="acts"><button class="sm" data-act="toggleTask" data-id="${t.id}">${t.done ? 'Mark pending' : 'Mark done'}</button>
  <button class="sm del" data-act="delTask" data-id="${t.id}">Delete</button></div></div>`;
}
$('taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('taskName').value.trim(), subject = $('taskSubject').value.trim();
  if (!name) return $('taskErr').textContent = 'Please enter a task name.';
  if (!subject) return $('taskErr').textContent = 'Please enter a subject.';
  tasks.unshift({ id: uid(), name, subject, priority: $('taskPriority').value, due: $('taskDue').value, done: false });
  save('ss_tasks', tasks); e.target.reset(); $('taskPriority').value = 'Medium'; $('taskErr').textContent = ''; renderTasks();
});
$('taskFilters').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  taskFilter = b.dataset.f;
  document.querySelectorAll('#taskFilters .chip').forEach(c => c.classList.toggle('active', c === b));
  renderTasks();
});

/* ---------- Timetable ---------- */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function renderTimetable() {
  $('ttGrid').innerHTML = DAYS.map(d => {
    const slots = timetable.filter(s => s.day === d).sort((a, b) => a.start.localeCompare(b.start));
    return `<div class="card"><h3>${d}</h3>${slots.length ? slots.map(s =>
      `<div class="slot"><span><b>${esc(s.subject)}</b><br>${s.start} – ${s.end}</span>
      <button data-act="delSlot" data-id="${s.id}" aria-label="Remove">✕</button></div>`).join('') : '<p class="meta">Free day</p>'}</div>`;
  }).join('');
}
$('ttForm').addEventListener('submit', e => {
  e.preventDefault();
  const subject = $('ttSubject').value.trim(), start = $('ttStart').value, end = $('ttEnd').value;
  if (!subject) return $('ttErr').textContent = 'Please enter a subject name.';
  if (!start || !end) return $('ttErr').textContent = 'Please choose a start and end time.';
  if (end <= start) return $('ttErr').textContent = 'End time must be after start time.';
  timetable.push({ id: uid(), subject, day: $('ttDay').value, start, end });
  save('ss_timetable', timetable); e.target.reset(); $('ttErr').textContent = ''; renderTimetable();
});

/* ---------- Notes ---------- */
function noteCard(n) {
  return `<div class="card item"><h3>${esc(n.title)}</h3><p>${esc(n.body).replace(/\n/g, '<br>')}</p>
  <div class="acts"><button class="sm" data-act="editNote" data-id="${n.id}">Edit</button>
  <button class="sm del" data-act="delNote" data-id="${n.id}">Delete</button></div></div>`;
}
function renderNotes() {
  const q = $('noteSearch').value.trim().toLowerCase();
  const list = notes.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q));
  $('noteList').innerHTML = list.length ? list.map(noteCard).join('') : '<p class="meta">No notes found.</p>';
}
function resetNoteForm() {
  editingNote = null; $('noteForm').reset(); $('noteSave').textContent = 'Save note'; $('noteCancel').classList.add('hidden');
}
$('noteForm').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('noteTitle').value.trim(), body = $('noteBody').value.trim();
  if (!title) return $('noteErr').textContent = 'Please enter a note title.';
  if (!body) return $('noteErr').textContent = 'Please enter some note content.';
  if (editingNote) Object.assign(notes.find(n => n.id === editingNote), { title, body });
  else notes.unshift({ id: uid(), title, body });
  save('ss_notes', notes); $('noteErr').textContent = ''; resetNoteForm(); renderNotes();
});
$('noteCancel').addEventListener('click', () => { resetNoteForm(); $('noteErr').textContent = ''; });
$('noteSearch').addEventListener('input', renderNotes);

/* ---------- Progress ---------- */
function renderProgress() {
  $('progressList').innerHTML = SUBJECTS.map(s => `<div class="card prog"><h3>${s}</h3>
  <div class="meta"><span id="pv-${s.replace(/\s/g, '')}">${progress[s]}</span>% complete</div>
  <div class="bar"><div class="fill" style="width:${progress[s]}%"></div></div>
  <input type="range" min="0" max="100" value="${progress[s]}" data-subject="${s}" aria-label="${s} progress"></div>`).join('');
}
$('progressList').addEventListener('input', e => {
  const s = e.target.dataset.subject; if (!s) return;
  progress[s] = +e.target.value;
  const card = e.target.closest('.card');
  card.querySelector('.fill').style.width = progress[s] + '%';
  card.querySelector('span').textContent = progress[s];
  save('ss_progress', progress); renderStats();
});

/* ---------- Goals ---------- */
function goalCard(g) {
  return `<div class="card item ${g.done ? 'done' : ''}"><h3>${esc(g.name)}</h3>
  <div class="meta">Target: ${g.date || 'No date'}</div>
  <div class="acts"><button class="sm" data-act="toggleGoal" data-id="${g.id}">${g.done ? 'Reopen' : 'Mark completed'}</button>
  <button class="sm del" data-act="delGoal" data-id="${g.id}">Delete</button></div></div>`;
}
function renderGoals() {
  $('goalList').innerHTML = goals.length ? goals.map(goalCard).join('') : '<p class="meta">No goals yet. Add your first one above.</p>';
  renderStats();
}
$('goalForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('goalName').value.trim();
  if (!name) return $('goalErr').textContent = 'Please enter a goal.';
  goals.unshift({ id: uid(), name, date: $('goalDate').value, done: false });
  save('ss_goals', goals); e.target.reset(); $('goalErr').textContent = ''; renderGoals();
});

/* ---------- Click actions (delegated) ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'toggleTask': { const t = tasks.find(x => x.id === id); t.done = !t.done; save('ss_tasks', tasks); renderTasks(); break; }
    case 'delTask': tasks = tasks.filter(x => x.id !== id); save('ss_tasks', tasks); renderTasks(); break;
    case 'delSlot': timetable = timetable.filter(x => x.id !== id); save('ss_timetable', timetable); renderTimetable(); break;
    case 'editNote': { const n = notes.find(x => x.id === id); editingNote = id; $('noteTitle').value = n.title; $('noteBody').value = n.body;
      $('noteSave').textContent = 'Update note'; $('noteCancel').classList.remove('hidden'); $('noteForm').scrollIntoView({ behavior: 'smooth', block: 'center' }); break; }
    case 'delNote': notes = notes.filter(x => x.id !== id); if (editingNote === id) resetNoteForm(); save('ss_notes', notes); renderNotes(); break;
    case 'toggleGoal': { const g = goals.find(x => x.id === id); g.done = !g.done; save('ss_goals', goals); renderGoals(); break; }
    case 'delGoal': goals = goals.filter(x => x.id !== id); save('ss_goals', goals); renderGoals(); break;
  }
  if ($('globalSearch').value.trim()) runSearch();
});

/* ---------- Global search ---------- */
function runSearch() {
  const q = $('globalSearch').value.trim().toLowerCase(), box = $('searchResults');
  if (!q) { box.classList.add('hidden'); return; }
  const out = [
    ...tasks.filter(t => (t.name + ' ' + t.subject).toLowerCase().includes(q)).map(t => `<div class="card"><small>Task</small><h3>${esc(t.name)}</h3><p class="meta">${esc(t.subject)} · ${t.priority}${t.done ? ' · Done' : ''}</p></div>`),
    ...notes.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(q)).map(n => `<div class="card"><small>Note</small><h3>${esc(n.title)}</h3><p class="meta">${esc(n.body.slice(0, 90))}</p></div>`),
    ...goals.filter(g => g.name.toLowerCase().includes(q)).map(g => `<div class="card"><small>Goal</small><h3>${esc(g.name)}</h3><p class="meta">${g.done ? 'Completed' : 'In progress'}</p></div>`)
  ];
  $('searchList').innerHTML = out.length ? out.join('') : '<p class="meta">No results found.</p>';
  box.classList.remove('hidden');
}
$('globalSearch').addEventListener('input', runSearch);

/* ---------- Study timer ---------- */
const MODES = { study: { s: 25 * 60, label: 'Study session' }, break: { s: 5 * 60, label: 'Break time' } };
let mode = 'study', remaining = MODES.study.s, tick = null;
function drawTimer() {
  $('timerDisplay').textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
  $('timerMode').textContent = MODES[mode].label;
  $('tMode').textContent = mode === 'study' ? 'Switch to break' : 'Switch to study';
}
function stopTimer() { clearInterval(tick); tick = null; }
function finishTimer() {
  stopTimer();
  if (mode === 'study') {
    sessions.count++; sessions.minutes += 25; save('ss_sessions', sessions); renderStats();
    $('timerMsg').textContent = '🎉 Study session complete! Take a 5-minute break.';
  } else $('timerMsg').textContent = '⏰ Break over. Ready for the next session?';
  try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play().catch(() => {}); } catch { /* ignore */ }
}
$('tStart').addEventListener('click', () => {
  if (tick) return; $('timerMsg').textContent = '';
  tick = setInterval(() => { remaining--; drawTimer(); if (remaining <= 0) finishTimer(); }, 1000);
});
$('tPause').addEventListener('click', stopTimer);
$('tReset').addEventListener('click', () => { stopTimer(); remaining = MODES[mode].s; $('timerMsg').textContent = ''; drawTimer(); });
$('tMode').addEventListener('click', () => { stopTimer(); mode = mode === 'study' ? 'break' : 'study'; remaining = MODES[mode].s; $('timerMsg').textContent = ''; drawTimer(); });

/* ---------- Theme & navigation ---------- */
function applyTheme(t) { document.documentElement.dataset.theme = t; $('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙'; }
$('themeBtn').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); save('ss_theme', t);
});
$('menuBtn').addEventListener('click', () => $('navLinks').classList.toggle('open'));
$('navLinks').addEventListener('click', e => { if (e.target.tagName === 'A') $('navLinks').classList.remove('open'); });

/* ---------- Init ---------- */
applyTheme(load('ss_theme', 'light'));
renderTasks(); renderTimetable(); renderNotes(); renderProgress(); renderGoals(); drawTimer();
