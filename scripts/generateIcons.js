/**
 * Menjana ikon PWA (PNG) tanpa sebarang pergantungan luaran (guna zlib
 * terbina-dalam Node.js sahaja) - lambang sigma emas atas latar biru gelap.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY_DEEP = [11, 18, 32, 255]; // #0B1220 (--navy-deep)
const NAVY_SOFT = [30, 49, 96, 255]; // #1E3160 (--navy-soft)
const GOLD = [244, 185, 66, 255]; // #F4B942 (--gold)

function drawLine(pixels, size, x0, y0, x1, y1, color, thickness) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  const half = Math.floor(thickness / 2);
  for (;;) {
    for (let ox = -half; ox <= half; ox++) {
      for (let oy = -half; oy <= half; oy++) {
        setPixel(pixels, size, x + ox, y + oy, color);
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const idx = (y * size + x) * 4;
  pixels[idx] = color[0];
  pixels[idx + 1] = color[1];
  pixels[idx + 2] = color[2];
  pixels[idx + 3] = color[3];
}

function fillCircle(pixels, size, cx, cy, r, color) {
  cx = Math.round(cx); cy = Math.round(cy);
  const rCeil = Math.ceil(r);
  for (let y = -rCeil; y <= rCeil; y++) {
    for (let x = -rCeil; x <= rCeil; x++) {
      if (x * x + y * y <= r * r) setPixel(pixels, size, cx + x, cy + y, color);
    }
  }
}

function strokeCircle(pixels, size, cx, cy, r, thickness, color) {
  cx = Math.round(cx); cy = Math.round(cy);
  const rOut = r + thickness / 2;
  const rIn = r - thickness / 2;
  const rCeil = Math.ceil(rOut);
  for (let y = -rCeil; y <= rCeil; y++) {
    for (let x = -rCeil; x <= rCeil; x++) {
      const d2 = x * x + y * y;
      if (d2 <= rOut * rOut && d2 >= rIn * rIn) setPixel(pixels, size, cx + x, cy + y, color);
    }
  }
}

/**
 * Lambang Sigma (Σ) tebal — sepadan dengan logo SVG premium di index.html
 * (bulatan navy + gegelang emas + glyph Sigma emas tebal).
 */
function buildIcon(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = NAVY_DEEP[0];
    pixels[i * 4 + 1] = NAVY_DEEP[1];
    pixels[i * 4 + 2] = NAVY_DEEP[2];
    pixels[i * 4 + 3] = NAVY_DEEP[3];
  }

  const pad = maskable ? size * 0.24 : size * 0.14;
  const circleR = maskable ? size * 0.4 : size * 0.46;
  const cx = size / 2;
  const cy = size / 2;

  fillCircle(pixels, size, cx, cy, circleR, NAVY_SOFT);
  strokeCircle(pixels, size, cx, cy, circleR, Math.max(2, size * 0.022), GOLD);

  const glyphR = circleR * 0.5;
  const left = cx - glyphR;
  const right = cx + glyphR;
  const top = cy - glyphR;
  const bottom = cy + glyphR;
  const midInset = glyphR * 0.72;
  const thickness = Math.max(3, Math.round(size * 0.075));

  drawLine(pixels, size, left, top, right, top, GOLD, thickness);
  drawLine(pixels, size, right, top, cx - midInset * 0.15, cy, GOLD, thickness);
  drawLine(pixels, size, cx - midInset * 0.15, cy, right, bottom, GOLD, thickness);
  drawLine(pixels, size, right, bottom, left, bottom, GOLD, thickness);

  return encodePNG(size, size, pixels);
}

function encodePNG(width, height, rgbaPixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgbaPixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk('IDAT', idatData);

  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { size: 192, file: 'icon-192.png', maskable: false },
  { size: 512, file: 'icon-512.png', maskable: false },
  { size: 512, file: 'icon-maskable-512.png', maskable: true },
];

for (const t of targets) {
  const png = buildIcon(t.size, t.maskable);
  fs.writeFileSync(path.join(outDir, t.file), png);
  console.log(`Dijana: icons/${t.file} (${png.length} bytes)`);
}
