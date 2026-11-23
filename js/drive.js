/* Ambil berkas dari Google Drive (mode online saja). Pola resmi Google: Google Picker + cakupan drive.file, artinya aplikasi
   HANYA mendapat akses ke berkas yang dipilih pengguna sendiri di Picker, bukan seluruh Drive. Token akses hanya di memori
   (± 50 menit), tidak disimpan. Isi berkas diunduh langsung ke peramban dan diproses di perangkat (impor Excel / OCR).
   Google Sheets diekspor sebagai .xlsx; PDF & gambar diunduh apa adanya. */
'use strict';
window.DRIVE = (function () {
  const CAKUPAN = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3/files/';
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const SHEET = 'application/vnd.google-apps.spreadsheet';
  const JENIS = {
    excel: [XLSX, SHEET],
    scan: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/tiff'],
  };
  const MAKS_BERKAS = 25, MAKS_UKURAN = 25 * 1024 * 1024;
  let token = null, habis = 0, pickerSiap = null;

  const tersedia = () => !!(window.CLOUD && window.CLOUD.aktif() && window.CLOUD.masuk());

  /** Token drive.file. Jendela izin Google dibuka LANGSUNG di dalam klik (tanpa await sebelumnya) agar tidak diblokir. */
  function mintaToken() {
    if (token && Date.now() < habis) return Promise.resolve(token);
    return window.CLOUD.tokenDrive(CAKUPAN).then(t => { token = t; habis = Date.now() + 50 * 60000; return t; });
  }

  function muatSkrip(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat Google Picker. Periksa koneksi internet.'));
      document.head.appendChild(s);
    });
  }
  function muatPicker() {
    return pickerSiap || (pickerSiap = (async () => {
      if (!window.gapi) await muatSkrip('https://apis.google.com/js/api.js');
      await new Promise((res, rej) => window.gapi.load('picker', { callback: res, onerror: () => rej(new Error('Google Picker gagal dimuat.')) }));
    })().catch(e => { pickerSiap = null; throw e; }));
  }

  /** Buka Google Picker (pilih banyak). jenis: 'excel' | 'scan'. -> [{id, name, mimeType, sizeBytes}] (kosong bila batal). */
  async function pilih(jenis, tok) {
    await muatPicker();
    const P = window.google.picker, cfg = window.FIREBASE_CONFIG || {};
    const tampil = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false).setMimeTypes(JENIS[jenis].join(','));
    return new Promise(res => {
      new P.PickerBuilder().addView(tampil).enableFeature(P.Feature.MULTISELECT_ENABLED).setMaxItems(MAKS_BERKAS)
        .setOAuthToken(tok).setDeveloperKey(cfg.apiKey).setAppId(cfg.nomorProyek || '').setLocale('id').setTitle('Pilih berkas somasi')
        .setCallback(d => {
          if (d.action === P.Action.PICKED) res((d.docs || []).map(x => ({ id: x.id, name: x.name, mimeType: x.mimeType, sizeBytes: Number(x.sizeBytes) || 0 })));
          else if (d.action === P.Action.CANCEL) res([]);
        }).build().setVisible(true);
    });
  }

  /** Unduh satu berkas terpilih -> File. fetchFn dapat diganti (uji). */
  /** Google Sheets diekspor ke .xlsx; berkas biasa diunduh isinya. -> {url, nama, jenis} */
  function rencanaUnduh(doc) {
    const id = encodeURIComponent(doc.id);
    if (doc.mimeType === SHEET) return { url: `${API}${id}/export?mimeType=${encodeURIComponent(XLSX)}`, nama: /\.xlsx$/i.test(doc.name) ? doc.name : doc.name + '.xlsx', jenis: XLSX };
    return { url: `${API}${id}?alt=media`, nama: doc.name, jenis: doc.mimeType || '' };
  }
  async function unduh(doc, tok, fetchFn) {
    if (!doc || !/^[\w-]{10,}$/.test(doc.id)) throw new Error('ID berkas Drive tidak sah.');
    if (doc.sizeBytes > MAKS_UKURAN) throw new Error(`${doc.name}: lebih dari 25 MB.`);
    const rencana = rencanaUnduh(doc);
    const r = await (fetchFn || fetch)(rencana.url, { headers: { Authorization: 'Bearer ' + tok }, cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error(`${doc.name}: gagal diunduh dari Drive (${r.status}).`);
    const blob = await r.blob();
    if (blob.size > MAKS_UKURAN) throw new Error(`${doc.name}: lebih dari 25 MB.`);
    return new File([blob], rencana.nama, { type: rencana.jenis || blob.type });
  }

  /** Alur lengkap untuk tombol: token (popup bila perlu) -> Picker -> unduh semua. kabar(teks) untuk status. -> File[] */
  function ambil(jenis, kabar) {
    kabar = kabar || (() => {});
    const janjiToken = mintaToken();   // dipanggil sinkron di dalam klik
    return janjiToken.then(async tok => {
      const docs = await pilih(jenis, tok);
      const berkas = [];
      for (let i = 0; i < docs.length; i++) {
        kabar(`Mengunduh dari Drive ${i + 1}/${docs.length}: ${docs[i].name}`);
        berkas.push(await unduh(docs[i], tok));
      }
      return berkas;
    });
  }
  function lupakanToken() { token = null; habis = 0; }

  return Object.freeze({ tersedia, ambil, unduh, lupakanToken, JENIS, MAKS_BERKAS });
})();
