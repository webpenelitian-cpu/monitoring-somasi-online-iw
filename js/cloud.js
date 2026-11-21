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

  async function masukGoogle() {
    await init();
    const p = new A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    user = (await A.signInWithPopup(auth, p)).user;
    if (!(await anggota())) { await keluar(); throw new Error('Akun ini belum terdaftar sebagai anggota. Minta administrator menambahkan UID Anda.'); }
    return user;
  }
  async function keluar() { if (auth) await A.signOut(auth); user = null; }
  async function anggota() {
    try { return (await F.getDoc(F.doc(db, 'anggota', user.uid))).exists(); } catch { return false; }
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
  return Object.freeze({ aktif, init, masuk, email, masukGoogle, keluar, baca, tulis });
})();
