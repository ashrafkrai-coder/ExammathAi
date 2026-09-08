/**
 * Menjana ikon PWA (PNG) tanpa sebarang pergantungan luaran (guna zlib
 * terbina-dalam Node.js sahaja) - lambang sigma emas atas latar biru gelap.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [11, 31, 58, 255]; // #0B1F3A
const GOLD = [244, 180, 0, 255]; // #F4B400
const WHITE = [255, 255, 255, 255];

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
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) setPixel(pixels, size, cx + x, cy + y, color);
    }
  }
}

function buildIcon(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = NAVY[0];
    pixels[i * 4 + 1] = NAVY[1];
    pixels[i * 4 + 2] = NAVY[2];
    pixels[i * 4 + 3] = NAVY[3];
  }

  const pad = maskable ? size * 0.22 : size * 0.14;
  const circleR = maskable ? size * 0.42 : size * 0.46;
  fillCircle(pixels, size, size / 2, size / 2, circleR, [10, 26, 48, 255]);

  const left = pad;
  const right = size - pad;
  const top = pad + size * 0.06;
  const bottom = size - pad - size * 0.06;
  const midY = size / 2;
  const thickness = Math.max(2, Math.round(size * 0.045));

  drawLine(pixels, size, left, top, right, top, GOLD, thickness);
  drawLine(pixels, size, right, top, left + (right - left) * 0.35, midY, GOLD, thickness);
  drawLine(pixels, size, left + (right - left) * 0.35, midY, right, bottom, GOLD, thickness);
  drawLine(pixels, size, right, bottom, left, bottom, GOLD, thickness);

  const dotR = Math.max(2, Math.round(size * 0.03));
  fillCircle(pixels, size, size * 0.76, size * 0.24, dotR, WHITE);

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
