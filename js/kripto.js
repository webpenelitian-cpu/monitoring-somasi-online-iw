/* Kriptografi brankas Monitoring Somasi (tanpa pustaka pihak ketiga; WebCrypto bawaan peramban).
   - Kunci: PBKDF2-HMAC-SHA256 600.000 iterasi (OWASP Password Storage Cheat Sheet, rekomendasi PBKDF2-SHA256),
     garam acak 16 bait per brankas. Kunci TIDAK pernah disimpan atau dikirim; hanya hidup di memori selama sesi.
   - Isi: AES-GCM 256 dengan IV acak 12 bait SETIAP kali disimpan (NIST SP 800-38D: IV tidak boleh dipakai ulang).
   - Jejak audit: rantai SHA-256 (setiap entri memuat hash entri sebelumnya) sehingga perubahan/penghapusan riwayat terdeteksi. */
'use strict';
window.KRIPTO = (function () {
  const ITER = 600000, ITER_MIN = 310000, ITER_MAKS = 5000000;
  const APP = 'monitoring-somasi', JENIS = 'AES-GCM-256';
  const te = new TextEncoder(), td = new TextDecoder();

  function b64(buf) {
    const u = new Uint8Array(buf); let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    const bin = atob(String(s)); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function siap() { if (!(window.crypto && crypto.subtle)) throw new Error('WebCrypto tidak tersedia. Buka lewat https:// atau http://127.0.0.1.'); }
  const acak = n => crypto.getRandomValues(new Uint8Array(n));

  // Kata yang mudah ditebak untuk aplikasi ini (nama aplikasi/perusahaan, pola umum).
  const TERLARANG = /somasi|monitoring|password|passw0rd|sandi|rahasia|qwerty|admin|123456|abcdef/i;
  /** Kata dari identitas organisasi (mis. nama perusahaan) yang juga dilarang dipakai di kata sandi. */
  const kataIdentitas = () => String((window.IDENTITAS_AKTIF || window.IDENTITAS || {}).perusahaan || '').toLowerCase().split(/[^a-z0-9]+/).filter(k => k.length >= 4 && !['persero', 'tbk'].includes(k));
  /** Penilaian kekuatan kata sandi brankas: minimal 12 karakter, 3 dari 4 jenis karakter, tanpa kata yang mudah ditebak. */
  function cekSandi(s) {
    s = String(s || '');
    const jenis = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(s)).length;
    const masalah = [];
    if (s.length < 12) masalah.push('minimal 12 karakter');
    if (jenis < 3) masalah.push('gabungkan minimal 3 jenis: huruf kecil, huruf besar, angka, simbol');
    if (/^(.)\1+$/.test(s)) masalah.push('jangan satu karakter berulang');
    if (TERLARANG.test(s) || kataIdentitas().some(k => s.toLowerCase().includes(k))) masalah.push('jangan memakai nama aplikasi/perusahaan atau pola umum (password, 123456, qwerty)');
    return { sah: masalah.length === 0, masalah };
  }

  async function turunkan(sandi, garam, iter) {
    siap();
    const bahan = await crypto.subtle.importKey('raw', te.encode(String(sandi).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: garam, iterations: iter },
      bahan, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /** Membuat kunci sesi baru (garam baru). -> {kunci, garam, iter} */
  async function kunciBaru(sandi) {
    const garam = acak(16);
    return { kunci: await turunkan(sandi, garam, ITER), garam: b64(garam), iter: ITER };
  }

  function amplopSah(x) {
    return !!(x && typeof x === 'object' && x.enc === JENIS && typeof x.ct === 'string' && typeof x.iv === 'string'
      && typeof x.salt === 'string' && Number.isInteger(x.iter) && x.iter >= ITER_MIN && x.iter <= ITER_MAKS);
  }

  /** Membuka kunci dari amplop yang ada (garam & iterasi dari amplop). */
  async function kunciDariAmplop(sandi, amplop) {
    if (!amplopSah(amplop)) throw new Error('Berkas brankas tidak dikenali atau rusak.');
    return { kunci: await turunkan(sandi, unb64(amplop.salt), amplop.iter), garam: amplop.salt, iter: amplop.iter };
  }

  // AAD mengikat amplop ke aplikasi ini DAN nomor versinya: amplop versi lama tidak bisa dipasang ulang sebagai versi baru
  // (rollback/replay) tanpa gagal dekripsi.
  const aad = rev => te.encode(APP + '|brankas/utama|' + rev);
  const revSah = r => Number.isInteger(r) && r >= 0;
  async function kunci(sesi, obj, rev) {
    siap();
    rev = revSah(rev) ? rev : 0;
    const iv = acak(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(rev) }, sesi.kunci, te.encode(JSON.stringify(obj)));
    return { enc: JENIS, kdf: 'PBKDF2-SHA256', iter: sesi.iter, salt: sesi.garam, iv: b64(iv), ct: b64(ct), app: APP, rev };
  }

  async function buka(sesi, amplop) {
    if (!amplopSah(amplop)) throw new Error('Berkas brankas tidak dikenali atau rusak.');
    let teks;
    try {
      teks = td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(amplop.iv), additionalData: aad(revSah(amplop.rev) ? amplop.rev : 0) }, sesi.kunci, unb64(amplop.ct)));
    } catch {
      throw new Error('Kata sandi brankas salah, atau data telah diubah pihak lain.');
    }
    return JSON.parse(teks);
  }

  async function sha256(teks) {
    siap();
    const h = await crypto.subtle.digest('SHA-256', typeof teks === 'string' ? te.encode(teks) : teks);
    return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('');
  }

  /** Isi entri jejak yang di-hash: urutan kunci tetap agar hash dapat dihitung ulang. */
  const isiJejak = e => JSON.stringify([e.no, e.t, e.oleh, e.aksi, e.id, e.ringkas, e.prev]);

  async function tambahJejak(jejak, data) {
    const prev = jejak.length ? jejak[jejak.length - 1].hash : '0'.repeat(64);
    const e = { no: jejak.length + 1, t: new Date().toISOString(), oleh: String(data.oleh || ''), aksi: String(data.aksi || ''),
      id: String(data.id || ''), ringkas: String(data.ringkas || '').slice(0, 300), prev };
    e.hash = await sha256(isiJejak(e));
    jejak.push(e);
    return e;
  }

  /** -> {utuh: bool, rusakDi: nomor entri pertama yang tidak cocok | 0} */
  async function periksaJejak(jejak) {
    let prev = '0'.repeat(64);
    for (let i = 0; i < jejak.length; i++) {
      const e = jejak[i];
      if (e.no !== i + 1 || e.prev !== prev || e.hash !== await sha256(isiJejak(e))) return { utuh: false, rusakDi: i + 1 };
      prev = e.hash;
    }
    return { utuh: true, rusakDi: 0 };
  }

  return Object.freeze({ ITER, cekSandi, kunciBaru, kunciDariAmplop, kunci, buka, amplopSah, sha256, tambahJejak, periksaJejak, b64, unb64 });
})();
