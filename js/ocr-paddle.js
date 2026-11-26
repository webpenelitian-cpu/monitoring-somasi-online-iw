/* Mesin OCR peramban berbasis PaddleOCR PP-OCRv4 (deteksi DB + pengenalan CTC, Apache-2.0) lewat ONNX Runtime Web
   1.31.1 (MIT): WebGPU bila tersedia, selain itu WASM. Semua berkas (pustaka, model, kamus) disajikan dari folder
   vendor situs ini sendiri dan hashnya tercatat di vendor/SHA256SUMS; dokumen TIDAK pernah dikirim ke luar perangkat.
   Hasilnya ikut diadu dengan Tesseract.js oleh EKSTRAK.pungutSuara; manusia tetap wajib memverifikasi. */
'use strict';
window.OCR_PADDLE = (function () {
  const DASAR = 'vendor/', MAKS_SISI = 2000, MIN_SISI = 736, TINGGI_REC = 48, LEBAR_REC_MAKS = 1600;

  // ------------------------------------------------------------------ bagian murni (diuji tanpa model)
  const kali32 = v => Math.max(32, Math.round(v / 32) * 32);
  /** Ukuran masukan deteksi: sisi terpanjang ≤ 2000, sisi terpendek ≥ 736 (seperti RapidOCR), kelipatan 32. */
  function ukuranDet(w, h) {
    let s = Math.min(1, MAKS_SISI / Math.max(w, h));
    if (Math.min(w, h) * s < MIN_SISI) s = MIN_SISI / Math.min(w, h);
    const W = kali32(w * s), H = kali32(h * s);
    return { w: W, h: H, sx: W / w, sy: H / h };
  }
  /** Satu komponen terhubung (4-tetangga) mulai dari piksel p. -> {x0,y0,x1,y1,jumlah,n} */
  const tetangga = (q, x, y, W, H) => [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1];
  function perluas(b, x, y) { b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); }
  function komponen(peta, mask, W, H, p, tumpuk) {
    const b = { x0: W, y0: H, x1: 0, y1: 0, jumlah: 0, n: 0 };
    tumpuk.length = 0; tumpuk.push(p); mask[p] = 0;
    while (tumpuk.length) {
      const q = tumpuk.pop(), x = q % W, y = (q - x) / W;
      b.jumlah += peta[q]; b.n++; perluas(b, x, y);
      for (const r of tetangga(q, x, y, W, H)) if (r >= 0 && mask[r]) { mask[r] = 0; tumpuk.push(r); }
    }
    b.x1++; b.y1++;
    return b;
  }
  /** Kotak teks dari peta probabilitas DB: ambang -> komponen -> skor rata-rata -> diperlebar (unclip). Urut atas-bawah. */
  function kotakDariPeta(peta, W, H, o) {
    const mask = new Uint8Array(W * H), tumpuk = [], out = [];
    for (let i = 0; i < mask.length; i++) mask[i] = peta[i] > o.ambang ? 1 : 0;
    for (let p = 0; p < mask.length; p++) {
      if (!mask[p]) continue;
      const b = komponen(peta, mask, W, H, p, tumpuk), w = b.x1 - b.x0, h = b.y1 - b.y0;
      if (Math.min(w, h) < 3 || b.jumlah / b.n < o.ambangKotak) continue;
      const d = (w * h * o.rasioUnclip) / (2 * (w + h));
      out.push({ x0: Math.max(0, b.x0 - d), y0: Math.max(0, b.y0 - d), x1: Math.min(W, b.x1 + d), y1: Math.min(H, b.y1 + d), skor: b.jumlah / b.n });
    }
    return out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  }
  /** Dekode CTC rakus: indeks 0 = blank, 1..n = kamus, n+1 = spasi; ulangan berturut-turut digabung. */
  function dekodeCTC(logit, T, C, kamus) {
    let teks = '', jumlah = 0, n = 0, sebelum = -1;
    for (let t = 0; t < T; t++) {
      let maks = -Infinity, idx = 0;
      for (let c = 0; c < C; c++) { const v = logit[t * C + c]; if (v > maks) { maks = v; idx = c; } }
      if (idx !== 0 && idx !== sebelum) { teks += idx <= kamus.length ? kamus[idx - 1] : ' '; jumlah += maks; n++; }
      sebelum = idx;
    }
    return { teks, skor: n ? jumlah / n : 0 };
  }
  /** Kotak bertext -> baris: tumpang-tindih vertikal ≥ 50% = satu baris; kiri ke kanan; baris atas ke bawah. */
  function susunBaris(kotak) {
    const baris = [];
    for (const k of [...kotak].sort((a, b) => a.y0 - b.y0)) {
      const tinggi = k.y1 - k.y0;
      const b = baris.find(x => Math.min(x.y1, k.y1) - Math.max(x.y0, k.y0) >= 0.5 * Math.min(tinggi, x.y1 - x.y0));
      if (b) { b.isi.push(k); b.y0 = Math.min(b.y0, k.y0); b.y1 = Math.max(b.y1, k.y1); } else baris.push({ y0: k.y0, y1: k.y1, isi: [k] });
    }
    return baris.sort((a, b) => a.y0 - b.y0).map(b => b.isi.sort((x, y) => x.x0 - y.x0).map(x => x.teks).filter(Boolean).join(' ')).filter(Boolean).join('\n');
  }

  /** Tolak janji yang belum selesai setelah ms (mesin tambahan tidak boleh membuat OCR macet). */
  function denganBatas(janji, ms, apa) {
    let t;
    const batas = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${apa} melewati batas waktu ${Math.round(ms / 1000)} detik`)), ms); });
    return Promise.race([janji, batas]).finally(() => clearTimeout(t));
  }
  const BATAS_GPU = 20000, BATAS_SIAP = 120000, BATAS_HALAMAN = 90000;

  // ------------------------------------------------------------------ mesin (memuat pustaka & model saat dipakai)
  let siap = null;
  function muatSkrip(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src)); document.head.appendChild(s); });
  }
  async function sesi(ort, nama) {
    const url = DASAR + 'paddleocr/' + nama;
    // WebGPU bisa menggantung bila GPU sibuk/tidak stabil: dibatasi waktunya, lalu turun ke WASM (CPU).
    if (navigator.gpu) {
      try { return { s: await denganBatas(ort.InferenceSession.create(url, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' }), BATAS_GPU, 'WebGPU'), ep: 'webgpu' }; } catch { /* turun ke WASM */ }
    }
    return { s: await ort.InferenceSession.create(url, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }), ep: 'wasm' };
  }
  function siapkan() {
    return siap || (siap = (async () => {
      if (!window.ort) await muatSkrip(DASAR + 'onnxruntime/ort.webgpu.min.js');
      const ort = window.ort;
      // Halaman tidak cross-origin isolated (GitHub Pages): tanpa SharedArrayBuffer -> 1 thread, tanpa worker proxy.
      ort.env.wasm.wasmPaths = new URL(DASAR + 'onnxruntime/', location.href).href;
      ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
      const [det, rec, teksKamus] = await Promise.all([sesi(ort, 'ch_PP-OCRv4_det_mobile.onnx'), sesi(ort, 'ch_PP-OCRv4_rec_mobile.onnx'),
        fetch(DASAR + 'paddleocr/ppocr_keys_v1.txt').then(r => { if (!r.ok) throw new Error('Kamus OCR tidak termuat'); return r.text(); })]);
      return { ort, det, rec, kamus: teksKamus.replace(/\r/g, '').split('\n').filter((x, i, a) => x !== '' || i < a.length - 1) };
    })().catch(e => { siap = null; throw e; }));
  }
  /** Kanvas -> tensor CHW ternormalisasi (x/255 - 0.5) / 0.5. */
  function tensor(ort, kanvas, W, H, sx, sy, sw, sh) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.drawImage(kanvas, sx, sy, sw, sh, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data, n = W * H, f = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) f[k * n + i] = d[i * 4 + k] / 127.5 - 1;
    return new ort.Tensor('float32', f, [1, 3, H, W]);
  }
  async function deteksi(m, kanvas) {
    const u = ukuranDet(kanvas.width, kanvas.height);
    const keluar = await m.det.s.run({ [m.det.s.inputNames[0]]: tensor(m.ort, kanvas, u.w, u.h, 0, 0, kanvas.width, kanvas.height) });
    const peta = keluar[m.det.s.outputNames[0]].data;
    return kotakDariPeta(peta, u.w, u.h, { ambang: 0.3, ambangKotak: 0.5, rasioUnclip: 1.6 })
      .map(k => ({ x0: k.x0 / u.sx, y0: k.y0 / u.sy, x1: k.x1 / u.sx, y1: k.y1 / u.sy }));
  }
  async function kenali(m, kanvas, k) {
    const w = k.x1 - k.x0, h = k.y1 - k.y0, W = Math.min(LEBAR_REC_MAKS, Math.max(16, Math.ceil(TINGGI_REC * w / h)));
    const keluar = await m.rec.s.run({ [m.rec.s.inputNames[0]]: tensor(m.ort, kanvas, W, TINGGI_REC, k.x0, k.y0, w, h) });
    const o = keluar[m.rec.s.outputNames[0]];
    return dekodeCTC(o.data, o.dims[1], o.dims[2], m.kamus);
  }
  /** Baca satu atau beberapa kanvas halaman. -> {teks, ep} */
  async function baca(daftarKanvas, kabar) {
    kabar = kabar || (() => {});
    kabar('Menyiapkan PaddleOCR peramban (unduhan pertama ±42 MB, lalu tersimpan di cache peramban)…');
    const m = await denganBatas(siapkan(), BATAS_SIAP, 'Memuat PaddleOCR'), halaman = [];
    for (let i = 0; i < daftarKanvas.length; i++) {
      kabar(`PaddleOCR (${m.det.ep === 'webgpu' ? 'GPU' : 'CPU'}) halaman ${i + 1}/${daftarKanvas.length}: mendeteksi teks…`);
      halaman.push(await denganBatas(bacaHalaman(m, daftarKanvas[i], i, daftarKanvas.length, kabar), BATAS_HALAMAN, `PaddleOCR halaman ${i + 1}`));
    }
    return { teks: halaman.join('\n\f\n'), ep: m.det.ep };
  }
  async function bacaHalaman(m, kanvas, i, n, kabar) {
    const kotak = await deteksi(m, kanvas);
    for (let j = 0; j < kotak.length; j++) {
      if (j % 20 === 0) kabar(`PaddleOCR halaman ${i + 1}/${n}: membaca ${j + 1}/${kotak.length} baris…`);
      const r = await kenali(m, kanvas, kotak[j]);
      kotak[j].teks = r.skor >= 0.5 ? r.teks : '';
    }
    return susunBaris(kotak);
  }
  return Object.freeze({ ukuranDet, kotakDariPeta, dekodeCTC, susunBaris, denganBatas, baca });
})();
