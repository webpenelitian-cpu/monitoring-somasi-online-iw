/* Grafik SVG tanpa pustaka (dibangun dengan createElementNS, tanpa innerHTML). Warna dari token CSS tema.
   Setiap grafik punya role="img" + judul + deskripsi, dan angka tertulis langsung di grafik (tidak hanya warna). */
'use strict';
window.GRAFIK = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, atr, anak) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(atr || {})) e.setAttribute(k, v);
    for (const a of [].concat(anak || [])) e.append(a instanceof Node ? a : document.createTextNode(String(a)));
    return e;
  }
  let nomor = 0;
  function kanvas(lebar, tinggi, judul, desk) {
    const id = 'g' + (++nomor);
    const svg = el('svg', { viewBox: `0 0 ${lebar} ${tinggi}`, role: 'img', 'aria-labelledby': `${id}t ${id}d`, class: 'grafik', preserveAspectRatio: 'xMidYMid meet' });
    svg.append(el('title', { id: id + 't' }, judul), el('desc', { id: id + 'd' }, desk));
    return svg;
  }
  const potong = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  /** Batang mendatar: data [{label, nilai, ket}] */
  function batang(data, o) {
    o = Object.assign({ judul: '', format: String, lebar: 640, kelas: 'seri-1', label: 28 }, o);
    const baris = 30, tinggi = Math.max(60, data.length * baris + 10), kiri = 210, kanan = 150;
    const maks = Math.max(1, ...data.map(d => d.nilai));
    const svg = kanvas(o.lebar, tinggi, o.judul, data.map(d => `${d.label}: ${o.format(d.nilai)}`).join('; ') || 'Tidak ada data');
    if (!data.length) { svg.append(el('text', { x: 10, y: 34, class: 'g-teks' }, 'Belum ada data')); return svg; }
    data.forEach((d, i) => {
      const y = 6 + i * baris, w = Math.max(2, (o.lebar - kiri - kanan) * d.nilai / maks);
      svg.append(el('text', { x: kiri - 8, y: y + 17, class: 'g-teks', 'text-anchor': 'end' }, [el('title', {}, d.label), potong(d.label, o.label)]));
      svg.append(el('rect', { x: kiri, y: y + 3, width: w, height: 20, rx: 3, class: o.kelas }));
      svg.append(el('text', { x: kiri + w + 6, y: y + 17, class: 'g-teks g-nilai' }, o.format(d.nilai) + (d.ket ? ` · ${d.ket}` : '')));
    });
    return svg;
  }

  /** Cincin dua bagian: dibayar vs saldo. */
  function cincin(bagian, o) {
    o = Object.assign({ judul: '', format: String }, o);
    const total = bagian.reduce((s, b) => s + b.nilai, 0), svg = kanvas(360, 220, o.judul, bagian.map(b => `${b.label}: ${o.format(b.nilai)}`).join('; '));
    const cx = 110, cy = 110, r = 80, tebal = 30;
    let sudut = -Math.PI / 2;
    svg.append(el('circle', { cx, cy, r, class: 'g-latar', fill: 'none', 'stroke-width': tebal }));
    bagian.forEach((b, i) => {
      if (!total || !b.nilai) return;
      const porsi = b.nilai / total, akhir = sudut + porsi * 2 * Math.PI, besar = porsi > 0.5 ? 1 : 0;
      const p = porsi >= 0.9999 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
        : `M ${cx + r * Math.cos(sudut)} ${cy + r * Math.sin(sudut)} A ${r} ${r} 0 ${besar} 1 ${cx + r * Math.cos(akhir)} ${cy + r * Math.sin(akhir)}`;
      svg.append(el('path', { d: p, fill: 'none', 'stroke-width': tebal, class: 'seri-' + (i + 1) + '-garis' }));
      sudut = akhir;
    });
    const utama = bagian[0];
    svg.append(el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', class: 'g-besar' }, total ? Math.round(100 * utama.nilai / total) + '%' : '0%'));
    svg.append(el('text', { x: cx, y: cy + 18, 'text-anchor': 'middle', class: 'g-teks' }, utama.label.toLowerCase()));
    bagian.forEach((b, i) => {
      const y = 70 + i * 52;
      svg.append(el('rect', { x: 220, y: y - 11, width: 12, height: 12, rx: 2, class: 'seri-' + (i + 1) }));
      svg.append(el('text', { x: 238, y, class: 'g-teks' }, b.label));
      svg.append(el('text', { x: 238, y: y + 18, class: 'g-teks g-nilai' }, o.format(b.nilai)));
    });
    return svg;
  }

  /** Kolom tegak per bulan. */
  function kolom(data, o) {
    o = Object.assign({ judul: '' }, o);
    const lebar = 640, tinggi = 220, bawah = 40, atas = 20, maks = Math.max(1, ...data.map(d => d.n));
    const svg = kanvas(lebar, tinggi, o.judul, data.map(d => `${d.label}: ${d.n}`).join('; ') || 'Tidak ada data');
    if (!data.length) { svg.append(el('text', { x: 10, y: 34, class: 'g-teks' }, 'Belum ada tanggal surat')); return svg; }
    const langkah = (lebar - 40) / data.length, w = Math.min(46, langkah * 0.6);
    svg.append(el('line', { x1: 20, x2: lebar - 20, y1: tinggi - bawah, y2: tinggi - bawah, class: 'g-sumbu' }));
    data.forEach((d, i) => {
      const h = (tinggi - bawah - atas - 14) * d.n / maks, x = 20 + i * langkah + (langkah - w) / 2, y = tinggi - bawah - h;
      svg.append(el('rect', { x, y, width: w, height: Math.max(1, h), rx: 3, class: 'seri-2' }));
      svg.append(el('text', { x: x + w / 2, y: y - 5, 'text-anchor': 'middle', class: 'g-teks g-nilai' }, d.n));
      const [th, bl] = d.label.split('-');
      svg.append(el('text', { x: x + w / 2, y: tinggi - bawah + 16, 'text-anchor': 'middle', class: 'g-teks' }, ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(bl) - 1] || bl));
      svg.append(el('text', { x: x + w / 2, y: tinggi - bawah + 32, 'text-anchor': 'middle', class: 'g-kecil' }, th));
    });
    return svg;
  }

  /** Matriks risiko 5x5 (baris: kemungkinan 5..1, kolom: dampak 1..5). */
  function matriks(g, o) {
    o = Object.assign({ judul: 'Matriks risiko' }, o);
    const sel = 52, kiri = 70, atas = 10, svg = kanvas(kiri + sel * 5 + 20, atas + sel * 5 + 56, o.judul,
      'Jumlah somasi aktif per kombinasi kemungkinan dan dampak: ' + g.map((b, i) => `kemungkinan ${i + 1}: ${b.join(', ')}`).join('; '));
    for (let k = 5; k >= 1; k--) {
      for (let d = 1; d <= 5; d++) {
        const x = kiri + (d - 1) * sel, y = atas + (5 - k) * sel, skor = k * d, n = g[k - 1][d - 1];
        const lv = skor >= 15 ? 'r4' : skor >= 10 ? 'r3' : skor >= 5 ? 'r2' : 'r1';
        svg.append(el('rect', { x, y, width: sel - 3, height: sel - 3, rx: 4, class: 'g-' + lv }));
        if (n) svg.append(el('text', { x: x + sel / 2 - 1.5, y: y + sel / 2 + 5, 'text-anchor': 'middle', class: 'g-besar g-' + lv + '-t' }, n));
      }
      svg.append(el('text', { x: kiri - 8, y: atas + (5 - k) * sel + sel / 2 + 4, 'text-anchor': 'end', class: 'g-teks' }, k));
    }
    for (let d = 1; d <= 5; d++) svg.append(el('text', { x: kiri + (d - 1) * sel + sel / 2, y: atas + 5 * sel + 14, 'text-anchor': 'middle', class: 'g-teks' }, d));
    svg.append(el('text', { x: kiri + sel * 2.5, y: atas + 5 * sel + 38, 'text-anchor': 'middle', class: 'g-teks' }, 'Dampak (saldo terbuka) →'));
    svg.append(el('text', { x: 14, y: atas + sel * 2.5, 'text-anchor': 'middle', class: 'g-teks', transform: `rotate(-90 14 ${atas + sel * 2.5})` }, 'Kemungkinan eskalasi →'));
    return svg;
  }
  return Object.freeze({ batang, cincin, kolom, matriks });
})();
