# Engelli Site Ekranı — Kişisel Motivasyon Mesajları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `blocked.html`'in normal engelli-site ekranında, statik "Zamanın değerli" metni yerine `stats`/`pomoStats` verisine dayalı kişiselleştirilmiş, rotasyonlu bir motivasyon mesajı göstermek.

**Architecture:** `utils.js`'e pure bir seçim fonksiyonu (`pickBlockedMessage`) eklenir — uygulanabilir istatistik tabanlı mesaj varyantlarını (streak, bugünkü sayı, bugünkü odak süresi) ve her zaman uygulanabilir bir düşündürücü-soru havuzunu birleştirip dışarıdan verilen bir `randomIndex` ile birini seçer (test edilebilirlik için `Math.random()` fonksiyonun içinde çağrılmaz). `blocked.js`, sadece normal (Pomodoro olmayan) engelleme durumunda bu fonksiyonu çağırıp sayfadaki `.eyebrow`/`.line1`/`.line2`/`.sub` elemanlarını doldurur.

**Tech Stack:** Plain JS (ES modules), `chrome.storage.local`, Node's built-in `node:test`. Spec: `docs/superpowers/specs/2026-09-11-motivational-messaging-design.md`.

---

### Task 1: `utils.js` — `pickBlockedMessage` pure fonksiyonu

**Files:**
- Modify: `utils.js`
- Test: `tests/utils.test.mjs`

- [ ] **Step 1: Yeni testleri yaz**

`tests/utils.test.mjs` dosyasının import satırına `pickBlockedMessage` ekle:

```js
import { findMatch, incrementStats, getDefaultStats, trimHistory, isLocked, migrateBlockedSites, LOCK_DURATION_MS, pickBlockedMessage } from '../utils.js';
```

Dosyanın sonuna ekle:

```js
describe('pickBlockedMessage', () => {
  it('sadece düşündürücü sorular uygulanabilirken havuz boş dönmez', () => {
    const msg = pickBlockedMessage({ streak: 1, todayCount: 0 }, { todayFocusMins: 0 }, 0);
    assert.ok(msg && msg.line1 && msg.line2 && msg.sub);
  });

  it('streak >= 2 ise streak mesajı adaylar arasına girer (index 0)', () => {
    const stats = { streak: 3, todayCount: 0 };
    const pomoStats = { todayFocusMins: 0 };
    const msg = pickBlockedMessage(stats, pomoStats, 0);
    assert.match(msg.line1, /3 günlük/);
  });

  it('streak 1 iken streak mesajı hiç aday olmaz', () => {
    const stats = { streak: 1, todayCount: 0 };
    const pomoStats = { todayFocusMins: 0 };
    for (let i = 0; i < 5; i++) {
      const msg = pickBlockedMessage(stats, pomoStats, i);
      assert.doesNotMatch(msg.line2, /zincirini kırma/);
    }
  });

  it('todayCount >= 1 ise sayı mesajı adaylar arasına girer (index 0)', () => {
    const stats = { streak: 0, todayCount: 4 };
    const pomoStats = { todayFocusMins: 0 };
    const msg = pickBlockedMessage(stats, pomoStats, 0);
    assert.match(msg.line2, /4\. kez/);
  });

  it('todayFocusMins >= 15 ise odak mesajı adaylar arasına girer', () => {
    const stats = { streak: 0, todayCount: 0 };
    const msg = pickBlockedMessage(stats, { todayFocusMins: 15 }, 0);
    assert.match(msg.line2, /odaklandın/);
  });

  it('todayFocusMins 14 iken odak mesajı hiç aday olmaz', () => {
    const stats = { streak: 0, todayCount: 0 };
    for (let i = 0; i < 5; i++) {
      const msg = pickBlockedMessage(stats, { todayFocusMins: 14 }, i);
      assert.doesNotMatch(msg.line2, /odaklandın/);
    }
  });

  it('null stats/pomoStats ile çökmeden düşündürücü sorulardan biri döner', () => {
    const msg = pickBlockedMessage(null, null, 2);
    assert.ok(msg.line1 && msg.line2 && msg.sub);
  });

  it('aynı girdi ve randomIndex ile her zaman aynı mesajı döner (deterministik)', () => {
    const stats = { streak: 3, todayCount: 2 };
    const pomoStats = { todayFocusMins: 20 };
    const a = pickBlockedMessage(stats, pomoStats, 7);
    const b = pickBlockedMessage(stats, pomoStats, 7);
    assert.deepEqual(a, b);
  });
});
```

- [ ] **Step 2: Testleri çalıştırıp başarısız olduğunu doğrula**

Run: `node --test tests/utils.test.mjs`
Expected: FAIL — `pickBlockedMessage is not a function` (import hatası).

- [ ] **Step 3: `utils.js`'e fonksiyonları ekle**

`utils.js` dosyasının sonuna ekle:

```js
const REFLECTIVE_QUESTIONS = [
  { eyebrow: 'dur bir saniye', line1: '10 dakika sonra', line2: 'kendine ne diyeceksin?', sub: 'Bir düşün.' },
  { eyebrow: 'dur bir saniye', line1: 'Bunu gerçekten', line2: 'şimdi mi yapman lazım?', sub: 'Sonra da yapabilirsin.' },
  { eyebrow: 'dur bir saniye', line1: 'Az önce ne', line2: 'yapıyordun, hatırlıyor musun?', sub: 'Kaldığın yere dön.' },
  { eyebrow: 'dur bir saniye', line1: 'Buraya gelmek,', line2: 'asıl istediğin şey miydi?', sub: 'Emin misin?' },
  { eyebrow: 'dur bir saniye', line1: '5 dakika sonra', line2: 'pişman olacak mısın?', sub: 'Şimdi karar ver.' },
];

function streakMessage(streak) {
  return {
    eyebrow: 'dur bir saniye',
    line1: `${streak} günlük`,
    line2: 'zincirini kırma.',
    sub: 'Bugün de devam et, yarın daha kolay olacak.',
  };
}

function todayCountMessage(todayCount) {
  return {
    eyebrow: 'yine mi buradasın',
    line1: 'Bu siteyi bugün',
    line2: `${todayCount}. kez engelledin.`,
    sub: 'Bir kez daha dene, gerçekten istersen çık.',
  };
}

function formatFocusMins(m) {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}dk`;
  if (rem === 0) return `${h}sa`;
  return `${h}sa ${rem}dk`;
}

function focusMessage(todayFocusMins) {
  return {
    eyebrow: 'dur bir saniye',
    line1: `Bugün ${formatFocusMins(todayFocusMins)}`,
    line2: 'odaklandın.',
    sub: 'Bunu şimdi boşa harcama.',
  };
}

export function pickBlockedMessage(stats, pomoStats, randomIndex) {
  const candidates = [];
  if (stats?.streak >= 2) candidates.push(streakMessage(stats.streak));
  if (stats?.todayCount >= 1) candidates.push(todayCountMessage(stats.todayCount));
  if (pomoStats?.todayFocusMins >= 15) candidates.push(focusMessage(pomoStats.todayFocusMins));
  candidates.push(...REFLECTIVE_QUESTIONS);
  return candidates[randomIndex % candidates.length];
}
```

- [ ] **Step 4: Testleri çalıştırıp geçtiğini doğrula**

Run: `node --test tests/utils.test.mjs`
Expected: PASS — tüm testler (eskiler dahil) yeşil.

- [ ] **Step 5: Commit**

```bash
git add utils.js tests/utils.test.mjs
git commit -m "feat: engelli site ekranı için kişisel motivasyon mesajı seçim fonksiyonu eklendi"
```

---

### Task 2: `blocked.js` — mesajı sayfaya uygulama

**Files:**
- Modify: `blocked.js`

- [ ] **Step 1: `blocked.js`'i güncelle**

`blocked.js` dosyasının tamamını şununla değiştir:

```js
import { pickBlockedMessage } from './utils.js';

const params = new URLSearchParams(window.location.search);
const target = params.get('target');
const isPomodoro = params.get('pomodoro') === '1';

const btn = document.getElementById('goBtn');
const sub = document.querySelector('.sub');

if (isPomodoro) {
  if (sub) sub.textContent = 'Pomodoro devam ediyor. Bu site çalışma süresinde kilitli. 🍅';
  btn.textContent = 'Tamam, geri dön';
  btn.addEventListener('click', () => history.back());
} else {
  btn.addEventListener('click', () => {
    if (target) window.location.href = decodeURIComponent(target);
  });
  applyMotivationalMessage();
}

async function applyMotivationalMessage() {
  const [{ stats }, { pomoStats }] = await Promise.all([
    chrome.storage.local.get({ stats: null }),
    chrome.storage.local.get({ pomoStats: null }),
  ]);
  const msg = pickBlockedMessage(stats, pomoStats, Math.floor(Math.random() * 1000));
  document.querySelector('.eyebrow').textContent = msg.eyebrow;
  document.querySelector('.line1').textContent = msg.line1;
  document.querySelector('.line2').textContent = msg.line2;
  document.querySelector('.sub').textContent = msg.sub;
}
```

`blocked.html`'in `<script type="module" src="blocked.js">` etiketi zaten mevcut
(ES module importu için gerekli), değişiklik gerekmiyor.

- [ ] **Step 2: Sözdizimini doğrula**

Run: `node --check blocked.js`
Expected: çıktı yok (hata yok).

- [ ] **Step 3: Regresyon testlerini çalıştır**

Run: `node --test tests/utils.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add blocked.js
git commit -m "feat: blocked.js normal engelleme ekranında kişisel motivasyon mesajı gösteriyor"
```

---

### Task 3: Manuel doğrulama

**Files:** yok (sadece manuel test)

- [ ] **Step 1: Uzantıyı yenile**

`chrome://extensions` → "Yenile".

- [ ] **Step 2: Farklı istatistik durumlarını gözlemle**

Bir siteyi birkaç kez arka arkaya engelletip popup'ı açıp kapatarak (`stats.todayCount`
artacak) `blocked.html`'i tekrar tetikle — mesajın zaman zaman "Bu siteyi bugün N. kez
engelledin" varyantını gösterdiğini doğrula. Sayfayı birkaç kez yeniden tetikleyip
(yeni sekmede tekrar engellenen siteye git) mesajın rastgele değiştiğini gözlemle.

- [ ] **Step 3: Boş/yeni kullanıcı durumunu doğrula**

`chrome.storage.local`'da `stats`/`pomoStats` temizken (veya streak/todayFocusMins
eşiklerin altındayken) sayfanın hata vermediğini, düşündürücü sorulardan birinin
göründüğünü doğrula.

- [ ] **Step 4: Pomodoro ekranının değişmediğini doğrula**

Pomodoro work fazındayken sabit listedeki bir siteye (x.com/instagram.com) git —
ekranın hâlâ sabit "Pomodoro devam ediyor..." metnini gösterdiğini, kişisel mesaj
mantığının burada devreye girmediğini doğrula.

- [ ] **Step 5: Testleri son kez çalıştır**

Run: `node --test tests/utils.test.mjs`
Expected: tüm testler PASS.
