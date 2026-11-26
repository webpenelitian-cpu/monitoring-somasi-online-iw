/* Model data, aturan bisnis, dan analitik Monitoring Somasi. Semua fungsi murni (tanpa DOM) agar teruji di tests/uji.js.
   Rubrik risiko mengacu pada ISO 31000 (kemungkinan x dampak); skala dan ambangnya keputusan internal yang tertulis di sini
   dan di halaman Tata Kelola, bukan kutipan standar. */
'use strict';
window.DATA = (function () {
  const STATUS = ['Baru', 'Kajian Legal', 'Tanggapan Terkirim', 'Negosiasi', 'Jadwal Bayar', 'Eskalasi Litigasi', 'Selesai'];
  const TINGKAT = ['Somasi I', 'Somasi II', 'Somasi III / Terakhir', 'Teguran / Peringatan', 'Permohonan Pembayaran', 'Lainnya'];
  const DISPOSISI = ['', 'Direksi', 'Legal', 'Keuangan', 'SCM', 'Proyek'];
  // Posisi tagihan sesuai Pedoman Internal Surat Tanggapan Somasi perusahaan, bagian 3 (redaksi pengganti A-D).
  const POSISI = { '': 'Belum dinilai', A: 'A · Pokok final, tidak disengketakan', B: 'B · Sebagian disengketakan',
    C: 'C · Janji bayar belum terpenuhi', D: 'D · Somasi lanjutan / pembaruan berkala' };
  const SELESAI = 'Selesai';

  const teks = v => (v === null || v === undefined) ? '' : String(v).trim();
  const angka = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = teks(v).replace(/rp\.?/i, '').replace(/\s/g, '');
    if (!s || s === '-') return 0;
    const n = Number(normalAngka(s));
    return Number.isFinite(n) ? n : 0;
  };
  /** "1.234.567,89" / "1,234,567.89" / "1234567" -> "1234567.89" */
  function normalAngka(s) {
    const titik = (s.match(/\./g) || []).length, koma = (s.match(/,/g) || []).length;
    if (titik && koma) return s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    if (koma === 1 && /,\d{1,2}$/.test(s)) return s.replace(',', '.');
    if (titik === 1 && /\.\d{1,2}$/.test(s)) return s;
    return s.replace(/[.,]/g, '');
  }

  /** yyyy-mm-dd yang benar-benar ada di kalender (Date.parse menerima 30 Februari, jadi dicek bolak-balik). */
  const tglSah = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const hariIni = () => new Date().toISOString().slice(0, 10);
  function selisihHari(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }

  function idBaru() {
    const u = crypto.getRandomValues(new Uint8Array(9));
    return 's' + Array.from(u, b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
  }

  /** Normalisasi satu catatan somasi: hanya kolom yang dikenal, jenis data benar, teks dipangkas. */
  const PANJANG = { noAgenda: 40, noSurat: 120, asalSurat: 200, rekanan: 200, proyek: 200, perihal: 400, pic: 120, ket: 2000, sumber: 300 };
  const tglAtauKosong = v => (tglSah(teks(v)) ? teks(v) : '');
  const pilihan = (v, daftar, bawaan) => (daftar.includes(v) ? v : bawaan);
  function normal(r) {
    r = r || {};
    const o = { id: teks(r.id) || idBaru() };
    for (const [k, n] of Object.entries(PANJANG)) o[k] = teks(r[k]).slice(0, n);
    for (const k of ['tglSurat', 'tglTerima', 'tenggat']) o[k] = tglAtauKosong(r[k]);
    for (const k of ['nilaiTuntutan', 'saldo', 'dibayar']) o[k] = Math.max(0, angka(r[k]));
    o.tingkat = pilihan(r.tingkat, TINGKAT, 'Lainnya');
    o.disposisi = pilihan(r.disposisi, DISPOSISI, '');
    o.status = pilihan(r.status, STATUS, 'Baru');
    o.posisi = pilihan(r.posisi, Object.keys(POSISI), '');
    o.kemungkinan = skala(r.kemungkinan); o.dampak = skala(r.dampak);
    o.tindakLanjut = Array.isArray(r.tindakLanjut) ? r.tindakLanjut.slice(0, 200).map(normalTL).filter(t => t.uraian) : [];
    o.verifikasi = teks(r.verifikasi).slice(0, BATAS_VERIF);
    o.surat = normalSurat(r.surat, o);
    o.rincian = normalRincian(r.rincian);
    o.dibuat = teks(r.dibuat) || new Date().toISOString();
    o.diubah = teks(r.diubah) || new Date().toISOString();
    return o;
  }
  /* Rincian sumber: baris asli dari register sumber (mis. IRL, satu baris per invoice) disimpan utuh di brankas
     terenkripsi; kolom Excel berawalan "Rincian: ". Tidak masuk Keterangan, CSV, laporan cetak, atau tebakan status. */
  const RINCIAN_RE = /^\s*rincian\s*:\s*(.*)$/i;
  function normalRincian(daftar) {
    if (!Array.isArray(daftar)) return [];
    return daftar.slice(0, 2000).filter(x => x && typeof x === 'object' && !Array.isArray(x)).map(x => {
      const o = {};
      for (const [k, v] of Object.entries(x).slice(0, 60)) if (teks(k)) o[teks(k).slice(0, 80)] = typeof v === 'number' && Number.isFinite(v) ? v : teks(v).slice(0, 1000);
      return o;
    }).filter(o => Object.keys(o).length);
  }
  const kunciRincian = x => JSON.stringify(Object.keys(x).sort().map(k => [k, x[k]]));
  /** Nomor rekening/akun hanya ditampilkan 4 digit terakhir. */
  const KOLOM_REKENING = /rekening|no\.? ?rek\b|account|akun bank/i;
  function samarkan(kolom, v) {
    if (!KOLOM_REKENING.test(teks(kolom))) return v;
    // Satu sel bisa berisi beberapa rekening (dipisah ; , | atau baris baru): samarkan masing-masing.
    return teks(v).split(/\s*[;,|\n]\s*/).filter(Boolean).map(x => { const d = x.replace(/\D/g, ''); return '••••' + d.slice(-4); }).join(' ; ');
  }
  /** Satu perkara = satu utang; setiap surat masuk (Somasi I, II, terakhir, teguran) dicatat di riwayat surat. */
  const PERINGKAT = { 'Lainnya': 0, 'Permohonan Pembayaran': 1, 'Teguran / Peringatan': 2, 'Somasi I': 3, 'Somasi II': 4, 'Somasi III / Terakhir': 5 };
  const peringkat = t => PERINGKAT[t] || 0;
  const normalSatuSurat = s => ({ tgl: tglAtauKosong(s && s.tgl), noSurat: teks(s && s.noSurat).slice(0, 120), tingkat: pilihan(s && s.tingkat, TINGKAT, 'Lainnya'),
    pengirim: teks(s && s.pengirim).slice(0, 200), nilai: Math.max(0, angka(s && s.nilai)), tenggat: tglAtauKosong(s && s.tenggat), sumber: teks(s && s.sumber).slice(0, 300) });
  /** Riwayat surat; catatan lama tanpa riwayat mendapat satu surat dari isian utamanya. Urut tanggal naik. */
  function normalSurat(daftar, o) {
    let s = Array.isArray(daftar) ? daftar.slice(0, 50).map(normalSatuSurat).filter(x => x.tgl || x.noSurat) : [];
    if (!s.length && (o.tglSurat || o.noSurat)) s = [normalSatuSurat({ tgl: o.tglSurat, noSurat: o.noSurat, tingkat: o.tingkat, pengirim: o.asalSurat, nilai: o.nilaiTuntutan, tenggat: o.tenggat, sumber: o.sumber })];
    return s.sort((a, b) => (a.tgl || '9999').localeCompare(b.tgl || '9999'));
  }
  const suratSama = (a, b) => a.tgl === b.tgl && (!a.noSurat || !b.noSurat || kunciNo(a.noSurat) === kunciNo(b.noSurat));
  const kunciNo = s => teks(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  /** Tambahkan surat-surat baru ke perkara: tidak ganda; tingkat naik ke yang tertinggi; tenggat mengikuti surat terbaru. -> jumlah surat baru */
  function gabungSurat(lama, surat) {
    let n = 0;
    for (const s of surat.map(normalSatuSurat)) {
      if (!(s.tgl || s.noSurat) || lama.surat.some(x => suratSama(x, s))) continue;
      lama.surat.push(s); n++;
    }
    if (!n) return 0;
    lama.surat.sort((a, b) => (a.tgl || '9999').localeCompare(b.tgl || '9999'));
    const tertinggi = lama.surat.reduce((t, s) => (peringkat(s.tingkat) > peringkat(t) ? s.tingkat : t), lama.tingkat);
    lama.tingkat = tertinggi;
    const terbaru = lama.surat.filter(s => s.tgl).slice(-1)[0];
    if (terbaru && terbaru.tenggat && terbaru.tenggat > (lama.tenggat || '')) lama.tenggat = terbaru.tenggat;
    return n;
  }
  const BATAS_VERIF = 4000;   // catatan selisih antarsumber bisa panjang; jangan terpotong diam-diam
  /** Tambah catatan verifikasi tanpa menggandakan kalimat yang sama. */
  function tambahVerifikasi(r, catatan) {
    const ada = r.verifikasi ? r.verifikasi.split(' · ') : [];
    for (const c of [].concat(catatan).map(teks).filter(Boolean)) if (!ada.includes(c)) ada.push(c);
    r.verifikasi = ada.join(' · ').slice(0, BATAS_VERIF);
  }
  const skala = v => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 0; };
  const normalTL = t => ({ tgl: tglSah(teks(t && t.tgl)) ? teks(t.tgl) : '', uraian: teks(t && t.uraian).slice(0, 600), noSurat: teks(t && t.noSurat).slice(0, 120) });

  /** Saldo terbuka: saldo tercatat; bila kosong, tuntutan dikurangi pembayaran. Somasi selesai = 0. */
  function saldoTerbuka(r) {
    if (r.status === SELESAI) return 0;
    if (r.saldo > 0) return r.saldo;
    return Math.max(0, r.nilaiTuntutan - r.dibayar);
  }
  const aktif = r => r.status !== SELESAI;
  const tingkatTinggi = r => r.tingkat === 'Somasi II' || r.tingkat === 'Somasi III / Terakhir';
  const lewatTenggat = (r, kini) => aktif(r) && !!r.tenggat && r.tenggat < kini && !['Tanggapan Terkirim', 'Jadwal Bayar', 'Negosiasi'].includes(r.status);

  /** Rubrik dampak (1-5) dari saldo terbuka. */
  function dampakOtomatis(saldo) {
    if (saldo >= 5e9) return 5;
    if (saldo >= 1e9) return 4;
    if (saldo >= 5e8) return 3;
    if (saldo >= 2.5e8) return 2;
    return 1;
  }
  /** Rubrik kemungkinan eskalasi (1-5) dari tingkat somasi, status, dan tenggat. */
  function kemungkinanOtomatis(r, kini) {
    if (r.status === 'Eskalasi Litigasi') return 5;
    const dasar = { 'Somasi III / Terakhir': 4, 'Somasi II': 3, 'Somasi I': 2 }[r.tingkat] || 1;
    return Math.min(5, dasar + (lewatTenggat(r, kini) ? 1 : 0));
  }
  function risiko(r, kini) {
    const k = r.kemungkinan || kemungkinanOtomatis(r, kini || hariIni());
    const d = r.dampak || dampakOtomatis(saldoTerbuka(r));
    const skor = k * d;
    return { k, d, skor, level: skor >= 15 ? 'Sangat tinggi' : skor >= 10 ? 'Tinggi' : skor >= 5 ? 'Sedang' : 'Rendah', manual: !!(r.kemungkinan || r.dampak) };
  }

  function jumlahPer(daftar, kunci, nilai) {
    const m = new Map();
    for (const r of daftar) {
      const k = kunci(r) || '(tanpa keterangan)';
      const v = m.get(k) || { label: k, n: 0, nilai: 0 };
      v.n++; v.nilai += nilai ? nilai(r) : 0;
      m.set(k, v);
    }
    return Array.from(m.values());
  }

  /** Ringkasan angka untuk dasbor & laporan. */
  function ringkasan(daftar, kini) {
    kini = kini || hariIni();
    const akt = daftar.filter(aktif);
    const tuntutan = daftar.reduce((s, r) => s + r.nilaiTuntutan, 0);
    const saldo = akt.reduce((s, r) => s + saldoTerbuka(r), 0);
    const dibayar = daftar.reduce((s, r) => s + r.dibayar, 0);
    const rs = akt.map(r => ({ r, ri: risiko(r, kini) }));
    return {
      kini, total: daftar.length, aktif: akt.length, selesai: daftar.length - akt.length, tuntutan, saldo, dibayar,
      persenBayar: tuntutan > 0 ? dibayar / tuntutan : 0,
      tinggi: akt.filter(tingkatTinggi).length, lewat: akt.filter(r => lewatTenggat(r, kini)).length,
      tanpaTanggapan: akt.filter(r => r.status === 'Baru' || r.status === 'Kajian Legal').length,
      risikoTinggi: rs.filter(x => x.ri.skor >= 10).length,
      perluVerifikasi: daftar.filter(r => r.verifikasi).length,
      perStatus: STATUS.map(s => ({ label: s, n: daftar.filter(r => r.status === s).length, nilai: daftar.filter(r => r.status === s).reduce((a, r) => a + saldoTerbuka(r), 0) })),
      perTingkat: jumlahPer(akt, r => r.tingkat, saldoTerbuka).sort((a, b) => b.nilai - a.nilai),
      perProyek: jumlahPer(akt, r => r.proyek, saldoTerbuka).sort((a, b) => b.nilai - a.nilai),
      perDisposisi: jumlahPer(akt, r => r.disposisi || 'Belum didisposisi', saldoTerbuka).sort((a, b) => b.n - a.n),
      perBulan: perBulan(daftar),
      teratas: akt.slice().sort((a, b) => saldoTerbuka(b) - saldoTerbuka(a)).slice(0, 5),
      matriks: matriks(rs),
    };
  }
  function perBulan(daftar) {
    const m = new Map();
    for (const r of daftar) {
      const tgl = r.surat && r.surat.length ? r.surat.map(s => s.tgl) : [r.tglSurat || r.tglTerima];
      for (const t of tgl.filter(Boolean)) m.set(t.slice(0, 7), (m.get(t.slice(0, 7)) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([label, n]) => ({ label, n }));
  }
  function matriks(rs) {
    const g = Array.from({ length: 5 }, () => Array(5).fill(0));
    for (const x of rs) g[x.ri.k - 1][x.ri.d - 1]++;
    return g;
  }

  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function tglPanjang(s) { if (!tglSah(s)) return '-'; const [y, m, d] = s.split('-'); return `${Number(d)} ${BULAN[Number(m) - 1]} ${y}`; }
  function rupiah(n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); }
  /** Rupiah ringkas untuk narasi & grafik: 1,23 M / 456,7 Jt. */
  function ringkas(n) {
    n = Math.round(n || 0);
    if (Math.abs(n) >= 1e12) return 'Rp ' + (n / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' T';
    if (Math.abs(n) >= 1e9) return 'Rp ' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M';
    if (Math.abs(n) >= 1e6) return 'Rp ' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' Jt';
    return rupiah(n);
  }
  const persen = x => (x * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%';

  /** Narasi ringkasan eksekutif: kalimat faktual dari data, tanpa penilaian yang tidak didukung angka. */
  function narasi(daftar, kini) {
    const s = ringkasan(daftar, kini);
    if (!s.total) return ['Belum ada data somasi. Impor data dari Excel atau tambahkan somasi baru.'];
    const p = [];
    p.push(`Per ${tglPanjang(s.kini)} tercatat ${s.total} somasi; ${s.aktif} masih aktif dan ${s.selesai} telah selesai. ` +
      `Total nilai tuntutan ${ringkas(s.tuntutan)}, telah dibayar ${ringkas(s.dibayar)} (${persen(s.persenBayar)}), ` +
      `dan saldo terbuka atas somasi aktif ${ringkas(s.saldo)}.`);
    if (s.teratas.length) {
      const top = s.teratas.slice(0, 3), sub = top.reduce((a, r) => a + saldoTerbuka(r), 0);
      p.push(`Eksposur terbesar: ${top.map(r => `${r.rekanan || r.asalSurat} (${ringkas(saldoTerbuka(r))})`).join(', ')}; ` +
        `ketiganya mewakili ${s.saldo ? persen(sub / s.saldo) : '0%'} saldo terbuka.`);
    }
    const perhatian = [];
    if (s.tinggi) perhatian.push(`${s.tinggi} somasi tingkat II/terakhir`);
    if (s.lewat) perhatian.push(`${s.lewat} somasi melewati tenggat tanggapan`);
    if (s.tanpaTanggapan) perhatian.push(`${s.tanpaTanggapan} somasi belum ditanggapi tertulis`);
    if (s.risikoTinggi) perhatian.push(`${s.risikoTinggi} somasi berisiko tinggi`);
    p.push(perhatian.length ? `Memerlukan perhatian manajemen: ${perhatian.join('; ')}.` : 'Tidak ada somasi aktif yang melewati tenggat atau berisiko tinggi.');
    return p;
  }

  /** Rekomendasi tindak lanjut per somasi, berbasis aturan dan Pedoman Internal Surat Tanggapan Somasi. */
  function rekomendasi(daftar, kini) {
    kini = kini || hariIni();
    return daftar.filter(aktif).flatMap(r => rekomendasiSatu(r, kini))
      .sort((a, b) => a.prio - b.prio || saldoTerbuka(b.r) - saldoTerbuka(a.r));
  }
  const belumDitanggapi = r => r.status === 'Baru' || r.status === 'Kajian Legal';
  /** Aturan rekomendasi: [syarat, prioritas, teks]. Rujukan "Pedoman" = Pedoman Internal Surat Tanggapan Somasi perusahaan. */
  const ATURAN = [
    [(r, ri, kini) => lewatTenggat(r, kini), 1, (n, r) => `${n}: tenggat tanggapan ${tglPanjang(r.tenggat)} terlewati. Kirim tanggapan tertulis lewat kanal sesuai kontrak dan simpan bukti terima (Pedoman bag. 4).`],
    [r => tingkatTinggi(r) && belumDitanggapi(r), 1, (n, r) => `${n}: ${r.tingkat} belum ditanggapi. Prioritaskan tanggapan; gunakan redaksi D (somasi lanjutan) bila sudah pernah ditanggapi.`],
    [r => r.posisi === 'C', 2, n => `${n}: janji bayar sebelumnya belum terpenuhi. Gunakan redaksi C; jangan menyebut janji lama sekadar estimasi.`],
    [(r, ri) => r.status === 'Eskalasi Litigasi' || ri.skor >= 15, 1, (n, r, ri) => `${n}: risiko ${ri.level.toLowerCase()} (${ri.k}×${ri.d}). Libatkan advokat korporasi bila ada gugatan, arbitrase, laporan pidana, atau ancaman PKPU/pailit (Pedoman bag. 4).`],
    [r => !!r.verifikasi, 2, (n, r) => `${n}: PERLU VERIFIKASI — ${r.verifikasi}`],
    [r => !r.pic, 3, n => `${n}: belum ada PIC. Tunjuk penanggung jawab dan pejabat penandatangan berwenang (Pedoman bag. 1 butir 4).`],
  ];
  function rekomendasiSatu(r, kini) {
    const nama = r.rekanan || r.asalSurat || '(tanpa nama)', ri = risiko(r, kini);
    return ATURAN.filter(([cek]) => cek(r, ri, kini)).map(([, prio, teks]) => ({ r, prio, teks: teks(nama, r, ri) }));
  }

  // ---------------------------------------------------------------- impor tabel (Excel)
  const SINONIM = [
    ['noAgenda', /^(file|no\.? ?agenda|agenda|no\.? ?file)$/],
    ['tglSurat', /^(tgl|tanggal) ?surat$/],
    ['tglTerima', /^(tgl|tanggal) ?(terima|diterima|masuk)$/],
    ['noSurat', /^(no\.?|nomor) ?surat$/],
    ['asalSurat', /^(asal ?surat|pengirim|kuasa ?hukum)$/],
    ['rekanan', /^(nama ?rekanan|rekanan|nama ?vendor|vendor|subkontraktor)$/],
    ['proyek', /^proyek$/],
    ['nilaiTuntutan', /^(nilai|nilai ?hutang.*|nilai ?tuntutan|nilai ?tagihan|tuntutan)$/],
    ['saldo', /^saldo.*$/],
    ['dibayar', /^(pembayaran|dibayar|realisasi.*)$/],
    ['tindakLanjut', /^(tindak ?lanjut|action ?plan)$/],
    ['perihal', /^(perihal|hal)$/],
    ['disposisi', /^disposisi$/],
    ['pic', /^pic$/],
    ['ket', /^(ket|keterangan)$/],
    ['tenggat', /^(tenggat|tenggat tanggapan|batas waktu|batas waktu tanggapan)$/],
    ['noTanggapan', /^(no\.? ?(surat )?tanggapan|nomor (surat )?tanggapan)$/],
    ['tglTanggapan', /^(tgl|tanggal) ?(surat )?tanggapan$/],
    ['verifikasi', /^(perlu verifikasi|catatan verifikasi|verifikasi)$/],
    ['tingkatTeks', /^tingkat( somasi)?$/],
    ['statusTeks', /^status$/],
  ];
  const kunciHeader = h => teks(h).toLowerCase().replace(/\s+/g, ' ');

  /** Cari baris header dan petakan kolom. -> {baris, peta: {indeksKolom: kolom}} | null */
  function petakanHeader(rows) {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const peta = {};
      (rows[i] || []).forEach((h, j) => {
        const k = kunciHeader(h), rinci = RINCIAN_RE.exec(teks(h));
        const cocok = SINONIM.find(([, re]) => re.test(k));
        if (rinci && rinci[1].trim()) peta[j] = 'rincian:' + rinci[1].trim().slice(0, 80);
        else if (cocok) peta[j] = cocok[0];
      });
      const nilaiKolom = Object.values(peta);
      if (nilaiKolom.length >= 3 && (nilaiKolom.includes('rekanan') || nilaiKolom.includes('asalSurat'))) return { baris: i, peta };
    }
    return null;
  }

  /** Tingkat somasi dari teks bebas. */
  function tebakTingkat(t) {
    t = teks(t).toLowerCase();
    // OCR kerap membaca angka Romawi I sebagai 1/l (mis. "Somasi Il", "Somasi 11").
    if (/(somasi|peringatan)\s*(iii|lll|111|3|ke-?\s*3|ketiga)\b|terakhir/.test(t)) return 'Somasi III / Terakhir';
    if (/(somasi|peringatan)\s*(ii|il|li|ll|11|2|ke-?\s*2|kedua)\b|teguran keras|peringatan kedua/.test(t)) return 'Somasi II';
    if (/somasi\s*(i|l|1|ke-?\s*1|pertama)\b|somasi/.test(t)) return 'Somasi I';
    if (/teguran|peringatan/.test(t)) return 'Teguran / Peringatan';
    if (/permohonan|tagihan|pembayaran/.test(t)) return 'Permohonan Pembayaran';
    return 'Lainnya';
  }
  function tebakStatus(o, semua) {
    if (/lunas/i.test(semua)) return SELESAI;
    if (/meeting|rapat|pertemuan/i.test(o.tlTeks)) return 'Negosiasi';
    if (/jadwal (bayar|pembayaran)/i.test(o.tlTeks)) return 'Jadwal Bayar';
    if (/tanggapan/i.test(semua)) return 'Tanggapan Terkirim';
    return 'Baru';
  }
  const DISPOSISI_TEBAK = [['Direksi', /direksi/i], ['Legal', /legal|hukum/i], ['SCM', /\bscm\b/i], ['Keuangan', /keuangan|finance/i]];

  /** Serial tanggal Excel (sistem 1900) -> ISO. Teks "2 Jul 2026" juga dikenali. */
  function tglExcel(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    return tglTeks(teks(v));
  }
  const BLN_PENDEK = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  function tglTeks(s) {
    if (tglSah(s)) return s;   // ISO yyyy-mm-dd
    const m = /(\d{1,2})[\s\-/.]+([A-Za-z]{3,})[a-z]*\.?[\s\-/.]+(\d{4})/.exec(s);
    if (m) {
      const b = BLN_PENDEK[m[2].slice(0, 3).toLowerCase()];
      if (b) return `${m[3]}-${String(b).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    const n = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
    if (n && +n[2] <= 12 && +n[1] <= 31) return `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`;
    return '';
  }

  /** Satu sel terisi -> kolom catatan sementara (kolom tak dikenal = perihal lain; "rincian:" = rincian sumber). */
  function isiSel(o, k, v) {
    if (!k) o.perihalLain.push(teks(v));
    else if (k.startsWith('rincian:')) o.rinci[k.slice(8)] = typeof v === 'number' ? v : teks(v);
    else if (k === 'ket') o.ket.push(teks(v));
    else if (k === 'tindakLanjut') o.tlTeks += (o.tlTeks ? '\n' : '') + teks(v);
    else if (o[k] === undefined) o[k] = v;
  }
  function barisKeCatatan(row, peta, sumber) {
    const o = { tlTeks: '', ket: [], perihalLain: [], rinci: {} };
    row.forEach((v, j) => { if (v !== '' && v !== null && v !== undefined) isiSel(o, peta[j], v); });
    const semua = row.filter((v, j) => !String(peta[j] || '').startsWith('rincian:')).map(teks).join(' ');   // rincian tidak dipakai menebak
    const disp = DISPOSISI_TEBAK.find(([, re]) => re.test(teks(o.disposisi)));
    const r = {
      noAgenda: teks(o.noAgenda), noSurat: teks(o.noSurat), tglSurat: tglExcel(o.tglSurat), tglTerima: tglExcel(o.tglTerima),
      asalSurat: teks(o.asalSurat), rekanan: teks(o.rekanan) || teks(o.asalSurat), proyek: teks(o.proyek), perihal: teks(o.perihal),
      nilaiTuntutan: angka(o.nilaiTuntutan), saldo: angka(o.saldo), dibayar: angka(o.dibayar),
      disposisi: disp ? disp[0] : '', pic: teks(o.pic),
      tingkat: TINGKAT.includes(teks(o.tingkatTeks)) ? teks(o.tingkatTeks) : tebakTingkat([o.tingkatTeks, o.perihal, ...o.perihalLain].map(teks).join(' ')),
      status: STATUS.includes(teks(o.statusTeks)) ? teks(o.statusTeks) : tebakStatus(o, semua),
      ket: [...o.ket, ...o.perihalLain.filter(x => !/^[ODT]$/.test(x))].join(' · '), sumber,
      tindakLanjut: tindakLanjutDari(o), tenggat: tglExcel(o.tenggat), verifikasi: teks(o.verifikasi),
      rincian: Object.keys(o.rinci).length ? [o.rinci] : [],
    };
    return normal(r);
  }
  function tindakLanjutDari(o) {
    const tl = o.tlTeks.split(/\n|(?:^|\s)-\s+/).map(teks).filter(Boolean).map(u => ({ tgl: '', uraian: u.replace(/^-\s*/, ''), noSurat: '' }));
    if (!(o.noTanggapan || o.tglTanggapan)) return tl;
    // Baris tanggapan: tanggal & nomor dari kolomnya, uraian dari kolom Tindak Lanjut (bila ada).
    const utama = tl.shift() || { uraian: 'Surat tanggapan perusahaan' + (o.noTanggapan ? ' No. ' + teks(o.noTanggapan) : '') };
    return [Object.assign(utama, { tgl: tglExcel(o.tglTanggapan), noSurat: teks(o.noTanggapan) }), ...tl];
  }

  /** rows (array baris dari satu lembar) -> {catatan, header, dilewati, adaNilai}.
      hanyaSomasi: pada lembar TANPA kolom nilai (register surat campuran), hanya baris yang memuat kata "somasi". */
  function dariTabel(rows, sumber, hanyaSomasi) {
    const h = petakanHeader(rows);
    if (!h) return { catatan: [], header: null, dilewati: 0, adaNilai: false };
    const adaNilai = Object.values(h.peta).some(k => k === 'nilaiTuntutan' || k === 'saldo');
    const saring = hanyaSomasi && !adaNilai;
    const out = []; let dilewati = 0;
    for (const row of rows.slice(h.baris + 1)) {
      const isi = (row || []).map(teks);
      const adaNama = Object.entries(h.peta).some(([j, k]) => (k === 'rekanan' || k === 'asalSurat') && isi[j]);
      if (!adaNama || (saring && !/somasi/i.test(isi.join(' ')))) { dilewati++; continue; }
      out.push(barisKeCatatan(row, h.peta, sumber));
    }
    return { catatan: out, header: h, dilewati, adaNilai };
  }

  /** Kunci pencocokan nama: tanpa bentuk badan usaha & tanda baca. */
  function kunciNama(s) {
    return teks(s).toLowerCase().replace(/\b(pt|cv|tbk|persero|ud|toko)\b\.?/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function samaNama(a, b) {
    const x = kunciNama(a), y = kunciNama(b);
    return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))));
  }
  /** Nama pihak penagih (rekanan; bila kosong, pengirim) dicocokkan dengan rekanan ATAU pengirim catatan lama. */
  const cocokNama = (x, r) => samaNama(x.rekanan, r.rekanan || r.asalSurat) || samaNama(x.asalSurat, r.rekanan || r.asalSurat);
  /** Tidak bertentangan. Proyek keduanya terisi & beda = utang lain (perkara terpisah). Bila proyek kosong di salah satu:
      nilai sama/kosong, atau tingkat sama. */
  const kompatibel = (x, r) => (x.proyek && r.proyek) ? samaNama(x.proyek, r.proyek)
    : (!x.nilaiTuntutan || !r.nilaiTuntutan || x.nilaiTuntutan === r.nilaiTuntutan || x.tingkat === r.tingkat);
  /** Semua calon pasangan: nomor agenda sama; bila tidak ada, nama cocok & tidak bertentangan. */
  function calonPasangan(daftar, r) {
    if (r.noAgenda) { const m = daftar.filter(x => x.noAgenda && x.noAgenda === r.noAgenda); if (m.length) return m; }
    return daftar.filter(x => cocokNama(x, r) && kompatibel(x, r));
  }
  /** Pasangan tunggal atau null. Calon ganda = ragu: TIDAK digabung otomatis (data krusial; salah gabung lebih berbahaya dari duplikat). */
  function cariPasangan(daftar, r) {
    const c = calonPasangan(daftar, r);
    return c.length === 1 ? c[0] : null;
  }
  /** Perbedaan isian yang sama-sama terisi tetapi berbeda (tidak ditimpa; ditampilkan untuk diputuskan manusia). */
  function selisih(lama, baru) {
    const out = [];
    for (const k of ['nilaiTuntutan', 'saldo', 'dibayar']) if (lama[k] && baru[k] && Math.round(lama[k]) !== Math.round(baru[k])) out.push(`${k} ${rupiah(lama[k])} ≠ ${rupiah(baru[k])}`);
    if (lama.status !== baru.status && baru.status === SELESAI) out.push(`sumber menyatakan LUNAS/selesai (status saat ini ${lama.status})`);
    return out;
  }
  /** Gabung aman: hanya mengisi kolom yang kosong; tidak pernah menimpa isian yang sudah ada. -> daftar kolom yang terisi */
  const KOLOM_ISI = ['noAgenda', 'noSurat', 'tglSurat', 'tglTerima', 'tenggat', 'asalSurat', 'rekanan', 'proyek', 'perihal', 'disposisi', 'pic', 'ket', 'sumber', 'nilaiTuntutan', 'saldo', 'dibayar'];
  function isiKolomKosong(lama, baru, diisi) {
    for (const k of KOLOM_ISI) if (!lama[k] && baru[k]) { lama[k] = baru[k]; diisi.push(k); }
    if (lama.tingkat === 'Lainnya' && baru.tingkat !== 'Lainnya') { lama.tingkat = baru.tingkat; diisi.push('tingkat'); }
  }
  function gabungRiwayat(lama, baru, diisi) {
    const ada = new Set(lama.tindakLanjut.map(t => t.uraian.toLowerCase()));
    const tlBaru = baru.tindakLanjut.filter(t => !ada.has(t.uraian.toLowerCase()));
    if (tlBaru.length) { lama.tindakLanjut.push(...tlBaru); diisi.push('tindakLanjut'); }
    const tingkatLama = lama.tingkat;
    if (gabungSurat(lama, baru.surat || [])) diisi.push(lama.tingkat !== tingkatLama ? 'surat lanjutan (tingkat naik)' : 'surat lanjutan');
    if (baru.verifikasi && !(lama.verifikasi || '').includes(baru.verifikasi)) { tambahVerifikasi(lama, baru.verifikasi); diisi.push('verifikasi'); }
    if (gabungRincian(lama, baru.rincian)) diisi.push('rincian sumber');
  }
  /** Tambah baris rincian sumber yang belum ada (tanpa ganda). -> jumlah baris baru */
  function gabungRincian(lama, daftar) {
    const adaR = new Set((lama.rincian = lama.rincian || []).map(kunciRincian));
    const rBaru = (daftar || []).filter(x => !adaR.has(kunciRincian(x))).slice(0, Math.max(0, 2000 - lama.rincian.length));
    lama.rincian.push(...rBaru);
    return rBaru.length;
  }
  /** Gabung aman: hanya mengisi kolom yang kosong (tidak menimpa), menambah tindak lanjut & surat lanjutan. -> daftar perubahan */
  function isiKosong(lama, baru) {
    const diisi = [];
    isiKolomKosong(lama, baru, diisi);
    gabungRiwayat(lama, baru, diisi);
    return diisi;
  }

  /** CSV (pemisah ;) untuk Excel: kolom sesuai tabel daftar. Sel yang diawali = + - @ diberi petik (CSV injection, OWASP). */
  function keCSV(daftar) {
    const kol = ['noAgenda', 'noSurat', 'tglSurat', 'tglTerima', 'tenggat', 'asalSurat', 'rekanan', 'proyek', 'perihal', 'tingkat', 'nilaiTuntutan', 'dibayar', 'saldo', 'status', 'disposisi', 'pic', 'posisi', 'verifikasi', 'ket'];
    const sel = v => { let s = teks(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const baris = [kol.join(';')].concat(daftar.map(r => kol.map(k => k === 'saldo' ? saldoTerbuka(r) : r[k]).map(sel).join(';')));
    return '﻿' + baris.join('\r\n');
  }

  return Object.freeze({ STATUS, TINGKAT, DISPOSISI, POSISI, SELESAI, normal, angka, tglSah, hariIni, selisihHari, idBaru, saldoTerbuka, aktif,
    lewatTenggat, risiko, dampakOtomatis, kemungkinanOtomatis, ringkasan, narasi, rekomendasi, tglPanjang, rupiah, ringkas, persen,
    petakanHeader, dariTabel, tebakTingkat, tglExcel, tglTeks, kunciNama, samaNama, calonPasangan, cariPasangan, selisih, isiKosong, keCSV, gabungSurat, tambahVerifikasi, peringkat, samarkan });
})();
