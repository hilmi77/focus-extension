# Pomodoro Duraklat/Devam Et Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Durdur" butonu timer'ı sıfırlamak yerine duraklatmalı; duraklatıldığında white noise durmalı, devam edildiğinde yeniden başlamalı; × ikonu ile tam sıfırlama mümkün olmalı.

**Architecture:** `pomodoro.js`'e `paused` + `remainingMs` state alanları ve `pausePomodoro` / `resumePomodoro` fonksiyonları eklenir. `popup.html` + `popup.js` yeni buton üçlüsünü (Duraklat / Devam Et / ×) yönetir. `background.js` `POMO_PAUSED` ve `POMO_RESUMED` mesajlarını dinleyerek white noise'ı kontrol eder.

**Tech Stack:** Vanilla JS, Chrome Extension MV3, Chrome Alarms API, Web Audio API (offscreen document)

---

## Dosya Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `pomodoro.js` | `DEFAULT_STATE` güncelle; `pausePomodoro`, `resumePomodoro` ekle; her ikisini export et |
| `background.js` | `POMO_PAUSED` → `stopWhiteNoise()`, `POMO_RESUMED` → `playWhiteNoise()` dinleyicileri ekle |
| `popup.html` | `pomoStopBtn` → `pomoPauseBtn`; `pomoResumeBtn` + `pomoResetBtn` ekle; timer'ı sarmalayan `pomo-timer-row` div'i ekle |
| `popup.js` | Import güncelle; `renderPomodoro` yeniden yaz; yeni event listener'lar ekle |
| `popup.css` | `.pomo-pause`, `.pomo-resume`, `.pomo-timer-row`, `.pomo-reset-btn`, `.pomo-timer.paused` stilleri ekle |

---

## Task 1: `pomodoro.js` — State ve Yeni Fonksiyonlar

**Files:**
- Modify: `pomodoro.js`

- [ ] **Adım 1: `DEFAULT_STATE`'e `paused` ve `remainingMs` ekle**

`pomodoro.js` dosyasında `DEFAULT_STATE` objesini şu hale getir:

```js
const DEFAULT_STATE = {
  active: false,
  paused: false,
  phase: 'work',
  round: 1,
  endTime: null,
  remainingMs: null,
  settings: { workMins: 25, breakMins: 5, longBreakMins: 15, roundsBeforeLongBreak: 4 },
};
```

- [ ] **Adım 2: `pausePomodoro` fonksiyonunu ekle**

`stopPomodoro` fonksiyonunun hemen altına ekle:

```js
export async function pausePomodoro() {
  const state = await getState();
  const remainingMs = Math.max(0, state.endTime - Date.now());
  await chrome.alarms.clear(ALARM_NAME);
  await setState({ active: false, paused: true, endTime: null, remainingMs });
}
```

- [ ] **Adım 3: `resumePomodoro` fonksiyonunu ekle**

`pausePomodoro` fonksiyonunun hemen altına ekle:

```js
export async function resumePomodoro() {
  const state = await getState();
  const endTime = Date.now() + state.remainingMs;
  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  await setState({ active: true, paused: false, endTime, remainingMs: null });
}
```

- [ ] **Adım 4: `stopPomodoro`'nun sıfırlama alanlarını güncelle**

`stopPomodoro` fonksiyonunu bul ve `paused` + `remainingMs` alanlarını da sıfırla:

```js
export async function stopPomodoro() {
  await chrome.alarms.clear(ALARM_NAME);
  const state = await getState();
  await setState({
    active: false,
    paused: false,
    endTime: null,
    remainingMs: null,
    phase: 'work',
    round: 1,
    settings: state.settings,
  });
}
```

- [ ] **Adım 5: Manuel doğrula**

Chrome DevTools → Extension popup'ını aç → Console'da:

```js
// background.js service worker console'unda çalıştır:
import('./pomodoro.js').then(m => m.getState()).then(console.log)
// Beklenen: { active: false, paused: false, remainingMs: null, ... }
```

- [ ] **Adım 6: Commit**

```bash
git add pomodoro.js
git commit -m "feat: pomodoro state'e paused/remainingMs eklendi, pausePomodoro ve resumePomodoro fonksiyonları"
```

---

## Task 2: `background.js` — White Noise Mesaj Dinleyicileri

**Files:**
- Modify: `background.js`

- [ ] **Adım 1: `POMO_PAUSED` ve `POMO_RESUMED` mesajlarını dinle**

`background.js` içindeki `chrome.runtime.onMessage.addListener` bloğunu bul:

```js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'POMO_STARTED') playWhiteNoise();
  if (msg.type === 'POMO_STOPPED') stopWhiteNoise();
});
```

Şu hale getir:

```js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'POMO_STARTED') playWhiteNoise();
  if (msg.type === 'POMO_PAUSED') stopWhiteNoise();
  if (msg.type === 'POMO_RESUMED') playWhiteNoise();
  if (msg.type === 'POMO_STOPPED') stopWhiteNoise();
});
```

- [ ] **Adım 2: Commit**

```bash
git add background.js
git commit -m "feat: POMO_PAUSED ve POMO_RESUMED mesajlarında white noise kontrolü"
```

---

## Task 3: `popup.html` — Yeni Butonlar ve Timer Satırı

**Files:**
- Modify: `popup.html`

- [ ] **Adım 1: Timer'ı `pomo-timer-row` div'ine sar ve reset butonu ekle**

`popup.html` içindeki şu bloğu bul:

```html
<div class="pomo-timer" id="pomoTimer">25:00</div>
<div class="pomo-controls">
  <button class="pomo-btn pomo-start" id="pomoStartBtn">Başlat</button>
  <button class="pomo-btn pomo-stop hidden" id="pomoStopBtn">Durdur</button>
</div>
```

Şu hale getir:

```html
<div class="pomo-timer-row">
  <div class="pomo-timer" id="pomoTimer">25:00</div>
  <button class="pomo-reset-btn hidden" id="pomoResetBtn" title="Sıfırla">×</button>
</div>
<div class="pomo-controls">
  <button class="pomo-btn pomo-start" id="pomoStartBtn">Başlat</button>
  <button class="pomo-btn pomo-pause hidden" id="pomoPauseBtn">Duraklat</button>
  <button class="pomo-btn pomo-resume hidden" id="pomoResumeBtn">Devam Et</button>
</div>
```

- [ ] **Adım 2: Commit**

```bash
git add popup.html
git commit -m "feat: popup'a Duraklat, Devam Et ve reset (×) butonları eklendi"
```

---

## Task 4: `popup.css` — Yeni Buton Stilleri

**Files:**
- Modify: `popup.css`

- [ ] **Adım 1: Mevcut `.pomo-stop` stilini `.pomo-pause` olarak yeniden adlandır ve yeni stiller ekle**

`popup.css` içinde şu satırları bul:

```css
.pomo-stop { background: #fee2e2; color: #ef4444; }
.pomo-stop:hover { background: #fecaca; }
```

Şu hale getir:

```css
.pomo-pause { background: #fee2e2; color: #ef4444; }
.pomo-pause:hover { background: #fecaca; }

.pomo-resume { background: #dcfce7; color: #16a34a; }
.pomo-resume:hover { background: #bbf7d0; }
```

- [ ] **Adım 2: `pomo-timer-row` ve reset butonu stillerini ekle**

`.pomo-timer { ... }` bloğunun hemen **öncesine** ekle:

```css
.pomo-timer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pomo-reset-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}
.pomo-reset-btn:hover { color: #ef4444; background: #fee2e2; }
```

- [ ] **Adım 3: Duraklatılmış timer görünümü için stil ekle**

`.pomo-timer { ... }` bloğunun hemen **sonrasına** ekle:

```css
.pomo-timer.paused {
  opacity: 0.45;
}
```

- [ ] **Adım 4: Commit**

```bash
git add popup.css
git commit -m "style: duraklat/devam et buton stilleri ve timer duraklatma görünümü"
```

---

## Task 5: `popup.js` — Renderlar ve Event Listener'lar

**Files:**
- Modify: `popup.js`

- [ ] **Adım 1: Import satırını güncelle**

`popup.js` dosyasının ilk satırını bul:

```js
import { getState, startPomodoro, stopPomodoro, updateSettings, getPomodoroStats } from './pomodoro.js';
```

Şu hale getir:

```js
import { getState, startPomodoro, stopPomodoro, pausePomodoro, resumePomodoro, updateSettings, getPomodoroStats } from './pomodoro.js';
```

- [ ] **Adım 2: `renderPomodoro` fonksiyonunu yeniden yaz**

`popup.js` içindeki mevcut `renderPomodoro` fonksiyonunu tamamen şunla değiştir:

```js
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
```

- [ ] **Adım 3: Mevcut `pomoStopBtn` listener'ını kaldır, 3 yeni listener ekle**

Şu bloğu bul ve **sil**:

```js
document.getElementById('pomoStopBtn').addEventListener('click', async () => {
  clearInterval(pomodoroTick);
  await stopPomodoro();
  chrome.runtime.sendMessage({ type: 'POMO_STOPPED' });
  const state = await getState();
  renderPomodoro(state);
});
```

Yerine şu 3 bloğu ekle (`pomoStartBtn` listener'ının hemen altına):

```js
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
```

- [ ] **Adım 4: Commit**

```bash
git add popup.js
git commit -m "feat: popup'ta duraklat/devam et/sıfırla akışı tamamlandı"
```

---

## Task 6: Manuel Test

- [ ] **Başlat → Duraklat → Devam Et akışını test et**

  1. Extension popup'ı aç
  2. "Başlat"a bas — timer geriye saymalı, white noise başlamalı, "Duraklat" + "×" görünmeli
  3. "Duraklat"a bas — timer donuk (soluk) göstermeli, white noise durmalı, "Devam Et" + "×" görünmeli
  4. "Devam Et"e bas — timer kaldığı yerden saymalı, white noise yeniden başlamalı

- [ ] **Reset (×) butonunu test et**

  1. Timer çalışırken veya duraklatılmışken "×"e bas
  2. Timer "25:00"a sıfırlanmalı, "Başlat" butonu görünmeli, white noise durmalı

- [ ] **Popup kapatıp açma sürekliliğini test et**

  1. Timer'ı başlat, popup'ı kapat
  2. Popup'ı yeniden aç — timer kaldığı yerden saymalı
  3. Timer'ı duraklat, popup'ı kapat
  4. Popup'ı yeniden aç — duraklatılmış görünüm korunmalı

- [ ] **Son commit**

```bash
git add -A
git status  # değişmeyen dosya olmadığını doğrula
git commit -m "chore: pomodoro duraklat/devam et özelliği tamamlandı" --allow-empty
```
