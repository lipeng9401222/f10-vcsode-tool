import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * 极简 ZIP 打包器（store + deflate），用于将 dist 目录压缩成单个 zip 文件。
 *
 * 不依赖第三方包，避免插件运行时再装 archiver。
 * 仅支持基本的 ZIP 输出：local file header + central directory + end-of-central-dir record。
 */

interface FileEntry {
  /** 在 zip 中的相对路径（使用 / 分隔） */
  name: string;
  /** crc32 校验值 */
  crc32: number;
  /** 压缩前大小 */
  size: number;
  /** 压缩后数据 */
  data: Buffer;
  /** 压缩方法：0=store, 8=deflate */
  method: number;
  /** 该 entry 在文件中的偏移 */
  offset: number;
}

/** 计算 CRC32 (IEEE 802.3 多项式) */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

/**
 * 递归收集目录下所有文件路径（绝对路径）。
 */
function walk(dir: string, base: string, out: { abs: string; rel: string }[]): void {
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    out.push({ abs: dir, rel: path.relative(base, dir).split(path.sep).join('/') });
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    walk(path.join(dir, name), base, out);
  }
}

/**
 * 将 sourceDir 目录打包为 zip 文件并写出到 outputZip 路径。
 * 返回最终 zip 文件路径。
 */
export function zipDirectory(sourceDir: string, outputZip: string): string {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`待打包目录不存在：${sourceDir}`);
  }
  const files: { abs: string; rel: string }[] = [];
  walk(sourceDir, sourceDir, files);

  const entries: FileEntry[] = [];
  let offset = 0;
  const localBuffers: Buffer[] = [];

  // dos time/date：固定写当前时间
  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

  for (const f of files) {
    const raw = fs.readFileSync(f.abs);
    const crc = crc32(raw);
    let data: Buffer;
    let method: number;
    const compressed = zlib.deflateRawSync(raw, { level: zlib.constants.Z_BEST_SPEED });
    if (compressed.length < raw.length) {
      data = compressed;
      method = 8; // deflate
    } else {
      data = raw;
      method = 0; // store
    }

    const nameBuf = Buffer.from(f.rel, 'utf-8');
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // flags: utf-8 name
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len

    localBuffers.push(localHeader, nameBuf, data);
    entries.push({ name: f.rel, crc32: crc, size: raw.length, data, method, offset });
    offset += localHeader.length + nameBuf.length + data.length;
  }

  // central directory
  const centralBuffers: Buffer[] = [];
  let centralSize = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf-8');
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8); // flags
    central.writeUInt16LE(e.method, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(e.crc32, 16);
    central.writeUInt32LE(e.data.length, 20);
    central.writeUInt32LE(e.size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(e.offset, 42);
    centralBuffers.push(central, nameBuf);
    centralSize += central.length + nameBuf.length;
  }

  // end of central dir
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment len

  const allBuffers = [...localBuffers, ...centralBuffers, eocd];
  fs.mkdirSync(path.dirname(outputZip), { recursive: true });
  fs.writeFileSync(outputZip, Buffer.concat(allBuffers));
  return outputZip;
}
