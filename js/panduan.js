/* Menu Panduan: satu bagian per fitur. Tiap halaman punya tombol "Panduan" di bilah atas yang langsung membuka
   bagian fitur itu (#panduan/<halaman>). Isi umum (tanpa identitas organisasi) karena ikut situs publik. */
'use strict';
window.PANDUAN = (function () {
  const B = [
    ['masuk', 'Masuk ke aplikasi', `<ol>
      <li>Versi online: klik <b>Masuk dengan Google</b> dan pilih akun yang sudah didaftarkan admin. Jendela tidak muncul? Izinkan pop-up untuk situs ini.</li>
      <li>Isi <b>nama Anda</b> (tercatat di jejak audit) dan <b>kata sandi brankas</b> dari admin, lalu klik <b>Buka</b>.</li>
      <li>Aplikasi terkunci otomatis bila tidak dipakai (bawaan 10 menit) dan saat jendela ditutup. Klik <b>Kunci sekarang</b> bila meninggalkan meja.</li></ol>`],
    ['ringkasan', 'Ringkasan Eksekutif', `<p>Halaman pertama setelah masuk. Semua angka dihitung langsung dari data.</p><ul>
      <li><b>Kotak indikator</b>: somasi aktif, saldo terbuka, total tuntutan, telah dibayar, tingkat II/terakhir, lewat tenggat, risiko tinggi.</li>
      <li><b>Ringkasan eksekutif</b>: kalimat siap kutip untuk manajemen.</li>
      <li><b>Prioritas penanganan</b>: somasi aktif dengan risiko tertinggi; klik nama rekanan untuk detail.</li>
      <li><b>Rekomendasi</b>: tindak lanjut menurut aturan pemantauan dan pedoman internal tanggapan somasi.</li></ul>`],
    ['grafik', 'Grafik & Risiko', `<ul>
      <li>Somasi masuk per bulan, saldo per tingkat/status/proyek/disposisi.</li>
      <li><b>Matriks risiko 5×5</b>: risiko = kemungkinan eskalasi × dampak. Dampak dari saldo terbuka (1: &lt; Rp 250 Jt sampai 5: ≥ Rp 5 M); kemungkinan dari tingkat somasi, +1 bila tenggat terlewati.</li>
      <li>Skor 10–14 = tinggi, 15–25 = sangat tinggi. Nilai otomatis dapat diganti manual di formulir somasi.</li></ul>`],
    ['daftar', 'Daftar Somasi', `<ul>
      <li><b>Cari & saring</b> per status, tingkat, proyek; klik judul kolom untuk mengurutkan.</li>
      <li><b>＋ Somasi baru</b>: isi rekanan, proyek, tingkat, nomor/tanggal surat, tenggat, nilai, lalu Simpan.</li>
      <li><b>Tindak lanjut</b>: klik nama rekanan › <b>Ubah / tambah tindak lanjut</b>; riwayat tampil sebagai linimasa.</li>
      <li><b>Status Selesai</b> membuat saldo terbuka nol. <b>Hapus</b> wajib disertai alasan (tercatat di jejak audit).</li>
      <li><b>Unduh CSV</b> untuk Excel. Berkas CSV tidak terenkripsi: simpan di lokasi aman.</li></ul>`],
    ['lokasi', 'Lokasi Tagihan', `<ul>
      <li><b>Isi data</b>: unduh/ekspor lembar register lokasi tagihan ke .xlsx, lalu buka <b>Impor Excel</b>. Kolom dikenali dari judulnya (Tanggal masuk, Berkas, No Reg, Rekanan, Proyek, Tanggal, Status, KET, PIC, KET kedua = alasan, Nilai).</li>
      <li><b>Impor ulang</b> aman: data yang sama tidak digandakan; bila tanggal status di sumber lebih baru, lokasi/status diperbarui dan posisi lama disimpan di <b>Riwayat perubahan</b>.</li>
      <li><b>Saring</b> per lokasi, status, PIC, berkas, proyek, atau <b>Hanya dokumen belum lengkap</b> (dibaca dari kata kunci di kolom alasan, mis. TTD vendor, kuitansi asli, faktur pajak, nota).</li>
      <li><b>Umur</b> dihitung otomatis: hari sejak berkas masuk dan hari sejak status terakhir.</li>
      <li>Klik No Reg untuk detail, <b>Ubah</b> (isi alasan perubahan) atau <b>Hapus</b> (alasan wajib). Semua perubahan tercatat di jejak audit.</li></ul>`],
    ['jampel', 'Jaminan Pelaksanaan (Jampel)', `<ul>
      <li><b>Isi data</b>: unduh tiap lembar BOX ke .xlsx lalu <b>Impor Excel</b> (boleh beberapa lembar sekaligus). Judul kolom boleh di baris kedua. Nama lembar BOX disimpan sebagai lokasi fisik.</li>
      <li><b>Sisa waktu</b> selalu dihitung dari tanggal berakhir terhadap hari ini, tidak disalin dari sumber.</li>
      <li><b>Pengingat</b> 60, 30, dan 7 hari sebelum berakhir tampil di menu ini dan di <b>Ringkasan Eksekutif</b>. Jaminan yang sudah lewat tetapi masih berstatus Aktif ditandai merah.</li>
      <li><b>Status</b>: Aktif, Diperpanjang, Diklaim/Dicairkan, Dikembalikan, Expired. Ubah lewat <b>Ubah</b> dan isi alasannya.</li>
      <li><b>Pengambilan dokumen asli</b>: catat tanggal, siapa, dan uraian di formulir Ubah; log tampil di detail.</li>
      <li>Ketentuan jaminan mengacu pada Perpres 16/2018 jo. 12/2021 dan pedoman SCM internal. Nilai/ambang tidak ditetapkan aplikasi; cek di sumber resmi yang berlaku.</li></ul>`],
    ['ocr', 'Impor Scan (OCR) & upload massal', `<ol>
      <li>Seret-lepas berkas ke kotak upload, klik <b>Pilih dari perangkat</b>, atau <b>Pilih dari Google Drive</b> (versi online). Boleh banyak sekaligus: maks. 25 berkas, 25 MB per berkas (PDF, JPG, PNG).</li>
      <li>Berkas masuk <b>Antrean upload</b> dan dibaca otomatis satu per satu. Lewat pintasan laptop dipakai 3 mesin OCR (paling akurat); lewat web dipakai OCR peramban.</li>
      <li>Dokumen tampil di kiri, isian di kanan. Label <b>“Mesin berbeda — WAJIB periksa”</b> berarti hasil tidak sepakat: pilih/ketik nilai yang benar. Cocokkan angka rupiah dengan terbilang di surat.</li>
      <li>Centang <b>“Saya sudah mencocokkan setiap isian”</b> lalu <b>Simpan</b>; berkas berikutnya langsung muncul. <b>Batal</b> melewati berkas itu.</li></ol>
      <p class="bantu">Dokumen tidak dikirim ke server. Antrean dikosongkan otomatis saat aplikasi dikunci.</p>`],
    ['impor', 'Impor Excel & cadangan', `<ol>
      <li>Seret-lepas atau pilih berkas .xlsx dari perangkat, atau <b>Pilih dari Google Drive</b> (Google Sheets otomatis diubah ke .xlsx). Banyak berkas digabung dalam satu pratinjau.</li>
      <li>Periksa label pratinjau: <b>Baru</b>, <b>Lengkapi</b> (mengisi kolom kosong), <b>Selisih</b> (nilai berbeda, tidak ditimpa, dicatat di keterangan), <b>Mirip N data</b> (tidak digabung otomatis).</li>
      <li>Klik <b>Terapkan</b>. Data yang sudah ada tidak pernah ditimpa.</li></ol>
      <p><b>Cadangan:</b> klik <b>Unduh cadangan</b> berkala (tetap terenkripsi). <b>Pulihkan cadangan</b> mengganti seluruh data; gunakan hanya bila diminta admin.</p>`],
    ['laporan', 'Laporan Manajemen', `<ol>
      <li>Klik <b>Cetak / simpan PDF</b>, pilih <b>Simpan sebagai PDF</b>, ukuran A4, centang <b>Grafik latar</b> (background graphics).</li>
      <li>Isi: indikator, ringkasan eksekutif, rekomendasi, grafik & matriks risiko, Lampiran A (somasi aktif), Lampiran B (dasar penilaian). Setiap halaman berlabel RAHASIA dan bernomor.</li></ol>
      <p class="bantu">Nama unit pelapor diatur di Pengaturan. Kirim PDF hanya lewat jalur resmi.</p>`],
    ['tata-kelola', 'Tata Kelola & Jejak Audit', `<p>Setiap perubahan tercatat (siapa, kapan, apa, alasan hapus) dan dikunci berantai SHA-256. Label <b>“Rantai utuh”</b> berarti riwayat tidak diubah; <b>“RANTAI RUSAK”</b> harus segera dilaporkan ke admin.</p>`],
    ['pengaturan', 'Pengaturan (admin)', `<ul>
      <li><b>Unit pelapor</b> (sampul laporan) dan <b>kunci otomatis</b> (5–30 menit).</li>
      <li><b>Identitas organisasi</b>: nama perusahaan, teks logo, tagline, nama pedoman; tersimpan terenkripsi.</li>
      <li><b>Ganti kata sandi brankas</b>; sampaikan sandi baru langsung ke anggota. Cadangan lama tetap terbuka dengan sandi lama.</li>
      <li><b>Anggota baru</b>: admin menambah email Google anggota di Firestore (koleksi <code>anggota_email</code>), lalu menyampaikan kata sandi brankas. Mencabut: hapus dokumennya dan ganti kata sandi.</li></ul>`],
    ['keamanan', 'Aturan keamanan', `<ul>
      <li>Kata sandi brankas hanya disampaikan langsung/telepon, tidak lewat email atau chat; jangan simpan di peramban.</li>
      <li>Kunci aplikasi saat meninggalkan perangkat; jangan memakai komputer umum.</li>
      <li>Jangan memotret layar atau meneruskan PDF/CSV di luar jalur resmi.</li>
      <li>Laporkan peringatan “versi data lebih lama” atau “RANTAI RUSAK”.</li></ul>`],
    ['masalah', 'Masalah umum', `<div class="tabel-bungkus"><table><thead><tr><th>Masalah</th><th>Solusi</th></tr></thead><tbody>
      <tr><td>Jendela Google tidak muncul</td><td>Izinkan pop-up untuk situs ini, klik lagi; cek jendela di taskbar.</td></tr>
      <tr><td>“Belum terdaftar sebagai anggota”</td><td>Minta admin mendaftarkan email Anda.</td></tr>
      <tr><td>“Kata sandi brankas salah”</td><td>Tanyakan sandi terbaru ke admin.</td></tr>
      <tr><td>“Data di server sudah berubah”</td><td>Catat perubahan Anda, Kunci, buka ulang, ulangi.</td></tr>
      <tr><td>Banyak label “WAJIB periksa” di OCR</td><td>Scan ulang lurus 300 dpi, atau pakai pintasan laptop.</td></tr>
      <tr><td>Tampilan lama setelah pembaruan</td><td>Tekan Ctrl+Shift+R.</td></tr></tbody></table></div>`],
  ];
  const ID_SAH = new Set(B.map(b => b[0]));

  function halaman() {
    const isi = B.map(([id, judul]) => `<li><a href="#panduan/${id}">${judul}</a></li>`).join('');
    return `<section class="kartu"><h2 class="judul-orn">Panduan penggunaan</h2><p>Pilih fitur, atau klik tombol <b>? Panduan</b> di bilah atas pada setiap halaman untuk langsung ke bagiannya.</p>
      <nav aria-label="Daftar isi panduan"><ul class="daftar-panduan">${isi}</ul></nav></section>
      ${B.map(([id, judul, html]) => `<section class="kartu panduan" id="pd-${id}" tabindex="-1"><h2>${judul}</h2>${html}<p class="tanpa-cetak">${FITUR.has(id) ? `<a href="#${id}">Buka fitur ini</a> · ` : ''}<a href="#panduan">Daftar isi</a></p></section>`).join('')}`;
  }
  const FITUR = new Set(['ringkasan', 'grafik', 'daftar', 'ocr', 'impor', 'laporan', 'tata-kelola', 'pengaturan']);
  /** Bagian panduan untuk halaman tertentu (bila ada). */
  const bagianUntuk = hal => (ID_SAH.has(hal) ? hal : '');
  return Object.freeze({ halaman, bagianUntuk, ID_SAH });
})();
