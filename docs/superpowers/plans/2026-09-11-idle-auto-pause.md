# Pomodoro Boşta Kalınca Otomatik Duraklat/Devam Et Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `chrome.idle` API'siyle kullanıcının gerçek etkileşimsizliğini tespit edip aktif bir Pomodoro fazını otomatik duraklatmak; kullanıcı geri döndüğünde ayrılık süresine göre otomatik devam ettirmek (kısa ayrılık) ya da askıdaki yarım turu sıfırlamak (uzun ayrılık) — günlük istatistiklere dokunmadan.

**Architecture:** `utils.js`'e eşik kararını veren pure bir fonksiyon (`decideIdleReturnAction`) eklenir. `manifest.json`'a `"idle"` izni eklenir. `background.js`'e yeni bir `chrome.idle.onStateChanged` dinleyicisi eklenir; bu dinleyici mevcut `pausePomodoro`/`resumePomodoro`/`stopPomodoro` fonksiyonlarını (zaten `pomodoro.js`'den export ediliyor) çağırarak durumu yönetir, yeni bir state-machine icat etmez.

**Tech Stack:** Plain JS (ES modules), Chrome MV3 `chrome.idle`/`chrome.notifications`/`chrome.storage` API'leri, Node's built-in `node:test`. Spec: `docs/superpowers/specs/2026-09-11-idle-auto-pause-design.md`.

---

### Task 1: `utils.js` — `decideIdleReturnAction` pure fonksiyonu

**Files:**
- Modify: `utils.js`
- Test: `tests/utils.test.mjs`

- [ ] **Step 1: Yeni testleri yaz**

`tests/utils.test.mjs` dosyasının import satırına `decideIdleReturnAction, IDLE_RESET_THRESHOLD_MS` ekle:

```js
import { findMatch, incrementStats, getDefaultStats, trimHistory, isLocked, migrateBlockedSites, LOCK_DURATION_MS, pickBlockedMessage, decideIdleReturnAction, IDLE_RESET_THRESHOLD_MS } from '../utils.js';
```

Dosyanın sonuna ekle:

```js
describe('decideIdleReturnAction', () => {
  it('30 dakikadan kısa ayrılıkta "resume" döner', () => {
    assert.equal(decideIdleReturnAction(29 * 60 * 1000), 'resume');
  });

  it('tam 30 dakikada "reset" döner (sınır dahil)', () => {
    assert.equal(decideIdleReturnAction(IDLE_RESET_THRESHOLD_MS), 'reset');
  });

  it('30 dakikadan uzun ayrılıkta "reset" döner', () => {
    assert.equal(decideIdleReturnAction(31 * 60 * 1000), 'reset');
  });

  it('0 ms ayrılıkta "resume" döner', () => {
    assert.equal(decideIdleReturnAction(0), 'resume');
  });

  it('özel bir eşik verilirse onu kullanır', () => {
    assert.equal(decideIdleReturnAction(5000, 10000), 'resume');
    assert.equal(decideIdleReturnAction(15000, 10000), 'reset');
  });
});
```

- [ ] **Step 2: Testleri çalıştırıp başarısız olduğunu doğrula**

Run: `node --test tests/utils.test.mjs`
Expected: FAIL — `decideIdleReturnAction is not a function` (import hatası).

- [ ] **Step 3: `utils.js`'e fonksiyonu ekle**

`utils.js` dosyasının sonuna ekle:

```js
export const IDLE_RESET_THRESHOLD_MS = 30 * 60 * 1000;

export function decideIdleReturnAction(awayMs, resetThresholdMs = IDLE_RESET_THRESHOLD_MS) {
  return awayMs >= resetThresholdMs ? 'reset' : 'resume';
}
```

- [ ] **Step 4: Testleri çalıştırıp geçtiğini doğrula**

Run: `node --test tests/utils.test.mjs`
Expected: PASS — tüm testler (eskiler dahil) yeşil.

- [ ] **Step 5: Commit**

```bash
git add utils.js tests/utils.test.mjs
git commit -m "feat: idle sonrası devam/sıfırlama kararını veren decideIdleReturnAction eklendi"
```

---

### Task 2: `manifest.json` + `background.js` — `chrome.idle` entegrasyonu

**Files:**
- Modify: `manifest.json`
- Modify: `background.js`

- [ ] **Step 1: `manifest.json`'a izin ekle**

`manifest.json` dosyasındaki `permissions` dizisini güncelle:

```json
  "permissions": ["storage", "webNavigation", "tabs", "alarms", "notifications", "offscreen", "idle"],
```

- [ ] **Step 2: `background.js` importlarını güncelle**

`background.js` dosyasının 3-4. satırlarını şununla değiştir:

```js
import { findMatch, getDefaultStats, incrementStats, decideIdleReturnAction } from './utils.js';
import { handlePomodoroAlarm, getState, getPomodoroStats, pausePomodoro, resumePomodoro, stopPomodoro } from './pomodoro.js';
```

- [ ] **Step 3: `chrome.idle` dinleyicisini ekle**

`background.js` dosyasının sonuna (mevcut `chrome.alarms.onAlarm.addListener(...)` bloğundan sonra) ekle:

```js
const IDLE_DETECTION_SECONDS = 300; // 5 dakika
chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);

chrome.idle.onStateChanged.addListener(async (state) => {
  const pomo = await getState();

  if (state !== 'active') {
    // 'idle' veya 'locked'
    if (pomo.active) {
      await pausePomodoro();
      await chrome.storage.local.set({ idleSince: Date.now() });
      await syncAudio();
    }
    return;
  }

  // state === 'active': kullanıcı geri döndü
  const { idleSince } = await chrome.storage.local.get({ idleSince: null });
  if (idleSince == null) return; // bu duraklatma idle tespitinden kaynaklanmadı

  await chrome.storage.local.remove('idleSince');
  const current = await getState();
  if (!current.paused) return; // kullanıcı zaten manuel müdahale etmiş

  const action = decideIdleReturnAction(Date.now() - idleSince);
  if (action === 'resume') {
    await resumePomodoro();
    chrome.notifications.create(`pomo-idle-resume-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: '👋 Tekrar hoş geldin',
      message: 'Bir süre uzaktaydın, Pomodoro kaldığı yerden devam ediyor.',
      priority: 2,
    });
  } else {
    await stopPomodoro();
    chrome.notifications.create(`pomo-idle-reset-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: '🍅 Pomodoro sıfırlandı',
      message: 'Uzun süre uzaktaydın, yarım kalan tur sıfırlandı. Bugünkü ilerlemen korundu — yeni bir tur başlatabilirsin.',
      priority: 2,
    });
  }
  await syncAudio();
});
```

Not: `pausePomodoro`, `resumePomodoro`, `stopPomodoro`, `getState` zaten
`pomodoro.js`'den export ediliyor (Step 2'de import edildi) — bu dosyada
yeniden implemente edilmiyor. `syncAudio` zaten `background.js` içinde
tanımlı bir fonksiyon, dokunmuyoruz.

- [ ] **Step 4: Sözdizimini doğrula**

Run: `node --check background.js`
Expected: çıktı yok (hata yok).

- [ ] **Step 5: Regresyon testlerini çalıştır**

Run: `node --test tests/utils.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add manifest.json background.js
git commit -m "feat: Pomodoro chrome.idle ile boşta kalınca otomatik duraklıyor, geri dönünce devam ediyor/sıfırlanıyor"
```

---

### Task 3: Manuel doğrulama

**Files:** yok (sadece manuel test)

- [ ] **Step 1: Uzantıyı yenile**

`chrome://extensions` → "Yenile". (`"idle"` izni yeni eklendiği için Chrome
izin onayı isteyebilir — kabul et.)

- [ ] **Step 2: Kısa ayrılık senaryosunu test et**

Pomodoro'yu başlat (work fazı). Bilgisayarı/fareyi ~5-6 dakika hiç
kullanmadan bekle (ya da test için `IDLE_DETECTION_SECONDS`'ı geçici olarak
15 saniyeye düşürüp tekrar dene) — Pomodoro'nun otomatik duraklaması
gerekiyor (popup'ı açtığında "Duraklatıldı" görünmeli). Geri dönüp fareyi
oynat — birkaç saniye içinde "👋 Tekrar hoş geldin" bildirimi ve otomatik
devam etmesi gerekiyor.

- [ ] **Step 3: Uzun ayrılık senaryosunu test et**

Aynı şekilde duraklat, ama geri dönmeden önce (test amaçlı)
`chrome.storage.local`'daki `idleSince` değerini DevTools konsolundan
32 dakika öncesine ayarla (`chrome.storage.local.set({idleSince: Date.now() - 32*60*1000})`),
sonra fareyi oynatıp state'in `'active'`'e geçmesini tetikle (ör. birkaç
saniye beklet) — "🍅 Pomodoro sıfırlandı" bildirimi gelmeli, Pomodoro
work fazı/1. round'a sıfırlanmalı.

- [ ] **Step 4: Günlük istatistiklerin korunduğunu doğrula**

Adım 3'ten önce ve sonra popup'taki "bugün tamamlanan tur" ve "bugünkü
odak süresi" değerlerinin **değişmediğini** doğrula.

- [ ] **Step 5: Manuel duraklatmanın etkilenmediğini doğrula**

Pomodoro'yu popup'taki "Duraklat" butonuyla manuel duraklat, birkaç dakika
bekle, tekrar "Devam Et" ile manuel başlat — bu akışta hiçbir idle
bildirimi görünmemeli (çünkü `idleSince` bu durumda hiç set edilmedi).

- [ ] **Step 6: Testleri son kez çalıştır**

Run: `node --test tests/utils.test.mjs`
Expected: tüm testler PASS.
