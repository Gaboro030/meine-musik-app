// Generates a simple solid-color 1024x1024 PNG with zero external deps
// (pure zlib), used as the source image for `tauri icon` - that command
// then derives every platform-specific format (ico/icns/png set) from it.
// Replace icons-source.png with a real logo whenever you have one; nothing
// else needs to change, `tauri icon` re-derives everything.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SIZE = 1024;

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Raw pixel data: Spotify-green background (#1db954) with a darker circle,
// just so it's visually distinct from a blank square.
const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
const cx = SIZE / 2, cy = SIZE / 2, r = SIZE * 0.32;
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 3);
  raw[rowStart] = 0; // filter type: none
  for (let x = 0; x < SIZE; x++) {
    const inCircle = (x - cx) ** 2 + (y - cy) ** 2 < r * r;
    const off = rowStart + 1 + x * 3;
    if (inCircle) {
      raw[off] = 10; raw[off + 1] = 10; raw[off + 2] = 10; // near-black note circle
    } else {
      raw[off] = 0x1d; raw[off + 1] = 0xb9; raw[off + 2] = 0x54; // spotify green
    }
  }
}

const idat = deflateSync(raw);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const outPath = join(root, "icons-source.png");
writeFileSync(outPath, png);
console.log(`-> wrote ${outPath} (${png.length} bytes), sha256 ${createHash("sha256").update(png).digest("hex").slice(0, 12)}`);
