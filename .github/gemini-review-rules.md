Bu proje saf JavaScript ile yazılmış bir **Chrome Manifest V3 extension**'ı (build aracı, package.json yok). Testler `tests/*.test.mjs` içinde `node:test` + `node:assert/strict` ile yazılıyor.

- **manifest.json:** Yeni `permissions` / `host_permissions` gerçekten gerekli mi? Gereksiz geniş izinleri (`<all_urls>` gibi) ve `web_accessible_resources`'a eklenen dosyaları belirt.
- **background.js (service worker):** Worker her an uyutulabilir; global değişkende tutulan state kaybolur, kalıcı veri `chrome.storage`'da olmalı. Zamanlayıcılar için `setTimeout`/`setInterval` yerine `chrome.alarms` kullanılmalı. Event listener'lar top-level'da senkron kaydedilmeli.
- **popup / blocked / offscreen sayfaları:** `innerHTML` ile kullanıcı verisi basılması XSS'tir, `textContent` veya DOM API kullanılmalı. Kullanıcı verisi `href`'e konuyorsa `javascript:` URL riskini belirt. MV3 CSP'de inline `<script>` ve `onclick=` gibi inline handler'lar çalışmaz.
- **utils.js:** Davranışı değişen veya yeni eklenen fonksiyon için `tests/utils.test.mjs`'e test eklenmemişse belirt.
