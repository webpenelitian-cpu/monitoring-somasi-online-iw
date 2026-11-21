/* Pemasang HTML aman (SKOR-01) — dipakai app.js, diuji di tests/uji.html. Tanpa ketergantungan. */
'use strict';
window.HTML_AMAN = (function () {
  // SKOR-01: satu-satunya jalan memasang HTML. Templat aplikasi sudah meng-escape data (esc) dan CSP memblokir skrip sebaris;
  // ini lapis ketiga (allowlist ala OWASP XSS Prevention Cheat Sheet): HTML diurai DOMParser di dokumen inert (<template>,
  // skrip tidak dijalankan), tag aktif & atribut on*/URL javascript:|data:|vbscript: dibuang, lalu node dipasang replaceChildren.
  const PENGURAI = new DOMParser(), TAG_TERLARANG = 'script,iframe,frame,object,embed,base,meta,link,style,template,svg,math';
  const URL_BAHAYA = /^\s*(?:javascript|data|vbscript):/i, ATR_URL = /^(?:href|src|action|formaction|xlink:href|srcdoc)$/i;
  // Pemeriksaan teks sebelum mengurai. CURIGA: kemungkinan atribut on* (nama atribut tidak pernah didekode entitas, jadi
  // selalu tampak harfiah), "script" (javascript:/vbscript:, juga yang disisipi tab/entitas sebagian), "data:", dan SETIAP
  // entitas selain lima yang dihasilkan esc() — entitas lain bisa menyamarkan skema URL (mis. &#106;&#97;…).
  // TAG_AKTIF: pembukaan tag terlarang. Bila keduanya negatif, HTML tidak memuat unsur aktif apa pun sehingga aman diurai
  // langsung di dokumen ini (konteks elemen tujuan, tanpa adopsi node); bila positif, lewat dokumen inert + pembersihan.
  // Positif palsu hanya memilih jalur yang lebih ketat.
  const CURIGA = /\bon[a-z]|script|data\s*:|&(?!(?:amp|lt|gt|quot|#39);)/i;
  const TAG_AKTIF = /<\s*(?:script|iframe|frame|object|embed|base|meta|link|style|template|svg|math)\b/i;
  // Buang karakter kontrol & spasi (kode ≤ U+0020) seperti peramban membuang tab/baris baru dari URL sebelum membaca skema.
  // Ditulis dengan perulangan kode karakter, bukan regex berkarakter kontrol (eslint no-control-regex).
  function tanpaKontrol(s) { let o = ''; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 32) o += s[i]; return o; }
  function pasangHTML(el, html) {
    html = String(html);
    if (!CURIGA.test(html) && !TAG_AKTIF.test(html)) {
      const r = document.createRange(); r.selectNodeContents(el);
      el.replaceChildren(r.createContextualFragment(html));
      return;
    }
    const frag = PENGURAI.parseFromString('<template>' + html + '</template>', 'text/html').querySelector('template').content;
    for (const n of frag.querySelectorAll(TAG_TERLARANG)) n.remove();
    for (const n of frag.querySelectorAll('*')) {
      for (let i = n.attributes.length - 1; i >= 0; i--) {
        const a = n.attributes[i];
        if (a.name.charCodeAt(0) === 111 /* o */ && a.name.charCodeAt(1) === 110 /* n */ || ATR_URL.test(a.name) && URL_BAHAYA.test(tanpaKontrol(a.value))) n.removeAttribute(a.name);
      }
    }
    el.replaceChildren(frag);
  }
  return Object.freeze({ pasang: pasangHTML });
})();
