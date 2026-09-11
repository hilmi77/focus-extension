# Pomodoro — Boşta Kalınca Otomatik Duraklat / Geri Dönünce Devam Et

**Tarih:** 2026-09-11
**Durum:** Tasarım onaylandı

## Amaç

Kullanıcı Pomodoro aktifken aniden uzaklaşmak zorunda kalıp unuttuğunda, mevcut
zamanlayıcı sessizce (kimse takip etmeden) fazdan faza geçmeye devam ediyor ya da
kullanıcı geri döndüğünde ne olduğunu anlamayıp oturumu tamamen terk ediyor —
sonra yeni bir tur manuel başlatmayı unutuyor. `chrome.idle` API'si ile gerçek
kullanıcı etkileşimsizliği tespit edilip zamanlayıcı otomatik duraklatılacak;
kullanıcı geri döndüğünde ise ayrılık süresine göre otomatik devam ettirilecek
ya da (çok uzun sürdüyse) temiz bir başlangıç için sıfırlanacak — **manuel
müdahale gerekmeden**.

## Kullanıcı Kararları

- **Duraklatma eşiği:** 5 dakika hareketsizlik (`chrome.idle` varsayılan tespit
  aralığına yakın, standart bir değer).
- **Geri dönüşte karar eşiği:** 30 dakikadan kısa ayrılıklarda **otomatik devam**
  (`resumePomodoro()`), 30 dakika ve üzeri ayrılıklarda **askıdaki yarım
  tur/faz sıfırlanır** (`stopPomodoro()` ile, work fazı/1. round'a dönülür) ve
  kullanıcıya bilgi verilir.
- **Günlük istatistikler etkilenmez:** `stopPomodoro()` sadece o anki
  aktif/duraklat/faz/round/kalan-süre durumunu sıfırlar; `pomoStats`
  (bugünkü tamamlanan tur sayısı, bugünkü odak dakikası) ve günlük hedef
  ilerlemesi **tamamen ayrı bir depoda** tutulur ve bu akıştan hiç etkilenmez.
  Yani "sıfırlama", o gün elde edilen ilerlemeyi silmez — sadece anlamsız
  hale gelmiş yarım/askıda kalan turu temizler.

## Veri Modeli

Yeni geçici (transient) anahtar, `chrome.storage.local` altında `idleSince`
(ms epoch veya `null`): kullanıcı etkileşimsizliğe geçtiğinde (ve bu extension
tarafından duraklatıldığında) `Date.now()` olarak yazılır; kullanıcı aktif
duruma dönüp işlem tamamlanınca temizlenir. Bu alan, "bu duraklatma idle
tespitinden mi kaynaklandı" sorusuna cevap verir — manuel duraklatmayla
karışmasın diye.

## Karar Mantığı (test edilebilir pure function)

`utils.js`'e eklenir:

```js
export const IDLE_RESET_THRESHOLD_MS = 30 * 60 * 1000;

export function decideIdleReturnAction(awayMs, resetThresholdMs = IDLE_RESET_THRESHOLD_MS) {
  return awayMs >= resetThresholdMs ? 'reset' : 'resume';
}
```

## `background.js` Entegrasyonu

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
  if (idleSince == null) return; // bu duraklatma bizden kaynaklanmadı, dokunma

  await chrome.storage.local.remove('idleSince');
  const current = await getState();
  if (!current.paused) return; // kullanıcı zaten manuel müdahale etmiş

  const action = decideIdleReturnAction(Date.now() - idleSince);
  if (action === 'resume') {
    await resumePomodoro();
    chrome.notifications.create(`pomo-idle-resume-${Date.now()}`, {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: '👋 Tekrar hoş geldin',
      message: 'Bir süre uzaktaydın, Pomodoro kaldığı yerden devam ediyor.',
      priority: 2,
    });
  } else {
    await stopPomodoro();
    chrome.notifications.create(`pomo-idle-reset-${Date.now()}`, {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: '🍅 Pomodoro sıfırlandı',
      message: 'Uzun süre uzaktaydın, yarım kalan tur sıfırlandı. Bugünkü ilerlemen korundu — yeni bir tur başlatabilirsin.',
      priority: 2,
    });
  }
  await syncAudio();
});
```

`pausePomodoro`, `resumePomodoro`, `stopPomodoro`, `getState` zaten
`pomodoro.js`'den export ediliyor — yeni bir state-machine mantığı eklenmiyor,
mevcut fonksiyonlar `chrome.idle` olaylarına bağlanıyor.

## Manifest Değişikliği

`manifest.json`'daki `permissions` dizisine `"idle"` eklenir. Yeni bir
`host_permissions` gerekmez.

## Test Planı

`tests/utils.test.mjs`'e eklenecek:
- `decideIdleReturnAction`: eşik altı/üstü/tam sınır (30dk) davranışı.

`background.js` tarafı (Chrome API'lerine bağımlı, otomatik test harness'ı yok
— site-lock ve motivasyon mesajı özelliklerinde olduğu gibi) manuel doğrulama
ile test edilecek.

## Kapsam Dışı

- Web `IdleDetector` API'si kullanılmıyor (foreground sayfa gerektiriyor,
  `chrome.idle` arka plan/service-worker için doğru araç).
- Duraklatma/sıfırlama eşik süreleri (5dk/30dk) bu iterasyonda ayarlanabilir
  bir kullanıcı ayarı olarak sunulmuyor (YAGNI, sabit değerler yeterli).
- Pomodoro dışı (site engelleme, ses) akışlarına dokunulmuyor.
