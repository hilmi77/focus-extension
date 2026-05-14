import { getDefaultStats } from './utils.js';

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

    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.dataset.index = i;
    btn.title = 'Sil';
    btn.textContent = '✕';
    btn.addEventListener('click', async () => {
      const current = await getBlockedSites();
      current.splice(i, 1);
      await saveBlockedSites(current);
      renderSiteList(current);
    });

    li.append(source, arrow, target, btn);
    list.appendChild(li);
  });
}

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

document.getElementById('addBtn').addEventListener('click', async () => {
  const sourceInput = document.getElementById('sourceInput');
  const targetInput = document.getElementById('targetInput');

  const source = sourceInput.value.trim()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '');
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

(async () => {
  const [sites, stats] = await Promise.all([getBlockedSites(), getStats()]);
  renderSiteList(sites);
  renderStats(stats);
})();
