const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * 拷贝 src/scripts 中的脚本资源到 dist/scripts，便于运行时直接 spawn 调用。
 */
function copyScripts() {
  const srcDir = path.join(__dirname, 'src', 'scripts');
  const destDir = path.join(__dirname, 'dist', 'scripts');
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}

async function main() {
  /** @type {import('esbuild').BuildOptions} */
  const opts = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [
      {
        name: 'log',
        setup(build) {
          build.onStart(() => console.log('[build] start'));
          build.onEnd((res) => {
            res.errors.forEach(({ text, location }) => {
              console.error(`✘ [ERROR] ${text}`);
              if (location) console.error(`    ${location.file}:${location.line}:${location.column}`);
            });
            copyScripts();
            console.log('[build] done');
          });
        }
      }
    ]
  };

  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
  } else {
    await esbuild.build(opts);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
