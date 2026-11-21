/* OCR surat somasi. Dua jalur, keduanya TIDAK mengirim dokumen ke luar perangkat:
   1. Mesin Laptop (paling andal) — layanan ocr/server_ocr.py di 127.0.0.1 (pintasan desktop): Tesseract 5 tessdata_best
      (ind+eng), RapidOCR PP-OCR dengan GPU DirectML, dan RapidOCR 3 PP-OCRv6; lapisan teks PDF digital dipakai langsung.
   2. Mesin Peramban (cadangan saat dibuka online) — tesseract.js 5 (WASM, data bahasa ind+eng dari folder vendor) pada
      dua praolah berbeda + lapisan teks PDF (pdf.js 3.11.174, isEvalSupported:false).
   Hasil semua mesin diadu oleh EKSTRAK.pungutSuara; manusia tetap wajib memverifikasi sebelum menyimpan. */
'use strict';
window.OCR = (function () {
  const MAKS = 25 * 1024 * 1024, MAKS_HAL = 10;
  const tokenMeta = () => { const m = document.querySelector('meta[name="ocr-token"]'); return m ? m.content : ''; };
  const dimuat = new Map();

  function muatSkrip(src) {
    if (!dimuat.has(src)) {
      dimuat.set(src, new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = () => { dimuat.delete(src); rej(new Error('Gagal memuat ' + src)); };
        document.head.appendChild(s);
      }));
    }
    return dimuat.get(src);
  }

  async function statusLaptop() {
    if (!tokenMeta() || !/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return { ada: false };
    try {
      const r = await fetch('/api/ocr/status', { headers: { 'X-OCR-Token': tokenMeta() }, cache: 'no-store' });
      return r.ok ? Object.assign({ ada: true }, await r.json()) : { ada: false };
    } catch { return { ada: false }; }
  }

  async function lewatLaptop(berkas, kabar) {
    kabar('Mesin laptop: membaca dokumen dengan 3 mesin OCR…');
    const r = await fetch('/api/ocr', { method: 'POST', body: berkas, cache: 'no-store',
      headers: { 'X-OCR-Token': tokenMeta(), 'Content-Type': berkas.type || 'application/octet-stream' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.galat || ('Layanan OCR menolak (' + r.status + ')'));
    return { jalur: 'laptop', mesin: j.mesin || [], halaman: j.halaman || 1, catatan: j.catatan || '' };
  }

  // ------------------------------------------------------------- jalur peramban
  async function pdfjs() {
    await muatSkrip('vendor/pdfjs/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
    return window.pdfjsLib;
  }
  async function halamanPdf(berkas, kabar) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await berkas.arrayBuffer()), isEvalSupported: false, enableXfa: false }).promise;
    const n = Math.min(doc.numPages, MAKS_HAL), kanvas = [], teks = [];
    for (let i = 1; i <= n; i++) {
      kabar(`Merender halaman ${i}/${n}…`);
      const hal = await doc.getPage(i);
      const isi = await hal.getTextContent();
      teks.push(isi.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join(''));
      const vp = hal.getViewport({ scale: 300 / 72 }), c = document.createElement('canvas');
      const skala = Math.min(1, 4000 / Math.max(vp.width, vp.height));
      const v2 = hal.getViewport({ scale: (300 / 72) * skala });
      c.width = Math.round(v2.width); c.height = Math.round(v2.height);
      await hal.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
      kanvas.push(c);
    }
    return { kanvas, teksDigital: teks.join('\n\f\n'), halaman: n };
  }
  async function kanvasGambar(berkas) {
    const bmp = await createImageBitmap(berkas);
    const skala = Math.min(1, 4000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * skala); c.height = Math.round(bmp.height * skala);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }
  /** Praolah kedua: abu-abu + ambang Otsu (teks pudar / latar kertas berwarna). */
  function biner(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data, hist = new Array(256).fill(0);
    for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = g; hist[g]++; }
    const t = otsu(hist, d.length / 4);
    for (let i = 0; i < d.length; i += 4) { const v = d[i] > t ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
    x.putImageData(img, 0, 0);
    return c;
  }
  function otsu(hist, total) {
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maks = 0, ambang = 127;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF, antar = wB * wF * (mB - mF) * (mB - mF);
      if (antar > maks) { maks = antar; ambang = i; }
    }
    return ambang;
  }
  let pekerja = null;
  async function tesseract() {
    if (pekerja) return pekerja;
    await muatSkrip('vendor/tesseract/tesseract.min.js');
    const dasar = new URL('vendor/tesseract/', location.href).href;
    pekerja = await window.Tesseract.createWorker(['ind', 'eng'], 1, {
      workerPath: dasar + 'worker.min.js', corePath: dasar + 'core', langPath: dasar + 'lang', workerBlobURL: false, gzip: true, cacheMethod: 'none',
    });
    return pekerja;
  }
  async function lewatPeramban(berkas, kabar) {
    let kanvas, teksDigital = '', halaman = 1;
    if (/pdf$/i.test(berkas.type) || /\.pdf$/i.test(berkas.name)) ({ kanvas, teksDigital, halaman } = await halamanPdf(berkas, kabar));
    else kanvas = [await kanvasGambar(berkas)];
    kabar('Menyiapkan mesin OCR peramban (sekali per sesi)…');
    const w = await tesseract(), a = [], b = [];
    for (let i = 0; i < kanvas.length; i++) {
      kabar(`OCR halaman ${i + 1}/${kanvas.length} (2 praolah)…`);
      a.push((await w.recognize(kanvas[i])).data.text);
      b.push((await w.recognize(biner(kanvas[i]))).data.text);
    }
    const mesin = [{ mesin: 'Tesseract.js (asli)', teks: a.join('\n\f\n') }, { mesin: 'Tesseract.js (biner Otsu)', teks: b.join('\n\f\n') }];
    if (teksDigital.replace(/\s/g, '').length > 80) mesin.unshift({ mesin: 'Teks digital PDF', teks: teksDigital });
    return { jalur: 'peramban', mesin, halaman, catatan: '' };
  }

  async function baca(berkas, kabar) {
    kabar = kabar || (() => {});
    if (!berkas || berkas.size > MAKS) throw new Error('Berkas kosong atau lebih dari 25 MB.');
    if (!/\.(pdf|png|jpe?g|webp|bmp|tiff?)$/i.test(berkas.name)) throw new Error('Gunakan PDF atau gambar (PNG, JPG, WEBP, BMP, TIFF).');
    const lap = await statusLaptop();
    const hasil = lap.ada ? await lewatLaptop(berkas, kabar) : await lewatPeramban(berkas, kabar);
    hasil.sha256 = await window.KRIPTO.sha256(new Uint8Array(await berkas.arrayBuffer()));
    hasil.suara = window.EKSTRAK.pungutSuara(hasil.mesin);
    return hasil;
  }
  return Object.freeze({ baca, statusLaptop, otsu, pdfjs });
})();
