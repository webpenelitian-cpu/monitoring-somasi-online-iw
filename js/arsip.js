/* Menu Lokasi Tagihan & Jaminan Pelaksanaan (Jampel): model, impor (judul kolom), pengingat, dan templat.
   Pencatatan mengacu pada ISO 15489-1:2016 (metadata, keaslian, riwayat), UU 43/2009 & PP 28/2012 (kearsipan),
   UU 27/2022 (PDP); kontrol akses mengacu pada ISO/IEC 27001. Ketentuan jaminan mengacu pada Perpres 16/2018 jo.
   12/2021 dan pedoman SCM internal; nilai/ambang tidak ditetapkan di sini dan wajib dicek di sumber resmi.
   Data tersimpan di brankas terenkripsi bersama data somasi. Sisa waktu jaminan DIHITUNG saat ditampilkan. */
'use strict';
window.ARSIP = (function () {
  const D = () => window.DATA, T = () => window.TAMPIL;
  const teks = v => String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
  const esc = s => T().esc(s);
  const tglSah = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const tgl = v => { const t = D().tglExcel(v); return tglSah(t) ? t : ''; };
  const hari = (a, b) => (tglSah(a) && tglSah(b) ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) : null);
  const kunciJudul = h => teks(h).toLowerCase();

  // ------------------------------------------------------------------ skema
  const STATUS_J = ['Aktif', 'Diperpanjang', 'Diklaim/Dicairkan', 'Dikembalikan', 'Expired'];
  const SKEMA = {
    lokasi: {
      kolom: [['tglMasuk', /^(tgl|tanggal) ?masuk$/], ['berkas', /^(jenis )?berkas$/], ['noReg', /^no\.? ?reg(istrasi)?$/],
        ['rekanan', /^(nama )?(rekanan|vendor)$/], ['proyek', /^(nama )?proyek$/], ['tglStatus', /^(tgl|tanggal)( status)?$/],
        ['lokasi', /^(status|lokasi( berkas)?)$/], ['ket', /^(ket|keterangan)$/], ['pic', /^pic$/], ['nilai', /^nilai/], ['warna', /warna/]],
      wajib: ['noReg', 'berkas', 'rekanan', 'lokasi'],
      teks: { berkas: 80, noReg: 60, rekanan: 200, proyek: 200, lokasi: 60, ket: 80, pic: 120, alasan: 600, warna: 40, catatan: 1000, sumber: 300 },
      tanggal: ['tglMasuk', 'tglStatus'], pembanding: 'tglStatus', ubah: ['tglStatus', 'lokasi', 'ket', 'pic', 'alasan'],
      kunci: r => [r.noReg, r.berkas, D().kunciNama(r.rekanan), r.tglMasuk].join('|').toLowerCase(),
    },
    jampel: {
      kolom: [['noFile', /^no\.? ?file$/], ['rekanan', /^(nama )?(rekanan|vendor)$/], ['proyek', /^(nama )?proyek$/],
        ['penyedia', /penyedia jaminan|^penjamin|^bank penerbit/], ['noKontrak', /^(nomor|no\.?) ?kontrak/], ['jenis', /^jenis( jaminan)?$/],
        ['nilai', /^nilai( jaminan)?$/], ['tglMulai', /^(tgl|tanggal) ?mulai/], ['tglAkhir', /^(tgl|tanggal) ?(berakhir|akhir|selesai)/],
        ['sisaSumber', /^sisa waktu/], ['statusTeks', /^status( jaminan)?$/], ['noregPbj', /^no\.? ?reg\.? ?pbj$/], ['ket', /^(ket|keterangan)$/], ['box', /^box$/]],
      wajib: ['rekanan', 'jenis'],
      teks: { box: 40, noFile: 60, rekanan: 200, proyek: 200, penyedia: 200, noKontrak: 200, jenis: 80, statusSumber: 80, noregPbj: 80, ket: 600, catatan: 1000, sumber: 300 },
      tanggal: ['tglMulai', 'tglAkhir'], pembanding: 'tglAkhir', ubah: ['tglAkhir', 'status', 'statusSumber', 'ket'],
      kunci: r => [r.box, r.noFile, D().kunciNama(r.rekanan), r.jenis, r.noKontrak, r.tglMulai].join('|').toLowerCase(),
    },
  };

  // ------------------------------------------------------------------ normalisasi
  const normalRiwayat = x => ({ tgl: tglSah(teks(x && x.tgl)) ? teks(x.tgl) : '', uraian: teks(x && x.uraian).slice(0, 600), oleh: teks(x && x.oleh).slice(0, 120), lokasi: teks(x && x.lokasi).slice(0, 60) });
  function normalUmum(jenis, r) {
    const s = SKEMA[jenis], o = { id: teks(r.id) || D().idBaru() };
    for (const [k, n] of Object.entries(s.teks)) o[k] = teks(r[k]).slice(0, n);
    for (const k of s.tanggal) o[k] = tglSah(teks(r[k])) ? teks(r[k]) : '';
    o.nilai = Math.max(0, D().angka(r.nilai) || 0);
    o.riwayat = (Array.isArray(r.riwayat) ? r.riwayat : []).slice(-200).map(normalRiwayat).filter(x => x.uraian);
    o.dibuat = teks(r.dibuat) || new Date().toISOString(); o.diubah = teks(r.diubah) || o.dibuat;
    return o;
  }
  const normalLokasi = r => normalUmum('lokasi', r || {});
  function tebakStatusJ(t) {
    if (/expired|ka?d[ae]luwarsa|habis/i.test(t)) return 'Expired';
    if (/perpanj/i.test(t)) return 'Diperpanjang';
    if (/klaim|cair/i.test(t)) return 'Diklaim/Dicairkan';
    if (/kembali/i.test(t)) return 'Dikembalikan';
    return 'Aktif';
  }
  function normalJampel(r) {
    r = r || {};
    const o = normalUmum('jampel', r);
    o.status = STATUS_J.includes(r.status) ? r.status : tebakStatusJ(teks(r.statusSumber || r.status));
    o.pengambilan = (Array.isArray(r.pengambilan) ? r.pengambilan : []).slice(-100).map(normalRiwayat).filter(x => x.uraian);
    return o;
  }
  const NORMAL = { lokasi: normalLokasi, jampel: normalJampel };

  // ------------------------------------------------------------------ impor
  /** Cari baris judul (40 baris pertama). Dua kolom "KET" pada Lokasi: yang kedua = alasan/kelengkapan. */
  function petakan(rows, jenis) {
    const s = SKEMA[jenis];
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const peta = {}, dipakai = new Set();
      (rows[i] || []).forEach((h, j) => {
        const k = kunciJudul(h), c = s.kolom.find(([, re]) => re.test(k));
        if (!c) return;
        const nama = c[0] === 'ket' && jenis === 'lokasi' && dipakai.has('ket') ? 'alasan' : c[0];
        if (!dipakai.has(nama)) { peta[j] = nama; dipakai.add(nama); }
      });
      if (s.wajib.every(k => dipakai.has(k))) return { baris: i, peta, judul: rows[i] || [] };
    }
    return null;
  }
  function barisKe(jenis, row, h, sumber) {
    const o = { sumber }, lain = [];
    (row || []).forEach((v, j) => {
      if (v === '' || v === null || v === undefined) return;
      const k = h.peta[j];
      if (k === 'sisaSumber') return;   // sisa waktu selalu dihitung ulang, bukan disalin
      if (k) { o[k] = v; return; }
      lain.push(`${teks(h.judul[j]) || 'kolom ' + (j + 1)}: ${teks(v)}`);
    });
    for (const k of SKEMA[jenis].tanggal) o[k] = tgl(o[k]);
    o.catatan = lain.join(' · ');
    if (jenis === 'jampel') {
      o.statusSumber = teks(o.statusTeks);
      if (!o.box) { const m = /box\s*([0-9]+[a-z]?)/i.exec(sumber); o.box = m ? 'BOX ' + m[1].toUpperCase() : ''; }
    }
    return NORMAL[jenis](o);
  }
  /** rows -> {jenis, catatan, header} bila lembar adalah register Lokasi Tagihan atau Jampel; selain itu null. */
  function dariTabel(rows, sumber) {
    for (const jenis of ['jampel', 'lokasi']) {
      const h = petakan(rows, jenis);
      if (!h) continue;
      const catatan = rows.slice(h.baris + 1).filter(r => (r || []).some(v => teks(v)))
        .map(r => barisKe(jenis, r, h, sumber)).filter(r => r.rekanan || r.noReg || r.noFile);
      return { jenis, catatan, header: h };
    }
    return null;
  }
  const kosong = v => v === '' || v === 0 || v === undefined;
  function isiKosongArsip(jenis, lama, baru) {
    const kol = Object.keys(SKEMA[jenis].teks).concat(SKEMA[jenis].tanggal, ['nilai']).filter(k => k !== 'sumber' && kosong(lama[k]) && !kosong(baru[k]));
    kol.forEach(k => { lama[k] = baru[k]; });
    return kol;
  }
  function berubah(jenis, lama, baru) {
    const s = SKEMA[jenis];
    return baru[s.pembanding] > (lama[s.pembanding] || '') && s.ubah.some(k => !kosong(baru[k]) && baru[k] !== lama[k]);
  }
  /** Rencana impor: baru / isi (kolom kosong) / perbarui (tanggal status lebih baru; riwayat disimpan) / sama / ganda (kembar dalam berkas). */
  function rencana(jenis, lama, baru) {
    const s = SKEMA[jenis], peta = new Map(lama.map(r => [s.kunci(r), r])), lihat = new Set();
    return baru.map(r => {
      const k = s.kunci(r);
      if (lihat.has(k)) return { aksi: 'ganda', r };
      lihat.add(k);
      const p = peta.get(k);
      if (!p) return { aksi: 'baru', r };
      if (berubah(jenis, p, r)) return { aksi: 'perbarui', r, idPasangan: p.id };
      const kolom = isiKosongArsip(jenis, JSON.parse(JSON.stringify(p)), r);
      return { aksi: kolom.length ? 'isi' : 'sama', r, idPasangan: p.id, kolom };
    });
  }
  function perbarui(jenis, p, r) {
    const s = SKEMA[jenis];
    const lama = s.ubah.filter(k => !kosong(p[k])).map(k => `${k}: ${p[k]}`).join('; ');
    p.riwayat.push({ tgl: p[s.pembanding] || '', uraian: 'Sebelumnya — ' + lama, oleh: 'impor', lokasi: jenis === 'lokasi' ? p.lokasi : '' });
    for (const k of s.ubah) if (!kosong(r[k])) p[k] = r[k];
  }
  /** Terapkan satu rencana ke daftar (array di brankas). -> ringkasan perubahan atau '' */
  function terapkan(jenis, daftar, b) {
    if (b.aksi === 'baru') { daftar.push(NORMAL[jenis](JSON.parse(JSON.stringify(b.r)))); return 'baru'; }
    const p = daftar.find(x => x.id === b.idPasangan);
    if (!p || b.aksi === 'sama' || b.aksi === 'ganda') return '';
    if (b.aksi === 'perbarui') perbarui(jenis, p, b.r);
    const kol = isiKosongArsip(jenis, p, b.r);
    p.diubah = new Date().toISOString();
    return b.aksi === 'perbarui' ? 'perbarui' : (kol.length ? 'isi' : '');
  }

  // ------------------------------------------------------------------ perhitungan
  const umur = (r, kini) => ({ masuk: hari(r.tglMasuk, kini), status: hari(r.tglStatus, kini) });
  const sisaHari = (j, kini) => hari(kini, j.tglAkhir);
  const berjalan = j => j.status === 'Aktif' || j.status === 'Diperpanjang';
  const statusEfektif = (j, kini) => (berjalan(j) && sisaHari(j, kini) !== null && sisaHari(j, kini) < 0 ? 'Expired' : j.status);
  /** Jaminan berjalan yang berakhir ≤7, 8–30, 31–60 hari lagi, dan yang sudah lewat tetapi belum diproses. */
  function pengingat(daftar, kini) {
    const p = { h7: [], h30: [], h60: [], lewat: [] };
    for (const j of daftar.filter(berjalan)) {
      const s = sisaHari(j, kini);
      if (s === null) continue;
      const ember = s < 0 ? 'lewat' : s <= 7 ? 'h7' : s <= 30 ? 'h30' : s <= 60 ? 'h60' : '';
      if (ember) p[ember].push(j);
    }
    for (const k of Object.keys(p)) p[k].sort((a, b) => a.tglAkhir.localeCompare(b.tglAkhir));
    return p;
  }
  const ATURAN_LENGKAP = [['Tanda tangan vendor', /\btt?d\b.*(vendor|rekanan)|tanda ?tangan.*(vendor|rekanan)/i], ['Tanda tangan', /\btt?d\b|tanda ?tangan/i],
    ['Kuitansi asli', /k[uw]i?tansi/i], ['Faktur pajak', /faktur/i], ['Nota', /\bnota\b/i], ['Meterai', /mat[e]?rai|meterai/i], ['BAP', /\bbap\b/i], ['Scan dokumen', /scan/i]];
  /** Dokumen yang belum lengkap menurut catatan alasan (pencocokan kata kunci; teks asli tetap ditampilkan). */
  function kelengkapan(alasan) {
    const out = [];
    for (const [label, re] of ATURAN_LENGKAP) if (re.test(alasan || '') && !(label === 'Tanda tangan' && out.includes('Tanda tangan vendor'))) out.push(label);
    return out;
  }
  const cocokSomasi = (somasi, r) => (r.rekanan ? somasi.filter(s => D().samaNama(s.rekanan, r.rekanan) || D().samaNama(s.asalSurat, r.rekanan)).map(s => s.id) : []);
  function kelompok(daftar, kunci) {
    const m = new Map();
    for (const r of daftar) { const k = r[kunci] || '(kosong)', x = m.get(k) || { label: k, n: 0, nilai: 0 }; x.n++; x.nilai += r.nilai || 0; m.set(k, x); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }

  // ------------------------------------------------------------------ templat
  const rp = n => esc(D().rupiah(n));
  const opsi = (daftar, pilih) => '<option value="">Semua</option>' + daftar.map(v => `<option value="${esc(v)}"${v === pilih ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const nilaiUnik = (daftar, k) => [...new Set(daftar.map(r => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')).slice(0, 300);
  const pilih = (id, label, daftar, k, f) => `<label>${label}<select id="fa-${k}" data-saring-arsip="${k}">${opsi(nilaiUnik(daftar, k), f[k])}</select></label>`;
  function lencanaSisa(s) {
    if (s === null) return '<span class="lencana">tanpa tanggal</span>';
    const kelas = s < 0 ? 'r4' : s <= 7 ? 'r4' : s <= 30 ? 'r3' : s <= 60 ? 'r2' : 'r1';
    return `<span class="lencana ${kelas}">${s < 0 ? 'lewat ' + -s : s} hari</span>`;
  }
  const tautSomasi = (somasi, r) => cocokSomasi(somasi, r).slice(0, 3).map(id => `<a class="lencana" href="#somasi/${esc(id)}">perkara somasi</a>`).join(' ');
  function tabelRingkas(judul, baris) {
    return `<section class="kartu"><h2>${esc(judul)}</h2><div class="tabel-bungkus" tabindex="0" role="region" aria-label="Tabel (dapat digulir)"><table><thead><tr><th>${esc(judul.split(' per ')[1] || 'Kelompok')}</th><th class="angka">Berkas</th><th class="angka">Nilai</th></tr></thead><tbody>
      ${baris.slice(0, 12).map(x => `<tr><td>${esc(x.label)}</td><td class="angka">${x.n}</td><td class="angka">${rp(x.nilai)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  const saringLokasi = (r, f) => ['lokasi', 'ket', 'pic', 'berkas', 'proyek'].every(k => !f[k] || r[k] === f[k])
    && (!f.kurang || kelengkapan(r.alasan).length > 0) && (!f.cari || [r.noReg, r.rekanan, r.proyek, r.alasan, r.pic].join(' ').toLowerCase().includes(f.cari.toLowerCase()));
  function saringJampel(j, f, kini) {
    if (f.status && statusEfektif(j, kini) !== f.status) return false;
    if (['jenis', 'box', 'proyek'].some(k => f[k] && j[k] !== f[k])) return false;
    return !f.cari || [j.noFile, j.rekanan, j.proyek, j.penyedia, j.noKontrak, j.noregPbj].join(' ').toLowerCase().includes(f.cari.toLowerCase());
  }
  const SARING = { lokasi: saringLokasi, jampel: saringJampel };
  const saring = (jenis, daftar, f, kini) => daftar.filter(r => SARING[jenis](r, f, kini));

  function halamanLokasi(data, f) {
    const d = data.lokasi, kurang = d.filter(r => kelengkapan(r.alasan).length).length;
    return `<section class="kpi" aria-label="Indikator lokasi tagihan">
        <div><span>Berkas tercatat</span><b>${d.length}</b><small>${esc(D().ringkas(d.reduce((s, r) => s + r.nilai, 0)))}</small></div>
        ${kelompok(d, 'lokasi').slice(0, 3).map(x => `<div><span>Di ${esc(x.label)}</span><b>${x.n}</b><small>${esc(D().ringkas(x.nilai))}</small></div>`).join('')}
        <div class="kuning"><span>Dokumen belum lengkap</span><b>${kurang}</b><small>menurut catatan alasan</small></div></section>
      <section class="kartu"><h2 class="judul-orn">Daftar lokasi berkas tagihan</h2>
        <div class="saring"><label>Cari<input id="fa-cari" data-saring-arsip="cari" type="search" value="${esc(f.cari || '')}" placeholder="No reg, rekanan, proyek, alasan"></label>
        ${pilih('lokasi', 'Lokasi', d, 'lokasi', f)}${pilih('ket', 'Status', d, 'ket', f)}${pilih('pic', 'PIC', d, 'pic', f)}${pilih('berkas', 'Berkas', d, 'berkas', f)}${pilih('proyek', 'Proyek', d, 'proyek', f)}
        <label class="cek"><input type="checkbox" id="fa-kurang" data-saring-arsip="kurang"${f.kurang ? ' checked' : ''}> Hanya dokumen belum lengkap</label></div>
        <p class="baris-btn"><button type="button" class="btn" data-aksi="arsip-tambah" data-jenis="lokasi">+ Tambah berkas</button></p>
        <div id="tabel-arsip"></div></section>
      <div class="grid-2">${tabelRingkas('Ringkasan per lokasi', kelompok(d, 'lokasi'))}${tabelRingkas('Ringkasan per status', kelompok(d, 'ket'))}</div>
      ${tabelRingkas('Ringkasan per PIC', kelompok(d, 'pic'))}`;
  }
  function tabelLokasi(baris, kini, somasi, batas) {
    if (!baris.length) return '<p>Tidak ada berkas yang cocok.</p>';
    return `<p class="bantu">${baris.length} berkas · umur dihitung sampai hari ini.</p><div class="tabel-bungkus" tabindex="0" role="region" aria-label="Tabel (dapat digulir)"><table id="tbl-lokasi"><thead><tr><th>No reg</th><th>Berkas</th><th>Rekanan</th><th>Proyek</th><th>Lokasi</th><th>Status</th><th>PIC</th>
      <th class="angka">Hari sejak masuk</th><th class="angka">Hari di lokasi</th><th>Belum lengkap</th><th class="angka">Nilai</th></tr></thead><tbody>
      ${baris.slice(0, batas).map(r => { const u = umur(r, kini), k = kelengkapan(r.alasan); return `<tr><td><a href="#" data-aksi="arsip-lihat" data-jenis="lokasi" data-id="${esc(r.id)}">${esc(r.noReg || '(tanpa no reg)')}</a></td>
        <td>${esc(r.berkas)}</td><td>${esc(r.rekanan)} ${tautSomasi(somasi, r)}</td><td>${esc(r.proyek)}</td><td><span class="lencana">${esc(r.lokasi)}</span></td><td>${esc(r.ket)}</td><td>${esc(r.pic)}</td>
        <td class="angka">${u.masuk ?? '—'}</td><td class="angka">${u.status ?? '—'}</td><td>${k.length ? `<span class="lencana r3">${esc(k.join(', '))}</span>` : ''}</td><td class="angka">${rp(r.nilai)}</td></tr>`; }).join('')}
      </tbody></table></div>${lagi(baris.length, batas)}`;
  }
  const lagi = (n, batas) => (n > batas ? `<p class="baris-btn"><button type="button" class="btn" data-aksi="arsip-lagi">Tampilkan ${Math.min(200, n - batas)} lagi (dari ${n - batas} tersisa)</button></p>` : '');

  function halamanJampel(data, f, kini) {
    const d = data.jampel, p = pengingat(d, kini), aktif = d.filter(j => berjalan(j) && statusEfektif(j, kini) !== 'Expired');
    return `<section class="kpi" aria-label="Indikator jaminan pelaksanaan">
        <div><span>Jaminan berjalan</span><b>${aktif.length}</b><small>${esc(D().ringkas(aktif.reduce((s, j) => s + j.nilai, 0)))} · dari ${d.length} tercatat</small></div>
        <div class="merah"><span>Berakhir ≤ 7 hari</span><b>${p.h7.length}</b><small>segera tindak lanjuti</small></div>
        <div class="kuning"><span>Berakhir 8–30 hari</span><b>${p.h30.length}</b><small>siapkan perpanjangan/pengembalian</small></div>
        <div><span>Berakhir 31–60 hari</span><b>${p.h60.length}</b><small>pantau</small></div>
        <div class="merah"><span>Lewat, status belum diproses</span><b>${p.lewat.length}</b><small>masih "Aktif/Diperpanjang"</small></div></section>
      <section class="kartu"><h2 class="judul-orn">Daftar jaminan pelaksanaan & jaminan lain</h2>
        <div class="saring"><label>Cari<input id="fa-cari" data-saring-arsip="cari" type="search" value="${esc(f.cari || '')}" placeholder="No file, rekanan, penyedia, kontrak"></label>
        <label>Status<select id="fa-status" data-saring-arsip="status">${opsi(STATUS_J, f.status)}</select></label>
        ${pilih('jenis', 'Jenis jaminan', d, 'jenis', f)}${pilih('box', 'Box', d, 'box', f)}${pilih('proyek', 'Proyek', d, 'proyek', f)}</div>
        <p class="baris-btn"><button type="button" class="btn" data-aksi="arsip-tambah" data-jenis="jampel">+ Tambah jaminan</button></p>
        <div id="tabel-arsip"></div>
        <p class="bantu">Sisa waktu dihitung dari tanggal berakhir terhadap hari ini (tidak disalin dari sumber). Ketentuan jaminan mengacu pada Perpres 16/2018 jo. 12/2021 dan pedoman SCM internal; cek ketentuan yang berlaku di sumber resmi.</p></section>`;
  }
  function tabelJampel(baris, kini, somasi, batas) {
    if (!baris.length) return '<p>Tidak ada jaminan yang cocok.</p>';
    return `<p class="bantu">${baris.length} jaminan.</p><div class="tabel-bungkus" tabindex="0" role="region" aria-label="Tabel (dapat digulir)"><table id="tbl-jampel"><thead><tr><th>Box</th><th>No file</th><th>Rekanan</th><th>Proyek</th><th>Penyedia</th><th>Jenis</th>
      <th class="angka">Nilai</th><th>Berakhir</th><th>Sisa waktu</th><th>Status</th></tr></thead><tbody>
      ${baris.slice(0, batas).map(j => `<tr><td>${esc(j.box)}</td><td><a href="#" data-aksi="arsip-lihat" data-jenis="jampel" data-id="${esc(j.id)}">${esc(j.noFile || '(tanpa no file)')}</a></td>
        <td>${esc(j.rekanan)} ${tautSomasi(somasi, j)}</td><td>${esc(j.proyek)}</td><td>${esc(j.penyedia)}</td><td>${esc(j.jenis)}</td><td class="angka">${rp(j.nilai)}</td>
        <td>${esc(D().tglPanjang(j.tglAkhir))}</td><td>${berjalan(j) ? lencanaSisa(sisaHari(j, kini)) : ''}</td><td>${esc(statusEfektif(j, kini))}</td></tr>`).join('')}
      </tbody></table></div>${lagi(baris.length, batas)}`;
  }
  const HALAMAN = { lokasi: halamanLokasi, jampel: halamanJampel }, TABEL = { lokasi: tabelLokasi, jampel: tabelJampel };
  const halaman = (jenis, data, f, kini) => HALAMAN[jenis](data, f, kini);
  const tabel = (jenis, baris, kini, somasi, batas) => TABEL[jenis](baris, kini, somasi, batas);

  /** Bagian Ringkasan Eksekutif: pengingat jaminan 60/30/7 hari + posisi berkas tagihan. */
  function ringkasanHtml(data, kini) {
    const j = data.jampel || [], l = data.lokasi || [];
    if (!j.length && !l.length) return '';
    const p = pengingat(j, kini), daftar = [...p.lewat, ...p.h7, ...p.h30, ...p.h60].slice(0, 10);
    const jam = j.length ? `<section class="kartu" aria-labelledby="h-jampel"><h2 id="h-jampel" class="judul-orn">Pengingat jaminan pelaksanaan</h2>
      <p>${p.lewat.length} lewat tanggal berakhir tetapi status belum diproses; ${p.h7.length} berakhir ≤ 7 hari; ${p.h30.length} berakhir 8–30 hari; ${p.h60.length} berakhir 31–60 hari.</p>
      ${daftar.length ? `<div class="tabel-bungkus" tabindex="0" role="region" aria-label="Tabel (dapat digulir)"><table><thead><tr><th>Rekanan</th><th>Proyek</th><th>Jenis</th><th class="angka">Nilai</th><th>Berakhir</th><th>Sisa</th></tr></thead><tbody>
      ${daftar.map(x => `<tr><td>${esc(x.rekanan)}</td><td>${esc(x.proyek)}</td><td>${esc(x.jenis)}</td><td class="angka">${rp(x.nilai)}</td><td>${esc(D().tglPanjang(x.tglAkhir))}</td><td>${lencanaSisa(sisaHari(x, kini))}</td></tr>`).join('')}
      </tbody></table></div>` : ''}<p><a href="#jampel">Buka menu Jaminan Pelaksanaan</a></p></section>` : '';
    const lok = l.length ? `<section class="kartu"><h2>Posisi berkas tagihan</h2><p>${kelompok(l, 'lokasi').slice(0, 5).map(x => `${esc(x.label)}: ${x.n} berkas (${esc(D().ringkas(x.nilai))})`).join(' · ')}.
      ${l.filter(r => kelengkapan(r.alasan).length).length} berkas dokumennya belum lengkap. <a href="#lokasi">Buka menu Lokasi Tagihan</a></p></section>` : '';
    return jam + lok;
  }

  const LABEL = { lokasi: { tglMasuk: 'Tanggal masuk', berkas: 'Berkas', noReg: 'No reg', rekanan: 'Rekanan', proyek: 'Proyek', tglStatus: 'Tanggal status', lokasi: 'Lokasi berkas', ket: 'Status', pic: 'PIC', alasan: 'Keterangan/alasan', nilai: 'Nilai', warna: 'Tanda warna', catatan: 'Catatan lain', sumber: 'Sumber data' },
    jampel: { box: 'Box (lokasi fisik)', noFile: 'No file', rekanan: 'Rekanan', proyek: 'Proyek', penyedia: 'Penyedia jaminan', noKontrak: 'Nomor kontrak/SPP', jenis: 'Jenis jaminan', nilai: 'Nilai jaminan', tglMulai: 'Tanggal mulai', tglAkhir: 'Tanggal berakhir', status: 'Status', statusSumber: 'Status di sumber', noregPbj: 'Noreg PBJ', ket: 'Keterangan', catatan: 'Catatan lain', sumber: 'Sumber data' } };
  function detail(jenis, r, kini, somasi) {
    const L = LABEL[jenis], tampil = k => (k === 'nilai' ? D().rupiah(r.nilai) : /^tgl/.test(k) ? D().tglPanjang(r[k]) : r[k]);
    const baris = Object.keys(L).filter(k => r[k]).map(k => `<tr><th scope="row">${esc(L[k])}</th><td>${esc(tampil(k))}</td></tr>`).join('');
    const tambahan = jenis === 'jampel' ? `<tr><th scope="row">Sisa waktu</th><td>${berjalan(r) ? lencanaSisa(sisaHari(r, kini)) : esc(statusEfektif(r, kini))}</td></tr>`
      : `<tr><th scope="row">Umur</th><td>${esc(umur(r, kini).masuk ?? '—')} hari sejak masuk · ${esc(umur(r, kini).status ?? '—')} hari di lokasi ini</td></tr><tr><th scope="row">Belum lengkap</th><td>${esc(kelengkapan(r.alasan).join(', ') || '—')}</td></tr>`;
    const daftarRiwayat = (judul, xs) => (xs && xs.length ? `<h3 class="judul-orn">${judul}</h3><ol class="linimasa">${xs.map(x => `<li><b>${esc(x.tgl ? D().tglPanjang(x.tgl) : 'Tanpa tanggal')}</b>${x.oleh ? ' · ' + esc(x.oleh) : ''}<br>${esc(x.uraian)}</li>`).join('')}</ol>` : '');
    const terkait = cocokSomasi(somasi, r);
    return `<div class="tabel-bungkus" tabindex="0" role="region" aria-label="Tabel (dapat digulir)"><table><tbody>${baris}${tambahan}</tbody></table></div>
      ${terkait.length ? `<p>Perkara somasi terkait: ${terkait.map(id => `<a href="#somasi/${esc(id)}">buka perkara</a>`).join(' · ')}</p>` : ''}
      ${daftarRiwayat('Pengambilan dokumen asli', r.pengambilan)}${daftarRiwayat('Riwayat perubahan', r.riwayat)}`;
  }
  const FORM = { lokasi: [['tglMasuk', 'date'], ['berkas'], ['noReg'], ['rekanan'], ['proyek'], ['tglStatus', 'date'], ['lokasi'], ['ket'], ['pic'], ['alasan', 'area'], ['nilai', 'rp'], ['warna']],
    jampel: [['box'], ['noFile'], ['rekanan'], ['proyek'], ['penyedia'], ['noKontrak'], ['jenis'], ['nilai', 'rp'], ['tglMulai', 'date'], ['tglAkhir', 'date'], ['status', 'status'], ['noregPbj'], ['ket', 'area']] };
  function masukan(jenis, r, [k, tipe]) {
    const label = esc(LABEL[jenis][k]), v = r[k] ?? '';
    if (tipe === 'area') return `<label class="lebar">${label}<textarea name="${k}" rows="2">${esc(v)}</textarea></label>`;
    if (tipe === 'status') return `<label>${label}<select name="${k}">${STATUS_J.map(s => `<option${s === v ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`;
    const nilai = tipe === 'rp' ? (v ? D().rupiah(v).replace(/^Rp\s?/, '') : '') : v;
    return `<label>${label}<input name="${k}" type="${tipe === 'date' ? 'date' : 'text'}"${tipe === 'rp' ? ' inputmode="numeric"' : ''} value="${esc(nilai)}"></label>`;
  }
  function form(jenis, r) {
    r = r || {};
    const ambil = jenis === 'jampel' ? `<fieldset class="lebar"><legend>Catat pengambilan/pengembalian dokumen asli (opsional)</legend>
      <label>Tanggal<input name="ambil-tgl" type="date"></label><label>Oleh<input name="ambil-oleh" type="text"></label><label class="lebar">Uraian<input name="ambil-uraian" type="text" placeholder="mis. jampel asli diambil bagian keuangan"></label></fieldset>` : '';
    return `<form id="form-arsip" class="form" autocomplete="off">${FORM[jenis].map(f => masukan(jenis, r, f)).join('')}${ambil}
      <label class="lebar">Alasan perubahan (dicatat di jejak audit)<input name="alasan-ubah" type="text"></label></form>`;
  }
  /** Data formulir -> catatan baru (lama tidak diubah di sini). Pengambilan dokumen asli ditambahkan ke log. */
  function dariForm(jenis, lama, f, oleh) {
    const r = NORMAL[jenis](Object.assign({}, lama || {}, f, { nilai: D().angka(f.nilai), id: lama ? lama.id : '', dibuat: lama ? lama.dibuat : '', diubah: new Date().toISOString() }));
    if (jenis === 'jampel' && teks(f['ambil-uraian'])) r.pengambilan.push(normalRiwayat({ tgl: tglSah(f['ambil-tgl']) ? f['ambil-tgl'] : D().hariIni(), uraian: f['ambil-uraian'], oleh: f['ambil-oleh'] || oleh }));
    return r;
  }
  const bedaForm = (jenis, lama, baru) => FORM[jenis].map(([k]) => k).filter(k => String(lama[k] ?? '') !== String(baru[k] ?? '')).map(k => `${LABEL[jenis][k]}: ${lama[k] || '-'} → ${baru[k] || '-'}`).join('; ');

  /** Pratinjau impor Lokasi/Jampel: jumlah per aksi, kolom kosong, ganda. */
  function pratinjauHtml(rencanaPer) {
    return Object.entries(rencanaPer).filter(([, xs]) => xs.length).map(([jenis, xs]) => {
      const n = { baru: 0, isi: 0, perbarui: 0, sama: 0, ganda: 0 };
      xs.forEach(b => { n[b.aksi]++; });
      const kos = ['rekanan', 'proyek', 'nilai', SKEMA[jenis].pembanding].map(k => `${LABEL[jenis][k]}: ${xs.filter(b => kosong(b.r[k])).length} kosong`).join(' · ');
      const judul = jenis === 'lokasi' ? 'Lokasi Tagihan' : 'Jaminan Pelaksanaan';
      return `<section class="kartu"><h3>${judul}: ${xs.length} baris</h3><p class="pesan info" role="status">${n.baru} baru, ${n.isi} melengkapi, ${n.perbarui} diperbarui (riwayat disimpan), ${n.sama} sama, ${n.ganda} kembar dalam berkas (dilewati).</p>
        <p class="bantu">${esc(kos)}</p></section>`;
    }).join('');
  }

  return Object.freeze({ STATUS_J, dariTabel, normalLokasi, normalJampel, normal: NORMAL, rencana, terapkan, umur, sisaHari, statusEfektif, pengingat, kelengkapan,
    cocokSomasi, saring, halaman, tabel, ringkasanHtml, detail, form, dariForm, bedaForm, pratinjauHtml });
})();
