# Pomodoro Duraklat/Devam Et Tasarımı

**Tarih:** 2026-06-16  
**Durum:** Onaylandı

## Özet

Şu an "Durdur" butonu timer'ı tamamen sıfırlıyor. Kullanıcı timer'ı duraklatıp kaldığı yerden devam edebilmeli. Duraklatma sırasında white noise da durmalı, devam edince yeniden başlamalı.

## State Değişiklikleri (`pomodoro.js`)

Mevcut state shape'e 2 alan eklenir:

```js
const DEFAULT_STATE = {
  active: false,
  paused: false,      // YENİ
  phase: 'work',
  round: 1,
  endTime: null,
  remainingMs: null,  // YENİ - duraklatıldığındaki kalan süre (ms)
  settings: { workMins: 25, breakMins: 5, longBreakMins: 15, roundsBeforeLongBreak: 4 },
};
```

## Yeni Fonksiyonlar (`pomodoro.js`)

### `pausePomodoro()`
1. Chrome alarm'ı iptal et (`chrome.alarms.clear`)
2. `remainingMs = state.endTime - Date.now()` hesapla
3. State'i güncelle: `active: false, paused: true, remainingMs, endTime: null`

### `resumePomodoro()`
1. `endTime = Date.now() + state.remainingMs` hesapla
2. Yeni alarm kur (`chrome.alarms.create`)
3. State'i güncelle: `active: true, paused: false, endTime, remainingMs: null`

### `stopPomodoro()` (değişmez)
Tam sıfırlama — `phase: 'work', round: 1, paused: false, remainingMs: null`

## UI Değişiklikleri

### `popup.html`
- Mevcut "Durdur" butonu → **"Duraklat"** (`id="pomoPauseBtn"`)
- Yeni **"Devam Et"** butonu eklenir (`id="pomoResumeBtn"`, başlangıçta `hidden`)
- Timer (`#pomoTimer`) yanına küçük **×** reset ikonu eklenir (`id="pomoResetBtn"`, başlangıçta `hidden`)

### Buton görünürlük mantığı (`popup.js`)

| Durum | Başlat | Duraklat | Devam Et | × Reset |
|-------|--------|----------|----------|---------|
| Hazır (inactive) | ✅ | — | — | — |
| Aktif (çalışıyor) | — | ✅ | — | ✅ |
| Duraklatıldı | — | — | ✅ | ✅ |

### Timer görünümü
- **Aktif:** sayaç geriye sayar
- **Duraklatıldı:** `remainingMs` donuk gösterilir, timer elementi hafif soluklaşır (CSS opacity)

### `renderPomodoro()` güncellenir
- `state.paused` durumunu kontrol eder
- Timer'ı `remainingMs` veya `endTime - Date.now()` ile gösterir

## Mesajlaşma (`background.js`)

| Mesaj | Eylem |
|-------|-------|
| `POMO_STARTED` | `playWhiteNoise()` (mevcut) |
| `POMO_PAUSED` | `stopWhiteNoise()` (YENİ) |
| `POMO_RESUMED` | `playWhiteNoise()` (YENİ) |
| `POMO_STOPPED` | `stopWhiteNoise()` (mevcut) |

## Engellenen Siteler

Duraklatılınca `active: false` olduğundan `background.js`'deki mevcut kontrol (`pomo.active && pomo.phase === 'work'`) zaten doğru çalışır — duraklatılmışken siteler engellenmez, reset'e gerek yok.

## Etkilenen Dosyalar

- `pomodoro.js` — `pausePomodoro`, `resumePomodoro` eklenir; `DEFAULT_STATE` güncellenir
- `popup.html` — yeni butonlar, reset ikonu
- `popup.js` — yeni event listener'lar, `renderPomodoro` güncellenir
- `background.js` — `POMO_PAUSED` ve `POMO_RESUMED` mesajları eklenir
