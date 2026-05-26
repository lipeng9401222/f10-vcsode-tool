import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件是否存在的轻量包装。该模块刻意不引入 vscode，便于做单元化测试。
 */
function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * 源码编辑相关工具：用最小侵入的方式修改 web/组件工程的关键源码文件。
 *
 * 功能覆盖：
 * - addWorkspaceDependency：往 web 工程 package.json 的 dependencies 写入 workspace:* 引用
 * - setMockTrue：把 web 工程 src/config.js 的 isMock 改为 true
 * - injectComponentIntoSetup：往 web 工程 src/setup.js|ts 注入组件包 import 与 deps 数组
 * - createViewPage：在组件工程 src/views 下生成简单的 .vue 页面
 */

/**
 * 修改结果。
 * - changed: true  表示文件内容被实际修改并已写回磁盘
 * - changed: false 表示文件已经是目标状态（幂等），未做任何写入
 * - message: 给用户的可读说明
 */
export interface EditResult {
  changed: boolean;
  message: string;
  filePath?: string;
}

/**
 * 在 package.json 的 dependencies 中加入 `<pkgName>: "workspace:*"`。
 *
 * 注意：使用 JSON.parse + JSON.stringify 写回，保留 2 空格缩进。
 * 不会改动其他字段。如果已有同名依赖，且版本相同则不变；若不同则覆盖为 workspace:*。
 *
 * @param pkgJsonPath web 工程 package.json 的绝对路径
 * @param pkgName     依赖包名（带作用域），例如 `@epframe/demo-study-components`
 */
export function addWorkspaceDependency(pkgJsonPath: string, pkgName: string): EditResult {
  if (!exists(pkgJsonPath)) {
    return { changed: false, message: `package.json 不存在：${pkgJsonPath}`, filePath: pkgJsonPath };
  }
  const raw = fs.readFileSync(pkgJsonPath, 'utf-8');
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw);
  } catch (e) {
    throw new Error(`package.json 解析失败（${pkgJsonPath}）：${(e as Error).message}`);
  }
  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  if (deps[pkgName] === 'workspace:*') {
    return { changed: false, message: `dependencies 已存在 ${pkgName}: workspace:*`, filePath: pkgJsonPath };
  }
  deps[pkgName] = 'workspace:*';
  pkg.dependencies = deps;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  return {
    changed: true,
    message: `已写入 dependencies["${pkgName}"] = "workspace:*"`,
    filePath: pkgJsonPath
  };
}

/**
 * 把 src/config.js 中的 isMock 字段值改为 true（仅当当前为 false 时才改）。
 *
 * 容忍：
 * - 单/双引号、布尔值、不同空格
 * - 末尾逗号
 *
 * 不会处理含有多处 isMock 的复杂场景，遇到匹配不到时返回 changed=false 并附说明。
 */
export function setMockTrue(configJsPath: string): EditResult {
  if (!exists(configJsPath)) {
    return { changed: false, message: `config.js 不存在：${configJsPath}`, filePath: configJsPath };
  }
  const raw = fs.readFileSync(configJsPath, 'utf-8');
  // 只匹配 "isMock: false" / "isMock:false" / "isMock : false" 等简单形态
  const re = /(\bisMock\s*:\s*)(true|false)/;
  const m = re.exec(raw);
  if (!m) {
    return {
      changed: false,
      message: '未在 config.js 中找到 isMock 字段，请手动确认',
      filePath: configJsPath
    };
  }
  if (m[2] === 'true') {
    return { changed: false, message: 'isMock 已为 true（无需修改）', filePath: configJsPath };
  }
  const next = raw.replace(re, `$1true`);
  fs.writeFileSync(configJsPath, next, 'utf-8');
  return { changed: true, message: '已将 isMock 修改为 true', filePath: configJsPath };
}

/**
 * 把组件工程的引用注入 web 工程的 setup.js / setup.ts：
 * 1. 加入 `import '<pkg>/style.css';`
 * 2. 加入 `import <Identifier> from '<pkg>';`
 * 3. 把 `<Identifier>` 追加到 `Utils.defineSetup({ ..., deps: [...] })` 的 deps 数组中
 *
 * 全部操作幂等：
 * - 已存在的 import 不会重复添加
 * - deps 数组里已有 identifier 不会重复追加
 *
 * 解析方式：基于正则的轻量字符串处理，不依赖 AST。如果 setup.js 没有
 * `Utils.defineSetup` 的 deps 字段，会抛出明确的错误。
 *
 * @param setupPath  setup.js / setup.ts 绝对路径
 * @param pkg        组件包名（含作用域），例如 `@epframe/demo-study-components`
 * @param identifier 用作 import 默认导出名 + deps 数组项，例如 `DemoStudyComponents`
 */
export function injectComponentIntoSetup(
  setupPath: string,
  pkg: string,
  identifier: string
): EditResult {
  if (!exists(setupPath)) {
    return { changed: false, message: `setup 文件不存在：${setupPath}`, filePath: setupPath };
  }

  let text = fs.readFileSync(setupPath, 'utf-8');
  const original = text;

  const styleImport = `import '${pkg}/style.css';`;
  const compImport = `import ${identifier} from '${pkg}';`;

  // 1. 注入两条 import
  if (!text.includes(styleImport)) {
    text = insertAfterLastImport(text, styleImport);
  }
  if (!new RegExp(`import\\s+${escapeReg(identifier)}\\s+from\\s+['"\`]${escapeReg(pkg)}['"\`]`).test(text)) {
    text = insertAfterLastImport(text, compImport);
  }

  // 2. 把 identifier 追加进 defineSetup({ ... deps: [...] })
  // 匹配 `deps: [ ... ]` 形态，允许跨行。
  // 由于 deps 内部一般不会有方括号嵌套，使用非贪婪匹配 [^\]]* 即可。
  const depsRe = /(\bdeps\s*:\s*\[)([^\]]*)(\])/m;
  const dm = depsRe.exec(text);
  if (!dm) {
    throw new Error(
      `未在 ${path.basename(setupPath)} 中找到 deps: [...] 数组，请确认是否使用 Utils.defineSetup`
    );
  }
  const inner = dm[2];
  const items = splitDepsItems(inner);
  if (items.includes(identifier)) {
    // identifier 已存在
    if (text === original) {
      return { changed: false, message: 'setup 中已包含该组件，无需修改', filePath: setupPath };
    }
  } else {
    items.push(identifier);
    const rebuilt = items.join(', ');
    text = text.replace(depsRe, `$1${rebuilt}$3`);
  }

  if (text === original) {
    return { changed: false, message: 'setup 内容已是目标状态', filePath: setupPath };
  }
  fs.writeFileSync(setupPath, text, 'utf-8');
  return { changed: true, message: '已写入 import 与 deps', filePath: setupPath };
}

/**
 * 在组件工程 src/views/<relPath>.vue 下生成一个最简页面。
 *
 * 参数：
 * - compRoot 组件工程根目录（包含 src/views 的那一级）
 * - relPath  形如 `demo` / `demo/index` / `user/list`，最终生成 `src/views/<relPath>.vue`
 * - title    可选标题，写到模板中给用户做占位提示
 *
 * 行为：
 * - 自动创建多级目录
 * - 已存在同名文件时不覆盖，返回 changed=false 并提示
 */
export function createViewPage(compRoot: string, relPath: string, title?: string): EditResult {
  // 标准化 relPath：去掉前后斜杠，自动补 .vue 后缀
  const cleaned = relPath.replace(/^[./\\]+/, '').replace(/\.vue$/i, '');
  if (!cleaned) {
    return { changed: false, message: '页面路径不能为空' };
  }
  // 校验非法字符
  if (/[<>"|?*]/.test(cleaned)) {
    return { changed: false, message: '页面路径包含非法字符' };
  }

  const viewsDir = path.join(compRoot, 'src', 'views');
  if (!exists(viewsDir)) {
    fs.mkdirSync(viewsDir, { recursive: true });
  }
  const target = path.join(viewsDir, cleaned + '.vue');
  if (exists(target)) {
    return { changed: false, message: `页面已存在：${target}`, filePath: target };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const baseName = path.basename(cleaned);
  const componentName = toPascal(baseName);
  const displayTitle = title ?? componentName;

  const tpl = renderPageTemplate(componentName, displayTitle);
  fs.writeFileSync(target, tpl, 'utf-8');
  return { changed: true, message: `已创建页面：${target}`, filePath: target };
}

// ----------------------------- helpers -----------------------------

/**
 * 把字符串插到最后一行 `import` 语句之后；如果没有任何 import，则插到文件最前。
 */
function insertAfterLastImport(text: string, lineToInsert: string): string {
  const lines = text.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\b/.test(lines[i])) lastImport = i;
  }
  if (lastImport === -1) {
    return lineToInsert + '\n' + text;
  }
  lines.splice(lastImport + 1, 0, lineToInsert);
  return lines.join('\n');
}

/**
 * 拆分 `deps: [a, b, c]` 数组中部分内容为标识符列表，丢弃空白与注释行。
 */
function splitDepsItems(inner: string): string[] {
  // 移除单行/多行注释
  const cleaned = inner
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return cleaned
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 把字符串转换为 PascalCase。
 * 例如：`my-page` -> `MyPage`、`my_page` -> `MyPage`、`mypage` -> `Mypage`。
 */
function toPascal(input: string): string {
  return input
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** 把文件名风格的 kebab/snake 转成 PascalCase 标识符（暴露用） */
export function pkgNameToIdentifier(pkgName: string): string {
  // @epframe/demo-study-components -> DemoStudyComponents
  const last = pkgName.split('/').pop() ?? pkgName;
  return toPascal(last);
}

/** 转义正则元字符 */
function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 渲染最简页面模板。
 */
function renderPageTemplate(componentName: string, title: string): string {
  return `<template>
  <div class="${kebab(componentName)}-page">
    <h2>${title}</h2>
    <p>这是 ${componentName} 页面，开始编写吧～</p>
  </div>
</template>

<script setup>
/**
 * ${title}
 */
import { ref } from 'vue';

defineOptions({ name: '${componentName}' });

const message = ref('Hello F10');
</script>

<style scoped>
.${kebab(componentName)}-page {
  padding: 16px;
}
</style>
`;
}

/** PascalCase -> kebab-case */
function kebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
