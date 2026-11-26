/* Templat halaman. Semua data pengguna lewat esc(); HTML dipasang lewat HTML_AMAN.pasang (lapis kedua) di app.js.
   Grafik dipasang terpisah sebagai node SVG (GRAFIK) ke elemen [data-grafik]. */
'use strict';
window.TAMPIL = (function () {
  const D = window.DATA;
  const ID = () => window.IDENTITAS_AKTIF || window.IDENTITAS || {};
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const opsi = (daftar, pilih, label) => daftar.map(v => `<option value="${esc(v)}"${v === pilih ? ' selected' : ''}>${esc(label ? label(v) : (v || '—'))}</option>`).join('');
  const lencanaRisiko = ri => `<span class="lencana ${ri.skor >= 15 ? 'r4' : ri.skor >= 10 ? 'r3' : ri.skor >= 5 ? 'r2' : 'r1'}">${esc(ri.level)} · ${ri.k}×${ri.d}</span>`;

  function kpi(s) {
    return `<section class="kpi" aria-label="Indikator utama">
      <div><span>Somasi aktif</span><b>${s.aktif}</b><small>dari ${s.total} tercatat · ${s.selesai} selesai</small></div>
      <div class="merah"><span>Saldo terbuka (aktif)</span><b>${esc(D.ringkas(s.saldo))}</b><small>${esc(D.rupiah(s.saldo))}</small></div>
      <div><span>Total nilai tuntutan</span><b>${esc(D.ringkas(s.tuntutan))}</b><small>seluruh somasi tercatat</small></div>
      <div class="hijau"><span>Telah dibayar</span><b>${esc(D.ringkas(s.dibayar))}</b><small>${esc(D.persen(s.persenBayar))} dari tuntutan</small></div>
      <div class="merah"><span>Tingkat II / terakhir</span><b>${s.tinggi}</b><small>somasi aktif</small></div>
      <div class="merah"><span>Lewat tenggat</span><b>${s.lewat}</b><small>tanggapan belum dikirim</small></div>
      <div><span>Risiko tinggi</span><b>${s.risikoTinggi}</b><small>skor ≥ 10 (dari 25)</small></div>
      <div class="kuning"><span>Perlu verifikasi</span><b>${s.perluVerifikasi}</b><small>data belum dipastikan</small></div>
    </section>`;
  }

  function tabelPrioritas(daftar, kini, n) {
    const baris = daftar.filter(D.aktif).map(r => ({ r, ri: D.risiko(r, kini) }))
      .sort((a, b) => b.ri.skor - a.ri.skor || D.saldoTerbuka(b.r) - D.saldoTerbuka(a.r)).slice(0, n || 10);
    if (!baris.length) return '<p>Tidak ada somasi aktif.</p>';
    return `<div class="tabel-bungkus"><table><thead><tr><th>Rekanan</th><th>Proyek</th><th>Tingkat</th><th class="angka">Saldo terbuka</th><th>Status</th><th>Risiko</th></tr></thead><tbody>
      ${baris.map(({ r, ri }) => `<tr><td><a href="#somasi/${esc(r.id)}">${esc(r.rekanan || r.asalSurat)}</a></td><td>${esc(r.proyek)}</td><td>${esc(r.tingkat)}</td>
      <td class="angka">${esc(D.rupiah(D.saldoTerbuka(r)))}</td><td><span class="lencana ${esc(r.status.split(' ')[0])}">${esc(r.status)}</span></td><td>${lencanaRisiko(ri)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function daftarRekomendasi(rek, n) {
    if (!rek.length) return '<p>Tidak ada tindakan mendesak menurut aturan pemantauan.</p>';
    return `<ol>${rek.slice(0, n || 8).map(x => `<li>${x.prio === 1 ? '<b>Prioritas 1.</b> ' : ''}${esc(x.teks)}</li>`).join('')}</ol>`;
  }

  function ringkasan(data, kini) {
    const s = D.ringkasan(data.somasi, kini);
    return `${kpi(s)}
    <section class="kartu narasi" aria-labelledby="h-ne"><h2 id="h-ne" class="judul-orn">Ringkasan eksekutif</h2>${D.narasi(data.somasi, kini).map(p => `<p>${esc(p)}</p>`).join('')}</section>
    <div class="grid-2">
      <section class="kartu"><h2>Komposisi pembayaran</h2><div data-grafik="cincin"></div></section>
      <section class="kartu"><h2>Saldo terbuka per proyek (5 terbesar)</h2><div data-grafik="proyek5"></div></section>
    </div>
    <section class="kartu"><h2 class="judul-orn">Prioritas penanganan</h2>${tabelPrioritas(data.somasi, kini, 8)}</section>
    <section class="panel-biru"><h2>Rekomendasi tindak lanjut</h2>${daftarRekomendasi(D.rekomendasi(data.somasi, kini), 8)}
      <p class="bantu">Rekomendasi otomatis dari aturan pemantauan dan Pedoman Internal Surat Tanggapan Somasi; keputusan tetap pada pejabat berwenang.</p></section>`;
  }

  function grafik() {
    return `<div class="grid-2">
      <section class="kartu"><h2>Somasi masuk per bulan</h2><div data-grafik="bulan"></div></section>
      <section class="kartu"><h2>Matriks risiko (ISO 31000)</h2><div data-grafik="matriks"></div>
        <div class="legenda"><span><i class="l1"></i>Rendah 1–4</span><span><i class="l2"></i>Sedang 5–9</span><span><i class="l3"></i>Tinggi 10–14</span><span><i class="l4"></i>Sangat tinggi 15–25</span></div></section>
      <section class="kartu"><h2>Saldo terbuka per tingkat somasi</h2><div data-grafik="tingkat"></div></section>
      <section class="kartu"><h2>Jumlah somasi per status</h2><div data-grafik="status"></div></section>
      <section class="kartu"><h2>Saldo terbuka per proyek</h2><div data-grafik="proyek"></div></section>
      <section class="kartu"><h2>Somasi aktif per disposisi</h2><div data-grafik="disposisi"></div></section>
    </div>`;
  }

  function daftar(data, f) {
    const proyek = Array.from(new Set(data.somasi.map(r => r.proyek).filter(Boolean))).sort();
    return `<section class="kartu">
      <div class="baris-btn tanpa-cetak"><button type="button" class="btn utama-btn" data-aksi="tambah">＋ Somasi baru</button>
        <a class="btn" href="#ocr">Dari scan (OCR)</a><a class="btn" href="#impor">Impor Excel</a><button type="button" class="btn" data-aksi="csv">Unduh CSV</button></div>
      <div class="saring" role="search"><label>Cari<input type="search" id="f-cari" value="${esc(f.cari)}" placeholder="rekanan, proyek, nomor surat…"></label>
        <label>Status<select id="f-status">${opsi(['', ...D.STATUS], f.status, v => v || 'Semua')}</select></label>
        <label>Tingkat<select id="f-tingkat">${opsi(['', ...D.TINGKAT], f.tingkat, v => v || 'Semua')}</select></label>
        <label>Proyek<select id="f-proyek">${opsi(['', ...proyek], f.proyek, v => v || 'Semua')}</select></label>
        <label>Verifikasi<select id="f-verifikasi">${opsi(['', 'perlu', 'sudah'], f.verifikasi || '', v => ({ '': 'Semua', perlu: 'Perlu verifikasi', sudah: 'Sudah terverifikasi' })[v])}</select></label></div>
      <div id="tabel-daftar"></div></section>`;
  }

  const KOLOM_TABEL = [['tglSurat', 'Tgl surat'], ['rekanan', 'Rekanan'], ['proyek', 'Proyek'], ['tingkat', 'Tingkat'], ['nilaiTuntutan', 'Tuntutan', 1], ['dibayar', 'Dibayar', 1], ['saldo', 'Saldo terbuka', 1], ['status', 'Status'], ['risiko', 'Risiko'], ['pic', 'PIC']];
  function tabelDaftar(baris, urut, kini) {
    const kepala = KOLOM_TABEL.map(([k, l, a]) => `<th${a ? ' class="angka"' : ''} aria-sort="${urut.kol === k ? (urut.naik ? 'ascending' : 'descending') : 'none'}"><button type="button" data-urut="${k}">${esc(l)}${urut.kol === k ? (urut.naik ? ' ▲' : ' ▼') : ''}</button></th>`).join('');
    const isi = baris.map(r => `<tr><td>${esc(D.tglPanjang(r.tglSurat))}</td><td><a href="#somasi/${esc(r.id)}">${esc(r.rekanan || r.asalSurat || '(tanpa nama)')}</a>${r.asalSurat && r.asalSurat !== r.rekanan ? `<br><small>${esc(r.asalSurat)}</small>` : ''}</td>
      <td>${esc(r.proyek)}</td><td>${esc(r.tingkat)}${r.surat.length > 1 ? `<br><small>${r.surat.length} surat</small>` : ''}</td><td class="angka">${esc(D.rupiah(r.nilaiTuntutan))}</td><td class="angka">${esc(D.rupiah(r.dibayar))}</td>
      <td class="angka">${esc(D.rupiah(D.saldoTerbuka(r)))}</td><td><span class="lencana ${esc(r.status.split(' ')[0])}">${esc(r.status)}</span>${D.lewatTenggat(r, kini) ? ' <span class="lencana r4">lewat tenggat</span>' : ''}${r.verifikasi ? ' <span class="lencana verif" title="' + esc(r.verifikasi) + '">perlu verifikasi</span>' : ''}</td>
      <td>${D.aktif(r) ? lencanaRisiko(D.risiko(r, kini)) : '—'}</td><td>${esc(r.pic)}</td></tr>`).join('');
    const total = baris.reduce((s, r) => s + D.saldoTerbuka(r), 0);
    return `<p class="bantu" role="status">${baris.length} somasi · saldo terbuka ${esc(D.rupiah(total))}</p>
      <div class="tabel-bungkus"><table id="tbl-somasi"><thead><tr>${kepala}</tr></thead><tbody>${isi || '<tr><td colspan="10">Tidak ada data yang cocok.</td></tr>'}</tbody></table></div>`;
  }

  function formSomasi(r) {
    const tgl = (k, l) => `<label>${l}<input type="date" name="${k}" value="${esc(r[k])}"></label>`;
    const txt = (k, l, x) => `<label${x ? ' class="lebar"' : ''}>${l}<input type="text" name="${k}" value="${esc(r[k])}" maxlength="200"></label>`;
    const uang = (k, l) => `<label>${l}<input type="text" inputmode="decimal" name="${k}" value="${r[k] ? esc(Math.round(r[k] * 100) / 100) : ''}" placeholder="0"></label>`;
    const skala = (k, l) => `<label>${l}<select name="${k}">${opsi(['0', '1', '2', '3', '4', '5'], String(r[k] || 0), v => v === '0' ? 'Otomatis' : v)}</select></label>`;
    return `<form id="form-somasi" class="form" autocomplete="off">
      ${txt('rekanan', 'Rekanan / kreditur')}${txt('asalSurat', 'Pengirim / kuasa hukum')}${txt('proyek', 'Proyek')}
      <label>Tingkat<select name="tingkat">${opsi(D.TINGKAT, r.tingkat)}</select></label>
      ${txt('noSurat', 'Nomor surat somasi')}${txt('noAgenda', 'No. agenda / file')}${tgl('tglSurat', 'Tanggal surat')}${tgl('tglTerima', 'Tanggal diterima')}${tgl('tenggat', 'Tenggat tanggapan')}
      ${txt('perihal', 'Perihal', 1)}${uang('nilaiTuntutan', 'Nilai tuntutan (Rp)')}${uang('dibayar', 'Telah dibayar (Rp)')}${uang('saldo', 'Saldo tercatat (Rp)')}
      <label>Status<select name="status">${opsi(D.STATUS, r.status)}</select></label><label>Disposisi<select name="disposisi">${opsi(D.DISPOSISI, r.disposisi)}</select></label>
      ${txt('pic', 'PIC')}<label>Posisi tagihan (Pedoman bag. 3)<select name="posisi">${opsi(Object.keys(D.POSISI), r.posisi, k => D.POSISI[k])}</select></label>
      ${skala('kemungkinan', 'Kemungkinan eskalasi (1–5)')}${skala('dampak', 'Dampak (1–5)')}
      <label class="lebar">Keterangan<textarea name="ket" maxlength="2000">${esc(r.ket)}</textarea></label>
      <label class="lebar">Perlu verifikasi (kosongkan bila sudah dicek dengan dokumen asli)<textarea name="verifikasi" maxlength="1000" placeholder="mis. nilai di surat ke-2 berbeda dengan surat pertama">${esc(r.verifikasi)}</textarea></label>
      <fieldset class="lebar"><legend>Tambah surat lanjutan (somasi berikutnya untuk utang yang sama)</legend><div class="form">
        <label>Tanggal surat<input type="date" name="sl-tgl"></label><label>Nomor surat<input type="text" name="sl-no" maxlength="120"></label>
        <label>Tingkat<select name="sl-tingkat">${opsi(D.TINGKAT, 'Somasi II')}</select></label><label>Nilai dituntut (Rp)<input type="text" inputmode="decimal" name="sl-nilai" placeholder="0"></label>
        <label>Tenggat tanggapan<input type="date" name="sl-tenggat"></label></div></fieldset>
      <fieldset class="lebar"><legend>Tambah tindak lanjut</legend><div class="form"><label>Tanggal<input type="date" name="tl-tgl"></label><label>No. surat tanggapan<input type="text" name="tl-no" maxlength="120"></label><label class="lebar">Uraian<input type="text" name="tl-uraian" maxlength="600" placeholder="mis. Surat tanggapan & jadwal bayar dikirim"></label></div></fieldset>
      <p class="lebar bantu">Saldo tercatat kosong = tuntutan − dibayar. Risiko “Otomatis” memakai rubrik di halaman Tata Kelola.</p>
    </form>`;
  }

  function detail(r, kini) {
    const ri = D.risiko(r, kini);
    const tl = r.tindakLanjut.length ? `<ol class="linimasa">${r.tindakLanjut.map(t => `<li><b>${esc(t.tgl ? D.tglPanjang(t.tgl) : 'Tanpa tanggal')}</b>${t.noSurat ? ` · <small>${esc(t.noSurat)}</small>` : ''}<br>${esc(t.uraian)}</li>`).join('')}</ol>` : '<p>Belum ada tindak lanjut tercatat.</p>';
    const surat = r.surat.length ? `<ol class="linimasa">${r.surat.map((s, i) => `<li><b>Surat ${i + 1} · ${esc(s.tingkat)}</b> · ${esc(s.tgl ? D.tglPanjang(s.tgl) : 'tanpa tanggal')}${s.noSurat ? ` · <small>${esc(s.noSurat)}</small>` : ''}<br>${s.nilai ? 'Dituntut ' + esc(D.rupiah(s.nilai)) : ''}${s.tenggat ? ' · tenggat ' + esc(D.tglPanjang(s.tenggat)) : ''}${s.pengirim ? `<br><small>${esc(s.pengirim)}</small>` : ''}</li>`).join('')}</ol>` : '<p>Belum ada surat tercatat.</p>';
    const verif = r.verifikasi ? `<div class="pesan verif-kotak" role="note"><b>Perlu verifikasi:</b> ${esc(r.verifikasi)}<p class="baris-btn"><button type="button" class="btn" data-aksi="tandai-terverifikasi" data-id="${esc(r.id)}">Tandai sudah diverifikasi</button></p></div>` : '';
    const baris = [['Pengirim', r.asalSurat], ['Proyek', r.proyek], ['Tingkat', r.tingkat], ['Perihal', r.perihal], ['Nomor surat', r.noSurat], ['No. agenda', r.noAgenda],
      ['Tanggal surat', D.tglPanjang(r.tglSurat)], ['Diterima', D.tglPanjang(r.tglTerima)], ['Tenggat tanggapan', D.tglPanjang(r.tenggat)], ['Nilai tuntutan', D.rupiah(r.nilaiTuntutan)],
      ['Dibayar', D.rupiah(r.dibayar)], ['Saldo terbuka', D.rupiah(D.saldoTerbuka(r))], ['Status', r.status], ['Disposisi', r.disposisi], ['PIC', r.pic], ['Posisi tagihan', D.POSISI[r.posisi]],
      ['Risiko', `${ri.level} (${ri.k}×${ri.d}${ri.manual ? ', manual' : ', otomatis'})`], ['Keterangan', r.ket], ['Sumber data', r.sumber]];
    return `${verif}<div class="grid-2"><div class="tabel-bungkus"><table><tbody>${baris.filter(b => b[1] && b[1] !== '-').map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>
      <div><h3 class="judul-orn">Riwayat surat masuk (${r.surat.length})</h3>${surat}<h3 class="judul-orn">Riwayat tindak lanjut perusahaan</h3>${tl}</div></div>${rincian(r)}`;
  }
  /** Rincian sumber (baris register asli, mis. per invoice). Nomor rekening tersamar (4 digit terakhir) kecuali
      pengguna menekan "Tampilkan nomor rekening" (tampil=true). Status tidak disimpan: render ulang = tersamar lagi.
      Saat tersamar, nomor lengkap tidak dimasukkan ke DOM. */
  function rincian(r, tampil = false, terbuka = tampil) {
    const daftar = r.rincian || [];
    if (!daftar.length) return '';
    const kol = [...new Set(daftar.flatMap(x => Object.keys(x)))];
    const angkaRp = (k, v) => (typeof v === 'number' && /rp|nilai|pengajuan|realisasi|sisa|hutang/i.test(k) ? D.rupiah(v) : v);
    const sel = (k, v) => esc(tampil ? angkaRp(k, v) : D.samarkan(k, angkaRp(k, v)));
    const adaRek = daftar.some(x => Object.keys(x).some(k => x[k] !== '' && D.samarkan(k, 'x') !== 'x'));
    const tombol = adaRek ? `<p class="baris-btn"><button type="button" class="btn" data-aksi="rekening" data-id="${esc(r.id)}" aria-pressed="${tampil}">${tampil ? 'Sembunyikan nomor rekening' : 'Tampilkan nomor rekening'}</button></p>` : '';
    return `<details class="rincian-sumber" data-rincian="${esc(r.id)}"${terbuka ? ' open' : ''}><summary>Rincian sumber (${daftar.length} baris)</summary>${tombol}<div class="tabel-bungkus"><table>
      <thead><tr>${kol.map(k => `<th scope="col">${esc(k)}</th>`).join('')}</tr></thead>
      <tbody>${daftar.map(x => `<tr>${kol.map(k => `<td>${x[k] === undefined ? '' : sel(k, x[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }

  /** Panel upload: seret-lepas, pilih dari perangkat, atau Google Drive (versi online). */
  function panelUnggah(o) {
    const drive = o.drive ? `<button type="button" class="btn btn-drive" data-aksi="${o.aksiDrive}"><span class="ikon-drive" aria-hidden="true"></span>Pilih dari Google Drive</button>`
      : '<span class="pil">Google Drive: tersedia di versi online setelah masuk</span>';
    return `<div class="unggah" data-unggah="${o.jenis}">
      <span class="unggah-ikon" aria-hidden="true">⇪</span>
      <p class="unggah-judul">Seret &amp; lepas berkas di sini</p>
      <p class="bantu">atau</p>
      <div class="unggah-pilihan">
        <label class="btn utama-btn btn-berkas">Pilih dari perangkat<input type="file" id="${o.id}" class="sr" multiple accept="${o.accept}"></label>
        ${drive}
      </div>
      <p class="bantu">${o.ket}</p></div>`;
  }
  function impor(drive) {
    return `<section class="kartu"><h2 class="judul-orn">Impor dari Excel</h2>
      <p>Pilih berkas .xlsx dari folder SOMASI (mis. <i>DAFTAR SOMASI MASUK.xlsx</i> atau <i>Somasi Tagihan Rekap Pervendor.xlsx</i>). Kolom dikenali dari judul kolom (Tgl Surat, Asal Surat, Nama Rekanan, Proyek, Nilai, Saldo, Pembayaran, Tindak Lanjut, Perihal, Disposisi, KET). Berkas dibaca di perangkat ini dan tidak diunggah.</p>
      ${panelUnggah({ jenis: 'excel', id: 'berkas-xlsx', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', drive, aksiDrive: 'drive-excel', ket: 'Excel .xlsx atau Google Sheets · banyak berkas digabung dalam satu pratinjau · maks. 25 berkas' })}
      <label class="cek"><input type="checkbox" id="hanya-somasi" checked> Hanya baris yang memuat kata “somasi” (untuk lembar register tanpa kolom nilai)</label>
      <p class="bantu">Penggabungan aman: data yang sudah ada TIDAK ditimpa. Baris yang cocok (nomor agenda sama, atau nama rekanan sama) hanya mengisi kolom yang masih kosong dan menambah tindak lanjut baru.</p>
      <div id="impor-hasil"></div></section>
      <section class="kartu"><h2>Cadangan terenkripsi</h2><p>Unduh salinan brankas (tetap terenkripsi dengan kata sandi saat ini) atau pulihkan dari cadangan.</p>
      <div class="baris-btn"><button type="button" class="btn" data-aksi="cadangan">Unduh cadangan</button><label class="btn">Pulihkan cadangan…<input type="file" id="berkas-cadangan" accept=".json" class="sr"></label></div></section>`;
  }

  function aksiImpor(b) {
    if (b.aksi === 'baru') return `<span class="lencana r2">Baru</span>${b.ragu ? `<br><span class="lencana r4">Mirip ${b.ragu.length} data — tidak digabung, periksa duplikat</span>` : ''}`;
    const beda = b.beda && b.beda.length ? `<br><span class="lencana r4">Selisih: ${esc(b.beda.join('; '))} (tidak ditimpa)</span>` : '';
    return (b.aksi === 'isi' ? `<span class="lencana r3">Lengkapi: ${esc(b.kolom.join(', '))}</span>` : '<span class="lencana r1">Sudah lengkap</span>') + beda;
  }
  function pratinjauImpor(baris, lembar) {
    const n = { baru: 0, isi: 0, sama: 0 }, beda = baris.filter(b => b.beda && b.beda.length).length;
    baris.forEach(b => n[b.aksi]++);
    const ubah = n.baru + n.isi + baris.filter(b => b.aksi === 'sama' && b.beda && b.beda.length).length;
    const jenisLembar = l => (l.arsip ? ` · <b>${l.arsip.jenis === 'lokasi' ? 'Lokasi Tagihan' : 'Jaminan Pelaksanaan'}</b>` : '');
    const pilihLembar = (lembar || []).map((l, i) => `<label class="cek"><input type="checkbox" class="pilih-lembar" data-i="${i}"${l.pakai ? ' checked' : ''}> Lembar “${esc(l.nama)}”${jenisLembar(l)} · ${l.arsip ? l.arsip.catatan.length : l.catatan.length} baris${l.adaNilai ? '' : ' · <i>register tanpa kolom nilai (hanya baris berkata “somasi”)</i>'}</label>`).join('');
    return `<fieldset><legend>Lembar yang diimpor</legend>${pilihLembar}</fieldset>
      <p class="pesan info" role="status">${baris.length} baris terbaca: ${n.baru} somasi baru, ${n.isi} melengkapi data yang ada, ${n.sama} sudah lengkap${beda ? `, <b>${beda} selisih nilai/tingkat</b> akan dicatat di keterangan tanpa menimpa` : ''}.</p>
      <div class="tabel-bungkus"><table><thead><tr><th>Aksi</th><th>Rekanan</th><th>Pengirim</th><th>Proyek</th><th>Tingkat</th><th class="angka">Nilai</th><th class="angka">Saldo</th><th>Status</th></tr></thead><tbody>
      ${baris.map(b => `<tr><td>${aksiImpor(b)}</td><td>${esc(b.r.rekanan)}</td><td>${esc(b.r.asalSurat)}</td><td>${esc(b.r.proyek)}</td><td>${esc(b.r.tingkat)}</td><td class="angka">${esc(D.rupiah(b.r.nilaiTuntutan))}</td><td class="angka">${esc(D.rupiah(b.r.saldo))}</td><td>${esc(b.r.status)}</td></tr>`).join('')}
      </tbody></table></div><p class="baris-btn"><button type="button" class="btn utama-btn" data-aksi="impor-terapkan"${ubah ? '' : ' disabled'}>Terapkan ${ubah} perubahan</button><button type="button" class="btn" data-aksi="impor-batal">Batal</button></p>`;
  }

  function ocr(lap, drive) {
    return `<section class="kartu"><h2 class="judul-orn">Impor dari scan surat (OCR)</h2>
      <p>Pilih scan surat somasi (PDF atau gambar). Teks dibaca beberapa mesin OCR, hasilnya diadu, lalu <b>Anda wajib mencocokkan setiap isian dengan dokumen asli</b> sebelum disimpan. Dokumen tidak dikirim ke luar perangkat.</p>
      <p><span class="pil ${lap.ada ? 'ok' : 'waspada'}">${lap.ada ? 'Mesin laptop aktif: ' + esc((lap.mesin || []).join(' · ')) : 'Mesin peramban: PaddleOCR PP-OCRv4 (GPU/CPU) + Tesseract.js, hasilnya diadu; dokumen tidak keluar dari perangkat. Unduhan pertama ±42 MB lalu tersimpan di cache. Pintasan desktop “Monitoring Somasi” tetap jalur tercepat.'}</span></p>
      ${panelUnggah({ jenis: 'scan', id: 'berkas-scan', accept: '.pdf,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,application/pdf,image/*', drive, aksiDrive: 'drive-scan', ket: 'PDF, JPG, PNG · maks. 25 berkas sekaligus, 25 MB per berkas · dibaca satu per satu, diverifikasi satu per satu' })}
      <div id="ocr-kabar" role="status" aria-live="polite"></div></section>
      <section class="kartu" id="ocr-antrian" hidden></section>
      <div id="ocr-hasil"></div>`;
  }

  const LABEL_ANTRIAN = { menunggu: ['Menunggu', ''], dibaca: ['Sedang dibaca', 'r3'], siap: ['Siap diverifikasi', 'r2'], verifikasi: ['Sedang diverifikasi', 'r3'],
    tersimpan: ['Tersimpan', 'r1'], dilewati: ['Dilewati', ''], gagal: ['Gagal dibaca', 'r4'] };
  /** Panel antrean upload massal OCR: setiap berkas tetap diverifikasi satu per satu. */
  function antrian(daftar, adaAktif) {
    const n = s => daftar.filter(x => x.status === s).length;
    const baris = daftar.map((x, i) => {
      const [label, kelas] = LABEL_ANTRIAN[x.status] || [x.status, ''];
      const aksi = x.status === 'siap' && !adaAktif ? `<button type="button" class="btn" data-aksi="antrian-verifikasi" data-id="${esc(x.id)}">Verifikasi</button>`
        : x.status === 'tersimpan' && x.idSomasi ? `<a href="#somasi/${esc(x.idSomasi)}">Lihat</a>` : esc(x.galat || '');
      return `<tr><td>${i + 1}</td><td>${esc(x.nama)}</td><td><span class="lencana ${kelas}">${esc(label)}</span></td><td>${aksi}</td></tr>`;
    }).join('');
    return `<h2>Antrean upload (${daftar.length} berkas)</h2>
      <p class="bantu" role="status">${n('tersimpan')} tersimpan · ${n('siap') + n('verifikasi')} menunggu verifikasi · ${n('menunggu') + n('dibaca')} belum dibaca · ${n('dilewati')} dilewati · ${n('gagal')} gagal</p>
      <div class="tabel-bungkus"><table><thead><tr><th>No</th><th>Berkas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${baris}</tbody></table></div>
      <p class="baris-btn"><button type="button" class="btn" data-aksi="antrian-bersihkan">Bersihkan yang selesai</button></p>`;
  }

  const LABEL_OCR = { rekanan: 'Rekanan / kreditur', noSurat: 'Nomor surat', tglSurat: 'Tanggal surat', perihal: 'Perihal', proyek: 'Proyek', tingkat: 'Tingkat', nilaiTuntutan: 'Nilai tuntutan (Rp)', tenggatHari: 'Tenggat (hari sejak diterima)' };
  const KET_STATUS = { sepakat: 'Semua mesin sepakat', mayoritas: 'Mayoritas mesin sepakat', tunggal: 'Hanya satu mesin — periksa', beda: 'Mesin berbeda — WAJIB periksa', kosong: 'Tidak terbaca — isi manual' };
  function hasilOcr(h, namaBerkas) {
    const s = h.suara;
    const kolom = window.EKSTRAK.KOLOM.map(k => {
      const v = s.isian[k], st = s.status[k], calon = s.calon[k].length > 1 ? `<small>Calon: ${s.calon[k].map(c => `${esc(k === 'nilaiTuntutan' ? D.rupiah(c.nilai) : c.nilai)} (${esc(c.mesin.join(', '))})`).join(' | ')}</small>` : '';
      const input = k === 'tingkat' ? `<select name="${k}" id="o-${k}">${opsi(D.TINGKAT, v)}</select>`
        : `<input id="o-${k}" name="${k}" type="${k === 'tglSurat' ? 'date' : 'text'}" value="${esc(k === 'nilaiTuntutan' ? (v || '') : v)}"${k === 'nilaiTuntutan' || k === 'tenggatHari' ? ' inputmode="decimal"' : ''}>`;
      return `<div class="kolom-ocr"><div class="kepala"><label for="o-${k}">${esc(LABEL_OCR[k])}</label><span class="lencana ${st}">${esc(KET_STATUS[st])}${k === 'nilaiTuntutan' && s.terbilangCocok ? ' · cocok dengan terbilang' : ''}</span></div>${input}${calon}</div>`;
    }).join('');
    return `<section class="kartu"><h2 class="judul-orn">Verifikasi hasil OCR</h2>
      <p class="bantu">${esc(namaBerkas)} · ${esc(h.halaman)} halaman · jalur ${h.jalur === 'laptop' ? 'mesin laptop' : 'mesin peramban'} · SHA-256 ${esc(h.sha256.slice(0, 16))}…${h.catatan ? ' · ' + esc(h.catatan) : ''}</p>
      <div class="ocr-tata"><div class="pratinjau" id="ocr-pratinjau" aria-label="Pratinjau dokumen"></div>
      <form class="isian-ocr" id="form-ocr" autocomplete="off">${kolom}
        <label>Tanggal diterima<input type="date" name="tglTerima" value="${esc(D.hariIni())}"></label>
        <label class="cek"><input type="checkbox" id="ocr-setuju" required> Saya sudah mencocokkan setiap isian di atas dengan dokumen asli.</label>
        <div class="baris-btn"><button type="submit" class="btn utama-btn">Simpan sebagai somasi</button><button type="button" class="btn" data-aksi="ocr-batal">Batal</button></div>
        <details class="mentah"><summary>Teks mentah per mesin</summary>${h.mesin.map(m => `<h3>${esc(m.mesin)}</h3><pre>${esc(m.teks)}</pre>`).join('')}</details>
      </form></div></section>`;
  }

  function laporan(data, kini, unit, oleh) {
    const s = D.ringkasan(data.somasi, kini);
    const akt = data.somasi.filter(D.aktif).sort((a, b) => D.saldoTerbuka(b) - D.saldoTerbuka(a));
    return `<div class="baris-btn tanpa-cetak"><button type="button" class="btn utama-btn" data-aksi="cetak">Cetak / simpan PDF</button><span class="bantu">Gunakan “Simpan sebagai PDF” di dialog cetak. Laporan berlabel RAHASIA.</span></div>
    <section class="kartu sampul"><p><span class="rahasia">RAHASIA · HANYA UNTUK MANAJEMEN</span></p>
      <div class="merek"><span class="bola" aria-hidden="true">${esc(ID().logo || 'MS')}</span><div><b>${esc(ID().perusahaan || 'Laporan internal')}</b>${unit ? `<small>${esc(unit)}</small>` : ''}</div></div>
      <h2 class="judul-orn">Laporan Monitoring Somasi</h2><p>Posisi per ${esc(D.tglPanjang(kini))}. Disusun oleh ${esc(oleh || '-')} dari aplikasi Monitoring Somasi.</p>
      ${kpi(s)}
      <h3>Ringkasan eksekutif</h3><div class="narasi">${D.narasi(data.somasi, kini).map(p => `<p>${esc(p)}</p>`).join('')}</div>
      <h3>Rekomendasi</h3>${daftarRekomendasi(D.rekomendasi(data.somasi, kini), 10)}</section>
    <section class="kartu grafik-laporan"><h2>Grafik utama</h2><div class="grid-2"><div><h3>Komposisi pembayaran</h3><div data-grafik="cincin"></div></div><div><h3>Matriks risiko</h3><div data-grafik="matriks"></div></div></div>
      <h3>Saldo terbuka per proyek (5 terbesar)</h3><div class="grafik-lebar" data-grafik="proyek5"></div>
      <h3>Saldo terbuka per tingkat</h3><div class="grafik-lebar" data-grafik="tingkat"></div></section>
    <section class="kartu halaman-baru"><h2>Lampiran A · Somasi aktif (${akt.length})</h2>${tabelLampiran(akt, kini)}</section>
    <section class="kartu"><h2>Lampiran B · Dasar penilaian</h2><p>Risiko = kemungkinan eskalasi × dampak (rubrik di bawah, mengacu pada kerangka ISO 31000). Saldo terbuka = saldo tercatat, atau tuntutan − pembayaran bila saldo tidak tercatat. Angka bersumber dari data yang dicatat di aplikasi (impor Excel folder SOMASI, verifikasi OCR, dan pencatatan manual) dan dapat ditelusuri di jejak audit.</p>${rubrik()}</section>`;
  }
  function tabelLampiran(akt, kini) {
    return `<div class="tabel-bungkus"><table class="tabel-lampiran"><thead><tr><th>No</th><th>Rekanan</th><th>Proyek</th><th>Tingkat</th><th class="angka">Tuntutan</th><th class="angka">Dibayar</th><th class="angka">Saldo</th><th>Status / tindak lanjut terakhir</th><th>Risiko</th></tr></thead><tbody>
      ${akt.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.rekanan || r.asalSurat)}</td><td>${esc(r.proyek)}</td><td>${esc(r.tingkat)}</td><td class="angka">${esc(D.rupiah(r.nilaiTuntutan))}</td><td class="angka">${esc(D.rupiah(r.dibayar))}</td><td class="angka">${esc(D.rupiah(D.saldoTerbuka(r)))}</td>
      <td>${esc(r.status)}${r.tindakLanjut.length ? '<br><small>' + esc(r.tindakLanjut[r.tindakLanjut.length - 1].uraian) + '</small>' : ''}</td><td>${lencanaRisiko(D.risiko(r, kini))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function rubrik() {
    return `<div class="grid-2"><div class="tabel-bungkus"><table><thead><tr><th>Dampak</th><th>Saldo terbuka</th></tr></thead><tbody>
      <tr><td>1</td><td>&lt; Rp 250 Jt</td></tr><tr><td>2</td><td>Rp 250 Jt – &lt; 500 Jt</td></tr><tr><td>3</td><td>Rp 500 Jt – &lt; 1 M</td></tr><tr><td>4</td><td>Rp 1 M – &lt; 5 M</td></tr><tr><td>5</td><td>≥ Rp 5 M</td></tr></tbody></table></div>
      <div class="tabel-bungkus"><table><thead><tr><th>Kemungkinan</th><th>Dasar</th></tr></thead><tbody>
      <tr><td>1</td><td>Permohonan / teguran biasa</td></tr><tr><td>2</td><td>Somasi I</td></tr><tr><td>3</td><td>Somasi II</td></tr><tr><td>4</td><td>Somasi III / terakhir</td></tr><tr><td>5</td><td>Eskalasi litigasi</td></tr><tr><td>+1</td><td>Tenggat tanggapan terlewati (maks. 5)</td></tr></tbody></table></div></div>`;
  }

  function tataKelola(data, cek) {
    const j = data.jejak.slice(-60).reverse();
    return `<section class="kartu"><h2 class="judul-orn">Kerangka tata kelola</h2>
      <p>Aplikasi ini dirancang <b>mengacu pada</b> (bukan klaim sertifikasi) standar dan prinsip berikut:</p>
      <div class="tabel-bungkus"><table><thead><tr><th>Rujukan</th><th>Penerapan di aplikasi</th></tr></thead><tbody>
      <tr><td>Prinsip GCG BUMN: transparansi</td><td>Ringkasan eksekutif, grafik, dan laporan manajemen dihitung langsung dari data; dasar penilaian dicantumkan di laporan.</td></tr>
      <tr><td>GCG: akuntabilitas & pertanggungjawaban</td><td>Setiap perubahan tercatat di jejak audit berantai SHA-256 (siapa, kapan, apa); PIC dan disposisi per somasi; rekomendasi menunjuk Pedoman Internal.</td></tr>
      <tr><td>GCG: kemandirian & kewajaran</td><td>Rubrik risiko tertulis dan sama untuk semua rekanan; penggabungan impor tidak menimpa data yang sudah diverifikasi.</td></tr>
      <tr><td>ISO 31000 Manajemen risiko</td><td>Identifikasi (pencatatan somasi), analisis (kemungkinan × dampak), evaluasi (matriks 5×5), perlakuan (rekomendasi & tindak lanjut), pemantauan (dasbor).</td></tr>
      <tr><td>ISO 37301 Sistem manajemen kepatuhan</td><td>Kewajiban tanggapan dan tenggat dipantau; somasi lewat tenggat dan tingkat II/terakhir dieskalasi ke manajemen.</td></tr>
      <tr><td>ISO/IEC 27001 Keamanan informasi</td><td>Enkripsi AES-256-GCM end-to-end, kunci dari kata sandi (PBKDF2 600.000 iterasi), kunci otomatis saat tidak aktif, CSP ketat, akses online hanya anggota terdaftar, OCR tanpa mengirim dokumen keluar.</td></tr>
      <tr><td>ISO 15489-1 Manajemen rekaman</td><td>Sumber setiap catatan (berkas Excel, hash SHA-256 scan OCR) disimpan; riwayat versi di cloud tidak dapat diubah atau dihapus.</td></tr>
      <tr><td>${esc(ID().pedoman || 'Pedoman internal tanggapan somasi')}</td><td>Posisi tagihan A–D, rekomendasi redaksi, pelibatan advokat, pencatatan saldo/selisih/PIC/tenggat.</td></tr>
      </tbody></table></div></section>
      <section class="kartu"><h2>Rubrik risiko</h2>${rubrik()}</section>
      <section class="kartu"><h2 class="judul-orn">Jejak audit</h2>
      <p><span class="pil ${cek.utuh ? 'ok' : 'bahaya'}">${cek.utuh ? `Rantai utuh · ${data.jejak.length} entri terverifikasi` : `RANTAI RUSAK di entri ${cek.rusakDi} — laporkan ke administrator`}</span></p>
      <div class="tabel-bungkus"><table><thead><tr><th>No</th><th>Waktu</th><th>Oleh</th><th>Aksi</th><th>Ringkasan</th><th>Hash</th></tr></thead><tbody>
      ${j.filter(e => e && typeof e.hash === 'string').map(e => `<tr><td>${esc(e.no)}</td><td>${esc(new Date(e.t).toLocaleString('id-ID'))}</td><td>${esc(e.oleh)}</td><td>${esc(e.aksi)}</td><td>${esc(e.ringkas)}</td><td><code>${esc(e.hash.slice(0, 12))}</code></td></tr>`).join('')}
      </tbody></table></div><p class="bantu">Menampilkan 60 entri terakhir.</p></section>`;
  }

  function pengaturan(p, mode) {
    return `<section class="kartu"><h2 class="judul-orn">Pengaturan</h2><form id="form-atur" class="form">
      <label>Unit pelapor (tampil di laporan)<input type="text" name="unit" maxlength="120" value="${esc(p.unit)}" placeholder="mis. Divisi Hukum"></label>
      <label>Kunci otomatis (menit)<select name="kunciMenit">${opsi(['5', '10', '15', '30'], String(p.kunciMenit))}</select></label>
      <fieldset class="lebar"><legend>Identitas organisasi (disimpan terenkripsi di brankas; tampil setelah login)</legend><div class="form">
      <label>Nama perusahaan<input type="text" name="perusahaan" maxlength="120" value="${esc((p.identitas || {}).perusahaan)}"></label>
      <label>Teks logo (maks. 6 huruf)<input type="text" name="logo" maxlength="6" value="${esc((p.identitas || {}).logo)}"></label>
      <label>Tagline<input type="text" name="tagline" maxlength="80" value="${esc((p.identitas || {}).tagline)}"></label>
      <label>Nama pedoman tanggapan somasi<input type="text" name="pedoman" maxlength="160" value="${esc((p.identitas || {}).pedoman)}"></label></div></fieldset>
      <div class="lebar baris-btn"><button type="submit" class="btn utama-btn">Simpan pengaturan</button></div></form></section>
      <section class="kartu"><h2>Ganti kata sandi brankas</h2><form id="form-sandi" class="form" autocomplete="off">
      <label>Kata sandi lama<input type="password" name="lama" required autocomplete="current-password"></label>
      <label>Kata sandi baru<input type="password" name="baru" required minlength="12" autocomplete="new-password"></label>
      <label>Ulangi kata sandi baru<input type="password" name="baru2" required minlength="12" autocomplete="new-password"></label>
      <div class="lebar baris-btn"><button type="submit" class="btn">Ganti kata sandi</button></div></form>
      <p class="bantu">Semua anggota memakai kata sandi brankas yang sama. Setelah diganti, sampaikan kata sandi baru lewat jalur aman (tidak lewat surel/chat biasa).
      Catatan: cadangan lama dan riwayat versi di cloud TETAP terbuka dengan kata sandi lama. Saat mencabut anggota (hapus dokumen anggota di Console), selalu ganti kata sandi.</p></section>
      <section class="kartu"><h2>Mode penyimpanan</h2><p>${esc(mode)}</p></section>`;
  }

  return Object.freeze({ esc, antrian, ringkasan, grafik, daftar, tabelDaftar, formSomasi, detail, rincian, impor, pratinjauImpor, ocr, hasilOcr, laporan, tataKelola, pengaturan });
})();
