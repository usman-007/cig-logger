/**
 * Renders the Ash app icons to PNG with no image dependencies:
 * a charcoal rounded square, an emerald ember, and its glow.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const BG = hex("#0b1015");
const PANEL = hex("#111a22");
const EMBER = hex("#10b981");
const EMBER_HOT = hex("#6ee7b7");
const ASH = hex("#eef2f6");
const FILTER = hex("#e0a355");

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const smooth = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** distance from point p to segment ab, in the same units as the inputs */
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.min(1, Math.max(0, (wx * vx + wy * vy) / len2));
  return { dist: Math.hypot(px - (ax + t * vx), py - (ay + t * vy)), t };
}

/**
 * A cigarette on the diagonal: amber filter at the bottom left, ash-white
 * body, emerald ember burning at the tip with a wisp of smoke above it.
 *
 * @param size    pixel size of the square icon
 * @param inset   0–0.5 fraction kept clear of the edges (maskable safe zone)
 * @param rounded corner radius as a fraction of the artboard; 0.5 = circle
 * @param opaque  true for platforms that reject transparency (iOS, maskable)
 */
function draw(size, { inset = 0, rounded = 0.22, opaque = true } = {}) {
  const S = size;
  const buf = Buffer.alloc(S * S * 4);
  const pad = inset * S;
  const box = { x0: pad, y0: pad, x1: S - pad, y1: S - pad };
  const B = box.x1 - box.x0;
  const radius = rounded * B;
  const u = (fx, fy) => [box.x0 + fx * B, box.y0 + fy * B];

  const [ax, ay] = u(0.245, 0.755); // filter end
  const [bx, by] = u(0.7, 0.35); // burning tip
  const bodyR = 0.072 * B;
  const emberR = 0.062 * B;
  const filterT = 0.34; // fraction of the stick that is filter

  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;

      const dx = Math.max(box.x0 + radius - px, 0, px - (box.x1 - radius));
      const dy = Math.max(box.y0 + radius - py, 0, py - (box.y1 - radius));
      const coverage = 1 - smooth(-0.8, 0.8, Math.hypot(dx, dy) - radius);

      // backdrop: charcoal, lifted toward the ember corner
      let color = mix(BG, PANEL, (py - box.y0) / B);
      const dTip = Math.hypot(px - bx, py - by);
      color = mix(color, EMBER, 0.5 * Math.exp(-((dTip / (emberR * 4.6)) ** 2)));

      // smoke wisp rising from the tip
      const rise = (by - py) / (0.3 * B);
      if (rise > 0 && rise < 1.05) {
        const curl = bx + Math.sin(rise * 4.2) * 0.05 * B;
        const wispR = (0.016 + rise * 0.012) * B;
        const a = (1 - smooth(wispR * 0.4, wispR, Math.abs(px - curl))) * (1 - rise) * 0.5;
        if (a > 0) color = mix(color, ASH, a);
      }

      // the cigarette itself
      const { dist, t } = segDist(px, py, ax, ay, bx, by);
      const body = 1 - smooth(bodyR - 1.1, bodyR + 0.4, dist);
      if (body > 0) {
        const isFilter = t < filterT;
        let stick = isFilter ? FILTER : ASH;
        // seam between filter and paper
        if (Math.abs(t - filterT) < 0.03) stick = mix(FILTER, ASH, 0.35);
        // shade the underside so the stick reads as a cylinder
        const side = (py - (ay + t * (by - ay))) / bodyR;
        stick = mix(stick, [0, 0, 0], Math.max(0, side) * 0.22);
        color = mix(color, stick, body);
      }

      // burning ember at the tip
      const ember = 1 - smooth(emberR - 1.1, emberR + 0.6, dTip);
      if (ember > 0) {
        color = mix(color, mix(EMBER, EMBER_HOT, 1 - Math.min(1, dTip / emberR)), ember);
      }

      const i = (y * S + x) * 4;
      buf[i] = Math.round(color[0]);
      buf[i + 1] = Math.round(color[1]);
      buf[i + 2] = Math.round(color[2]);
      buf[i + 3] = opaque ? 255 : Math.round(coverage * 255);
    }
  }
  return encodePng(S, S, buf);
}

mkdirSync(OUT, { recursive: true });

const targets = [
  ["icon-192.png", 192, { inset: 0.06, rounded: 0.22, opaque: false }],
  ["icon-512.png", 512, { inset: 0.06, rounded: 0.22, opaque: false }],
  // maskable art must survive a circular crop: keep everything inside 80%
  ["icon-maskable-192.png", 192, { inset: 0.14, rounded: 0.5, opaque: true }],
  ["icon-maskable-512.png", 512, { inset: 0.14, rounded: 0.5, opaque: true }],
  ["apple-touch-icon.png", 180, { inset: 0.08, rounded: 0.001, opaque: true }],
  ["icon-32.png", 32, { inset: 0.02, rounded: 0.22, opaque: false }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(resolve(OUT, name), draw(size, opts));
  console.log("wrote", name, `${size}×${size}`);
}
