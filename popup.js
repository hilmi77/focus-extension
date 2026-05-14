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
  if (sites.length === 0) {
    list.innerHTML = '<p class="empty-state">Henüz site eklenmedi.</p>';
    return;
  }
  list.innerHTML = sites.map((site, i) => `
    <li class="site-item">
      <span class="site-source">${site.source}</span>
      <span class="site-arrow">→</span>
      <span class="site-target">${site.target}</span>
      <button class="delete-btn" data-index="${i}" title="Sil">✕</button>
    </li>
  `).join('');

  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.index);
      const current = await getBlockedSites();
      current.splice(idx, 1);
      await saveBlockedSites(current);
      renderSiteList(current);
    });
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
