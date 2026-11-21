/* Pembaca .xlsx minimal tanpa pustaka pihak ketiga: ZIP (direktori pusat) + DecompressionStream('deflate-raw') +
   DOMParser untuk sharedStrings & lembar kerja. Hanya membaca nilai sel (teks, angka); rumus dibaca dari nilai tersimpannya.
   Batas ukuran mencegah zip bomb: berkas <= 15 MB, tiap bagian terurai <= 40 MB. */
'use strict';
window.XLSX_MINI = (function () {
  const MAKS_BERKAS = 15 * 1024 * 1024, MAKS_URAI = 40 * 1024 * 1024, MAKS_TOTAL = 100 * 1024 * 1024;

  function u16(d, o) { return d[o] | (d[o + 1] << 8); }
  function u32(d, o) { return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0; }

  function direktori(d) {
    let e = -1;
    for (let i = d.length - 22; i >= Math.max(0, d.length - 65557); i--) if (u32(d, i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('Bukan berkas Excel (.xlsx) yang sah.');
    const n = u16(d, e + 10); let p = u32(d, e + 16);
    const isi = new Map(), td = new TextDecoder();
    for (let i = 0; i < n; i++) {
      if (u32(d, p) !== 0x02014b50) throw new Error('Struktur berkas Excel rusak.');
      const metode = u16(d, p + 10), ukZip = u32(d, p + 20), ukAsli = u32(d, p + 24);
      const pn = u16(d, p + 28), pe = u16(d, p + 30), pk = u16(d, p + 32), lokal = u32(d, p + 42);
      isi.set(td.decode(d.subarray(p + 46, p + 46 + pn)), { metode, ukZip, ukAsli, lokal });
      p += 46 + pn + pe + pk;
    }
    return isi;
  }

  const total = { n: 0 };
  async function urai(d, ent) {
    if (ent.ukAsli > MAKS_URAI) throw new Error('Bagian berkas Excel terlalu besar.');
    const awal = ent.lokal + 30 + u16(d, ent.lokal + 26) + u16(d, ent.lokal + 28);
    const potong = d.subarray(awal, awal + ent.ukZip);
    if (ent.metode === 0) return potong;
    if (ent.metode !== 8) throw new Error('Metode kompresi Excel tidak didukung.');
    // Dibaca bertahap dengan hitungan berjalan: berhenti begitu melewati batas (ukuran di header ZIP tidak dipercaya).
    const pembaca = new Blob([potong]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const bagian = []; let n = 0;
    for (;;) {
      const { done, value } = await pembaca.read();
      if (done) break;
      n += value.length; total.n += value.length;
      if (n > MAKS_URAI || total.n > MAKS_TOTAL) { await pembaca.cancel(); throw new Error('Isi berkas Excel terlalu besar (kemungkinan zip bomb).'); }
      bagian.push(value);
    }
    const buf = new Uint8Array(n); let o = 0;
    for (const b of bagian) { buf.set(b, o); o += b.length; }
    return buf;
  }

  async function xml(d, dir, nama) {
    const ent = dir.get(nama);
    if (!ent) return null;
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(await urai(d, ent)), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML di dalam berkas Excel rusak.');
    return doc;
  }
  const teksSI = si => Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join('');

  function kolom(ref) {
    let n = 0;
    for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }
  function nilaiSel(c, ss) {
    const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
    if (t === 'inlineStr') { const is = c.getElementsByTagName('is')[0]; return is ? teksSI(is) : ''; }
    if (!v) return '';
    if (t === 's') return ss[Number(v.textContent)] || '';
    if (t === 'str' || t === 'e') return v.textContent;
    if (t === 'b') return v.textContent === '1';
    const n = Number(v.textContent);
    return Number.isFinite(n) ? n : v.textContent;
  }
  function lembarKeBaris(doc, ss) {
    const rows = [];
    for (const r of Array.from(doc.getElementsByTagName('row'))) {
      const i = Number(r.getAttribute('r')) - 1;
      if (!(i >= 0 && i < 100000)) continue;
      const baris = [];
      for (const c of Array.from(r.getElementsByTagName('c'))) {
        const j = kolom(c.getAttribute('r') || 'A1');
        if (j >= 0 && j < 200) baris[j] = nilaiSel(c, ss);
      }
      rows[i] = Array.from(baris, x => (x === undefined ? '' : x));
    }
    return Array.from(rows, x => x || []);
  }

  /** ArrayBuffer -> [{nama, rows}] */
  async function baca(buf) {
    if (buf.byteLength > MAKS_BERKAS) throw new Error('Berkas Excel lebih dari 15 MB.');
    const d = new Uint8Array(buf), dir = direktori(d);
    total.n = 0;
    const sst = await xml(d, dir, 'xl/sharedStrings.xml');
    const ss = sst ? Array.from(sst.getElementsByTagName('si')).map(teksSI) : [];
    const wb = await xml(d, dir, 'xl/workbook.xml'), rel = await xml(d, dir, 'xl/_rels/workbook.xml.rels');
    if (!wb || !rel) throw new Error('Berkas Excel tidak lengkap.');
    const target = new Map(Array.from(rel.getElementsByTagName('Relationship')).map(x => [x.getAttribute('Id'), x.getAttribute('Target')]));
    const hasil = [];
    for (const s of Array.from(wb.getElementsByTagName('sheet'))) {
      const t = jalurLembar(s, target);
      const doc = t ? await xml(d, dir, t) : null;
      if (doc) hasil.push({ nama: s.getAttribute('name') || t, rows: lembarKeBaris(doc, ss) });
    }
    return hasil;
  }
  /** Jalur XML lembar dari relasi workbook; hanya xl/worksheets/*.xml yang diterima. */
  function jalurLembar(s, target) {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const t = String(target.get(rid) || '').replace(/^\/?xl\//, '').replace(/^\//, '');
    return /^worksheets\/[\w.-]+\.xml$/.test(t) ? 'xl/' + t : '';
  }
  return Object.freeze({ baca, kolom });
})();
