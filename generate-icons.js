const zlib = require('zlib');
const fs = require('fs');

function uint32BE(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(n, 0);
  return buf;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = uint32BE(data.length);
  const crcVal = uint32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function createFocusPNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    uint32BE(size), uint32BE(size),
    Buffer.from([8, 6, 0, 0, 0]) // 8-bit RGBA
  ]));

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const cornerR = size * 0.22;
  const squareR = size * 0.49;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const px = Math.abs(dx);
      const py = Math.abs(dy);

      let inside = false;
      if (px <= squareR && py <= squareR) {
        if (px <= squareR - cornerR || py <= squareR - cornerR) {
          inside = true;
        } else {
          const cdx = px - (squareR - cornerR);
          const cdy = py - (squareR - cornerR);
          inside = Math.sqrt(cdx * cdx + cdy * cdy) <= cornerR;
        }
      }

      const off = 1 + x * 4;
      if (!inside) {
        row[off] = 0; row[off + 1] = 0; row[off + 2] = 0; row[off + 3] = 0;
      } else if (dist <= r * 0.12) {
        row[off] = 255; row[off + 1] = 255; row[off + 2] = 255; row[off + 3] = 255;
      } else if (dist >= r * 0.35 && dist <= r * 0.52) {
        row[off] = 165; row[off + 1] = 180; row[off + 2] = 252; row[off + 3] = 255;
      } else if (dist >= r * 0.74 && dist <= r) {
        row[off] = 99; row[off + 1] = 102; row[off + 2] = 241; row[off + 3] = 255;
      } else {
        row[off] = 30; row[off + 1] = 27; row[off + 2] = 75; row[off + 3] = 255;
      }
    }
    rows.push(row);
  }

  const idat = chunk('IDAT', zlib.deflateSync(Buffer.concat(rows)));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

fs.mkdirSync('icons', { recursive: true });
[16, 48, 128].forEach(size => {
  fs.writeFileSync(`icons/icon${size}.png`, createFocusPNG(size));
  console.log(`✓ icon${size}.png`);
});
