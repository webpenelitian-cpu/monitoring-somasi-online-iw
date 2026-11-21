/* Pembacaan isi surat somasi dari teks hasil OCR, plus pemungutan suara antar-mesin OCR.
   Prinsip data krusial: setiap isian diberi status keyakinan; nilai uang dicocokkan dengan "terbilang" bila ada;
   tidak ada isian yang disimpan tanpa diperiksa manusia (lihat app.js, layar Verifikasi OCR). */
'use strict';
window.EKSTRAK = (function () {
  const D = window.DATA;
  const SATUAN = { nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11 };
  const BESAR = { ribu: 1e3, juta: 1e6, miliar: 1e9, milyar: 1e9, triliun: 1e12, trilyun: 1e12 };

  /** "satu miliar dua ratus tiga puluh juta ... rupiah" -> 1230000000 (null bila tidak terbaca). */
  function terbilang(t) {
    const kata = String(t || '').toLowerCase().replace(/(se)(ratus|puluh|belas|ribu)/g, 'satu $2').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
    const s = { total: 0, kelompok: 0, cur: 0, ada: false };
    for (const k of kata) if (!langkahTerbilang(s, k)) break;
    const n = s.total + s.kelompok + s.cur;
    return s.ada && n > 0 ? n : null;
  }
  /** Satu kata terbilang; false = kata bukan bilangan setelah bilangan dimulai (berhenti). */
  function langkahTerbilang(s, k) {
    if (k in SATUAN) { s.cur += SATUAN[k]; s.ada = true; return true; }
    if (k === 'belas') { s.cur += 10; return true; }
    if (k === 'puluh') { s.cur *= 10; return true; }
    if (k === 'ratus') { s.kelompok += s.cur * 100; s.cur = 0; return true; }
    if (k in BESAR) { s.total += (s.kelompok + s.cur) * BESAR[k]; s.kelompok = 0; s.cur = 0; return true; }
    return !s.ada || ['rupiah', 'koma', 'sen'].includes(k);
  }

  const RE_RP = /rp\.?\s*([0-9][0-9.,\s]{2,})/gi;
  function semuaNilai(teks) {
    const out = [];
    for (const m of String(teks).matchAll(RE_RP)) {
      const n = D.angka(m[1].replace(/\s+/g, '').replace(/[.,]-?$/, ''));
      if (n >= 1000) out.push({ n, i: m.index });
    }
    return out;
  }
  /** Nilai tuntutan: Rp yang diikuti terbilang yang cocok (paling kuat), jika tidak ada maka Rp terbesar. */
  function nilai(teks) {
    const t = String(teks), daftar = semuaNilai(t);
    for (const x of daftar) {
      const sesudah = t.slice(x.i, x.i + 400), m = /\(\s*([a-z\s]+rupiah)/i.exec(sesudah) || /terbilang\s*:?\s*([a-z\s]+rupiah)/i.exec(sesudah);
      const tb = m ? terbilang(m[1]) : null;
      if (tb !== null && Math.abs(tb - x.n) < 1) return { nilai: x.n, terbilangCocok: true };
    }
    if (!daftar.length) return { nilai: 0, terbilangCocok: false };
    return { nilai: Math.max(...daftar.map(x => x.n)), terbilangCocok: false };
  }

  const ambil = (re, t, i) => { const m = re.exec(t); return m ? m[i || 1].replace(/\s+/g, ' ').trim() : ''; };
  /** Bulan Romawi di nomor surat sering terbaca 1/l/| oleh OCR (VIII -> V111): segmen yang hanya berisi I V X 1 l | dirapikan. */
  const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  function rapikanNomor(s) {
    return s.replace(/\s+/g, '').split('/').map(seg => {
      if (!/^[IVXl1|]{1,4}$/.test(seg) || !/[IVX]/.test(seg)) return seg;
      const r = seg.replace(/[1l|]/g, 'I');
      return ROMAWI.includes(r) ? r : seg;
    }).join('/');
  }
  function nomorSurat(t) { return rapikanNomor(ambil(/\b(?:nomor|no)\s*\.?\s*:\s*([A-Za-z0-9][A-Za-z0-9./\-\s]{3,60}?)(?:\n|\s{2,}|lampiran|perihal|hal\b)/i, t)); }
  function perihal(t) { return ambil(/\b(?:perihal|hal)\s*:\s*([^\n]{3,160})/i, t); }
  function tanggal(t) {
    const m = /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i.exec(t);
    return m ? D.tglTeks(`${m[1]} ${m[2].slice(0, 3)} ${m[3]}`) : D.tglTeks(t);
  }
  function rekanan(t) {
    const kuasa = ambil(/kuasa\s+(?:hukum\s+)?(?:dari|untuk)\s+((?:PT|CV)\.?\s+[A-Z][A-Za-z0-9.&\s]{2,60}?)(?:[,(\n]|\s+berdasarkan|\s+yang)/i, t);
    if (kuasa) return kuasa;
    const sendiri = D.kunciNama((window.IDENTITAS_AKTIF || window.IDENTITAS || {}).perusahaan || '').split(' ')[0] || '\u0000';
    for (const m of String(t).matchAll(/\b((?:PT|CV)\.?\s+[A-Z][A-Za-z0-9.&]*(?:\s+[A-Z][A-Za-z0-9.&]*){0,5})/g)) {
      if (!D.kunciNama(m[1]).startsWith(sendiri)) return m[1].replace(/\s+/g, ' ').trim();
    }
    return '';
  }
  function proyek(t) { return ambil(/\bproyek\s+([A-Z][^\n,.;]{3,100}?)(?=\s+(?:sebesar|senilai|dengan|yang|sejumlah|berdasarkan|dan)\b|[\n,.;]|$)/i, t); }
  function tenggatHari(t) { const m = /(?:dalam\s+(?:jangka\s+)?waktu|selambat-?lambatnya)\s+(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?hari/i.exec(t); return m ? Number(m[1]) : 0; }

  /** Satu teks -> isian. */
  function bacaSurat(teks) {
    const t = String(teks || '');
    const nv = nilai(t);
    return { noSurat: nomorSurat(t), tglSurat: tanggal(t), perihal: perihal(t), rekanan: rekanan(t), proyek: proyek(t),
      tingkat: D.tebakTingkat(perihal(t) || t.slice(0, 3000)), nilaiTuntutan: nv.nilai, terbilangCocok: nv.terbilangCocok, tenggatHari: tenggatHari(t) };
  }

  const KOLOM = ['noSurat', 'tglSurat', 'perihal', 'rekanan', 'proyek', 'tingkat', 'nilaiTuntutan', 'tenggatHari'];
  const kunciBanding = v => typeof v === 'number' ? String(Math.round(v)) : String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  /** Pemungutan suara antar-mesin: [{mesin, teks}] -> {isian, status per kolom, calon per kolom}.
      status: 'sepakat' (>=2 mesin sama, atau satu-satunya mesin + terbilang cocok), 'tunggal', 'beda', 'kosong'. */
  function pungutSuara(hasilMesin) {
    const baca = hasilMesin.map(h => ({ mesin: h.mesin, isi: bacaSurat(h.teks) }));
    const isian = {}, status = {}, calon = {};
    for (const k of KOLOM) {
      const urut = hitungSuara(baca, k);
      calon[k] = urut;
      isian[k] = urut.length ? urut[0].nilai : (k === 'nilaiTuntutan' || k === 'tenggatHari' ? 0 : '');
      status[k] = statusKolom(urut, baca.length);
    }
    const cocokTb = baca.some(b => b.isi.terbilangCocok && b.isi.nilaiTuntutan === isian.nilaiTuntutan);
    if (cocokTb && status.nilaiTuntutan !== 'beda') status.nilaiTuntutan = 'sepakat';
    return { isian, status, calon, terbilangCocok: cocokTb, mesin: baca.map(b => b.mesin) };
  }
  function hitungSuara(baca, k) {
    const suara = new Map();
    for (const b of baca) {
      const v = b.isi[k];
      if (!v || (k === 'tingkat' && v === 'Lainnya')) continue;
      const kk = kunciBanding(v), s = suara.get(kk) || { nilai: v, mesin: [] };
      s.mesin.push(b.mesin); suara.set(kk, s);
    }
    return Array.from(suara.values()).sort((a, b) => b.mesin.length - a.mesin.length);
  }
  function statusKolom(urut, nMesin) {
    if (!urut.length) return 'kosong';
    if (urut.length > 1 && urut[0].mesin.length === urut[1].mesin.length) return 'beda';
    if (urut[0].mesin.length >= 2) return urut.length > 1 ? 'mayoritas' : 'sepakat';
    return nMesin > 1 && urut.length > 1 ? 'beda' : 'tunggal';
  }

  return Object.freeze({ terbilang, nilai, bacaSurat, pungutSuara, KOLOM });
})();
