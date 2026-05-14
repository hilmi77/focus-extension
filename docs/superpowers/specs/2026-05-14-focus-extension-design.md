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
- Mevcut engellenen site → hedef çiftlerini listeler
- Yeni çift ekleme formu: `[instagram.com] → [react.dev]`
- Silme butonu her satırda
- Değişiklikler anında `chrome.storage.sync`'e kaydedilir

### Veri Yapısı

```json
{
  "blockedSites": [
    { "source": "instagram.com", "target": "https://react.dev" },
    { "source": "twitter.com", "target": "https://nodejs.org" },
    { "source": "x.com", "target": "https://nodejs.org" }
  ]
}
```

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

## Kapsam Dışı

- Firefox / Edge desteği
- Zamanlama (belirli saatlerde engelleme)
- İstatistik / dashboard
- Chrome Web Store yayını
- Şifre koruması
