import { getState, startPomodoro, stopPomodoro, pausePomodoro, resumePomodoro, updateSettings, getPomodoroStats } from './pomodoro.js';

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

async function getBlockedSites() {
  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  return blockedSites;
}

async function saveBlockedSites(sites) {
  await chrome.storage.sync.set({ blockedSites: sites });
}

async function getStats() {
  return getPomodoroStats();
}

// ── Notes ─────────────────────────────────────────────────────────────────────

async function getNotes() {
  const { notes = [] } = await chrome.storage.local.get({ notes: [] });
  return notes;
}

async function saveNotes(notes) {
  await chrome.storage.local.set({ notes });
}

function renderNotes(notes) {
  const list = document.getElementById('notesList');
  const clearBtn = document.getElementById('notesClearBtn');
  list.innerHTML = '';
  clearBtn.classList.toggle('hidden', notes.length === 0);
  notes.forEach((note, i) => {
    const li = document.createElement('li');
    li.className = 'note-item' + (note.done ? ' done' : '');

    const check = document.createElement('span');
    check.className = 'note-check';
    check.addEventListener('click', async () => {
      const current = await getNotes();
      current[i].done = !current[i].done;
      await saveNotes(current);
      renderNotes(current);
    });

    const text = document.createElement('span');
    text.className = 'note-text';
    text.textContent = note.text;

    const del = document.createElement('button');
    del.className = 'note-delete';
    del.textContent = '×';
    del.title = 'Sil';
    del.addEventListener('click', async () => {
      const current = await getNotes();
      current.splice(i, 1);
      await saveNotes(current);
      renderNotes(current);
    });

    li.append(check, text, del);
    list.appendChild(li);
  });
}

async function addNote(text) {
  const current = await getNotes();
  current.push({ text, done: false });
  await saveNotes(current);
  renderNotes(current);
}

document.getElementById('noteAddBtn').addEventListener('click', async () => {
  const input = document.getElementById('noteInput');
  const text = input.value.trim();
  if (!text) return;
  await addNote(text);
  input.value = '';
});

document.getElementById('notesClearBtn').addEventListener('click', async () => {
  await saveNotes([]);
  renderNotes([]);
});

document.getElementById('noteInput').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const input = e.target;
  const text = input.value.trim();
  if (!text) return;
  await addNote(text);
  input.value = '';
});

// ── Site list ────────────────────────────────────────────────────────────────

let editingIndex = null;

function renderSiteList(sites) {
  const list = document.getElementById('siteList');
  list.innerHTML = '';

  if (sites.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Henüz site eklenmedi.';
    list.appendChild(empty);
    return;
  }

  sites.forEach((site, i) => {
    const li = document.createElement('li');
    li.className = 'site-item';

    const source = document.createElement('span');
    source.className = 'site-source';
    source.textContent = site.source;

    const arrow = document.createElement('span');
    arrow.className = 'site-arrow';
    arrow.textContent = '→';

    const target = document.createElement('span');
    target.className = 'site-target';
    target.textContent = site.target;

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.title = 'Düzenle';
    editBtn.textContent = 'düzenle';
    editBtn.addEventListener('click', () => openEdit(i, site));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Sil';
    deleteBtn.textContent = 'sil';
    deleteBtn.addEventListener('click', async () => {
      const current = await getBlockedSites();
      current.splice(i, 1);
      await saveBlockedSites(current);
      closeEdit();
      renderSiteList(current);
    });

    li.append(source, arrow, target, editBtn, deleteBtn);
    list.appendChild(li);
  });
}

function openEdit(index, site) {
  editingIndex = index;
  document.getElementById('editSource').value = site.source;
  document.getElementById('editTarget').value = site.target;
  document.getElementById('editModal').classList.remove('hidden');
  document.getElementById('addSection').classList.add('hidden');
}

function closeEdit() {
  editingIndex = null;
  document.getElementById('editModal').classList.add('hidden');
  document.getElementById('addSection').classList.remove('hidden');
}

document.getElementById('editCancelBtn').addEventListener('click', closeEdit);

document.getElementById('editSaveBtn').addEventListener('click', async () => {
  if (editingIndex === null) return;
  const source = document.getElementById('editSource').value.trim()
    .replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  let target = document.getElementById('editTarget').value.trim();
  if (!source || !target) return;
  if (!target.startsWith('http')) target = 'https://' + target;
  const current = await getBlockedSites();
  current[editingIndex] = { source, target };
  await saveBlockedSites(current);
  closeEdit();
  renderSiteList(current);
});

// ── Add site ─────────────────────────────────────────────────────────────────

document.getElementById('addBtn').addEventListener('click', async () => {
  const sourceInput = document.getElementById('sourceInput');
  const targetInput = document.getElementById('targetInput');
  const source = sourceInput.value.trim()
    .replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  let target = targetInput.value.trim();
  if (!source || !target) return;
  if (!target.startsWith('http')) target = 'https://' + target;
  const current = await getBlockedSites();
  if (current.some(s => s.source === source)) return;
  current.push({ source, target });
  await saveBlockedSites(current);
  renderSiteList(current);
  sourceInput.value = '';
  targetInput.value = '';
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMins(m) {
  if (m <= 0) return '0dk';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}dk`;
  if (rem === 0) return `${h}sa`;
  return `${h}sa ${rem}dk`;
}

function calcProjected(goal, settings) {
  const { workMins, breakMins, longBreakMins, roundsBeforeLongBreak } = settings;
  const work = goal * workMins;
  if (goal <= 1) return { work, rest: 0 };
  const totalBreaks = goal - 1;
  const longBreaks = Math.floor(goal / roundsBeforeLongBreak);
  const shortBreaks = Math.max(0, totalBreaks - longBreaks);
  const rest = shortBreaks * breakMins + longBreaks * longBreakMins;
  return { work, rest };
}

function estimateBreakMins(rounds, settings) {
  if (rounds <= 1) return 0;
  const { breakMins, longBreakMins, roundsBeforeLongBreak } = settings;
  const totalBreaks = rounds - 1;
  const longBreaks = Math.floor(rounds / roundsBeforeLongBreak);
  const shortBreaks = Math.max(0, totalBreaks - longBreaks);
  return shortBreaks * breakMins + longBreaks * longBreakMins;
}

// ── Goal ──────────────────────────────────────────────────────────────────────

async function getGoal() {
  const { dailyGoal = 8 } = await chrome.storage.local.get({ dailyGoal: 8 });
  return dailyGoal;
}

function renderGoal(todayRounds, goal, settings) {
  const pct = Math.min(100, Math.round((todayRounds / goal) * 100));
  const fill = document.getElementById('goalBarFill');
  const text = document.getElementById('goalProgressText');
  const hint = document.getElementById('goalHint');
  fill.style.width = pct + '%';
  fill.classList.toggle('done', todayRounds >= goal);
  if (todayRounds >= goal) {
    const { work, rest } = calcProjected(goal, settings);
    text.textContent = `Tebrikler! ${formatMins(work)} çalıştın · ${formatMins(rest)} mola yaptın`;
    text.classList.add('done');
  } else {
    text.textContent = `${todayRounds} / ${goal} tur tamamlandı`;
    text.classList.remove('done');
  }
  document.getElementById('goalInput').value = goal;
  if (hint && settings) {
    const { work, rest } = calcProjected(goal, settings);
    hint.textContent = `${goal} tur = ${formatMins(work)} çalışma · ${formatMins(rest)} mola`;
  }
}

document.getElementById('goalInput').addEventListener('change', async (e) => {
  const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
  e.target.value = val;
  await chrome.storage.local.set({ dailyGoal: val });
  const [{ todayRounds }, state] = await Promise.all([getPomodoroStats(), getState()]);
  renderGoal(todayRounds, val, state.settings);
});

document.getElementById('goalResetBtn').addEventListener('click', async () => {
  await stopPomodoro();
  chrome.runtime.sendMessage({ type: 'POMO_STOPPED' });
  await chrome.storage.local.remove('pomoStats');
  const [goal, state] = await Promise.all([getGoal(), getState()]);
  renderGoal(0, goal, state.settings);
  renderStats({ todayRounds: 0, todayFocusMins: 0 }, state.settings);
  renderPomodoro(state);
});

// ── Stats ─────────────────────────────────────────────────────────────────────

function renderStats({ todayRounds, todayFocusMins }, settings) {
  document.getElementById('todayRounds').textContent = todayRounds;
  document.getElementById('todayFocusMins').textContent = formatMins(todayFocusMins);
  const breakMins = settings ? estimateBreakMins(todayRounds, settings) : 0;
  document.getElementById('todayBreakMins').textContent = formatMins(breakMins);
}

// ── Pomodoro UI ───────────────────────────────────────────────────────────────

const PHASE_LABELS = { work: 'Çalışıyor', break: 'Mola', longBreak: 'Uzun Mola' };

let pomodoroTick = null;

function renderPomodoro(state) {
  const phaseEl = document.getElementById('pomoPhase');
  const timerEl = document.getElementById('pomoTimer');
  const startBtn = document.getElementById('pomoStartBtn');
  const pauseBtn = document.getElementById('pomoPauseBtn');
  const resumeBtn = document.getElementById('pomoResumeBtn');
  const resetBtn = document.getElementById('pomoResetBtn');
  const dots = document.querySelectorAll('.round-dot');

  if (state.active) {
    phaseEl.textContent = PHASE_LABELS[state.phase];
  } else if (state.paused) {
    phaseEl.textContent = `${PHASE_LABELS[state.phase]} — Duraklatıldı`;
  } else {
    phaseEl.textContent = 'Hazır';
  }
  phaseEl.className = 'pomo-phase' + (state.active || state.paused ? ' ' + state.phase : '');

  dots.forEach((dot, i) => {
    dot.classList.toggle('done', i < state.round - 1);
  });

  if (state.active && state.endTime) {
    timerEl.textContent = formatMs(Math.max(0, state.endTime - Date.now()));
    timerEl.classList.remove('paused');
    startBtn.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');
  } else if (state.paused && state.remainingMs != null) {
    timerEl.textContent = formatMs(state.remainingMs);
    timerEl.classList.add('paused');
    startBtn.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
  } else {
    const { settings, phase } = state;
    const mins = phase === 'work' ? settings.workMins
               : phase === 'break' ? settings.breakMins
               : settings.longBreakMins;
    timerEl.textContent = `${String(mins).padStart(2, '0')}:00`;
    timerEl.classList.remove('paused');
    startBtn.classList.remove('hidden');
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
  }

  document.getElementById('pomoWorkMins').value = state.settings.workMins;
  document.getElementById('pomoBreakMins').value = state.settings.breakMins;
  document.getElementById('pomoLongMins').value = state.settings.longBreakMins;
}

function formatMs(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startTick(initialState) {
  clearInterval(pomodoroTick);
  if (!initialState.active || !initialState.endTime) return;
  let lastPhase = initialState.phase;
  pomodoroTick = setInterval(async () => {
    const current = await getState();
    if (!current.active || !current.endTime) {
      clearInterval(pomodoroTick);
      renderPomodoro(current);
      return;
    }
    if (current.phase !== lastPhase) {
      lastPhase = current.phase;
      renderPomodoro(current);
    }
    document.getElementById('pomoTimer').textContent =
      formatMs(Math.max(0, current.endTime - Date.now()));
  }, 1000);
}

document.getElementById('pomoStartBtn').addEventListener('click', async () => {
  await startPomodoro();
  chrome.runtime.sendMessage({ type: 'POMO_STARTED' });
  const state = await getState();
  renderPomodoro(state);
  startTick(state);
});

document.getElementById('pomoPauseBtn').addEventListener('click', async () => {
  clearInterval(pomodoroTick);
  await pausePomodoro();
  chrome.runtime.sendMessage({ type: 'POMO_PAUSED' });
  const state = await getState();
  renderPomodoro(state);
});

document.getElementById('pomoResumeBtn').addEventListener('click', async () => {
  await resumePomodoro();
  chrome.runtime.sendMessage({ type: 'POMO_RESUMED' });
  const state = await getState();
  renderPomodoro(state);
  startTick(state);
});

document.getElementById('pomoResetBtn').addEventListener('click', async () => {
  clearInterval(pomodoroTick);
  await stopPomodoro();
  chrome.runtime.sendMessage({ type: 'POMO_STOPPED' });
  const state = await getState();
  renderPomodoro(state);
});

['pomoWorkMins', 'pomoBreakMins', 'pomoLongMins'].forEach(id => {
  document.getElementById(id).addEventListener('change', async (e) => {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    e.target.value = val;
    const key = id === 'pomoWorkMins' ? 'workMins'
              : id === 'pomoBreakMins' ? 'breakMins'
              : 'longBreakMins';
    await updateSettings({ [key]: val });
  });
});

// ── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const [sites, stats, pomoState, notes, goal] = await Promise.all([
    getBlockedSites(), getStats(), getState(), getNotes(), getGoal()
  ]);
  renderSiteList(sites);
  renderStats(stats, pomoState.settings);
  renderPomodoro(pomoState);
  startTick(pomoState);
  renderNotes(notes);
  renderGoal(stats.todayRounds, goal, pomoState.settings);
})();
