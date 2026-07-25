# Ses Modları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pomodoro çalışma fazındaki sesi opsiyonel yapmak; Kapalı / Beyaz gürültü / Klasik müzik (YouTube) modları ve bağımsız durdur/oynat butonu eklemek.

**Architecture:** Ses tercihi `chrome.storage.sync` (`soundSettings`), geçici sustur durumu `chrome.storage.local` (`soundRuntime.muted`) içinde tutulur. Background'da merkezî `syncAudio()` fonksiyonu, pomodoro state + ayar + muted'a bakıp doğru sesi başlatır/durdurur. Klasik müzik, offscreen sayfaya gizli bir YouTube `embed` iframe'i gömülerek çalınır (CSP nedeniyle IFrame API script'i değil, iframe oluştur/kaldır ile kontrol).

**Tech Stack:** Vanilla JS (ES modules), Chrome MV3 (offscreen, storage), Web Audio API, `node --test` (birim testleri).

**Test komutu:** `node --test tests/utils.test.mjs`

---

### Task 1: `parseYouTubeId` saf fonksiyonu (utils.js)

**Files:**
- Modify: `utils.js`
- Test: `tests/utils.test.mjs`

- [ ] **Step 1: Testleri yaz**

`tests/utils.test.mjs` içine, dosyanın en altına ekle. Ayrıca 3. satırdaki import'a `parseYouTubeId` ekle:

Import satırını şununla değiştir:
```js
import { findMatch, incrementStats, getDefaultStats, trimHistory, parseYouTubeId } from '../utils.js';
```

Dosyanın sonuna ekle:
```js
describe('parseYouTubeId', () => {
  it('tam watch URL için video ID döner', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('youtu.be kısa link için ID döner', () => {
    assert.equal(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('live/embed yolu için ID döner', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('düz 11 karakterlik ID kabul eder', () => {
    assert.equal(parseYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('ekstra parametreli watch URL için ID döner', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'), 'dQw4w9WgXcQ');
  });

  it('geçersiz girdi için null döner', () => {
    assert.equal(parseYouTubeId('https://example.com/foo'), null);
    assert.equal(parseYouTubeId('merhaba dünya'), null);
    assert.equal(parseYouTubeId(''), null);
    assert.equal(parseYouTubeId(null), null);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `node --test tests/utils.test.mjs`
Expected: FAIL — `parseYouTubeId is not a function` (veya import'ta undefined).

- [ ] **Step 3: Fonksiyonu ekle**

`utils.js` dosyasının sonuna ekle:
```js
export function parseYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (!str) return null;
  const ID = /^[A-Za-z0-9_-]{11}$/;
  if (ID.test(str)) return str;
  try {
    const url = new URL(str);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      return ID.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && ID.test(v)) return v;
      const m = url.pathname.match(/^\/(?:embed|live|shorts)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `node --test tests/utils.test.mjs`
Expected: PASS — tüm testler yeşil.

- [ ] **Step 5: Commit**

```bash
git add utils.js tests/utils.test.mjs
git commit -m "feat: YouTube linkinden video ID çıkaran parseYouTubeId eklendi"
```

---

### Task 2: `sound.js` — ses ayarı/state modülü

**Files:**
- Create: `sound.js`

Bu modül hem `background.js` hem `popup.js` tarafından import edilir. Chrome storage sarmalayıcıları + preset radyo + video ID çözümü içerir.

- [ ] **Step 1: `sound.js` oluştur**

```js
import { parseYouTubeId } from './utils.js';

// 7/24 canlı klasik müzik yayını. Task 6'da gömmeye açık olduğu doğrulanacak.
export const PRESET_CLASSICAL_VIDEO_ID = 'jgpJVI3tDbY';

const DEFAULT_SOUND_SETTINGS = { mode: 'off', musicUrl: null };

export async function getSoundSettings() {
  const { soundSettings } = await chrome.storage.sync.get({ soundSettings: DEFAULT_SOUND_SETTINGS });
  return { ...DEFAULT_SOUND_SETTINGS, ...soundSettings };
}

export async function setSoundSettings(partial) {
  const current = await getSoundSettings();
  const next = { ...current, ...partial };
  await chrome.storage.sync.set({ soundSettings: next });
  return next;
}

export async function getSoundRuntime() {
  const { soundRuntime } = await chrome.storage.local.get({ soundRuntime: { muted: false } });
  return soundRuntime;
}

export async function setSoundMuted(muted) {
  await chrome.storage.local.set({ soundRuntime: { muted } });
}

export function resolveVideoId(musicUrl) {
  if (!musicUrl) return PRESET_CLASSICAL_VIDEO_ID;
  return parseYouTubeId(musicUrl) ?? PRESET_CLASSICAL_VIDEO_ID;
}
```

- [ ] **Step 2: Sözdizimi/import doğrula**

Run: `node --check sound.js`
Expected: hata yok (çıktı boş). Not: `node --check` import edilen dosyayı çalıştırmaz, sadece sözdizimini kontrol eder.

- [ ] **Step 3: Commit**

```bash
git add sound.js
git commit -m "feat: ses ayarı ve state modülü (sound.js) eklendi"
```

---

### Task 3: Offscreen'de YouTube müzik çalma

**Files:**
- Modify: `offscreen.html`
- Modify: `offscreen.js`

- [ ] **Step 1: `offscreen.html`'e iframe container ekle**

`offscreen.html` içeriğini şu şekilde değiştir:
```html
<!DOCTYPE html>
<html><body>
<div id="ytHost"></div>
<script src="offscreen.js"></script>
</body></html>
```

- [ ] **Step 2: `offscreen.js`'e müzik fonksiyonları ekle**

`offscreen.js` dosyasında, `stopWhiteNoise` fonksiyonundan sonra (26. satır civarı, mesaj dinleyicisinden önce) ekle:
```js
function startMusic(videoId) {
  const host = document.getElementById('ytHost');
  host.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.width = '0';
  iframe.height = '0';
  iframe.style.border = 'none';
  iframe.allow = 'autoplay';
  iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1`;
  host.appendChild(iframe);
}

function stopMusic() {
  const host = document.getElementById('ytHost');
  host.innerHTML = '';
}
```

- [ ] **Step 3: Mesaj dinleyicisine yeni tipleri ekle**

`offscreen.js` içindeki `chrome.runtime.onMessage.addListener` bloğunda, `STOP_WHITE_NOISE` satırından sonra ekle:
```js
  if (msg.type === 'START_MUSIC') startMusic(msg.videoId);
  if (msg.type === 'STOP_MUSIC') stopMusic();
```

- [ ] **Step 4: Sözdizimi doğrula**

Run: `node --check offscreen.js`
Expected: hata yok.

- [ ] **Step 5: Commit**

```bash
git add offscreen.html offscreen.js
git commit -m "feat: offscreen'e YouTube iframe ile müzik çalma eklendi"
```

---

### Task 4: Background `syncAudio()` orkestrasyonu

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Import ekle**

`background.js` üstündeki import bloğuna (4. satırdan sonra) ekle:
```js
import { getSoundSettings, getSoundRuntime, resolveVideoId } from './sound.js';
```

- [ ] **Step 2: Müzik yardımcıları + syncAudio ekle**

`background.js` içindeki `stopWhiteNoise` fonksiyonundan sonra (69. satır civarı) ekle:
```js
async function playMusic(videoId) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: 'START_MUSIC', videoId });
}

async function stopMusic() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) chrome.runtime.sendMessage({ type: 'STOP_MUSIC' });
}

async function syncAudio() {
  const [settings, runtime, pomo] = await Promise.all([
    getSoundSettings(), getSoundRuntime(), getState(),
  ]);
  const shouldPlay = settings.mode !== 'off' && pomo.active && pomo.phase === 'work' && !runtime.muted;

  if (!shouldPlay) {
    await stopWhiteNoise();
    await stopMusic();
    return;
  }

  if (settings.mode === 'whitenoise') {
    await stopMusic();
    await playWhiteNoise();
  } else if (settings.mode === 'classic') {
    await stopWhiteNoise();
    await playMusic(resolveVideoId(settings.musicUrl));
  }
}
```

- [ ] **Step 3: Mesaj dinleyicisini `syncAudio`'ya bağla**

`background.js` içindeki mevcut mesaj dinleyicisini (71-76. satırlar) şununla değiştir:
```js
chrome.runtime.onMessage.addListener((msg) => {
  if (['POMO_STARTED', 'POMO_PAUSED', 'POMO_RESUMED', 'POMO_STOPPED', 'SYNC_AUDIO'].includes(msg.type)) {
    syncAudio();
  }
});
```

- [ ] **Step 4: Alarm faz geçişini `syncAudio`'ya bağla**

`background.js` içindeki alarm dinleyicisinde, `pomodoro-phase-end` bloğunu (93-98. satırlar) şununla değiştir:
```js
  if (alarm.name === 'pomodoro-phase-end') {
    await playSound();
    await handlePomodoroAlarm(alarm.name);
    await syncAudio();
  } else {
```

- [ ] **Step 5: Sözdizimi doğrula**

Run: `node --check background.js`
Expected: hata yok.

- [ ] **Step 6: Commit**

```bash
git add background.js
git commit -m "feat: merkezî syncAudio orkestrasyonu ve müzik çalma eklendi"
```

---

### Task 5: Popup ses UI'si

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`

- [ ] **Step 1: HTML — ses satırını ekle**

`popup.html` içinde `pomo-settings` div'inin kapanışından sonra, `</section>` (56. satır) `pomoSection` kapanışından ÖNCE ekle:
```html
        <div class="pomo-sound">
          <div class="sound-modes" role="group" aria-label="Ses modu">
            <button type="button" class="sound-mode-btn" data-mode="off">🔇 Kapalı</button>
            <button type="button" class="sound-mode-btn" data-mode="whitenoise">🌊 Gürültü</button>
            <button type="button" class="sound-mode-btn" data-mode="classic">🎼 Müzik</button>
          </div>
          <div class="sound-music-row hidden" id="soundMusicRow">
            <input type="text" id="soundMusicUrl" placeholder="YouTube linki (boşsa klasik radyo)" />
          </div>
          <button type="button" class="sound-toggle-btn hidden" id="soundToggleBtn" title="Sesi durdur/oynat">⏸ Sesi durdur</button>
        </div>
```

- [ ] **Step 2: CSS — stil ekle**

`popup.css` dosyasının sonuna ekle:
```css
.pomo-sound { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 8px; }
.sound-modes { display: flex; gap: 6px; }
.sound-mode-btn {
  flex: 1; padding: 6px 4px; font-size: 12px; cursor: pointer;
  border: 1px solid #d0d0d0; border-radius: 8px; background: #f6f6f6; color: #333;
}
.sound-mode-btn.active { background: #2d6cdf; border-color: #2d6cdf; color: #fff; }
.sound-music-row { display: flex; }
.sound-music-row input {
  flex: 1; padding: 6px 8px; font-size: 12px;
  border: 1px solid #d0d0d0; border-radius: 8px;
}
.sound-toggle-btn {
  padding: 6px 8px; font-size: 12px; cursor: pointer;
  border: 1px solid #d0d0d0; border-radius: 8px; background: #f6f6f6; color: #333;
}
```

- [ ] **Step 3: popup.js — import ekle**

`popup.js` en üstteki import'lardan sonra (1. satırdan sonra) ekle:
```js
import { getSoundSettings, setSoundSettings, getSoundRuntime, setSoundMuted } from './sound.js';
```

- [ ] **Step 4: popup.js — render + wiring ekle**

`popup.js` içinde, `// ── Init ──` yorumundan (426. satır civarı) HEMEN ÖNCE ekle:
```js
// ── Ses UI ─────────────────────────────────────────────────────────────────────

function renderSound(settings, runtime) {
  document.querySelectorAll('.sound-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === settings.mode);
  });
  const musicRow = document.getElementById('soundMusicRow');
  const toggleBtn = document.getElementById('soundToggleBtn');
  const urlInput = document.getElementById('soundMusicUrl');

  musicRow.classList.toggle('hidden', settings.mode !== 'classic');
  urlInput.value = settings.musicUrl ?? '';

  toggleBtn.classList.toggle('hidden', settings.mode === 'off');
  toggleBtn.textContent = runtime.muted ? '▶ Sesi aç' : '⏸ Sesi durdur';
}

async function refreshSound() {
  const [settings, runtime] = await Promise.all([getSoundSettings(), getSoundRuntime()]);
  renderSound(settings, runtime);
}

document.querySelectorAll('.sound-mode-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    await setSoundSettings({ mode: btn.dataset.mode });
    await setSoundMuted(false);
    chrome.runtime.sendMessage({ type: 'SYNC_AUDIO' });
    await refreshSound();
  });
});

document.getElementById('soundMusicUrl').addEventListener('change', async (e) => {
  const val = e.target.value.trim();
  await setSoundSettings({ musicUrl: val || null });
  chrome.runtime.sendMessage({ type: 'SYNC_AUDIO' });
  await refreshSound();
});

document.getElementById('soundToggleBtn').addEventListener('click', async () => {
  const runtime = await getSoundRuntime();
  await setSoundMuted(!runtime.muted);
  chrome.runtime.sendMessage({ type: 'SYNC_AUDIO' });
  await refreshSound();
});
```

- [ ] **Step 5: popup.js — init'te çağır**

`popup.js` init IIFE'sinin (428. satır civarı) sonunda, mevcut render çağrılarının yanına ekle. `renderGoal(...)` satırından sonra ekle:
```js
  await refreshSound();
```

- [ ] **Step 6: Sözdizimi doğrula**

Run: `node --check popup.js`
Expected: hata yok.

- [ ] **Step 7: Commit**

```bash
git add popup.html popup.css popup.js
git commit -m "feat: popup'a ses modu seçici, müzik linki ve durdur/oynat butonu eklendi"
```

---

### Task 6: Uçtan uca manuel doğrulama

**Files:** (kod değişikliği yok — doğrulama + gerekirse preset ID düzeltmesi)

- [ ] **Step 1: Uzantıyı yükle**

Chrome → `chrome://extensions` → Developer mode açık → "Load unpacked" → proje klasörünü seç (zaten yüklüyse "Reload").

- [ ] **Step 2: Preset radyoyu doğrula**

Popup'ı aç → Ses modunu **🎼 Müzik** yap (link boş) → Pomodoro **Başlat**.
Beklenen: birkaç saniye içinde klasik müzik çalar.
Çalmıyorsa: `sound.js` içindeki `PRESET_CLASSICAL_VIDEO_ID`'yi gömmeye açık, canlı bir klasik müzik yayınının ID'siyle değiştir (YouTube'da video → Paylaş → Yerleştir ile gömülebildiğini doğrula), kaydet, uzantıyı reload et, tekrar dene.

- [ ] **Step 3: Üç modu doğrula**

- **🔇 Kapalı** seçili + pomodoro çalışırken: hiç ses yok.
- **🌊 Gürültü** seçili + pomodoro çalışırken: beyaz gürültü çalar.
- **🎼 Müzik** + kendi YouTube linkini yapıştır: o video çalar. Geçersiz link yapıştır: preset radyoya düşer.

- [ ] **Step 4: Faz + kontrol davranışı**

- Çalışma → mola geçişinde ses susar; mola → çalışma geçişinde tekrar başlar.
- **Duraklat** → ses susar; **Devam Et** → tekrar çalar.
- **⏸ Sesi durdur** → ses susar ve buton **▶ Sesi aç** olur; manuel açana kadar (faz geçişinde bile) kapalı kalır.
- Uzantı popup'ını kapat-aç → seçili mod ve link korunur.

- [ ] **Step 5: Birim testleri son kez çalıştır**

Run: `node --test tests/utils.test.mjs`
Expected: tüm testler PASS.

- [ ] **Step 6: (Gerekliyse) preset ID commit'i**

Preset ID'yi değiştirdiysen:
```bash
git add sound.js
git commit -m "fix: gömmeye açık klasik radyo preset ID'si ayarlandı"
```
