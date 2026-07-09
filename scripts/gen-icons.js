'use strict';

// Generates all app icons as PNGs with zero image dependencies.
// Design: three lines of "text" with the middle line selected (highlight band)
// — the Rex gesture, as an icon.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- minimal PNG encoder ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(file, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log(`wrote ${file} (${width}x${height})`);
}

/* ---------- shape rasterizer (unit coords, 3x3 supersampled) ---------- */

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

// point (u,v) inside a rounded rect: inside the bbox and, if in a corner
// region, within radius r of that corner's arc center
function inRoundRect(u, v, s) {
  const { x, y, w, h, r } = s;
  if (u < x || u > x + w || v < y || v > y + h) return false;
  const ax = Math.max(x + r, Math.min(u, x + w - r));
  const ay = Math.max(y + r, Math.min(v, y + h - r));
  const dx = u - ax, dy = v - ay;
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(u, v, s) {
  const [[x1, y1], [x2, y2], [x3, y3]] = s.pts;
  const d1 = (u - x2) * (y1 - y2) - (x1 - x2) * (v - y2);
  const d2 = (u - x3) * (y2 - y3) - (x2 - x3) * (v - y3);
  const d3 = (u - x1) * (y3 - y1) - (x3 - x1) * (v - y1);
  const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}

function inShape(u, v, s) {
  return s.pts ? inTriangle(u, v, s) : inRoundRect(u, v, s);
}

function render(file, size, shapes) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          // composite shapes top-down: last matching shape wins per sample
          let sr = 0, sg = 0, sb = 0, sa = 0;
          for (const s of shapes) {
            if (inShape(u, v, s)) {
              const [cr, cg, cb] = hex(s.color);
              const ca = s.alpha == null ? 1 : s.alpha;
              // source-over
              const na = ca + sa * (1 - ca);
              if (na > 0) {
                sr = (cr * ca + sr * sa * (1 - ca)) / na;
                sg = (cg * ca + sg * sa * (1 - ca)) / na;
                sb = (cb * ca + sb * sa * (1 - ca)) / na;
              }
              sa = na;
            }
          }
          r += sr; g += sg; b += sb; a += sa;
        }
      }
      const n = SS * SS;
      const idx = (py * size + px) * 4;
      rgba[idx] = Math.round(r / n);
      rgba[idx + 1] = Math.round(g / n);
      rgba[idx + 2] = Math.round(b / n);
      rgba[idx + 3] = Math.round((a / n) * 255);
    }
  }
  writePng(file, size, size, rgba);
}

/* ---------- designs ---------- */

const bar = (y, x0, x1, h, color, alpha) =>
  ({ x: x0, y: y - h / 2, w: x1 - x0, h, r: h / 2, color, alpha });

// App icon: ink rounded square, three text lines, middle line selected.
// Logo: an original pixel T-Rex in the offline-runner style.
// '#' = pixel; the eye is the hole at row 1.
const DINO = [
  '..............########',
  '.............##.######',
  '.............#########',
  '.............#########',
  '.............#####....',
  '.............########.',
  '.............#####....',
  '#............####.....',
  '#...........#####.....',
  '##.........######.....',
  '###.......##########..',
  '####.....###########..',
  '#####...##########....',
  '###################...',
  '.#################....',
  '..###############.....',
  '...#############......',
  '....###########.......',
  '.....####..####.......',
  '.....###....###.......',
  '.....##......##.......',
  '.....###.....###......'
];

// merge horizontal pixel runs into rects; box in unit coords
function bitmapShapes(bitmap, box, color, alpha) {
  const H = bitmap.length, W = bitmap[0].length;
  for (const row of bitmap) if (row.length !== W) throw new Error('ragged bitmap: ' + row);
  const px = box.size / Math.max(W, H);
  const ox = box.x + (box.size - W * px) / 2;
  const oy = box.y + (box.size - H * px) / 2;
  const shapes = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (bitmap[y][x] === '#') {
        let x2 = x;
        while (x2 < W && bitmap[y][x2] === '#') x2++;
        // 1.02 overlap hides antialiasing seams between adjacent rows
        shapes.push({ x: ox + x * px, y: oy + y * px, w: (x2 - x) * px, h: px * 1.02, r: 0, color, alpha });
        x = x2;
      } else x++;
    }
  }
  return shapes;
}

function bitmapSvgRects(bitmap, size, fill) {
  const shapes = bitmapShapes(bitmap, { x: 0, y: 0, size: 1 }, fill);
  return shapes.map(s =>
    `  <rect x="${(s.x * size).toFixed(2)}" y="${(s.y * size).toFixed(2)}" width="${(s.w * size).toFixed(2)}" height="${(s.h * size).toFixed(2)}" fill="${fill}"/>`
  ).join('\n');
}

const appShapes = [
  { x: 0.03, y: 0.03, w: 0.94, h: 0.94, r: 0.21, color: '#131316' },
  ...bitmapShapes(DINO, { x: 0.17, y: 0.17, size: 0.66 }, '#ffffff')
];

// Tray (macOS template): pure black, alpha carries the shape.
const trayTemplateShapes = bitmapShapes(DINO, { x: 0.04, y: 0.04, size: 0.92 }, '#000000');

// Tray (Windows/Linux): white on transparent.
const trayColorShapes = bitmapShapes(DINO, { x: 0.04, y: 0.04, size: 0.92 }, '#ffffff');

if (require.main === module) {
  const assets = path.join(__dirname, '..', 'assets');
  render(path.join(assets, 'icon.png'), 1024, appShapes);
  render(path.join(assets, 'trayTemplate.png'), 22, trayTemplateShapes);
  render(path.join(assets, 'trayTemplate@2x.png'), 44, trayTemplateShapes);
  render(path.join(assets, 'tray.png'), 32, trayColorShapes);

  fs.writeFileSync(path.join(assets, 'logo.svg'),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Rex mark: pixel T-Rex -->
${bitmapSvgRects(DINO, 64, '#ffffff')}
</svg>
`);
  fs.writeFileSync(path.join(assets, 'logo-badge.svg'),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Rex badge: pixel T-Rex on its app tile, for light backgrounds -->
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#131316"/>
  <g transform="translate(11.5,11.5) scale(0.64)">
${bitmapSvgRects(DINO, 64, '#ffffff')}
  </g>
</svg>
`);
  console.log('wrote assets/logo.svg, assets/logo-badge.svg');
}

module.exports = { render, bar, bitmapShapes, DINO };
