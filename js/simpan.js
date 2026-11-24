/* Penyimpanan brankas: SELALU terenkripsi (amplop AES-GCM dari KRIPTO). Tidak ada mode teks polos.
   - Lokal: IndexedDB di profil peramban ini (pintasan desktop memakai profil Edge khusus di data-lokal\edge).
   - Cloud (bila firebase-config.js diisi dan pengguna masuk): dokumen brankas/utama di Firestore berisi amplop saja;
     server hanya melihat teks sandi. Versi (rev) dicek dalam transaksi agar dua orang tidak saling menimpa diam-diam. */
'use strict';
window.SIMPAN = (function () {
  const DB = 'monitoring-somasi', TOKO = 'brankas', KUNCI = 'utama';
  let dbJanji = null;

  function buka() {
    return dbJanji || (dbJanji = new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('IndexedDB tidak tersedia di peramban ini.'));
      const q = indexedDB.open(DB, 1);
      q.onupgradeneeded = () => q.result.createObjectStore(TOKO);
      q.onsuccess = () => res(q.result);
      q.onerror = () => { dbJanji = null; rej(q.error || new Error('IndexedDB gagal dibuka')); };
    }));
  }
  async function tx(mode, fn) {
    const db = await buka();
    return new Promise((res, rej) => {
      const t = db.transaction(TOKO, mode), s = t.objectStore(TOKO), q = fn(s);
      t.oncomplete = () => res(q && q.result);
      t.onerror = t.onabort = () => rej(t.error || new Error('Transaksi IndexedDB gagal'));
    });
  }
  const bacaLokal = () => tx('readonly', s => s.get(KUNCI));
  const tulisLokal = amplop => tx('readwrite', s => s.put(amplop, KUNCI));
  const hapusLokal = () => tx('readwrite', s => { s.delete(INGAT); return s.delete(KUNCI); });

  /* Ingat kunci antar-refresh: yang disimpan hanya CryptoKey AES-GCM NON-EXTRACTABLE (hasil PBKDF2, extractable=false)
     di IndexedDB — bahan mentah & kata sandi tidak pernah disimpan. Terikat ke origin + UID akun; kedaluwarsa setelah
     menganggur BATAS_INGAT_MENIT (atau kunci otomatis brankas bila lebih pendek); dihapus saat "Kunci sekarang",
     kunci otomatis, keluar akun, atau UID berbeda. */
  const INGAT = 'sesi-kunci', BATAS_INGAT_MENIT = 30;
  const bacaIngat = () => tx('readonly', s => s.get(INGAT));
  const lupakanKunci = () => tx('readwrite', s => s.delete(INGAT)).catch(() => {});
  let sentuhT = 0;
  function ingatKunci(uid, oleh) {
    const k = sesi.kunci;
    if (!k || !(k.kunci instanceof CryptoKey) || k.kunci.extractable) return Promise.resolve();   // hanya kunci yang tidak bisa diekspor
    sentuhT = Date.now();
    return tx('readwrite', s => s.put({ kunci: k.kunci, garam: k.garam, iter: k.iter, uid: uid || '', asal: location.origin,
      oleh: String(oleh || '').slice(0, 120), terakhir: sentuhT }, INGAT)).catch(() => {});
  }
  /** Tandai aktivitas (paling sering 1x/menit) agar batas menganggur dihitung dari aktivitas terakhir. */
  function sentuh() {
    if (!sesi.kunci || Date.now() - sentuhT < 60000) return;
    sentuhT = Date.now();
    tx('readwrite', s => { const g = s.get(INGAT); g.onsuccess = () => { if (g.result) s.put(Object.assign(g.result, { terakhir: sentuhT }), INGAT); }; }).catch(() => {});
  }
  /** Kunci yang diingat sah: CryptoKey non-extractable, origin & UID sama, belum menganggur lewat batas. */
  const ingatSah = (r, uid, kini) => r.kunci instanceof CryptoKey && !r.kunci.extractable && r.asal === location.origin
    && r.uid === (uid || '') && r.terakhir <= kini && kini - r.terakhir <= BATAS_INGAT_MENIT * 60000;
  /** Ada kunci yang diingat (belum diperiksa keabsahannya). */
  const adaIngat = () => bacaIngat().then(r => !!r, () => false);
  /** Buka ulang brankas dari kunci yang diingat. -> nama pengguna (jejak audit) atau '' bila tidak bisa (kunci dihapus). */
  async function pulihkanSesi(uid) {
    let r;
    try { r = await bacaIngat(); } catch { return ''; }
    if (!r) return '';
    const batal = async () => { await lupakanKunci(); return ''; }, kini = Date.now();
    if (!ingatSah(r, uid, kini)) return batal();
    try {
      const amplop = await ambilAmplop();
      if (!amplop || amplop.salt !== r.garam || amplop.iter !== r.iter) return batal();   // sandi diganti / brankas lain
      const data = await bukaDengan({ kunci: r.kunci, garam: r.garam, iter: r.iter }, amplop);
      if (kini - r.terakhir > data.pengaturan.kunciMenit * 60000) { kunciSesi(); return batal(); }
    } catch { kunciSesi(); return batal(); }
    sentuhT = 0; sentuh();
    return r.oleh || 'Pengguna';
  }

  /** Status sesi brankas (di memori saja). */
  const sesi = { kunci: null, data: null, rev: 0, cloud: false, mundur: 0, ukuran: 0 };

  function dataKosong() { return { versi: 1, somasi: [], jejak: [], pengaturan: { unit: '', kunciMenit: 10 } }; }

  /** Sumber amplop: cloud (bila aktif & masuk) diutamakan, lokal sebagai salinan. */
  async function ambilAmplop() {
    if (window.CLOUD && window.CLOUD.masuk()) {
      const c = await window.CLOUD.baca();
      if (c) { sesi.cloud = true; return c; }
    }
    sesi.cloud = !!(window.CLOUD && window.CLOUD.masuk());
    return bacaLokal();
  }

  async function adaBrankas() { return !!(await ambilAmplop()); }

  async function bukaBrankas(sandi) {
    const amplop = await ambilAmplop();
    if (!amplop) throw new Error('Brankas belum dibuat.');
    return bukaDengan(await window.KRIPTO.kunciDariAmplop(sandi, amplop), amplop);
  }
  async function bukaDengan(k, amplop) {
    const data = await window.KRIPTO.buka(k, amplop);
    if (!data || !Array.isArray(data.somasi) || !Array.isArray(data.jejak)) throw new Error('Isi brankas tidak dikenali.');
    data.somasi = data.somasi.map(window.DATA.normal);
    data.pengaturan = pengaturanSah(data.pengaturan);
    Object.assign(sesi, { kunci: k, data, rev: amplop.rev || 0 });
    sesi.mundur = cekMundur(sesi.rev);
    return data;
  }
  /** Pengaturan dari brankas divalidasi ulang (anggota lain tidak bisa mematikan kunci otomatis). */
  function pengaturanSah(p) {
    p = p || {};
    return { unit: String(p.unit || '').slice(0, 120), kunciMenit: [5, 10, 15, 30].includes(Number(p.kunciMenit)) ? Number(p.kunciMenit) : 10,
      identitas: identitasSah(p.identitas) };
  }
  const BATAS_ID = { perusahaan: 120, logo: 6, tagline: 80, pedoman: 160 };
  /** Identitas organisasi di brankas; bila kosong diambil dari js/identitas.js (versi laptop/privat). */
  function identitasSah(x) {
    const asal = x && x.perusahaan ? x : (window.IDENTITAS || {}), o = {};
    for (const [k, n] of Object.entries(BATAS_ID)) o[k] = String(asal[k] || '').slice(0, n);
    return o;
  }
  /** Versi tertinggi yang pernah dibuka di perangkat ini; versi lebih rendah = kemungkinan pemulihan ke data lama (rollback). */
  function cekMundur(rev) {
    let maks = 0;
    try {
      const mentah = localStorage.getItem('ms-rev-maks');
      if (mentah !== null && !/^\d+$/.test(mentah)) {
        // Rusak ≠ tidak ada: simpan salinannya sebelum ditulis ulang, dan catat sebagai galat.
        localStorage.setItem('ms-rev-maks.rusak-' + Date.now(), mentah.slice(0, 200));
        console.error('ERROR penanda versi ms-rev-maks rusak; salinan disimpan, perlindungan rollback dimulai ulang dari versi ' + rev);
      } else maks = Number(mentah) || 0;
    } catch { /* localStorage tidak tersedia (mode privat) */ }
    if (rev > maks) try { localStorage.setItem('ms-rev-maks', String(rev)); } catch { /* abaikan */ }
    return rev < maks ? maks : 0;
  }

  async function buatBrankas(sandi, oleh) {
    if (await adaBrankas()) throw new Error('Brankas sudah ada. Buka dengan kata sandinya.');
    const k = await window.KRIPTO.kunciBaru(sandi), data = dataKosong();
    data.pengaturan = pengaturanSah(data.pengaturan);
    await window.KRIPTO.tambahJejak(data.jejak, { oleh, aksi: 'buat-brankas', ringkas: 'Brankas data somasi dibuat' });
    Object.assign(sesi, { kunci: k, data, rev: 0 });
    await simpan();
    return data;
  }

  async function simpan() {
    if (!sesi.kunci) throw new Error('Brankas terkunci.');
    const revBaru = sesi.rev + 1;
    const amplop = await window.KRIPTO.kunci(sesi.kunci, sesi.data, revBaru);
    if (sesi.cloud) await window.CLOUD.tulis(amplop, sesi.rev);
    await tulisLokal(amplop);
    sesi.rev = revBaru;
    cekMundur(revBaru);
    sesi.ukuran = amplop.ct.length;
  }

  /** Ganti kata sandi: garam baru, seluruh isi dienkripsi ulang. */
  async function gantiSandi(lama, baru) {
    const amplop = await ambilAmplop();
    await window.KRIPTO.buka(await window.KRIPTO.kunciDariAmplop(lama, amplop), amplop);
    sesi.kunci = await window.KRIPTO.kunciBaru(baru);
    await simpan();
    await lupakanKunci();   // kunci lama tidak berlaku lagi
  }

  /** Kunci: hapus kunci & data dari memori. lupakan=true (default) juga menghapus kunci yang diingat (refresh minta sandi). */
  function kunciSesi(lupakan = true) { sesi.kunci = null; sesi.data = null; sesi.rev = 0; sesi.mundur = 0; return lupakan ? lupakanKunci() : Promise.resolve(); }
  async function ekspor() { if (!sesi.kunci) throw new Error('Brankas terkunci.'); return window.KRIPTO.kunci(sesi.kunci, sesi.data, sesi.rev); }

  /** Pulihkan dari cadangan terenkripsi (perlu kata sandi cadangan). Menggantikan isi brankas yang terbuka. */
  async function pulihkan(amplop, sandi) {
    const data = await window.KRIPTO.buka(await window.KRIPTO.kunciDariAmplop(sandi, amplop), amplop);
    if (!data || !Array.isArray(data.somasi) || !Array.isArray(data.jejak)) throw new Error('Isi cadangan tidak dikenali.');
    const cek = await window.KRIPTO.periksaJejak(data.jejak);
    if (!cek.utuh) throw new Error('Jejak audit cadangan tidak utuh (rusak di entri ' + cek.rusakDi + '). Pemulihan dibatalkan.');
    data.somasi = data.somasi.map(window.DATA.normal);
    data.pengaturan = pengaturanSah(data.pengaturan);
    sesi.data = data;
    return data;
  }

  return Object.freeze({ sesi, cekMundur, ingatKunci, sentuh, adaIngat, pulihkanSesi, lupakanKunci, BATAS_INGAT_MENIT, adaBrankas, bukaBrankas, buatBrankas, simpan, gantiSandi, kunciSesi, ekspor, pulihkan, hapusLokal, bacaLokal });
})();
