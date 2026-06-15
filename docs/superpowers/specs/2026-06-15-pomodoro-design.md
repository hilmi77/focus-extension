# Pomodoro Timer — Tasarım Speci

**Tarih:** 2026-06-15  
**Durum:** Onaylandı

---

## Özet

Focus extension'a klasik Pomodoro döngüsü eklenir. Çalışma fazında X (x.com, twitter.com) ve Instagram (instagram.com) her zaman engellenir — kullanıcının engelleme listesinden bağımsız olarak. Mola ve uzun mola fazlarında bu siteler serbesttir, yalnızca kullanıcının normal listesi geçerlidir.

---

## Bileşenler

### `pomodoro.js` (yeni dosya)

Timer mantığını içerir. Popup ve background bu modülü kullanır.

**Dışa açılan fonksiyonlar:**
- `startPomodoro()` — work fazından başlatır, alarmları kurar
- `stopPomodoro()` — aktif timer'ı durdurur, alarmları temizler
- `resetPomodoro()` — durumu sıfırlar (çalışmayan hale getirir)
- `getState()` — mevcut durumu döner (storage'dan okur)
- `handleAlarm(alarmName)` — faz geçişini tetikler (background'dan çağrılır)

**Storage şeması (`chrome.storage.local`):**
```json
{
  "pomodoro": {
    "active": false,
    "phase": "work",
    "round": 1,
    "endTime": null,
    "settings": {
      "workMins": 25,
      "breakMins": 5,
      "longBreakMins": 15,
      "roundsBeforeLongBreak": 4
    }
  }
}
```

**Alarm isimleri:**
- `pomodoro-phase-end` — mevcut fazın bitmesini tetikler

**Faz geçiş mantığı:**
```
work (round N) → break
break → work (round N+1)
work (round 4) → longBreak
longBreak → work (round 1, sıfırlar)
```

---

### `background.js` (genişletilir)

`webNavigation.onBeforeNavigate` listener'ına Pomodoro engelleme katmanı eklenir.

**Sabit engellenen siteler (sadece work fazında):**
```js
const POMODORO_BLOCKED = ['x.com', 'twitter.com', 'instagram.com'];
```

**Kontrol akışı:**
1. Normal blockedSites listesi kontrol edilir (mevcut davranış)
2. Pomodoro `phase === 'work'` ise POMODORO_BLOCKED listesi ek olarak kontrol edilir
3. POMODORO_BLOCKED'dan eşleşme bulunursa `blocked.html`'e yönlendirilir (target yok, sadece engelleme mesajı gösterilir)
4. `handleAlarm` faz geçişlerini işler

---

### `popup.html` (genişletilir)

Mevcut istatistik ve site listesinin üstüne Pomodoro bölümü eklenir.

**UI elemanları:**
- Faz etiketi: `Çalışıyor` / `Mola` / `Uzun Mola`
- Geri sayım: `MM:SS` formatında büyük saat
- Tur göstergesi: 4 adet ● (dolu/boş)
- Butonlar: Başlat / Durdur / Sıfırla
- Ayarlar satırı: çalışma / mola / uzun mola dakika inputları (sayı input, 1–120 arası)

---

### `popup.js` (genişletilir)

- Sayfa açıldığında mevcut Pomodoro durumunu yükler ve UI'yi günceller
- Her saniye `setInterval` ile geri sayımı günceller (endTime - şimdiki zaman)
- Başlat/Durdur/Sıfırla butonları `pomodoro.js` fonksiyonlarını çağırır
- Süre ayarları değiştiğinde yeni değerleri storage'a kaydeder

---

## Davranış Detayları

### Popup kapalıyken timer

`chrome.alarms` kullanıldığı için popup kapalıyken de faz geçişleri çalışır. Popup açıldığında `endTime`'dan geriye kalan süre hesaplanır.

### Pomodoro bittiğinde bildirim

Her faz geçişinde `chrome.notifications` ile bildirim gösterilir:
- work → break: "Mola zamanı! 5 dakika dinlen."
- break → work: "Tekrar odaklanma zamanı!"
- work → longBreak: "4 tur tamamlandı! Uzun mola hak ettin."

### POMODORO_BLOCKED siteleri blocked.html'de

Mevcut `blocked.html`, yönlendirme hedefini URL parametresinden alıyor. Pomodoro kaynaklı engellemede `target` parametresi olmaz — `blocked.html` bu durumu handle eder: "Pomodoro devam ediyor, bu siteye erişim kilitli." mesajı gösterilir.

### Timer durdurulunca

`stopPomodoro()` mevcut fazı ve kalan süreyi korumaz — sıfırdan başlamak gerekir. (Pause/resume yok, tasarım gereği.)

---

## Dosya Değişiklikleri Özeti

| Dosya | Değişiklik |
|---|---|
| `pomodoro.js` | Yeni dosya |
| `background.js` | Pomodoro engelleme katmanı + alarm handler |
| `popup.html` | Pomodoro bölümü eklenir |
| `popup.js` | Pomodoro UI bağlantısı |
| `blocked.html/js` | Pomodoro modu için "target yok" durumu handle edilir |
