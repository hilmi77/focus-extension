# Focus Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dikkat dağıtıcı siteleri engelleyen, motivasyon sayfası gösteren, streak ve haftalık grafik ile istatistik takip eden kişisel Chrome extension'ı.

**Architecture:** Manifest V3 Chrome extension. Background service worker `webNavigation` API ile URL'leri dinler, engellenen siteye girişi `blocked.html`'e yönlendirir. Popup site çiftlerini yönetir, streak + günlük sayaç + haftalık canvas bar chart gösterir. Saf HTML/CSS/JS, ES Modules, build adımı yok.

**Tech Stack:** Chrome Extension Manifest V3, ES Modules, Canvas API, `chrome.storage.sync/local`, `chrome.webNavigation`, `chrome.tabs`, Node.js built-in test runner (`node:test`)

---

## Dosya Haritası

| Dosya | Sorumluluk |
|-------|-----------|
| `manifest.json` | Extension config, izinler, giriş noktaları |
| `utils.js` | Pure fonksiyonlar: URL eşleştirme, istatistik logic |
| `background.js` | webNavigation listener, redirect, stats güncelleme |
| `blocked.html` | Motivation sayfası markup |
| `blocked.js` | URL param parse, buton handler |
| `blocked.css` | Koyu tema, merkezi layout, stillenmiş buton |
| `popup.html` | Popup markup |
| `popup.js` | Storage okuma/yazma, DOM render, canvas grafik |
| `popup.css` | Popup stili, kart layout |
| `generate-icons.js` | PNG icon oluşturucu (çalıştır, commit'e dahil etme) |
| `icons/` | 16/48/128px PNG ikonlar |
| `tests/utils.test.mjs` | utils.js unit testleri |

---

### Task 1: Proje İskeleti + İkonlar

**Files:**
- Create: `manifest.json`
- Create: `generate-icons.js`
- Create: `icons/` klasörü

- [ ] **Step 1: manifest.json oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Focus",
  "version": "1.0.0",
  "description": "Dikkat dağıtıcı siteleri engelle, üretken sitelere yönlen.",
  "permissions": ["storage", "webNavigation", "tabs"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["blocked.html"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

- [ ] **Step 2: Icon üretici script oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/generate-icons.js`:

```javascript
const zlib = require('zlib');
const fs = require('fs');

function uint32BE(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(n, 0);
  return buf;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = uint32BE(data.length);
  const crcVal = uint32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function createPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    uint32BE(size), uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0])
  ]));
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const idat = chunk('IDAT', zlib.deflateSync(Buffer.concat(rows)));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

fs.mkdirSync('icons', { recursive: true });
[16, 48, 128].forEach(size => {
  fs.writeFileSync(`icons/icon${size}.png`, createPNG(size, 99, 102, 241));
  console.log(`✓ icon${size}.png`);
});
```

- [ ] **Step 3: İkonları üret**

```bash
cd /Users/hilmikale/Developer/Projects/focus-extension
node generate-icons.js
```

Beklenen çıktı:
```
✓ icon16.png
✓ icon48.png
✓ icon128.png
```

- [ ] **Step 4: Commit**

```bash
cd /Users/hilmikale/Developer/Projects/focus-extension
git add manifest.json generate-icons.js icons/
git commit -m "feat: proje iskeleti ve ikonlar"
```

---

### Task 2: URL Eşleştirme + İstatistik Fonksiyonları (utils.js)

**Files:**
- Create: `utils.js`
- Create: `tests/utils.test.mjs`

- [ ] **Step 1: Failing testleri yaz**

`/Users/hilmikale/Developer/Projects/focus-extension/tests/utils.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findMatch, incrementStats, getDefaultStats, trimHistory } from '../utils.js';

describe('findMatch', () => {
  const sites = [
    { source: 'instagram.com', target: 'https://react.dev' },
    { source: 'x.com', target: 'https://nodejs.org' },
  ];

  it('engellenen URL için eşleşme döner', () => {
    const result = findMatch('https://www.instagram.com/feed', sites);
    assert.deepEqual(result, { source: 'instagram.com', target: 'https://react.dev' });
  });

  it('www olmadan da eşleşir', () => {
    const result = findMatch('https://instagram.com/stories', sites);
    assert.deepEqual(result, { source: 'instagram.com', target: 'https://react.dev' });
  });

  it('engellenmemiş URL için null döner', () => {
    const result = findMatch('https://react.dev', sites);
    assert.equal(result, null);
  });

  it('boş liste için null döner', () => {
    const result = findMatch('https://instagram.com', []);
    assert.equal(result, null);
  });
});

describe('incrementStats', () => {
  it('aynı günde sadece sayacı artırır', () => {
    const stats = { ...getDefaultStats(), todayDate: '2026-05-14', todayCount: 2, streak: 3 };
    const result = incrementStats(stats, '2026-05-14');
    assert.equal(result.todayCount, 3);
    assert.equal(result.streak, 3);
  });

  it('yeni günde streak devam eder (önceki gün vardı)', () => {
    const stats = { ...getDefaultStats(), todayDate: '2026-05-13', todayCount: 5, streak: 3 };
    const result = incrementStats(stats, '2026-05-14');
    assert.equal(result.streak, 4);
    assert.equal(result.todayCount, 1);
    assert.equal(result.todayDate, '2026-05-14');
    assert.equal(result.history['2026-05-13'], 5);
  });

  it('gün atlandıysa streak sıfırlanır', () => {
    const stats = { ...getDefaultStats(), todayDate: '2026-05-10', todayCount: 3, streak: 5 };
    const result = incrementStats(stats, '2026-05-14');
    assert.equal(result.streak, 1);
    assert.equal(result.todayCount, 1);
  });

  it('ilk kullanımda streak 1 olur', () => {
    const result = incrementStats(getDefaultStats(), '2026-05-14');
    assert.equal(result.streak, 1);
    assert.equal(result.todayCount, 1);
  });
});

describe('trimHistory', () => {
  it('7 günden eskiyi siler', () => {
    const history = { '2026-05-01': 3, '2026-05-07': 2, '2026-05-08': 5 };
    const result = trimHistory(history, '2026-05-14');
    assert.equal(result['2026-05-01'], undefined);
    assert.equal(result['2026-05-07'], undefined);
    assert.equal(result['2026-05-08'], 5);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, fail ettiğini doğrula**

```bash
cd /Users/hilmikale/Developer/Projects/focus-extension
node --test tests/utils.test.mjs
```

Beklenen: `Cannot find module '../utils.js'` hatası.

- [ ] **Step 3: utils.js uygula**

`/Users/hilmikale/Developer/Projects/focus-extension/utils.js`:

```javascript
export function findMatch(url, blockedSites) {
  if (!blockedSites || blockedSites.length === 0) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return blockedSites.find(
      site => hostname.includes(site.source.replace(/^www\./, ''))
    ) ?? null;
  } catch {
    return null;
  }
}

export function getDefaultStats() {
  return { streak: 0, lastBlockedDate: null, todayCount: 0, todayDate: null, history: {} };
}

export function incrementStats(stats, today) {
  const yesterday = getPreviousDay(today);

  if (stats.todayDate === today) {
    return { ...stats, todayCount: stats.todayCount + 1 };
  }

  const newHistory = stats.todayDate
    ? trimHistory({ ...stats.history, [stats.todayDate]: stats.todayCount }, today)
    : { ...stats.history };

  return {
    streak: stats.todayDate === yesterday ? stats.streak + 1 : 1,
    lastBlockedDate: today,
    todayCount: 1,
    todayDate: today,
    history: newHistory,
  };
}

export function trimHistory(history, today) {
  const cutoff = new Date(today + 'T12:00:00');
  cutoff.setDate(cutoff.getDate() - 7);
  return Object.fromEntries(
    Object.entries(history).filter(([date]) => new Date(date + 'T12:00:00') >= cutoff)
  );
}

function getPreviousDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
```

- [ ] **Step 4: Testleri çalıştır, pass ettiğini doğrula**

```bash
node --test tests/utils.test.mjs
```

Beklenen çıktı (tüm satırlar `✔`):
```
✔ findMatch > engellenen URL için eşleşme döner
✔ findMatch > www olmadan da eşleşir
✔ findMatch > engellenmemiş URL için null döner
✔ findMatch > boş liste için null döner
✔ incrementStats > aynı günde sadece sayacı artırır
✔ incrementStats > yeni günde streak devam eder (önceki gün vardı)
✔ incrementStats > gün atlandıysa streak sıfırlanır
✔ incrementStats > ilk kullanımda streak 1 olur
✔ trimHistory > 7 günden eskiyi siler
```

- [ ] **Step 5: Commit**

```bash
git add utils.js tests/
git commit -m "feat: URL eşleştirme ve istatistik logic + testler"
```

---

### Task 3: Background Service Worker

**Files:**
- Create: `background.js`

- [ ] **Step 1: background.js oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/background.js`:

```javascript
import { findMatch, getDefaultStats, incrementStats } from './utils.js';

chrome.webNavigation.onBeforeNavigate.addListener(async ({ tabId, url, frameId }) => {
  if (frameId !== 0) return;
  if (url.startsWith(chrome.runtime.getURL(''))) return;

  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  const match = findMatch(url, blockedSites);
  if (!match) return;

  const target = encodeURIComponent(match.target);
  await chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL(`blocked.html?target=${target}`)
  });
  await recordBlock();
});

async function recordBlock() {
  const { stats } = await chrome.storage.local.get({ stats: null });
  const current = stats ?? getDefaultStats();
  const today = new Date().toISOString().split('T')[0];
  const updated = incrementStats(current, today);
  await chrome.storage.local.set({ stats: updated });
}
```

- [ ] **Step 2: Extension'ı Chrome'a yükle**

1. `chrome://extensions` aç
2. Sağ üstte **Developer mode** aç
3. **Load unpacked** → `/Users/hilmikale/Developer/Projects/focus-extension` seç
4. Extension kartında kırmızı hata ikonu yok mu kontrol et

- [ ] **Step 3: Manuel test — redirect çalışıyor mu?**

Extension'ın background service worker sayfasını aç (kartındaki "Service Worker" linkine tıkla) → Console'a yapıştır:

```javascript
await chrome.storage.sync.set({
  blockedSites: [{ source: 'example.com', target: 'https://react.dev' }]
});
```

Yeni sekmede `https://example.com` aç.

Beklenen: `blocked.html?target=https%3A%2F%2Freact.dev` URL'ine yönlendirilmeli (şimdilik boş/404 sayfa — normal).

- [ ] **Step 4: Test verisini temizle**

Service worker console'unda:
```javascript
await chrome.storage.sync.clear();
```

- [ ] **Step 5: Commit**

```bash
cd /Users/hilmikale/Developer/Projects/focus-extension
git add background.js
git commit -m "feat: background service worker — URL dinleme ve yönlendirme"
```

---

### Task 4: Motivation Sayfası

**Files:**
- Create: `blocked.html`
- Create: `blocked.js`
- Create: `blocked.css`

- [ ] **Step 1: blocked.html oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/blocked.html`:

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Odaklan</title>
  <link rel="stylesheet" href="blocked.css" />
</head>
<body>
  <div class="container">
    <div class="icon">🎯</div>
    <h1 class="title">Buraya neden geldin?</h1>
    <p class="subtitle">Zamanın değerli — kendine yatırım yap.</p>
    <button class="cta-btn" id="goBtn">Haydi çalış →</button>
  </div>
  <script type="module" src="blocked.js"></script>
</body>
</html>
```

- [ ] **Step 2: blocked.js oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/blocked.js`:

```javascript
const params = new URLSearchParams(window.location.search);
const target = params.get('target');

document.getElementById('goBtn').addEventListener('click', () => {
  if (target) window.location.href = decodeURIComponent(target);
});
```

- [ ] **Step 3: blocked.css oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/blocked.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  background: #0a0a0f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #e2e8f0;
}

.container {
  text-align: center;
  padding: 2rem;
  max-width: 480px;
}

.icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
}

.title {
  font-size: 2.25rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.subtitle {
  font-size: 1.125rem;
  color: #94a3b8;
  margin-bottom: 2.5rem;
  line-height: 1.6;
}

.cta-btn {
  display: inline-block;
  padding: 0.875rem 2.5rem;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  letter-spacing: 0.01em;
}

.cta-btn:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}

.cta-btn:active {
  transform: translateY(0);
}
```

- [ ] **Step 4: Manuel test**

Chrome'da `chrome-extension://<extension-id>/blocked.html?target=https%3A%2F%2Freact.dev` aç.  
(Extension ID'yi `chrome://extensions` sayfasından al.)

Kontrol et:
- Koyu arka plan, ortada 🎯 ikon, başlık ve alt metin görünüyor
- "Haydi çalış →" butonu stillenmiş, hover'da renk değişiyor
- Butona basınca `react.dev` açılıyor
- Tarayıcı geri butonunu kasıtlı olarak kullanmak dışında kolay çıkış yolu yok

- [ ] **Step 5: Commit**

```bash
cd /Users/hilmikale/Developer/Projects/focus-extension
git add blocked.html blocked.js blocked.css
git commit -m "feat: motivation sayfası"
```

---

### Task 5: Popup HTML + CSS

**Files:**
- Create: `popup.html`
- Create: `popup.css`

- [ ] **Step 1: popup.html oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/popup.html`:

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Focus</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <div class="popup">

    <section class="stats">
      <div class="stat-card">
        <span class="stat-value" id="streak">0</span>
        <span class="stat-label">günlük streak 🔥</span>
      </div>
      <div class="stat-card">
        <span class="stat-value" id="todayCount">0</span>
        <span class="stat-label">bugün engellendi</span>
      </div>
    </section>

    <section class="chart-section">
      <p class="chart-title">Son 7 gün</p>
      <canvas id="chart" width="300" height="64"></canvas>
    </section>

    <div class="divider"></div>

    <section class="sites-section">
      <p class="section-title">Engellenen siteler</p>
      <ul class="site-list" id="siteList"></ul>
    </section>

    <section class="add-section">
      <div class="input-row">
        <input type="text" id="sourceInput" class="input" placeholder="instagram.com" />
        <span class="arrow">→</span>
        <input type="text" id="targetInput" class="input" placeholder="https://react.dev" />
      </div>
      <button class="add-btn" id="addBtn">Ekle</button>
    </section>

  </div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: popup.css oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/popup.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 360px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f8fafc;
  color: #1e293b;
}

.popup {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats {
  display: flex;
  gap: 10px;
}

.stat-card {
  flex: 1;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #6366f1;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
}

.chart-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
}

.chart-title {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 8px;
}

canvas {
  display: block;
}

.divider {
  height: 1px;
  background: #e2e8f0;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.site-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.site-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.875rem;
}

.site-source {
  color: #ef4444;
  font-weight: 500;
}

.site-arrow {
  color: #94a3b8;
  font-size: 0.75rem;
}

.site-target {
  color: #22c55e;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 4px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}

.delete-btn:hover {
  color: #ef4444;
  background: #fee2e2;
}

.empty-state {
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
  padding: 12px 0;
}

.add-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.8rem;
  color: #1e293b;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: #6366f1;
}

.arrow {
  color: #94a3b8;
  font-size: 0.875rem;
}

.add-btn {
  width: 100%;
  padding: 9px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.add-btn:hover {
  background: #4f46e5;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hilmikale/Developer/Projects/focus-extension
git add popup.html popup.css
git commit -m "feat: popup HTML ve CSS"
```

---

### Task 6: Popup JavaScript

**Files:**
- Create: `popup.js`

- [ ] **Step 1: popup.js oluştur**

`/Users/hilmikale/Developer/Projects/focus-extension/popup.js`:

```javascript
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
```

- [ ] **Step 2: Extension'ı yenile**

`chrome://extensions` → Focus kartında **Reload** (döngü ikonu) butonuna bas.

- [ ] **Step 3: Popup manuel testi**

Toolbar ikonuna tıkla. Kontrol et:
- Popup 360px genişliğinde açılıyor
- İstatistik kartları görünüyor (0 streak, 0 bugün)
- "Henüz site eklenmedi." boş durum mesajı görünüyor
- `instagram.com` → `react.dev` girip Ekle'ye bas → liste güncelleniyor
- Silme butonu (✕) tıklayınca satır kalkıyor
- Form temizleniyor

- [ ] **Step 4: End-to-end testi**

1. Popup'tan `instagram.com` → `https://react.dev` ekle
2. Yeni sekmede `https://instagram.com` aç
3. Motivation sayfası açıldı mı? (🎯 + "Buraya neden geldin?")
4. "Haydi çalış →" butonuna bas → `react.dev` açılıyor mu?
5. Popup'ı tekrar aç → "Bugün engellendi" 1 oldu mu?
6. Haftalık grafik: bugünün barı mor, diğerleri açık mor

- [ ] **Step 5: Commit**

```bash
cd /Users/hilmikale/Developer/Projects/focus-extension
git add popup.js
git commit -m "feat: popup JS — site yönetimi, istatistik ve canvas grafik"
```

---

### Task 7: Son Kontroller

- [ ] **Step 1: Edge case testleri**

Popup'ta:
- Aynı siteyi iki kez eklemeye çalış → ikinci ekleme olmamalı
- Hedef URL'e `http://` olmadan gir: `react.dev` → kaydedilenin `https://react.dev` olduğunu confirm et (storage'da kontrol)
- Boş inputla Ekle'ye bas → hiçbir şey olmamalı

- [ ] **Step 2: Storage sıfırla ve tam akışı test et**

Service worker console'unda:
```javascript
await chrome.storage.sync.clear();
await chrome.storage.local.clear();
```

Extension reload yap, popup aç — her şey sıfırdan çalışıyor mu?

- [ ] **Step 3: Final commit**

```bash
cd /Users/hilmikale/Developer/Projects/focus-extension
git add -A
git commit -m "chore: focus extension v1.0 tamamlandı"
```
