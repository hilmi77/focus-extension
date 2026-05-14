# Focus Extension — Design Spec
**Date:** 2026-05-14  
**Status:** Approved

## Overview

Kişisel üretkenlik için Chrome browser extension'ı. Dikkat dağıtıcı sitelere (Instagram, X vb.) girmeye çalışıldığında motivasyon sayfası gösterir, ardından kullanıcının belirlediği üretken bir siteye yönlendirir.

## Hedef

Kullanıcı (tek kişi, kişisel kullanım) sosyal medya gibi zaman çalan sitelere girmek yerine, farkında olmadan React.dev, Node.js docs, Udemy, Dev.to gibi öğrenme kaynaklarına yönlendirilsin.

## Mimari

### Bileşenler

**1. Background Service Worker** (`background.js`)
- Chrome'un `webNavigation` API'si ile URL değişikliklerini dinler
- Engellenen bir URL tespit edildiğinde `blocked.html`'e yönlendirir
- Redirect hedefini URL parametresi olarak taşır: `blocked.html?target=https://react.dev`
- Engellenen site listesini `chrome.storage.sync`'ten okur

**2. Motivation Sayfası** (`blocked.html` + `blocked.js`)
- Tam ekran, sade tasarım
- Sabit motivasyon mesajı: *"Buraya neden geldin? Zamanın değerli — kendine yatırım yap."*
- Tek buton: **"Haydi çalış →"** → tıklayınca `target` parametresindeki URL'e yönlendirir
- Geri butonu yok, kolay çıkış yok

**3. Popup** (`popup.html` + `popup.js`)
- Toolbar ikonuna tıklayınca açılır
- Üstte istatistik kartları: "🔥 4 günlük streak" + "Bugün 3 engelleme"
- Altında haftalık mini bar chart: son 7 günün günlük engelleme sayısı (canvas veya saf CSS ile, kütüphane yok)
- Mevcut engellenen site → hedef çiftlerini listeler
- Yeni çift ekleme formu: `[instagram.com] → [react.dev]`
- Silme butonu her satırda
- Değişiklikler anında `chrome.storage.sync`'e kaydedilir

**4. İstatistik Motoru** (`background.js` içinde)
- Her engelleme olayında `chrome.storage.local`'e yazar: bugünkü tarih + sayaç
- Günlük sayaç: her gün gece yarısı sıfırlanır (tarih karşılaştırması ile)
- Streak: son engelleme tarihi bugünden farklıysa ve dün de girişim yoksa streak devam eder; engellenen bir siteye bugün başarıyla girilirse (redirect yerine) streak sıfırlanmaz — sadece bloklama sayısı artar (kullanıcı zaten engellendi)

### Veri Yapısı

```json
{
  "blockedSites": [
    { "source": "instagram.com", "target": "https://react.dev" }
  ]
}
```

Liste tamamen kullanıcı tarafından yönetilir — hardcoded site yok. İlk kurulumda liste boştur. Popup üzerinden eklenip silinir, `chrome.storage.sync`'te saklanır.

**İstatistik verisi** (`chrome.storage.local`):
```json
{
  "stats": {
    "streak": 4,
    "lastBlockedDate": "2026-05-14",
    "todayCount": 3,
    "todayDate": "2026-05-14",
    "history": {
      "2026-05-13": 5,
      "2026-05-12": 2
    }
  }
}
```
`history` son 7 günü tutar, eskisi silinir.

## Dosya Yapısı

```
focus-extension/
├── manifest.json          # MV3, permissions: storage, webNavigation
├── background.js          # URL listener + redirect logic
├── blocked.html           # Motivation sayfası
├── blocked.js             # Target URL parse + buton handler
├── popup.html             # Site listesi yönetimi
├── popup.js               # Storage okuma/yazma
├── styles/
│   ├── blocked.css
│   └── popup.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Kurulum (Kişisel Kullanım)

1. `chrome://extensions` aç
2. **Developer mode** aç
3. **Load unpacked** → `focus-extension/` klasörünü seç
4. Toolbar ikonuna tıkla → engellenen siteleri ekle

## UI / Stil

Default browser bileşenleri kullanılmaz. Her iki sayfa da özel CSS ile tasarlanır.

**Motivation Sayfası (`blocked.css`):**
- Koyu arka plan (siyah/çok koyu gri), merkeze hizalı içerik
- Büyük, sade bir başlık fontu
- Buton: dolgu rengi (accent), hover efekti, border-radius, büyük padding — tıklanabilir hissettirsin
- Genel his: odak verici, dağıtmayan, biraz dramatik

**Popup (`popup.css`):**
- Sabit genişlik (360px), temiz beyaz/açık gri arka plan
- Input ve butonlar custom stil: border-radius, focus ring, tutarlı padding
- Site çiftleri kart benzeri satırlar: kaynak → hedef, sağda silme ikonu
- Ekleme formu altta, net ayrımlı bölümler
- Genel his: minimal, modern, kullanışlı

## V2 (Sonraki Özellikler)

- **Üretken site zaman takibi** — React.dev, Node.js gibi hedef sitelerde geçirilen süreyi ölçme, popup'ta gösterme

## Kapsam Dışı

- Firefox / Edge desteği
- Zamanlama (belirli saatlerde engelleme)
- Chrome Web Store yayını
- Şifre koruması
