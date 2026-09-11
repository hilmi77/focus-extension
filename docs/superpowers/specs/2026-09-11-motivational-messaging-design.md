# Engelli Site Ekranı — Kişisel İstatistik Tabanlı Motivasyon Mesajları

**Tarih:** 2026-09-11
**Durum:** Tasarım onaylandı

## Amaç

`blocked.html`'deki statik "Zamanın değerli / Her geçen saniye geri gelmiyor" metni
zamanla etkisini kaybediyor (yenilik etkisi geçti). Araştırma, jenerik ilham
sözlerinin zayıf etkili olduğunu, kişiselleştirilmiş istatistik/streak tabanlı
mesajların ve "an içinde" düşündürücü soruların daha etkili olduğunu gösteriyor.
Elimizde zaten `stats` (`utils.js`, streak/todayCount/history) ve `pomoStats`
(`pomodoro.js`, todayRounds/todayFocusMins) verisi var — bunları kullanarak her
engellemede farklı, kişisel bir mesaj gösterilecek.

## Kapsam

Sadece **normal engelli-site ekranı** (`blocked.html?target=...`) etkilenir.
Pomodoro sabit listesi engellemesinde (`blocked.html?pomodoro=1`) gösterilen ekran
değişmeden kalır (zaten net ve bağlama özel bir mesajı var: "Pomodoro devam ediyor").

## Mesaj Varyantları

Her varyant bir `{ eyebrow, line1, line2, sub }` nesnesi döner (mevcut
`blocked.html` yapısındaki `.eyebrow`, `.headline .line1/.line2`, `.sub`
elemanlarına karşılık gelir).

1. **Streak** — uygulanabilirlik: `stats.streak >= 2`
   `{ eyebrow: 'dur bir saniye', line1: '${streak} günlük', line2: 'zincirini kırma.', sub: 'Bugün de devam et, yarın daha kolay olacak.' }`

2. **Bugünkü engelleme sayısı** — uygulanabilirlik: `stats.todayCount >= 1`
   `{ eyebrow: 'yine mi buradasın', line1: 'Bu siteyi bugün', line2: '${todayCount}. kez engelledin.', sub: 'Bir kez daha dene, gerçekten istersen çık.' }`

3. **Bugünkü odak süresi** — uygulanabilirlik: `pomoStats.todayFocusMins >= 15`
   `{ eyebrow: 'dur bir saniye', line1: 'Bugün ${odakSüresi}', line2: 'odaklandın.', sub: 'Bunu şimdi boşa harcama.' }`
   (`${odakSüresi}` mevcut `formatMins`-benzeri bir formatlayıcıyla, örn. "1sa 30dk".)

4. **Düşündürücü sorular** — uygulanabilirlik: her zaman (havuz asla boş olmaz).
   Sabit bir soru havuzundan rastgele biri, her biri kendi `{eyebrow, line1, line2, sub}` setiyle:
   - *"10 dakika sonra kendine ne diyeceksin?"*
   - *"Bunu gerçekten şimdi mi yapman lazım?"*
   - *"Az önce ne yapıyordun, hatırlıyor musun?"*
   - *"Buraya gelmek, asıl istediğin şey miydi?"*
   - *"5 dakika sonra pişman olacak mısın?"*

## Seçim Mantığı

`utils.js`'e eklenecek pure function:

```js
export function pickBlockedMessage(stats, pomoStats, randomIndex) {
  const candidates = [];
  if (stats?.streak >= 2) candidates.push(streakMessage(stats.streak));
  if (stats?.todayCount >= 1) candidates.push(todayCountMessage(stats.todayCount));
  if (pomoStats?.todayFocusMins >= 15) candidates.push(focusMessage(pomoStats.todayFocusMins));
  REFLECTIVE_QUESTIONS.forEach(q => candidates.push(q));
  return candidates[randomIndex % candidates.length];
}
```

`randomIndex` dışarıdan (çağıran taraftan) verilir — `Math.random()` fonksiyonun
içinde çağrılmaz, böylece pure ve test edilebilir kalır. `blocked.js` bunu
`Math.floor(Math.random() * 1000)` gibi bir değerle çağırır.

Düşündürücü sorular havuzu her zaman `candidates`'a eklendiği için liste asla boş
olmaz (yeni kullanıcıda streak/todayCount/focusMins eşiklerin altında kalabilir).

## `blocked.js` Entegrasyonu

Normal (Pomodoro olmayan) engelleme durumunda:

```js
if (!isPomodoro) {
  const { stats } = await chrome.storage.local.get({ stats: null });
  const { pomoStats } = await chrome.storage.local.get({ pomoStats: null });
  const msg = pickBlockedMessage(stats, pomoStats, Math.floor(Math.random() * 1000));
  document.querySelector('.eyebrow').textContent = msg.eyebrow;
  document.querySelector('.line1').textContent = msg.line1;
  document.querySelector('.line2').textContent = msg.line2;
  document.querySelector('.sub').textContent = msg.sub;
}
```

`blocked.html`'deki mevcut statik metin, JS'in üzerine yazacağı bir **fallback**
olarak kalır (JS çalışmazsa/hata verirse kullanıcı yine anlamlı bir ekran görür).

## Test Planı

`tests/utils.test.mjs`'e eklenecek:
- Her eşik değeri için uygulanabilirlik testi (streak 1 vs 2, todayCount 0 vs 1,
  todayFocusMins 14 vs 15).
- Hiçbir stat eşiği geçmemişken havuzun boş dönmediği (sadece düşündürücü sorular).
- Aynı `randomIndex` ile çağrıldığında deterministik/tutarlı sonuç döndüğü.

## Kapsam Dışı

- Pomodoro sabit-liste ekranı (`?pomodoro=1`) değişmiyor.
- Uzaktan/API tabanlı alıntı servisleri kullanılmıyor (offline, sabit havuz yeterli — YAGNI).
- Kullanıcının mesaj tercihini özelleştirebileceği bir ayar eklenmiyor (bu iterasyonda gerek yok).
