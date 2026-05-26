import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { URL } from 'url';

/**
 * 通过 multipart/form-data 上传一个文件到指定 URL。
 * 不依赖第三方包，自行拼装 multipart body。
 */
export interface UploadResult {
  status: number;
  body: string;
}

export interface UploadParams {
  url: string;
  filePath: string;
  fileField: string;
  fields: Record<string, string>;
  headers: Record<string, string>;
}

/**
 * 生成边界字符串。
 */
function makeBoundary(): string {
  return '----F10VSCodeBoundary' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/**
 * 简单 MIME 类型推断；二进制 zip 默认为 application/zip。
 */
function guessMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.zip') return 'application/zip';
  if (ext === '.tar') return 'application/x-tar';
  if (ext === '.gz') return 'application/gzip';
  return 'application/octet-stream';
}

/**
 * 执行上传。
 */
export function uploadFile(params: UploadParams): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const boundary = makeBoundary();
    const fileBuf = fs.readFileSync(params.filePath);
    const fileName = path.basename(params.filePath);
    const mime = guessMime(params.filePath);

    const parts: Buffer[] = [];
    const pushText = (k: string, v: string): void => {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
          'utf-8'
        )
      );
    };

    for (const [k, v] of Object.entries(params.fields)) {
      pushText(k, v);
    }

    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${params.fileField}"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`,
        'utf-8'
      )
    );
    parts.push(fileBuf);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'));
    const body = Buffer.concat(parts);

    let parsed: URL;
    try {
      parsed = new URL(params.url);
    } catch (e) {
      reject(new Error(`上传地址非法：${params.url}`));
      return;
    }
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        method: 'POST',
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          ...params.headers
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
        );
      }
    );
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}
