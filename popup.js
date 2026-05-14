import { getDefaultStats } from './utils.js';

// ── Storage helpers ──────────────────────────────────────────────────────────

async function getBlockedSites() {
  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  return blockedSites;
}

async function saveBlockedSites(sites) {
  await chrome.storage.sync.set({ blockedSites: sites });
}

async function getStats() {
  const { stats } = await chrome.storage.local.get({ stats: null });
  return stats ?? getDefaultStats();
}

async function getTodoGroups() {
  const { todoGroups = [] } = await chrome.storage.local.get({ todoGroups: [] });
  return todoGroups;
}

async function saveTodoGroups(groups) {
  await chrome.storage.local.set({ todoGroups: groups });
}

// ── Tab switching ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
  });
});

// ── Sites: render ────────────────────────────────────────────────────────────

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

// ── Sites: add ───────────────────────────────────────────────────────────────

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

// ── Stats: render + chart ────────────────────────────────────────────────────

function renderStats(stats) {
  document.getElementById('streak').textContent = stats.streak;
  document.getElementById('todayCount').textContent = stats.todayCount;
  drawChart(stats);
}

function getLast7Days(today) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function drawChart(stats) {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  const W = 300;
  const H = 64;
  canvas.width = W;
  canvas.height = H;

  const today = new Date().toISOString().split('T')[0];
  const days = getLast7Days(today);
  const history = { ...stats.history };
  if (stats.todayDate === today) history[today] = stats.todayCount;

  const values = days.map(d => history[d] ?? 0);
  const max = Math.max(...values, 1);

  const barW = 30;
  const gap = Math.floor((W - barW * 7) / 8);
  const labelH = 14;
  const chartH = H - labelH;

  days.forEach((day, i) => {
    const val = values[i];
    const barH = Math.max(4, Math.floor((chartH - 8) * val / max));
    const x = gap + i * (barW + gap);
    const y = chartH - barH;

    ctx.fillStyle = day === today ? '#6366f1' : '#c7d2fe';
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 3);
    ctx.fill();

    const label = new Date(day + 'T12:00:00')
      .toLocaleDateString('tr-TR', { weekday: 'narrow' });
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + barW / 2, H - 2);
  });
}

// ── Todos: helpers ───────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function getNextWeekday(day, hour) {
  const now = new Date();
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  const current = now.getDay();
  let diff = (day - current + 7) % 7;
  if (diff === 0 && now >= d) diff = 7;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

async function setGroupAlarm(groupId, day, hour) {
  const name = `focus-alarm-${groupId}`;
  await chrome.alarms.clear(name);
  chrome.alarms.create(name, { when: getNextWeekday(day, hour), periodInMinutes: 10080 });
}

async function clearGroupAlarm(groupId) {
  await chrome.alarms.clear(`focus-alarm-${groupId}`);
}

// ── Todos: render ────────────────────────────────────────────────────────────

function renderTodoGroups(groups) {
  const container = document.getElementById('todoGroups');
  container.innerHTML = '';

  groups.forEach((group) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'todo-group';

    // Header
    const header = document.createElement('div');
    header.className = 'todo-group-header';

    const title = document.createElement('span');
    title.className = 'todo-group-title';
    title.textContent = group.title;

    const badge = document.createElement('span');
    badge.className = 'alarm-badge';
    badge.style.display = group.alarm ? 'inline' : 'none';
    if (group.alarm) {
      badge.textContent = `⏰ ${DAYS_TR[group.alarm.day]} ${String(group.alarm.hour).padStart(2, '0')}:00`;
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'todo-group-delete';
    delBtn.textContent = 'sil';
    delBtn.title = 'Listeyi sil';
    delBtn.addEventListener('click', async () => {
      const groups = await getTodoGroups();
      const idx = groups.findIndex(g => g.id === group.id);
      if (idx === -1) return;
      await clearGroupAlarm(group.id);
      groups.splice(idx, 1);
      await saveTodoGroups(groups);
      renderTodoGroups(groups);
    });

    header.append(title, badge, delBtn);

    // Todo items
    const items = document.createElement('div');
    items.className = 'todo-items';

    group.todos.forEach((todo) => {
      const item = document.createElement('div');
      item.className = 'todo-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'todo-checkbox';
      cb.checked = todo.done;
      cb.addEventListener('change', async () => {
        const groups = await getTodoGroups();
        const g = groups.find(g => g.id === group.id);
        if (!g) return;
        const t = g.todos.find(t => t.id === todo.id);
        if (t) t.done = cb.checked;
        await saveTodoGroups(groups);
        renderTodoGroups(groups);
      });

      const text = document.createElement('span');
      text.className = 'todo-text' + (todo.done ? ' done' : '');
      text.textContent = todo.text;

      const del = document.createElement('button');
      del.className = 'todo-delete';
      del.textContent = '×';
      del.addEventListener('click', async () => {
        const groups = await getTodoGroups();
        const g = groups.find(g => g.id === group.id);
        if (!g) return;
        g.todos = g.todos.filter(t => t.id !== todo.id);
        await saveTodoGroups(groups);
        renderTodoGroups(groups);
      });

      item.append(cb, text, del);
      items.appendChild(item);
    });

    // Add todo input row
    const addRow = document.createElement('div');
    addRow.className = 'add-todo-row';

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'add-todo-input';
    addInput.placeholder = 'Yeni görev ekle...';

    const addBtn = document.createElement('button');
    addBtn.className = 'add-todo-btn';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', async () => {
      const text = addInput.value.trim();
      if (!text) return;
      const groups = await getTodoGroups();
      const g = groups.find(g => g.id === group.id);
      if (!g) return;
      g.todos.push({ id: uid(), text, done: false });
      await saveTodoGroups(groups);
      renderTodoGroups(groups);
    });

    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });
    addRow.append(addInput, addBtn);

    // Alarm row
    const alarmRow = document.createElement('div');
    alarmRow.className = 'alarm-row';

    const alarmLabel = document.createElement('span');
    alarmLabel.className = 'alarm-label';
    alarmLabel.textContent = group.alarm ? '⏰ Aktif:' : '⏰ Hatırlatıcı kur:';

    const daySelect = document.createElement('select');
    daySelect.className = 'alarm-select';
    DAYS_TR.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = d;
      if (group.alarm && group.alarm.day === i) opt.selected = true;
      daySelect.appendChild(opt);
    });

    const hourSelect = document.createElement('select');
    hourSelect.className = 'alarm-select';
    [8, 9, 10, 11, 12, 14, 16, 18, 20].forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = `${String(h).padStart(2, '0')}:00`;
      if (group.alarm && group.alarm.hour === h) opt.selected = true;
      hourSelect.appendChild(opt);
    });

    const setBtn = document.createElement('button');
    setBtn.className = 'alarm-set-btn';
    setBtn.textContent = group.alarm ? 'Güncelle' : 'Ayarla';
    setBtn.addEventListener('click', async () => {
      const day = Number(daySelect.value);
      const hour = Number(hourSelect.value);
      const groups = await getTodoGroups();
      const g = groups.find(g => g.id === group.id);
      if (!g) return;
      g.alarm = { day, hour };
      await saveTodoGroups(groups);
      await setGroupAlarm(group.id, day, hour);
      renderTodoGroups(groups);
    });

    alarmRow.append(alarmLabel, daySelect, hourSelect, setBtn);

    if (group.alarm) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'alarm-clear-btn';
      clearBtn.textContent = 'Kaldır';
      clearBtn.addEventListener('click', async () => {
        const groups = await getTodoGroups();
        const g = groups.find(g => g.id === group.id);
        if (!g) return;
        g.alarm = null;
        await saveTodoGroups(groups);
        await clearGroupAlarm(group.id);
        renderTodoGroups(groups);
      });
      alarmRow.appendChild(clearBtn);
    }

    groupEl.append(header, items, addRow, alarmRow);
    container.appendChild(groupEl);
  });
}

// ── Todos: add group ─────────────────────────────────────────────────────────

document.getElementById('addGroupBtn').addEventListener('click', async () => {
  const input = document.getElementById('groupTitleInput');
  const title = input.value.trim();
  if (!title) return;

  const groups = await getTodoGroups();
  groups.push({ id: uid(), title, todos: [], alarm: null });
  await saveTodoGroups(groups);
  renderTodoGroups(groups);
  input.value = '';
});

document.getElementById('groupTitleInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('addGroupBtn').click();
});

// ── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const [sites, stats, groups] = await Promise.all([
    getBlockedSites(), getStats(), getTodoGroups()
  ]);
  renderSiteList(sites);
  renderStats(stats);
  renderTodoGroups(groups);
})();
