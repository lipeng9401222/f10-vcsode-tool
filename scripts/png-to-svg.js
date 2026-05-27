/**
 * 把 PNG 嵌入到 SVG（base64 data URI）。
 * 用法：node scripts/png-to-svg.js <input.png> <output.svg>
 * 默认：resources/logo.png -> resources/logo.svg
 */
const fs = require('fs');
const path = require('path');

const input = process.argv[2] || path.resolve(__dirname, '..', 'resources', 'logo.png');
const output = process.argv[3] || path.resolve(__dirname, '..', 'resources', 'logo.svg');

if (!fs.existsSync(input)) {
  console.error('input not found:', input);
  process.exit(1);
}

const buf = fs.readFileSync(input);
const b64 = buf.toString('base64');

// 尝试读 PNG 头里的宽高（IHDR 在前 24 字节）
let width = 1024;
let height = 1024;
if (buf.length >= 24 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
  width = buf.readUInt32BE(16);
  height = buf.readUInt32BE(20);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <image width="${width}" height="${height}" xlink:href="data:image/png;base64,${b64}"/>
</svg>
`;

fs.writeFileSync(output, svg);
console.log(`✅ ${output} (${(svg.length / 1024).toFixed(1)} KB, ${width}x${height})`);
