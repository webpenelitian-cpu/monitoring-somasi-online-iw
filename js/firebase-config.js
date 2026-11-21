/* Konfigurasi web Firebase proyek monitoring-somasi-iw. Nilai ini PUBLIK menurut desain Firebase (bukan rahasia):
   API key dibatasi referrer; akses data dijaga aturan Firestore (cloud/firestore.rules: hanya akun di koleksi anggota)
   dan enkripsi end-to-end (server hanya menyimpan teks sandi). */
'use strict';
window.FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyCdVDW9cttpMzbKYYC3Yd2D3di2nubqgu0',
  authDomain: 'monitoring-somasi-iw.firebaseapp.com',
  projectId: 'monitoring-somasi-iw',
  appId: '1:947391379921:web:9b03937397bd6a2dfbc8f0',
  recaptchaSiteKey: '',
  // Mode online hanya aktif di origin resmi ini (situs publik & server laptop); origin lain (uji, salinan) tetap lokal.
  asal: Object.freeze(['https://webpenelitian-cpu.github.io', 'http://127.0.0.1:8801']),
});
