import * as fs from 'fs';
import * as path from 'path';

/**
 * 解析 epoint 框架 web/组件工程下 src/router/static.js 中显式声明的静态路由。
 *
 * 文档原文（vue 框架 setup 阶段）总结：
 * - eui-core 不会"按文件目录派生路由"，最终能访问的 path 必须在 static.js
 *   中显式声明（ROOT_ROUTES / MENU_ROUTES），或来自后端菜单。
 * - ROOT_ROUTES 的 path 以 `/` 开头；MENU_ROUTES 的 path 不以 `/` 开头。
 *
 * 因此预览功能必须以 static.js 为权威数据源。本解析器使用轻量正则，
 * 不依赖 AST，能够处理：
 * - 单/双引号、反引号
 * - 注释（// 与 /* *\/）
 * - 跨行书写（`path: '...',` 和 `component: () => import('...')` 不必同行）
 * - meta 子对象、可选的 name 字段
 */

/** 静态路由所属节点 */
export type RouteKind = 'root' | 'menu';

/**
 * 解析得到的一条路由记录。
 */
export interface StaticRoute {
  /** 来源 .js 文件绝对路径 */
  source: string;
  /** ROOT_ROUTES 还是 MENU_ROUTES */
  kind: RouteKind;
  /** 原始 path 字符串（保留前后斜杠的原貌） */
  path: string;
  /** 路由 name 字段，如果有 */
  name?: string;
  /** import('@/views/xxx.vue') 中的相对路径（含 @/ 前缀） */
  componentImport?: string;
  /** 推断出的 .vue 文件绝对路径，找不到则为 undefined */
  vueFile?: string;
}

/**
 * 给定 web/组件工程根目录，解析其 src/router/static.js（如有）。
 * - rootDir 应该是包含 src/ 的工程根目录
 * - 若文件不存在，返回空数组，不报错
 */
export function parseStaticRoutes(rootDir: string): StaticRoute[] {
  const file = path.join(rootDir, 'src', 'router', 'static.js');
  if (!fileExists(file)) return [];

  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch {
    return [];
  }
  const stripped = stripComments(raw);

  const routes: StaticRoute[] = [];
  for (const kind of ['root', 'menu'] as RouteKind[]) {
    const arrName = kind === 'root' ? 'ROOT_ROUTES' : 'MENU_ROUTES';
    const body = extractArrayBody(stripped, arrName);
    if (!body) continue;
    for (const block of splitObjects(body)) {
      const route = parseRouteObject(block, kind, file, rootDir);
      if (route) routes.push(route);
    }
  }
  return routes;
}

/**
 * 解析一个对象字面量内部文本（不含外层 `{}`），抽出 path / name / component。
 */
function parseRouteObject(
  body: string,
  kind: RouteKind,
  source: string,
  rootDir: string
): StaticRoute | undefined {
  const path0 = matchString(body, /\bpath\s*:\s*(['"`])([^'"`]+)\1/);
  if (!path0) return undefined;
  const name0 = matchString(body, /\bname\s*:\s*(['"`])([^'"`]+)\1/);
  const comp0 = matchString(
    body,
    /\bcomponent\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*(['"`])([^'"`]+)\1\s*\)/
  );

  const r: StaticRoute = {
    source,
    kind,
    path: path0,
    name: name0,
    componentImport: comp0,
    vueFile: comp0 ? resolveImport(comp0, rootDir) : undefined
  };
  return r;
}

/**
 * `import('@/views/foo.vue')` 形式的相对路径解析为绝对路径。
 * - `@/` 在 vite 配置里通常映射到 `<rootDir>/src/`
 * - 也兼容 `./views/foo.vue` 或 `../foo.vue`（基于 src/router/ 目录）
 */
function resolveImport(spec: string, rootDir: string): string | undefined {
  let abs: string;
  if (spec.startsWith('@/')) {
    abs = path.join(rootDir, 'src', spec.slice(2));
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    abs = path.resolve(rootDir, 'src', 'router', spec);
  } else if (spec.startsWith('/')) {
    abs = spec;
  } else {
    // 不识别的 specifier（可能是某个 npm 包），直接返回 undefined
    return undefined;
  }
  return fileExists(abs) ? abs : abs; // 即便文件不存在也返回路径，便于 UI 提示
}

/**
 * 从原始源码中删除单/多行注释。
 */
function stripComments(src: string): string {
  // 多行注释优先（避免出现 /* // */ 误删）
  let s = src.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return s;
}

/**
 * 提取 `export const NAME = [ ... ];` 的数组体（不含外层方括号）。
 */
function extractArrayBody(src: string, arrName: string): string | undefined {
  const re = new RegExp(`export\\s+const\\s+${arrName}\\s*=\\s*\\[`, 'm');
  const m = re.exec(src);
  if (!m) return undefined;
  const start = m.index + m[0].length; // 跳过 `[`
  // 找匹配的 ]
  let depth = 1;
  let i = start;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    if (depth === 0) break;
    i += 1;
  }
  if (depth !== 0) return undefined;
  return src.slice(start, i);
}

/**
 * 把 `{ ... }, { ... }, { ... }` 形式的数组体切分成对象内部块。
 * 返回每个对象字面量的内部文本（不含外层 `{}`）。
 */
function splitObjects(body: string): string[] {
  const parts: string[] = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] !== '{') {
      i += 1;
      continue;
    }
    // 找匹配的 }
    let depth = 1;
    const start = i + 1;
    i += 1;
    while (i < body.length && depth > 0) {
      const ch = body[i];
      if (ch === '"' || ch === "'" || ch === '`') {
        // 跳过字符串
        const quote = ch;
        i += 1;
        while (i < body.length && body[i] !== quote) {
          if (body[i] === '\\') i += 1;
          i += 1;
        }
        i += 1;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      if (depth === 0) {
        parts.push(body.slice(start, i));
        i += 1;
        break;
      }
      i += 1;
    }
    if (depth > 0) break; // 未配对，避免死循环
  }
  return parts;
}

function matchString(text: string, re: RegExp): string | undefined {
  const m = re.exec(text);
  if (!m) return undefined;
  return m[2] ?? m[1];
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
