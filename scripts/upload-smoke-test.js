// 在本地起一个最简 http 服务，接收 multipart/form-data，
// 验证我们的 uploadFile 工具发送的请求格式是否正确，并能从中正确读出字段与文件。

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const esbuild = require('esbuild');

const tmpDir = path.join(__dirname, '.tmp-upload');
fs.mkdirSync(tmpDir, { recursive: true });

// 把 src/utils/upload.ts 编译成 cjs 用于测试
const entry = path.join(tmpDir, 'entry.ts');
fs.writeFileSync(
  entry,
  `import { uploadFile } from '../../src/utils/upload';\nexport { uploadFile };\n`
);
esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(tmpDir, 'entry.js')
});
const { uploadFile } = require(path.join(tmpDir, 'entry.js'));

// 准备一个待上传文件
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'f10-upload-'));
const filePath = path.join(sandbox, 'demo.zip');
fs.writeFileSync(filePath, Buffer.from('hello-zip-bytes'));

let received = null;

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const ct = req.headers['content-type'] || '';
    const m = /boundary=(.+)$/.exec(ct);
    const boundary = m ? m[1] : '';
    const text = buf.toString('binary');
    received = {
      contentType: ct,
      boundary,
      hasAppName: text.includes('name="appName"') && text.includes('demo-web'),
      hasVersion: text.includes('name="version"') && text.includes('1.0.0'),
      hasFile: text.includes('filename="demo.zip"') && text.includes('hello-zip-bytes'),
      authHeader: req.headers['authorization'] || ''
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
});

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/upload`;
  const result = await uploadFile({
    url,
    filePath,
    fileField: 'file',
    fields: { appName: 'demo-web', version: '1.0.0' },
    headers: { Authorization: 'Bearer test' }
  });
  server.close();

  let pass = result.status === 200 && received && received.hasAppName && received.hasVersion && received.hasFile && received.authHeader === 'Bearer test';
  console.log('upload result:', result);
  console.log('server received:', received);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (pass) {
    console.log('✅ upload smoke test passed');
  } else {
    console.error('❌ upload smoke test FAILED');
    process.exit(1);
  }
});
