/**
 * sourceEdit 工具的烟雾测试。
 *
 * 在临时目录构造一个迷你 web/comp 工程，跑一次 add/dependency、setMockTrue、injectComponentIntoSetup、createViewPage，
 * 验证幂等性与正确性。
 *
 * 用法：node scripts/source-edit-smoke.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// 直接 require 编译产物（dist/extension.js）会拉起整个 vscode 模块（不可用）。
// 所以这里直接用 ts-node 跑源码也不太合适。最简方式：把 sourceEdit 的核心逻辑“同步”到本地一个独立可运行的小脚本，
// 但为了不重复实现，本文件改为：构造样例输入文件，调用 require 加载 dist，并使用 esbuild 跑前已经把
// utils/sourceEdit.ts 编译进 extension.js 中（无 vscode import）。这里通过单独构建一个 cjs 版本来测试。
// 简化起见：直接使用 tsc 临时编译然后 require。
const { execSync } = require('child_process');

const root = path.join(os.tmpdir(), 'f10-source-edit-smoke-' + Date.now());
fs.mkdirSync(root, { recursive: true });

// 构建临时 cjs 版本
const out = path.join(root, 'sourceEdit.cjs');
execSync(
  `npx esbuild "src/utils/sourceEdit.ts" --bundle --platform=node --format=cjs --external:vscode --outfile="${out}"`,
  { stdio: 'inherit' }
);
const lib = require(out);

// 样例 web 工程
const webRoot = path.join(root, 'web');
fs.mkdirSync(path.join(webRoot, 'src'), { recursive: true });
const webPkg = path.join(webRoot, 'package.json');
const setupJs = path.join(webRoot, 'src', 'setup.js');
const configJs = path.join(webRoot, 'src', 'config.js');

fs.writeFileSync(
  webPkg,
  JSON.stringify(
    {
      name: 'web-eva-plus',
      dependencies: {
        '@epframe/eui-core': '^10.0.6'
      }
    },
    null,
    2
  )
);

fs.writeFileSync(
  setupJs,
  `import euiCore, { Utils } from '@epframe/eui-core';
import AdminComponents from '@demo-live/admin-components';
import '@demo-live/admin-components/style.css';

export const setup = Utils.defineSetup({
  meta: {},
  deps: [euiCore, AdminComponents],
});
`
);

fs.writeFileSync(
  configJs,
  `const config = {
  appTitle: '',
  isMock: false,
};
export default config;
`
);

// 1. addWorkspaceDependency
let r = lib.addWorkspaceDependency(webPkg, '@epframe/demo-study-components');
assert(r.changed, 'first add should write');
r = lib.addWorkspaceDependency(webPkg, '@epframe/demo-study-components');
assert(!r.changed, 'second add should be idempotent');
const pkg = JSON.parse(fs.readFileSync(webPkg, 'utf-8'));
assert(pkg.dependencies['@epframe/demo-study-components'] === 'workspace:*', 'dep not written');
assert(pkg.dependencies['@epframe/eui-core'] === '^10.0.6', 'existing dep lost');

// 2. setMockTrue
r = lib.setMockTrue(configJs);
assert(r.changed, 'mock should be flipped');
r = lib.setMockTrue(configJs);
assert(!r.changed, 'mock flip should be idempotent');
assert(/isMock:\s*true/.test(fs.readFileSync(configJs, 'utf-8')), 'isMock not true');

// 3. injectComponentIntoSetup
r = lib.injectComponentIntoSetup(setupJs, '@epframe/demo-study-components', 'DemoStudyComponents');
assert(r.changed, 'inject should change');
r = lib.injectComponentIntoSetup(setupJs, '@epframe/demo-study-components', 'DemoStudyComponents');
assert(!r.changed, 'inject should be idempotent');
const setupContent = fs.readFileSync(setupJs, 'utf-8');
assert(setupContent.includes(`import DemoStudyComponents from '@epframe/demo-study-components';`), 'comp import missing');
assert(setupContent.includes(`import '@epframe/demo-study-components/style.css';`), 'style import missing');
assert(/deps:\s*\[[^\]]*DemoStudyComponents[^\]]*\]/.test(setupContent), 'deps not patched');
assert(/euiCore/.test(setupContent), 'euiCore lost');

// 4. createViewPage
const compRoot = path.join(root, 'comp');
fs.mkdirSync(path.join(compRoot, 'src', 'views'), { recursive: true });
r = lib.createViewPage(compRoot, 'demo/index', '示例首页');
assert(r.changed, 'page should be created');
assert(fs.existsSync(path.join(compRoot, 'src', 'views', 'demo', 'index.vue')), 'page file missing');
r = lib.createViewPage(compRoot, 'demo/index');
assert(!r.changed, 'second create should not overwrite');

console.log('\n✅ All smoke checks passed at:', root);

function assert(cond, msg) {
  if (!cond) {
    console.error('❌ assert failed:', msg);
    process.exit(1);
  } else {
    console.log('  ✓', msg);
  }
}
