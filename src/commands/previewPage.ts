import * as vscode from 'vscode';
import * as path from 'path';
import {
  getWorkspaceRoot,
  pickCompProject,
  pickWebProject,
  readBasePathFromConfig,
  normalizeBasePath
} from '../utils/workspace';
import { parseStaticRoutes, StaticRoute } from '../utils/staticRouteParser';
import { runInTerminal } from '../utils/runner';
import { probeTcp, waitForPort } from '../utils/probe';
import { log } from '../utils/output';

/** 工作区记忆 key */
const MEMENTO_HOST_KEY = 'f10.preview.host';
const MEMENTO_PORT_KEY = 'f10.preview.port';
const MEMENTO_BASE_KEY = 'f10.preview.basePath';
const MEMENTO_WEB_KEY = 'f10.preview.webDir';
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = '5173';

/**
 * 命令：在浏览器中预览页面。
 *
 * 路由数据源（按优先级）：
 *   1. 组件工程 + web 工程的 src/router/static.js（ROOT_ROUTES + MENU_ROUTES）
 *      —— 这是 epoint 框架真正生效的路由，文件路径不会自动派生
 *   2. 没解析到任何静态路由时，给出明显警告并提示：
 *      "请先在 src/router/static.js 中声明路由"，不再回退到文件路径派生（避免误导）
 *
 * 流程：
 *   1. 选组件工程 → 解析它和所属 workspace 中所有相关 web 工程的 static.js
 *   2. 路由列表 QuickPick（标注来源 root/menu + 来源文件 + .vue 是否找到）
 *   3. 推断 host/port/basePath（可记忆，可手输）
 *   4. 探活 dev server，未启动则询问是否一键 `pnpm run dev --force` 并轮询等待
 */
export async function previewPageCommand(context: vscode.ExtensionContext): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  // 1. 选组件工程
  const compDir = await pickCompProject(root);
  if (!compDir) return;

  // 2. 解析所选组件工程的 src/router/static.js
  //    注意：epoint 框架的 ROOT_ROUTES / MENU_ROUTES 都声明在组件工程里。
  //    web 工程的 static.js 通常是空的（实际路由由各个组件包自己声明），
  //    所以这里只读所选组件工程，结果更聚焦也更符合用户心智。
  const routes = parseStaticRoutes(compDir);
  log(`[preview] static routes total = ${routes.length} from ${compDir}`);

  if (routes.length === 0) {
    const ans = await vscode.window.showErrorMessage(
      `epoint 框架不会按文件目录派生路由：\n\n${path.basename(compDir)}/src/router/static.js 中没有声明任何路由。\n\n请先在 ROOT_ROUTES 或 MENU_ROUTES 中声明 path 与 component 后再使用预览。`,
      '打开 static.js',
      '取消'
    );
    if (ans === '打开 static.js') {
      const sampleFile = path.join(compDir, 'src', 'router', 'static.js');
      try {
        const doc = await vscode.workspace.openTextDocument(sampleFile);
        await vscode.window.showTextDocument(doc);
      } catch {
        void vscode.window.showWarningMessage(`未能打开：${sampleFile}`);
      }
    }
    return;
  }

  // 3. 让用户选一条路由
  const picked = await pickRouteFromList(routes);
  if (!picked) return;

  // 4. 选 web 工程：用上次记忆，没记忆则让用户选
  const ws = context.workspaceState;
  const lastWeb = ws.get<string>(MEMENTO_WEB_KEY);
  let webDir: string | undefined;
  if (lastWeb && pathExists(lastWeb)) {
    webDir = lastWeb;
  } else {
    webDir = await pickWebProject(root);
    if (!webDir) return;
    await ws.update(MEMENTO_WEB_KEY, webDir);
  }

  // 5. basePath 推断
  let basePath = ws.get<string>(MEMENTO_BASE_KEY) ?? readBasePathFromConfig(webDir);
  if (!basePath) {
    const userInput = await vscode.window.showInputBox({
      prompt: '请输入 web 工程的 basePath（即 vite 的 base，例如 /epoint-web）',
      value: '/epoint-web',
      ignoreFocusOut: true
    });
    if (!userInput) return;
    basePath = userInput;
  }
  basePath = normalizeBasePath(basePath);

  // 6. host:port
  const host = ws.get<string>(MEMENTO_HOST_KEY) ?? DEFAULT_HOST;
  const port = ws.get<string>(MEMENTO_PORT_KEY) ?? DEFAULT_PORT;
  const userHost = await vscode.window.showInputBox({
    prompt: '请输入 vite dev server 的 host:port',
    value: `${host}:${port}`,
    ignoreFocusOut: true,
    validateInput: (v) =>
      /^[\w.\-]+:\d+$/.test(v.trim()) ? undefined : '格式应为 host:port，例如 localhost:5174'
  });
  if (!userHost) return;
  const [h, pStr] = userHost.trim().split(':');
  const portNum = Number(pStr);
  await ws.update(MEMENTO_HOST_KEY, h);
  await ws.update(MEMENTO_PORT_KEY, pStr);
  await ws.update(MEMENTO_BASE_KEY, basePath);

  // 7. 拼接最终 URL
  // route.path 可能以 `/` 开头（ROOT_ROUTES）或不开头（MENU_ROUTES）
  // 拼接前后规则：始终保证 basePath + 路由 path 中间只有一个 `/`
  const routePath = stripLeadingSlash(picked.path);
  const url = `http://${h}:${pStr}${basePath}/${routePath}`;
  log(`[preview] target=${url} (kind=${picked.kind}, source=${picked.source})`);

  // 8. 探活 → 如未启动询问启动
  const alive = await probeTcp(h, portNum, 800);
  if (alive) {
    await openInBrowser(url);
    return;
  }
  const ans = await vscode.window.showWarningMessage(
    `未检测到 ${h}:${pStr} 上的服务。需要先启动 ${path.basename(webDir)} 的 dev server（pnpm run dev --force）吗？`,
    { modal: true },
    '启动并预览',
    '只显示 URL'
  );
  if (ans !== '启动并预览') {
    if (ans === '只显示 URL') {
      void vscode.window.showInformationMessage(`URL：${url}（请手动启动 dev 后访问）`);
    }
    return;
  }

  // 9. 启动 dev + 轮询等待
  runInTerminal('pnpm run dev --force', { cwd: webDir, terminalName: 'F10 启动工程' });
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `等待 ${h}:${pStr} 启动…`,
      cancellable: true
    },
    async (progress, token) => {
      progress.report({ message: '正在轮询端口（最多 2 分钟）' });
      const ready = await waitForPort(h, portNum, 120_000, 800, token);
      if (token.isCancellationRequested) {
        log('[preview] 用户取消等待');
        return;
      }
      if (!ready) {
        const retryAns = await vscode.window.showErrorMessage(
          `等待超时：${h}:${pStr} 仍未就绪。可能 vite 选了别的端口（默认会从 5173 递增）。`,
          '重新输入端口',
          '取消'
        );
        if (retryAns === '重新输入端口') {
          await previewPageCommand(context);
        }
        return;
      }
      log(`[preview] dev server up, opening ${url}`);
      await openInBrowser(url);
    }
  );
}

/**
 * 让用户在静态路由列表中选一条。
 * 显示形式：
 *   $(symbol-event) /car-apply-add        car-apply-add → src/views/car-apply/car-apply-add.vue
 *   $(symbol-event) demo/page/...         menu · web-eva-plus/src/router/static.js
 */
async function pickRouteFromList(routes: StaticRoute[]): Promise<StaticRoute | undefined> {
  // 同 path 去重（保留第一条）
  const seen = new Set<string>();
  const unique = routes.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });

  // 排序：root 在前、menu 在后；同组按 path 升序
  unique.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'root' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  const items = unique.map((r) => {
    const kindBadge = r.kind === 'root' ? '$(symbol-event) [root]' : '$(list-tree) [menu]';
    const fileLabel = r.vueFile ? toShort(r.vueFile) : r.componentImport ?? '<未识别 component>';
    return {
      label: `${kindBadge} ${r.path}`,
      description: r.name ? `name: ${r.name}` : undefined,
      detail: `${fileLabel}  ←  ${toShort(r.source)}`,
      route: r
    };
  });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `选择要预览的静态路由（共 ${unique.length} 条；root = 根路由，menu = 菜单路由）`,
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });
  return picked?.route;
}

function stripLeadingSlash(p: string): string {
  return p.replace(/^\/+/, '');
}

function toShort(abs: string): string {
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return ws && abs.startsWith(ws) ? abs.slice(ws.length + 1) : abs;
}

async function openInBrowser(url: string): Promise<void> {
  const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
  if (!opened) {
    void vscode.window.showWarningMessage(`无法打开浏览器，URL：${url}`);
  }
}

function pathExists(p: string): boolean {
  try {
    return require('fs').existsSync(p);
  } catch {
    return false;
  }
}
