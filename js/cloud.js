/* Sambungan Firebase (mode online). SDK (salinan lokal) dimuat hanya bila firebase-config.js terisi.
   Yang dikirim ke Firestore HANYA amplop terenkripsi + nomor versi + email pengubah; kata sandi brankas tidak pernah dikirim.
   Pola diambil dari aplikasi lowongan-kerja (login Google popup, sesi berakhir saat peramban ditutup, App Check opsional). */
'use strict';
window.CLOUD = (function () {
  // SDK Firebase 10.12.2 disalin ke vendor/firebase (hash asli diverifikasi, lihat vendor/SUMBER.md): tanpa CDN.
  const SDK = new URL('vendor/firebase', document.baseURI).href;
  const cfg = window.FIREBASE_CONFIG || {};
  let A = null, F = null, app = null, auth = null, db = null, user = null, siap = null;

  const lengkap = () => !!(cfg.apiKey && cfg.projectId && cfg.appId);
  const aktif = () => lengkap() && Array.isArray(cfg.asal) && cfg.asal.includes(location.origin);
  const masuk = () => !!user;
  const email = () => (user && user.email) || '';
  const uid = () => (user && user.uid) || '';
  /** fn(uidBaru) dipanggil bila akun berganti/keluar (mis. di tab lain) — brankas yang terbuka harus dikunci. */
  function pantauAkun(fn) {
    if (!auth) return;
    let awal = uid();
    A.onAuthStateChanged(auth, u => { const baru = (u && u.uid) || ''; if (baru !== awal) { awal = baru; fn(baru); } });
  }

  function init() {
    return siap || (siap = (async () => {
      const [appMod, fsMod, authMod, ac] = await Promise.all([
        import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore.js`), import(`${SDK}/firebase-auth.js`),
        cfg.recaptchaSiteKey ? import(`${SDK}/firebase-app-check.js`) : null,
      ]);
      F = fsMod; A = authMod;
      app = appMod.initializeApp(cfg);
      if (ac) ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(cfg.recaptchaSiteKey), isTokenAutoRefreshEnabled: false });
      auth = A.getAuth(app); auth.languageCode = 'id';
      await A.setPersistence(auth, A.browserSessionPersistence);
      db = F.getFirestore(app);
      user = await new Promise(res => { const off = A.onAuthStateChanged(auth, u => { off(); res(u); }); });
    })().catch(e => { siap = null; throw e; }));
  }

  /** Jendela Google WAJIB dibuka langsung di dalam klik pengguna (tanpa await sebelumnya), atau peramban memblokirnya
      (auth/popup-blocked / cancelled-popup-request). SDK sudah dimuat oleh init() saat layar kunci tampil. */
  function masukGoogle() {
    if (!auth) return Promise.reject(new Error('Layanan login belum siap. Muat ulang halaman lalu coba lagi.'));
    const p = new A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return A.signInWithPopup(auth, p).then(async hasil => {
      user = hasil.user;
      if (await anggota()) return user;
      const uid = user.uid, email = user.email;
      await keluar();
      const e = new Error(`Akun ${email} belum terdaftar sebagai anggota. Minta administrator menambahkan dokumen anggota_email/${String(email).toLowerCase()} (atau anggota/${uid}).`);
      e.uid = uid; throw e;
    });
  }
  async function keluar() { if (auth) await A.signOut(auth); user = null; }
  /** Token akses Google untuk cakupan tambahan (mis. drive.file), lewat jendela izin Google akun yang sedang masuk.
      Dibuka langsung di dalam klik (tanpa await sebelumnya). Token tidak disimpan di sini. */
  function tokenDrive(cakupan) {
    if (!auth || !auth.currentUser) return Promise.reject(new Error('Masuk dengan Google terlebih dahulu.'));
    const p = new A.GoogleAuthProvider();
    p.addScope(cakupan);
    p.setCustomParameters({ login_hint: auth.currentUser.email || '' });
    return A.reauthenticateWithPopup(auth.currentUser, p).then(r => {
      const c = A.GoogleAuthProvider.credentialFromResult(r);
      if (!c || !c.accessToken) throw new Error('Izin Google Drive tidak diberikan.');
      return c.accessToken;
    });
  }
  /** Anggota bila ada anggota/{uid} atau anggota_email/{email huruf kecil}. */
  async function anggota() {
    const ada = async (kol, id) => { try { return (await F.getDoc(F.doc(db, kol, id))).exists(); } catch { return false; } };
    return (await ada('anggota', user.uid)) || (!!user.email && await ada('anggota_email', user.email.toLowerCase()));
  }

  async function baca() {
    const s = await F.getDoc(F.doc(db, 'brankas', 'utama'));
    return s.exists() ? s.data() : null;
  }
  /** Tulis amplop bila versi di server masih revLama. -> rev baru. Galat 'konflik' bila orang lain sudah menyimpan. */
  async function tulis(amplop, revLama) {
    const ref = F.doc(db, 'brankas', 'utama');
    return F.runTransaction(db, async t => {
      const s = await t.get(ref), revServer = s.exists() ? (s.data().rev || 0) : 0;
      if (revServer !== revLama || amplop.rev !== revLama + 1) {
        const oleh = s.exists() ? (s.data().oleh || 'anggota lain') : 'administrator (dokumen tidak ada)';
        const e = new Error(`Data di server sudah berubah (oleh ${oleh}). Perubahan Anda BELUM tersimpan: catat perubahan, kunci lalu buka ulang brankas, kemudian ulangi.`);
        e.code = 'konflik'; throw e;
      }
      const isi = Object.assign({}, amplop, { oleh: user.email, diubah: F.serverTimestamp(), versi: 1 });
      t.set(ref, isi);
      t.set(F.doc(db, 'riwayat', 'r' + amplop.rev), isi);
      return amplop.rev;
    });
  }
  return Object.freeze({ aktif, init, masuk, email, uid, pantauAkun, masukGoogle, keluar, baca, tulis, tokenDrive });
})();
