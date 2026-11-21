/* Pengendali antarmuka Monitoring Somasi: kunci/buka brankas, navigasi, CRUD, impor, OCR, laporan. */
'use strict';
(function () {
  // Cegah halaman dibingkai situs lain (clickjacking). Server lokal juga mengirim frame-ancestors 'none'.
  if (window.top !== window.self) { document.documentElement.hidden = true; throw new Error('Dibingkai: dihentikan'); }
  const S = window.SIMPAN, K = window.KRIPTO;
  // Modul isi aplikasi dimuat setelah layar kunci tampil (saat kolom sandi difokus / formulir dikirim), agar layar kunci ringan.
  let D = window.DATA, T = window.TAMPIL, janjiModul = null;
  const MODUL = ['js/data.js', 'js/xlsx.js', 'js/ekstrak.js', 'js/ocr.js', 'js/grafik.js', 'js/tampilan.js'];
  function muatSatu(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src)); document.head.appendChild(s); });
  }
  function muatModul() {
    if (window.DATA && window.TAMPIL) { D = window.DATA; T = window.TAMPIL; return Promise.resolve(); }
    return janjiModul || (janjiModul = (async () => { for (const m of MODUL) await muatSatu(m); D = window.DATA; T = window.TAMPIL; })()
      .catch(e => { janjiModul = null; throw e; }));
  }
  const $ = s => document.querySelector(s);
  const pasang = (el, html) => window.HTML_AMAN.pasang(el, html);
  const MENU = [['ringkasan', '◆', 'Ringkasan Eksekutif'], ['grafik', '▤', 'Grafik & Risiko'], ['daftar', '☰', 'Daftar Somasi'], ['ocr', '⎙', 'Impor Scan (OCR)'],
    ['impor', '⇪', 'Impor Excel & Cadangan'], ['laporan', '▣', 'Laporan Manajemen'], ['tata-kelola', '⚖', 'Tata Kelola & Jejak Audit'], ['pengaturan', '⚙', 'Pengaturan']];
  const st = { oleh: '', filter: { cari: '', status: '', tingkat: '', proyek: '' }, urut: { kol: 'saldo', naik: false }, imporBaris: null, lembar: [], ocr: null, idleT: 0, blob: [], pulih: null, idlePasang: false };
  const data = () => S.sesi.data;
  const kini = () => D.hariIni();

  // ------------------------------------------------------------------ identitas organisasi
  /** Identitas dari brankas (setelah dibuka) atau js/identitas.js; diterapkan ke elemen [data-identitas]. */
  function terapkanIdentitas(id) {
    window.IDENTITAS_AKTIF = Object.freeze(Object.assign({}, window.IDENTITAS || {}, id || {}));
    const I = window.IDENTITAS_AKTIF;
    document.querySelectorAll('[data-identitas]').forEach(el => {
      if (el.dataset.asli === undefined) el.dataset.asli = el.textContent;
      el.textContent = I[el.dataset.identitas] || el.dataset.asli;
    });
    document.title = 'Monitoring Somasi' + (I.logo ? ' · ' + I.logo.toUpperCase() : '');
  }
  const labelUnit = () => data().pengaturan.unit || (window.IDENTITAS_AKTIF || {}).perusahaan || 'Pemantauan somasi';
  terapkanIdentitas();

  // ------------------------------------------------------------------ tema
  function aturTema(t) {
    if (t) document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
    try { if (t) localStorage.setItem('ms-tema', t); else localStorage.removeItem('ms-tema'); } catch { /* mode privat */ }
  }
  try { const t = localStorage.getItem('ms-tema'); if (t === 'gelap' || t === 'terang') aturTema(t); } catch { /* abaikan */ }
  $('#btn-tema').addEventListener('click', () => {
    const gelap = document.documentElement.dataset.tema === 'gelap' || (!document.documentElement.dataset.tema && matchMedia('(prefers-color-scheme: dark)').matches);
    aturTema(gelap ? 'terang' : 'gelap');
  });

  // ------------------------------------------------------------------ layar kunci
  let modeBuat = false;
  function galatKunci(pesan) { const e = $('#kunci-galat'); e.textContent = pesan || ''; e.hidden = !pesan; }
  /** Mode online: tombol Google; form kata sandi muncul setelah masuk. -> boleh lanjut */
  async function siapkanCloud() {
    const cloud = window.CLOUD.aktif();
    $('#kunci-cloud').hidden = !cloud;
    if (!cloud) return true;
    try { await window.CLOUD.init(); } catch (e) { galatKunci('Layanan online tidak terjangkau: ' + (e.message || e)); }
    const masuk = window.CLOUD.masuk();
    $('#cloud-akun').textContent = masuk ? window.CLOUD.email() : 'Belum masuk';
    $('#form-kunci').hidden = !masuk;
    return masuk;
  }
  async function siapkanKunci() {
    try { await siapkanMode(); } finally { $('.kunci-kartu').classList.add('siap'); }
  }
  async function siapkanMode() {
    if (!(await siapkanCloud())) return;
    let ada = false;
    try { ada = await S.adaBrankas(); } catch (e) { galatKunci(e.message); }
    modeBuat = !ada;
    $('#kunci-judul').textContent = ada ? 'Buka brankas data' : 'Buat brankas data baru';
    $('#lbl-sandi2').hidden = ada; $('#sandi2').required = !ada;
    $('#lbl-nama').hidden = false;
    $('#btn-buka').textContent = ada ? 'Buka' : 'Buat brankas';
    try { $('#nama-pengguna').value = localStorage.getItem('ms-nama') || ''; } catch { /* abaikan */ }
    if (window.CLOUD.masuk()) $('#nama-pengguna').value = window.CLOUD.email();
    $('#sandi').autocomplete = ada ? 'current-password' : 'new-password';
  }
  $('#btn-google').addEventListener('click', async () => {
    const b = $('#btn-google');
    if (b.disabled) return;
    galatKunci(''); b.disabled = true;
    try { await window.CLOUD.masukGoogle(); await siapkanKunci(); } catch (e) { galatKunci(pesanLogin(e)); } finally { b.disabled = false; }
  });
  function pesanLogin(e) {
    const k = (e && e.code) || '';
    if (k === 'auth/popup-blocked') return 'Jendela login Google diblokir peramban. Izinkan pop-up untuk situs ini, lalu klik lagi.';
    if (k === 'auth/popup-closed-by-user' || k === 'auth/cancelled-popup-request') return 'Login dibatalkan. Klik "Masuk dengan Google" sekali lagi.';
    return (e && e.message) || String(e);
  }

  async function kirimKunci(ev) {
    ev.preventDefault(); galatKunci('');
    const sandi = $('#sandi').value, nama = $('#nama-pengguna').value.trim();
    if (!nama) return galatKunci('Isi nama Anda untuk jejak audit.');
    const tombol = $('#btn-buka'); tombol.disabled = true; tombol.textContent = 'Memproses…';
    try {
      await muatModul();
      if (modeBuat) await buat(sandi); else await S.bukaBrankas(sandi);
      st.oleh = nama;
      try { localStorage.setItem('ms-nama', window.CLOUD.masuk() ? '' : nama); } catch { /* abaikan */ }
      await catat('buka-brankas', '', 'Brankas dibuka');
      await simpanSekarang();
      masukAplikasi();
    } catch (e) { galatKunci(e.message || String(e)); } finally {
      tombol.disabled = false; tombol.textContent = modeBuat ? 'Buat brankas' : 'Buka';
      $('#sandi').value = ''; $('#sandi2').value = '';
    }
  }
  async function buat(sandi) {
    const cek = K.cekSandi(sandi);
    if (!cek.sah) throw new Error('Kata sandi lemah: ' + cek.masalah.join('; ') + '.');
    if (sandi !== $('#sandi2').value) throw new Error('Kedua kata sandi tidak sama.');
    await S.buatBrankas(sandi, $('#nama-pengguna').value.trim());
  }
  $('#form-kunci').addEventListener('submit', kirimKunci);

  function masukAplikasi() {
    $('#layar-kunci').hidden = true; $('#app').hidden = false;
    pasang($('#nav'), MENU.map(([id, ik, l]) => `<li><a href="#${id}"><span aria-hidden="true">${ik}</span>${T.esc(l)}</a></li>`).join(''));
    $('#pil-mode').textContent = S.sesi.cloud ? 'Online · ' + window.CLOUD.email() : 'Perangkat ini';
    $('#pil-mode').className = 'pil ' + (S.sesi.cloud ? 'ok' : '');
    terapkanIdentitas(data().pengaturan.identitas);
    $('#unit-label').textContent = labelUnit();
    $('#menit-kunci').textContent = data().pengaturan.kunciMenit;
    infoSimpan('Terbuka · ' + data().somasi.length + ' somasi');
    if (S.sesi.mundur) alert(`PERINGATAN: versi data yang dibuka (versi ${S.sesi.rev}) LEBIH LAMA dari yang pernah dibuka di perangkat ini (versi ${S.sesi.mundur}). Kemungkinan data dipulihkan ke versi lama. Periksa jejak audit dan laporkan ke administrator.`);
    mulaiIdle();
    if (!location.hash || location.hash === '#') location.hash = '#ringkasan'; else tampil();
  }

  function kunciSekarang(alasan) {
    S.kunciSesi(); st.ocr = null; st.imporBaris = null; st.lembar = []; st.pulih = null; st.filter = { cari: '', status: '', tingkat: '', proyek: '' };
    clearTimeout(st.idleT);
    st.blob.forEach(u => URL.revokeObjectURL(u)); st.blob = [];
    if ($('#dlg').open) $('#dlg').close();
    ['#isi', '#dlg-isi', '#dlg-kaki', '#nav'].forEach(s => $(s).replaceChildren());
    $('#app').hidden = true; $('#layar-kunci').hidden = false;
    terapkanIdentitas();
    galatKunci(alasan || '');
    siapkanKunci();
    $('#sandi').focus();
  }
  $('#btn-kunci').addEventListener('click', () => kunciSekarang('Brankas dikunci.'));

  // Kunci otomatis saat tidak aktif: kunci & data dihapus dari memori.
  function mulaiIdle() {
    const reset = () => {
      clearTimeout(st.idleT);
      if (!S.sesi.kunci) return;
      st.idleT = setTimeout(() => kunciSekarang('Dikunci otomatis karena tidak ada aktivitas.'), (data().pengaturan.kunciMenit || 10) * 60000);
    };
    if (!st.idlePasang) { ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(e => document.addEventListener(e, reset, { passive: true })); st.idlePasang = true; }
    reset();
  }

  // ------------------------------------------------------------------ simpan & jejak
  function infoSimpan(t, kelas) { const e = $('#info-simpan'); e.textContent = t; e.className = kelas || ''; }
  async function catat(aksi, id, ringkas) { await K.tambahJejak(data().jejak, { oleh: st.oleh, aksi, id, ringkas }); }
  async function simpanSekarang() {
    infoSimpan('Menyimpan…');
    try {
      await S.simpan(); infoSimpan('Tersimpan terenkripsi · ' + new Date().toLocaleTimeString('id-ID'));
      if (S.sesi.ukuran > 800000) infoSimpan('Tersimpan. PERHATIAN: ukuran brankas mendekati batas 950 KB — arsipkan somasi selesai ke cadangan.', 'galat');
    } catch (e) {
      infoSimpan('GAGAL menyimpan: ' + (e.message || e), 'galat');
      alert('Gagal menyimpan: ' + (e.message || e));
      throw e;
    }
  }

  // ------------------------------------------------------------------ navigasi
  window.addEventListener('hashchange', () => { if (S.sesi.kunci) tampil(); });
  $('#menu-btn').addEventListener('click', () => {
    const b = $('#samping').classList.toggle('buka');
    $('#menu-btn').setAttribute('aria-expanded', String(b));
  });

  const HALAMAN = {
    ringkasan: () => pasang($('#isi'), T.ringkasan(data(), kini())),
    grafik: () => pasang($('#isi'), T.grafik()),
    daftar: () => { pasang($('#isi'), T.daftar(data(), st.filter)); isiTabel(); },
    impor: () => pasang($('#isi'), T.impor()),
    ocr: async () => { pasang($('#isi'), T.ocr({ ada: false })); const lap = await window.OCR.statusLaptop(); if (lap.ada && location.hash === '#ocr') pasang($('#isi'), T.ocr(lap)); },
    laporan: () => pasang($('#isi'), T.laporan(data(), kini(), data().pengaturan.unit, st.oleh)),
    'tata-kelola': async () => pasang($('#isi'), T.tataKelola(data(), await K.periksaJejak(data().jejak))),
    pengaturan: () => pasang($('#isi'), T.pengaturan(data().pengaturan, S.sesi.cloud ? 'Online: amplop terenkripsi disimpan di Firestore (dokumen brankas/utama, riwayat versi tak dapat diubah) dan salinan terenkripsi di perangkat ini.' : 'Perangkat ini: amplop terenkripsi disimpan di IndexedDB profil peramban ini. Unduh cadangan secara berkala.')),
  };
  async function tampil() {
    const [hal, id] = location.hash.slice(1).split('/');
    if (hal === 'somasi' && id) { location.replace('#daftar'); bukaDetail(id); return; }
    const fn = HALAMAN[hal] ? hal : 'ringkasan';
    const m = MENU.find(x => x[0] === fn);
    $('#judul').textContent = m[2]; document.title = m[2] + ' · Monitoring Somasi';
    document.querySelectorAll('#nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + fn ? 'page' : 'false'));
    $('#samping').classList.remove('buka');
    await HALAMAN[fn]();
    pasangGrafik();
    $('#isi').focus({ preventScroll: true });
  }

  function pasangGrafik() {
    const s = D.ringkasan(data().somasi, kini()), G = window.GRAFIK, rp = D.ringkas;
    const buat = {
      cincin: () => G.cincin([{ label: 'Telah dibayar', nilai: s.dibayar }, { label: 'Saldo terbuka', nilai: s.saldo }], { judul: 'Komposisi pembayaran', format: rp }),
      proyek5: () => G.batang(s.perProyek.slice(0, 5).map(x => ({ label: x.label, nilai: x.nilai, ket: x.n + ' somasi' })), { judul: 'Saldo terbuka per proyek', format: rp }),
      proyek: () => G.batang(s.perProyek.map(x => ({ label: x.label, nilai: x.nilai, ket: x.n + ' somasi' })), { judul: 'Saldo terbuka per proyek', format: rp }),
      tingkat: () => G.batang(s.perTingkat.map(x => ({ label: x.label, nilai: x.nilai, ket: x.n + ' somasi' })), { judul: 'Saldo terbuka per tingkat', format: rp, kelas: 'seri-2' }),
      status: () => G.batang(s.perStatus.filter(x => x.n).map(x => ({ label: x.label, nilai: x.n })), { judul: 'Jumlah somasi per status', kelas: 'seri-2' }),
      disposisi: () => G.batang(s.perDisposisi.map(x => ({ label: x.label, nilai: x.n })), { judul: 'Somasi aktif per disposisi', kelas: 'seri-2' }),
      bulan: () => G.kolom(s.perBulan, { judul: 'Somasi masuk per bulan' }),
      matriks: () => G.matriks(s.matriks, { judul: 'Matriks risiko somasi aktif' }),
    };
    document.querySelectorAll('[data-grafik]').forEach(el => { const f = buat[el.dataset.grafik]; if (f) el.replaceChildren(f()); });
  }

  // ------------------------------------------------------------------ daftar
  function cocokFilter(r) {
    const f = st.filter, q = f.cari.toLowerCase();
    if (f.status && r.status !== f.status) return false;
    if (f.tingkat && r.tingkat !== f.tingkat) return false;
    if (f.proyek && r.proyek !== f.proyek) return false;
    return !q || [r.rekanan, r.asalSurat, r.proyek, r.perihal, r.noSurat, r.noAgenda, r.pic].join(' ').toLowerCase().includes(q);
  }
  function nilaiUrut(r, k) {
    if (k === 'saldo') return D.saldoTerbuka(r);
    if (k === 'risiko') return D.aktif(r) ? D.risiko(r, kini()).skor : -1;
    return r[k];
  }
  function isiTabel() {
    const { kol, naik } = st.urut;
    const baris = data().somasi.filter(cocokFilter).sort((a, b) => {
      const x = nilaiUrut(a, kol), y = nilaiUrut(b, kol);
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'id');
      return naik ? c : -c;
    });
    const t = $('#tabel-daftar'); if (t) pasang(t, T.tabelDaftar(baris, st.urut, kini()));
  }
  document.addEventListener('input', e => {
    const m = { 'f-cari': 'cari', 'f-status': 'status', 'f-tingkat': 'tingkat', 'f-proyek': 'proyek' }[e.target.id];
    if (m) { st.filter[m] = e.target.value; isiTabel(); }
  });

  // ------------------------------------------------------------------ dialog somasi
  const dlg = $('#dlg');
  function bukaDialog(judul, isi, kaki) {
    $('#dlg-judul').textContent = judul; pasang($('#dlg-isi'), isi); pasang($('#dlg-kaki'), kaki);
    if (!dlg.open) dlg.showModal();
  }
  function bukaDetail(id) {
    const r = data().somasi.find(x => x.id === id);
    if (!r) return;
    bukaDialog(r.rekanan || r.asalSurat || 'Somasi', T.detail(r, kini()),
      `<button type="button" class="btn hapus" data-aksi="hapus" data-id="${T.esc(id)}">Hapus</button><span class="sp"></span><button type="button" class="btn" data-aksi="tutup-dialog">Tutup</button><button type="button" class="btn utama-btn" data-aksi="ubah" data-id="${T.esc(id)}">Ubah / tambah tindak lanjut</button>`);
  }
  function bukaForm(r) {
    bukaDialog(r ? 'Ubah somasi' : 'Somasi baru', T.formSomasi(r || D.normal({})),
      `<button type="button" class="btn" data-aksi="tutup-dialog">Batal</button><button type="button" class="btn utama-btn" data-aksi="simpan-somasi" data-id="${T.esc(r ? r.id : '')}">Simpan</button>`);
  }
  function bacaForm(form) {
    const f = Object.fromEntries(new FormData(form).entries());
    for (const k of ['nilaiTuntutan', 'dibayar', 'saldo']) f[k] = D.angka(f[k]);
    return f;
  }
  function beda(lama, baru) {
    return ['rekanan', 'proyek', 'tingkat', 'status', 'nilaiTuntutan', 'dibayar', 'saldo', 'disposisi', 'pic', 'tenggat', 'posisi', 'kemungkinan', 'dampak']
      .filter(k => String(lama[k]) !== String(baru[k])).map(k => `${k}: ${lama[k] || '-'} → ${baru[k] || '-'}`).join('; ');
  }
  function catatanDariForm(lama, f) {
    const tetap = lama ? { id: lama.id, dibuat: lama.dibuat, tindakLanjut: lama.tindakLanjut.slice() } : { id: '', dibuat: '', tindakLanjut: [] };
    const r = D.normal(Object.assign({}, lama || {}, f, tetap, { diubah: new Date().toISOString() }));
    if (f['tl-uraian']) r.tindakLanjut.push({ tgl: D.tglSah(f['tl-tgl']) ? f['tl-tgl'] : D.hariIni(), uraian: f['tl-uraian'].slice(0, 600), noSurat: (f['tl-no'] || '').slice(0, 120) });
    return r;
  }
  async function simpanSomasi(id) {
    const form = $('#form-somasi'), f = bacaForm(form);
    if (!f.rekanan && !f.asalSurat) { alert('Isi nama rekanan atau pengirim.'); return; }
    const lama = id ? data().somasi.find(x => x.id === id) : null;
    const r = catatanDariForm(lama, f);
    const ringkasUbah = lama ? (beda(lama, r) || 'perubahan isian') : 'somasi baru ' + r.tingkat + ' ' + D.rupiah(r.nilaiTuntutan);
    if (lama) Object.assign(lama, r); else data().somasi.push(r);
    const tl = f['tl-uraian'] ? ' · TL: ' + f['tl-uraian'] : '';
    await catat(lama ? 'ubah' : 'tambah', r.id, `${r.rekanan || r.asalSurat}: ${ringkasUbah}${tl}`);
    await simpanSekarang();
    dlg.close(); tampil();
  }
  async function hapusSomasi(id) {
    const r = data().somasi.find(x => x.id === id);
    if (!r) return;
    const alasan = prompt(`Hapus somasi ${r.rekanan || r.asalSurat}? Tulis alasan penghapusan (wajib, dicatat di jejak audit):`);
    if (!alasan || !alasan.trim()) return;
    data().somasi = data().somasi.filter(x => x.id !== id);
    await catat('hapus', id, `${r.rekanan || r.asalSurat} (${r.tingkat}, ${D.rupiah(r.nilaiTuntutan)}) dihapus. Alasan: ${alasan.trim().slice(0, 200)}`);
    await simpanSekarang();
    dlg.close(); tampil();
  }

  // ------------------------------------------------------------------ impor excel
  async function bacaExcel(berkas) {
    const hasil = $('#impor-hasil');
    pasang(hasil, '<p class="pesan info" role="status">Membaca berkas…</p>');
    try {
      const lembar = await window.XLSX_MINI.baca(await berkas.arrayBuffer());
      const hanya = $('#hanya-somasi').checked;
      // Lembar berkolom nilai (mis. PAPARAN DIREKSI) dipakai secara bawaan; register surat campuran tanpa nilai harus dipilih sendiri.
      st.lembar = lembar.map(l => Object.assign({ nama: l.nama }, D.dariTabel(l.rows, `Excel: ${berkas.name} › ${l.nama}`, hanya)))
        .filter(l => l.catatan.length).map(l => Object.assign(l, { pakai: l.adaNilai }));
      if (st.lembar.length && !st.lembar.some(l => l.pakai)) st.lembar.forEach(l => { l.pakai = true; });
      tampilRencana();
    } catch (e) { pasang(hasil, `<p class="pesan galat" role="alert">${T.esc(e.message || e)}</p>`); }
  }
  function tampilRencana() {
    const salin = data().somasi.map(r => D.normal(JSON.parse(JSON.stringify(r)))), baris = [];
    for (const l of st.lembar.filter(x => x.pakai)) for (const r of l.catatan) baris.push(rencanaImpor(salin, r));
    st.imporBaris = baris;
    pasang($('#impor-hasil'), st.lembar.length ? T.pratinjauImpor(baris, st.lembar) : '<p class="pesan galat" role="alert">Tidak ada baris yang dikenali. Pastikan ada judul kolom seperti “Nama Rekanan”/“Rekanan”, “Proyek”, “Nilai”.</p>');
  }
  const salinan = r => D.normal(JSON.parse(JSON.stringify(r)));
  /** Rencana per baris dihitung terhadap salinan, agar baris kembar dalam satu berkas juga tergabung. */
  function rencanaImpor(salin, r) {
    const calon = D.calonPasangan(salin, r);
    if (calon.length !== 1) { salin.push(salinan(r)); return { aksi: 'baru', r, kolom: [], ragu: calon.length > 1 ? calon.map(x => x.rekanan) : null }; }
    const p = calon[0], beda = D.selisih(p, r), kolom = D.isiKosong(p, salinan(r));
    return { aksi: kolom.length ? 'isi' : 'sama', r, kolom, beda, idPasangan: p.id };
  }
  async function terapkanSatu(b, n) {
    if (b.aksi === 'baru') {
      const r = salinan(b.r);
      if (b.ragu) r.ket = [r.ket, `[Impor ${D.hariIni()}] mirip ${b.ragu.length} data lain (${b.ragu.join('; ')}); periksa kemungkinan duplikat.`].filter(Boolean).join(' · ');
      data().somasi.push(r); n.baru++;
      return catat('impor-baru', r.id, `${r.rekanan}: ${r.tingkat} ${D.rupiah(r.nilaiTuntutan)} · ${r.sumber}`);
    }
    const p = data().somasi.find(x => x.id === b.idPasangan);
    if (!p) return null;
    const k = D.isiKosong(p, salinan(b.r));
    if (b.beda && b.beda.length) {
      p.ket = [p.ket, `[Impor ${D.hariIni()}] selisih dengan ${b.r.sumber}: ${b.beda.join('; ')} (tidak ditimpa)`].filter(Boolean).join(' · ').slice(0, 2000);
      k.push('ket'); n.beda++;
    }
    if (!k.length) return null;
    n.isi++; p.diubah = new Date().toISOString();
    return catat('impor-lengkapi', p.id, `${p.rekanan}: ${k.join(', ')}${b.beda && b.beda.length ? ' · SELISIH ' + b.beda.join('; ') : ''} · ${b.r.sumber}`);
  }
  async function terapkanImpor() {
    const n = { baru: 0, isi: 0, beda: 0 };
    for (const b of st.imporBaris || []) await terapkanSatu(b, n);
    st.imporBaris = null; st.lembar = [];
    await simpanSekarang();
    pasang($('#impor-hasil'), `<p class="pesan ok" role="status">Impor selesai: ${n.baru} somasi baru, ${n.isi} dilengkapi${n.beda ? `, ${n.beda} selisih dicatat di keterangan untuk diperiksa` : ''}.</p>`);
  }

  // ------------------------------------------------------------------ cadangan
  function unduh(nama, isi, jenis) {
    const url = URL.createObjectURL(new Blob([isi], { type: jenis }));
    const a = document.createElement('a'); a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function cadangan() {
    const amplop = await S.ekspor();
    await catat('unduh-cadangan', '', 'Cadangan terenkripsi diunduh'); await simpanSekarang();
    unduh(`cadangan-monitoring-somasi-${D.hariIni()}.json`, JSON.stringify(amplop), 'application/json');
  }
  async function pulihkan(berkas) {
    try {
      if (berkas.size > 30 * 1024 * 1024) throw new Error('Berkas cadangan terlalu besar.');
      st.pulih = { amplop: JSON.parse(await berkas.text()), nama: berkas.name };
      bukaDialog('Pulihkan cadangan', `<form id="form-pulih" class="form" autocomplete="off"><p class="lebar pesan galat">Pemulihan MENGGANTI seluruh data saat ini dengan isi cadangan <b>${T.esc(berkas.name)}</b>.</p>
        <label class="lebar">Kata sandi brankas saat cadangan dibuat<input type="password" name="sandi" required autocomplete="off"></label></form>`,
        '<button type="button" class="btn" data-aksi="tutup-dialog">Batal</button><button type="submit" form="form-pulih" class="btn utama-btn">Pulihkan</button>');
    } catch (e) { alert('Pemulihan gagal: ' + (e.message || e)); }
  }
  async function kirimPulih(ev) {
    ev.preventDefault();
    const sandi = new FormData(ev.target).get('sandi'), p = st.pulih;
    try {
      await S.pulihkan(p.amplop, sandi);
      await catat('pulihkan-cadangan', '', `Dipulihkan dari ${p.nama}`); await simpanSekarang();
      st.pulih = null; dlg.close(); alert('Cadangan dipulihkan.'); location.hash = '#ringkasan';
    } catch (e) { alert('Pemulihan gagal: ' + (e.message || e)); }
  }

  // ------------------------------------------------------------------ OCR
  async function jalankanOcr(berkas) {
    const kabar = t => pasang($('#ocr-kabar'), `<p>${T.esc(t)}</p><div class="kemajuan"><i></i></div>`);
    pasang($('#ocr-hasil'), '');
    try {
      const h = await window.OCR.baca(berkas, kabar);
      st.ocr = { h, berkas };
      pasang($('#ocr-kabar'), '<p class="pesan ok">Selesai dibaca. Periksa setiap isian terhadap dokumen di sebelah kiri.</p>');
      pasang($('#ocr-hasil'), T.hasilOcr(h, berkas.name));
      await pratinjau(berkas);
    } catch (e) { pasang($('#ocr-kabar'), `<p class="pesan galat" role="alert">OCR gagal: ${T.esc(e.message || e)}</p>`); }
  }
  async function pratinjau(berkas) {
    const tempat = $('#ocr-pratinjau');
    if (!/\.pdf$/i.test(berkas.name)) {
      const img = new Image(), u = URL.createObjectURL(berkas); st.blob.push(u); img.alt = 'Scan ' + berkas.name; img.src = u; tempat.replaceChildren(img); return;
    }
    const lib = await window.OCR.pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await berkas.arrayBuffer()), isEvalSupported: false, enableXfa: false }).promise;
    for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
      const hal = await doc.getPage(i), v1 = hal.getViewport({ scale: 1 }), vp = hal.getViewport({ scale: Math.min(1.6, 2400 / Math.max(v1.width, v1.height)) }), c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height; c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Halaman ${i}`);
      await hal.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      tempat.append(c);
    }
  }
  async function simpanOcr(ev) {
    ev.preventDefault();
    if (!$('#ocr-setuju').checked) { alert('Centang pernyataan verifikasi terlebih dahulu.'); return; }
    const f = Object.fromEntries(new FormData($('#form-ocr')).entries()), h = st.ocr.h;
    const tenggat = Number(f.tenggatHari) > 0 && D.tglSah(f.tglTerima) ? new Date(Date.parse(f.tglTerima + 'T00:00:00Z') + Number(f.tenggatHari) * 86400000).toISOString().slice(0, 10) : '';
    const tidakSepakat = Object.entries(h.suara.status).filter(([, v]) => v !== 'sepakat' && v !== 'mayoritas').map(([k]) => k);
    const r = D.normal({ rekanan: f.rekanan, noSurat: f.noSurat, tglSurat: f.tglSurat, tglTerima: f.tglTerima, perihal: f.perihal, proyek: f.proyek, tingkat: f.tingkat,
      nilaiTuntutan: D.angka(f.nilaiTuntutan), tenggat, sumber: `OCR ${h.jalur}: ${st.ocr.berkas.name} · sha256 ${h.sha256}`,
      tindakLanjut: [{ tgl: f.tglTerima, uraian: 'Somasi diterima dan dicatat dari scan (OCR terverifikasi manusia)', noSurat: f.noSurat }] });
    data().somasi.push(r);
    await catat('tambah-ocr', r.id, `${r.rekanan}: ${r.tingkat} ${D.rupiah(r.nilaiTuntutan)} dari scan ${st.ocr.berkas.name}; diverifikasi ${st.oleh}; mesin: ${h.suara.mesin.join(', ')}${tidakSepakat.length ? '; dikoreksi/diperiksa manual: ' + tidakSepakat.join(', ') : ''}`);
    await simpanSekarang();
    st.ocr = null; location.hash = '#somasi/' + r.id;
  }

  // ------------------------------------------------------------------ pengaturan
  async function simpanAtur(ev) {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries()), p = data().pengaturan;
    p.unit = String(f.unit || '').slice(0, 120); p.kunciMenit = [5, 10, 15, 30].includes(Number(f.kunciMenit)) ? Number(f.kunciMenit) : 10;
    p.identitas = { perusahaan: String(f.perusahaan || '').slice(0, 120), logo: String(f.logo || '').slice(0, 6), tagline: String(f.tagline || '').slice(0, 80), pedoman: String(f.pedoman || '').slice(0, 160) };
    await catat('pengaturan', '', `Unit: ${p.unit || '-'}; kunci otomatis ${p.kunciMenit} menit; identitas: ${p.identitas.perusahaan || '-'}`); await simpanSekarang();
    terapkanIdentitas(p.identitas); $('#unit-label').textContent = labelUnit(); $('#menit-kunci').textContent = p.kunciMenit;
    alert('Pengaturan disimpan.');
  }
  async function gantiSandi(ev) {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries()), cek = K.cekSandi(f.baru);
    try {
      if (!cek.sah) throw new Error('Kata sandi baru lemah: ' + cek.masalah.join('; '));
      if (f.baru !== f.baru2) throw new Error('Kata sandi baru tidak sama.');
      await catat('ganti-sandi', '', 'Kata sandi brankas diganti (garam baru, enkripsi ulang)');
      await S.gantiSandi(f.lama, f.baru);
      ev.target.reset(); alert('Kata sandi diganti. Sampaikan ke anggota lain lewat jalur aman.');
    } catch (e) { alert(e.message || e); }
  }

  // ------------------------------------------------------------------ delegasi peristiwa
  const AKSI = {
    'tutup-dialog': () => dlg.close(), tambah: () => bukaForm(null), csv: unduhCSV,
    ubah: b => { const r = data().somasi.find(x => x.id === b.dataset.id); if (r) bukaForm(r); },
    'simpan-somasi': b => simpanSomasi(b.dataset.id), hapus: b => hapusSomasi(b.dataset.id),
    'impor-terapkan': terapkanImpor, 'impor-batal': () => { st.imporBaris = null; st.lembar = []; pasang($('#impor-hasil'), ''); },
    cadangan, cetak: () => window.print(), 'ocr-batal': () => { st.ocr = null; pasang($('#ocr-hasil'), ''); pasang($('#ocr-kabar'), ''); },
  };
  async function unduhCSV() {
    if (!confirm('CSV berisi data RAHASIA tanpa enkripsi. Simpan hanya di lokasi yang aman. Lanjutkan?')) return;
    await catat('ekspor-csv', '', 'Daftar somasi diekspor ke CSV (tanpa enkripsi)'); await simpanSekarang();
    unduh(`monitoring-somasi-${D.hariIni()}.csv`, D.keCSV(data().somasi.filter(cocokFilter)), 'text/csv;charset=utf-8');
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-aksi]'), u = e.target.closest('[data-urut]');
    if (b && AKSI[b.dataset.aksi]) { e.preventDefault(); Promise.resolve(AKSI[b.dataset.aksi](b)).catch(x => alert(x.message || x)); }
    if (u) { st.urut = { kol: u.dataset.urut, naik: st.urut.kol === u.dataset.urut ? !st.urut.naik : false }; isiTabel(); }
  });
  document.addEventListener('change', e => {
    if (e.target.classList.contains('pilih-lembar')) { st.lembar[Number(e.target.dataset.i)].pakai = e.target.checked; tampilRencana(); return; }
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (e.target.id === 'berkas-xlsx') bacaExcel(f);
    else if (e.target.id === 'berkas-cadangan') pulihkan(f);
    else if (e.target.id === 'berkas-scan') jalankanOcr(f);
    e.target.value = '';
  });
  document.addEventListener('submit', e => {
    const h = { 'form-ocr': simpanOcr, 'form-atur': simpanAtur, 'form-sandi': gantiSandi, 'form-pulih': kirimPulih }[e.target.id];
    if (h) Promise.resolve(h(e)).catch(x => alert(x.message || x));
  });
  window.addEventListener('pagehide', () => { if (S.sesi.kunci) kunciSekarang('Brankas dikunci saat halaman ditutup.'); });
  window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

  ['focusin', 'pointerdown'].forEach(e => $('#form-kunci').addEventListener(e, () => { muatModul().catch(() => {}); }, { once: true }));
  siapkanKunci();
})();
