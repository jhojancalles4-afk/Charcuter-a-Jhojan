const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.alloc(4 + len);
  typeAndData.write(type, 0, 4, 'ascii');
  data.copy(typeAndData, 4);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPngBuffer(width, height, isMaskable = false) {
  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = writeChunk('IHDR', ihdrData);

  // Scanlines
  // We'll draw a rich Dark Slate (#0f172a) background with an emerald (#10b981) + rose (#f43f5e) accent badge,
  // representing Charcutería Jhojan POS.
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = width * (isMaskable ? 0.45 : 0.44);
  const rInner = width * (isMaskable ? 0.35 : 0.34);

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background: #0f172a (dark slate 900)
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      if (!isMaskable && dist > rOuter + 2) {
        // Transparent outside for normal icon
        r = 15; g = 23; b = 42; a = 255;
      }

      // Outer ring: emerald / rose gradient
      if (dist <= rOuter && dist >= rInner) {
        // diagonal gradient
        const t = (x + y) / (width + height);
        r = Math.round(16 + t * (244 - 16));   // from emerald #10b981 to rose #f43f5e
        g = Math.round(185 + t * (63 - 185));
        b = Math.round(129 + t * (94 - 129));
      } else if (dist < rInner) {
        // Center badge background: #1e293b (slate 800)
        r = 30;
        g = 41;
        b = 59;

        // Draw a stylized 'J' / butcher knife / scale motif
        // Central symbol
        const relX = (x - cx) / width;
        const relY = (y - cy) / height;

        // Vertical bar of J
        const inJBar = relX >= 0.02 && relX <= 0.12 && relY >= -0.18 && relY <= 0.12;
        // Top crossbar
        const inJTop = relX >= -0.10 && relX <= 0.16 && relY >= -0.22 && relY <= -0.16;
        // Bottom hook of J
        const inJHook = relX >= -0.14 && relX <= 0.05 && relY >= 0.08 && relY <= 0.18 && (dist < rInner - 8);

        // Gold star/coin accent
        const inCoin = (relX + 0.14) * (relX + 0.14) + (relY + 0.10) * (relY + 0.10) < 0.003;

        if (inJBar || inJTop || inJHook) {
          // Emerald highlight: #34d399
          r = 52;
          g = 211;
          b = 153;
        } else if (inCoin) {
          // Amber accent: #f59e0b
          r = 245;
          g = 158;
          b = 11;
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = writeChunk('IDAT', compressedData);
  const iendChunk = writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate PNGs
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPngBuffer(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPngBuffer(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPngBuffer(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPngBuffer(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPngBuffer(48, 48, false));

// Generate SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#f43f5e" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="110" fill="#0f172a" />
  <circle cx="256" cy="256" r="210" fill="none" stroke="url(#grad)" stroke-width="20" stroke-dasharray="16 10" />
  <circle cx="256" cy="256" r="185" fill="#1e293b" />
  
  <!-- Stylized Scale & Jhojan "J" Logo -->
  <path d="M 230 160 L 320 160 M 275 160 L 275 310 C 275 350 215 355 200 320" 
        fill="none" stroke="#34d399" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" />
  <!-- Scale balance beam -->
  <line x1="160" y1="210" x2="350" y2="210" stroke="#94a3b8" stroke-width="12" stroke-linecap="round" />
  <circle cx="255" cy="210" r="10" fill="#38bdf8" />
  <!-- Pans -->
  <path d="M 140 245 L 180 245 C 180 260 140 260 140 245 Z" fill="#64748b" />
  <line x1="160" y1="210" x2="160" y2="245" stroke="#64748b" stroke-width="4" />
  <path d="M 330 245 L 370 245 C 370 260 330 260 330 245 Z" fill="#64748b" />
  <line x1="350" y1="210" x2="350" y2="245" stroke="#64748b" stroke-width="4" />

  <!-- Meat / Charcuterie Accent badge -->
  <circle cx="360" cy="160" r="28" fill="url(#gold)" />
  <text x="360" y="169" font-family="system-ui, sans-serif" font-size="24" font-weight="900" fill="#0f172a" text-anchor="middle">KG</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

console.log('Icons generated successfully in public/');
