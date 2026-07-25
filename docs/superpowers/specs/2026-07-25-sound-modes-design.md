# Ses Modları — Beyaz Gürültü / Klasik Müzik / Kapalı

**Tarih:** 2026-07-25
**Durum:** Tasarım onaylandı

## Amaç

Pomodoro çalışma fazında şu an **her zaman otomatik başlayan** beyaz gürültüyü opsiyonel
hale getirmek ve alternatif olarak YouTube üzerinden klasik müzik seçeneği eklemek.
Kullanıcı sesi hiç istemeyebilir, beyaz gürültü ya da klasik müzik seçebilir ve çalma
sırasında sesi bağımsız olarak durdurabilir.

## Kullanıcı Kararları

- **Ses modu:** Kapalı / Beyaz gürültü / Klasik müzik — **varsayılan: Kapalı**
- **Klasik müzik kaynağı:** Hazır gömülü canlı klasik radyo (varsayılan) + kullanıcının
  yapıştırdığı kendi YouTube linki/ID'si.
- **Bağımsız ⏯ butonu:** Sesi durdurunca **manuel tekrar açana kadar kapalı kalır**
  (sonraki fazda otomatik başlamaz).
- **Kalıcılık:** Seçili mod ve link `chrome.storage` içinde saklanır.

## Durum Modeli (State)

Ses ayarları `chrome.storage.sync` altında `soundSettings` anahtarında tutulur
(cihazlar arası senkron, pomodoro `settings` gibi kullanıcı tercihi):

```js
soundSettings = {
  mode: 'off' | 'whitenoise' | 'classic',   // varsayılan 'off'
  musicUrl: string | null,                   // kullanıcının YouTube linki; null ise preset radyo
}
```

Geçici (transient) çalma durumu `chrome.storage.local` altında `soundRuntime`:

```js
soundRuntime = {
  muted: boolean,   // ⏯ ile durdurulunca true; manuel play ile false. Varsayılan false.
}
```

**Çalma kuralı:** Ses YALNIZCA şu koşulların HEPSİ sağlanınca çalar:
`mode !== 'off'` **ve** pomodoro `active` **ve** `phase === 'work'` **ve** `muted === false`.

Mola/uzun mola fazında, duraklatınca, durdurunca ve `muted === true` iken ses susar.

## Bileşenler

### 1. `offscreen.js` / `offscreen.html` — Ses üretimi

İki bağımsız ses kaynağı:

- **Beyaz gürültü:** Mevcut `startWhiteNoise` / `stopWhiteNoise` (Web Audio, değişmez).
- **Klasik müzik (YouTube):** `offscreen.html` içine gizli bir `<iframe>` gömülür.
  - `src = https://www.youtube.com/embed/<VIDEO_ID>?enablejsapi=1&autoplay=1`
  - Kontrol, `iframe.contentWindow.postMessage(...)` ile yapılır (play/pause/stop).
  - **Not (CSP):** MV3 uzantı sayfaları uzak *script* yükleyemez, bu yüzden YouTube
    IFrame API script'i (`iframe_api`) **kullanılmaz**. Bunun yerine doğrudan `embed`
    iframe'i + `postMessage` komutları kullanılır. `frame-src` varsayılan CSP'de
    kısıtlı olmadığından iframe gömme host izni gerektirmez.
  - Yeni mesaj tipleri: `START_MUSIC { videoId }`, `STOP_MUSIC`.

Offscreen `reasons` zaten `['AUDIO_PLAYBACK']` — değişmez.

### 2. `background.js` — Orkestrasyon

- `ensureOffscreen` değişmez.
- Yeni yardımcılar: `playMusic(videoId)`, `stopMusic()` (offscreen'e mesaj gönderir).
- **Merkezî `syncAudio()` fonksiyonu:** Mevcut state'i okur, çalma kuralını uygular ve
  doğru sesi başlatır/durdurur. Pomodoro mesajları (`POMO_STARTED/PAUSED/RESUMED/STOPPED`)
  ve alarm faz geçişi artık doğrudan beyaz gürültü çağırmak yerine `syncAudio()` çağırır.
- YouTube linkinden video ID çıkarımı `utils.js`'te saf fonksiyon olur (test edilebilir):
  `parseYouTubeId(input)` — tam URL, kısa `youtu.be`, ya da düz ID kabul eder;
  geçersizse `null`. `musicUrl` null ise **preset radyo ID'si** kullanılır.
- Yeni mesaj: popup'tan gelen `SOUND_SETTINGS_CHANGED` ve `SOUND_TOGGLE` (⏯) →
  ilgili state güncellenir, `syncAudio()` çağrılır.

### 3. `popup.html` / `popup.js` — UI

Pomodoro bölümüne (`pomoSection`) yeni bir **ses satırı**:

- 3'lü segment/seçici: **Kapalı · Beyaz gürültü · Klasik müzik**
- Mod "Klasik müzik" iken görünen bir **YouTube link input'u** (boşsa preset radyo çalar,
  ipucu metniyle belirtilir).
- Bir **⏯ durdur/oynat butonu** — pomodoro çalışırken sesi bağımsız susturur/başlatır
  (`SOUND_TOGGLE`). Durum `soundRuntime.muted`'a yazılır ve manuel açana kadar kalır.
- Ayar değişince `SOUND_SETTINGS_CHANGED` mesajı; `soundSettings` `storage.sync`'e yazılır.

### 4. `utils.js` — Saf yardımcı

- `parseYouTubeId(input) → videoId | null`. Birim testleri `tests/utils.test.mjs`'e eklenir.

## Sabit: Preset Radyo

Kod içinde bir sabit: `PRESET_CLASSICAL_VIDEO_ID` — 7/24 canlı klasik müzik yayını yapan
bir YouTube video ID'si. `musicUrl` null olduğunda bu kullanılır. Uygulama sırasında
gömmeye açık, kararlı bir canlı yayın seçilecek (embed'e kapalıysa alternatif denenecek).

## Veri Akışı

1. Kullanıcı popup'ta mod seçer → `soundSettings` `storage.sync`'e yazılır +
   `SOUND_SETTINGS_CHANGED` → `syncAudio()`.
2. Pomodoro başlar (`POMO_STARTED`) → `syncAudio()` kurala göre seçili sesi başlatır.
3. Faz geçişi (alarm): work→break `syncAudio()` sesi durdurur; break→work tekrar başlatır
   (muted değilse).
4. ⏯ butonu → `muted` toggle → `syncAudio()`.
5. Duraklat/Devam/Durdur → mevcut mesajlar `syncAudio()`'ya bağlanır.

## Hata Yönetimi

- Geçersiz YouTube linki: `parseYouTubeId` null döner → preset radyoya düşülür; input'ta
  hafif bir uyarı gösterilir.
- Gömmeye kapalı/oynatılamayan video: sessizce çalmaz (uzantı akışı bozulmaz); beyaz
  gürültü ve pomodoro etkilenmez.
- İnternet yok: müzik çalmaz, hata log'lanır; pomodoro normal devam eder.

## Test

- **Birim (`tests/utils.test.mjs`):** `parseYouTubeId` — tam URL / `youtu.be` / düz ID /
  geçersiz girdi.
- **Manuel (uzantı yüklü):** 3 modun her biri; work↔break geçişinde ses davranışı;
  ⏯ ile durdurup manuel açma; link girip preset'e düşme; uzantı kapat-aç sonrası mod
  kalıcılığı.

## Kapsam Dışı (YAGNI)

- Playlist / çoklu şarkı yönetimi.
- Ses seviyesi kaydırıcısı (beyaz gürültü sabit 0.12 kalır; müzik YouTube varsayılanı).
- Mola fazında farklı ses çalma.
- Kendi mp3 dosyası yükleme.
