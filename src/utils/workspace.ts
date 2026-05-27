import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 返回当前活动的工作区根目录绝对路径，没有时弹错并返回 undefined。
 */
export function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showErrorMessage('请先打开一个工作区文件夹再执行 F10 命令');
    return undefined;
  }
  if (folders.length === 1) return folders[0].uri.fsPath;
  // 多根工作区：让用户选
  return folders[0].uri.fsPath;
}

/**
 * 判断目录是否存在。
 */
export function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * 检测当前根目录是否已是 pnpm workspace（同时存在 package.json 和 pnpm-workspace.yaml）。
 */
export function isPnpmWorkspace(root: string): boolean {
  return exists(path.join(root, 'package.json')) && exists(path.join(root, 'pnpm-workspace.yaml'));
}

/**
 * 检测当前工作区是否是 F10 / Epoint 组件化工程。
 *
 * 判定条件（同时满足）：
 * 1. 是 pnpm workspace（存在 package.json + pnpm-workspace.yaml）
 * 2. 工作区下既能找到至少一个 web 工程（package.json 含 scripts.dev、无 exports）
 * 3. 工作区下也能找到至少一个组件工程（含 src/views + package.json.exports）
 *
 * 这样可以避免把"刚创建工作区还没建工程"或"只有 web 工程没有组件包"的目录误判为 F10 工程。
 */
export function isF10Project(root: string): boolean {
  if (!isPnpmWorkspace(root)) return false;
  const webs = findWebProjectDirs(root);
  if (webs.length === 0) return false;
  const comps = findCompProjectDirs(root);
  if (comps.length === 0) return false;
  return true;
}

/**
 * 在 root 下查找看起来像 web 工程的目录：
 * - 存在 package.json
 * - scripts 中包含 dev 命令
 *
 * 同时遍历 root/ 与 root/packages/ 下的一级子目录。
 */
export function findWebProjectDirs(root: string): string[] {
  const result: string[] = [];
  const visit = (parent: string): void => {
    if (!exists(parent)) return;
    for (const name of fs.readdirSync(parent)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const dir = path.join(parent, name);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      const pkgPath = path.join(dir, 'package.json');
      if (!exists(pkgPath)) continue;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        // 通过 exports 字段排除组件工程；web 工程通常没有 exports
        if (pkg.exports) continue;
        if (pkg.scripts && (pkg.scripts.dev || pkg.scripts['dev:h5'])) {
          result.push(dir);
        }
      } catch {
        /* ignore */
      }
    }
  };
  visit(root);
  visit(path.join(root, 'packages'));
  return Array.from(new Set(result));
}

/**
 * 让用户选择一个 web 工程目录。
 */
export async function pickWebProject(root: string): Promise<string | undefined> {
  const candidates = findWebProjectDirs(root);
  if (candidates.length === 0) {
    void vscode.window.showErrorMessage('当前工作区下未找到包含 dev 脚本的 web 工程，请先创建 web 工程');
    return undefined;
  }
  if (candidates.length === 1) return candidates[0];
  const picked = await vscode.window.showQuickPick(
    candidates.map((c) => ({ label: path.basename(c), description: c, value: c })),
    { placeHolder: '请选择要操作的 web 工程目录' }
  );
  return picked?.value;
}

/**
 * 在 root 下递归（一层 + packages/* 一层）查找看起来像组件工程的目录：
 * 判定标准：包含 src/views 目录 + package.json 里 exports['.'] 指向 dist/index.js
 * 同时排除 web 工程（含 scripts.dev = vite，但 exports 字段为空）。
 */
export function findCompProjectDirs(root: string): string[] {
  const result: string[] = [];
  const visit = (parent: string): void => {
    if (!exists(parent)) return;
    for (const name of fs.readdirSync(parent)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const dir = path.join(parent, name);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      if (isCompProjectDir(dir)) result.push(dir);
    }
  };

  visit(root);
  visit(path.join(root, 'packages'));
  // 去重
  return Array.from(new Set(result));
}

/**
 * 判断给定目录是否是组件工程：包含 package.json + src/views + package.json 含 exports。
 */
export function isCompProjectDir(dir: string): boolean {
  const pkgPath = path.join(dir, 'package.json');
  if (!exists(pkgPath)) return false;
  if (!exists(path.join(dir, 'src', 'views'))) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (!pkg.exports) return false;
    // 排除 web 工程：通常 web 工程没有 exports 字段
    return true;
  } catch {
    return false;
  }
}

/**
 * 让用户从找到的组件工程中选一个。如果只有一个直接返回。
 */
export async function pickCompProject(root: string): Promise<string | undefined> {
  const candidates = findCompProjectDirs(root);
  if (candidates.length === 0) {
    void vscode.window.showErrorMessage(
      '当前工作区下未找到组件工程（需要含 src/views 与 package.json.exports）'
    );
    return undefined;
  }
  if (candidates.length === 1) return candidates[0];
  const picked = await vscode.window.showQuickPick(
    candidates.map((c) => ({
      label: path.basename(c),
      description: readPackageName(c) ?? c,
      detail: c,
      value: c
    })),
    { placeHolder: '请选择要操作的组件工程' }
  );
  return picked?.value;
}

/**
 * 读取目录下 package.json 的 name 字段。
 */
export function readPackageName(dir: string): string | undefined {
  const pkgPath = path.join(dir, 'package.json');
  if (!exists(pkgPath)) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return typeof pkg.name === 'string' ? pkg.name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 在 web 工程目录下找到 setup.js 或 setup.ts。
 * 优先 src/setup.js，再 src/setup.ts。
 */
export function findSetupFile(webRoot: string): string | undefined {
  const candidates = [
    path.join(webRoot, 'src', 'setup.js'),
    path.join(webRoot, 'src', 'setup.ts')
  ];
  return candidates.find((p) => exists(p));
}

/**
 * 在 web 工程目录下找到 src/config.js。
 */
export function findConfigJsFile(webRoot: string): string | undefined {
  const candidates = [
    path.join(webRoot, 'src', 'config.js'),
    path.join(webRoot, 'src', 'config.ts')
  ];
  return candidates.find((p) => exists(p));
}

/**
 * 从 web 工程的 src/config.js 中尝试解析 BASEPATH。
 *
 * 兼容两种写法：
 *   const BASEPATH = process.env.VITE_RUN_ALL_PATH?.trim() || "/foo/bar/";
 *   const BASEPATH = "/foo/bar/";
 *
 * 找不到就返回 undefined。
 */
export function readBasePathFromConfig(webRoot: string): string | undefined {
  const file = findConfigJsFile(webRoot);
  if (!file) return undefined;
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch {
    return undefined;
  }
  // 优先匹配字面量字符串里以 `/...` 开头的部分
  const reFallback = /BASEPATH\s*=[^;]*?["'`](\/[^"'`]+)["'`]/m;
  const m = reFallback.exec(raw);
  if (m) {
    return normalizeBasePath(m[1]);
  }
  // 退一步：匹配 basePath: "/foo"
  const reBasePathField = /\bbasePath\s*[:=]\s*["'`](\/[^"'`]+)["'`]/m;
  const m2 = reBasePathField.exec(raw);
  if (m2) return normalizeBasePath(m2[1]);
  return undefined;
}

/**
 * 规范化 base 路径：保证以 `/` 开头，去掉结尾的 `/`。
 */
export function normalizeBasePath(p: string): string {
  let r = p.trim();
  if (!r.startsWith('/')) r = '/' + r;
  if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
  return r;
}
