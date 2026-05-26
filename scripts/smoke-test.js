// 简单的冒烟测试：验证 zip 工具能正确产出可被 unzip -l 解读的 zip 文件
const fs = require('fs');
const path = require('path');
const os = require('os');

// 通过 require dist 编译产物间接测试 src/utils/zip.ts 的核心逻辑
// 因为 esbuild 把所有源码都内联进了 dist/extension.js，无法单独 require
// 所以这里复制一份 zip.ts 的核心逻辑做测试，或者直接 require ts-node + 源码。
// 这里采取最简单的方式：用 ts 源码编译一次到独立 cjs，运行后清理。

const { execSync } = require('child_process');

// 先做 ts 编译
const tmpDir = path.join(__dirname, '.tmp-smoke');
fs.mkdirSync(tmpDir, { recursive: true });

// 写一个最小入口 ts，引用 utils/zip
const entry = path.join(tmpDir, 'entry.ts');
fs.writeFileSync(
  entry,
  `import { zipDirectory } from '../../src/utils/zip';\nexport { zipDirectory };\n`
);

// 用 esbuild 编译该入口
const esbuild = require('esbuild');
esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(tmpDir, 'entry.js')
});

const { zipDirectory } = require(path.join(tmpDir, 'entry.js'));

// 准备测试数据：在 os.tmpdir 下做个 dist 目录
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'f10-zip-'));
const dist = path.join(sandbox, 'dist');
fs.mkdirSync(path.join(dist, 'static'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), '<html><body>hello</body></html>');
fs.writeFileSync(path.join(dist, 'static', 'app.js'), 'console.log("hi");\n'.repeat(50));

const zipPath = path.join(sandbox, 'out.zip');
zipDirectory(dist, zipPath);

// 用系统 unzip 验证
const list = execSync(`unzip -l "${zipPath}"`).toString();
console.log(list);
const ok = list.includes('index.html') && list.includes('static/app.js');
if (!ok) {
  console.error('FAIL: zip 未包含预期文件');
  process.exit(1);
}

// 解压验证内容一致
const out = path.join(sandbox, 'unzipped');
fs.mkdirSync(out);
execSync(`unzip -q "${zipPath}" -d "${out}"`);
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf-8');
if (!html.includes('hello')) {
  console.error('FAIL: 解压后内容不一致');
  process.exit(1);
}

// 清理
fs.rmSync(sandbox, { recursive: true, force: true });
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('✅ zip smoke test passed');
