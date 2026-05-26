import * as vscode from 'vscode';
import * as path from 'path';
import {
  getWorkspaceRoot,
  pickWebProject,
  pickCompProject,
  findSetupFile,
  findConfigJsFile,
  readPackageName
} from '../utils/workspace';
import {
  addWorkspaceDependency,
  setMockTrue,
  injectComponentIntoSetup,
  createViewPage,
  pkgNameToIdentifier
} from '../utils/sourceEdit';
import { log } from '../utils/output';

/**
 * 命令：开启 mock 模式
 * - 找到 web 工程的 src/config.js
 * - 把 isMock 改为 true
 *
 * 对应文档需求：PC 工程创建后需要把 src/config.js 的 isMock 配置为 true。
 */
export async function enableMockModeCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  const webDir = await pickWebProject(root);
  if (!webDir) return;

  const configPath = findConfigJsFile(webDir);
  if (!configPath) {
    void vscode.window.showErrorMessage(
      `未在 ${path.basename(webDir)}/src 下找到 config.js / config.ts`
    );
    return;
  }

  try {
    const result = setMockTrue(configPath);
    log(`[enableMock] ${result.message} (${result.filePath ?? ''})`);
    if (result.changed) {
      void vscode.window.showInformationMessage(`✅ ${result.message}`);
      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc);
    } else {
      void vscode.window.showInformationMessage(result.message);
    }
  } catch (e) {
    void vscode.window.showErrorMessage((e as Error).message);
  }
}

/**
 * 命令：把组件工程接入 web 工程
 * - 用户选择目标 web 工程与要接入的组件工程
 * - 自动改 web 工程：
 *    1. package.json: dependencies 添加 `<comp>: workspace:*`
 *    2. src/setup.js|ts: 加 import 样式 + import 默认导出 + 写入 deps 数组
 * - 完成后建议用户执行 pnpm install + eui-cli build
 *
 * 对应文档需求：组件工程创建完成后接入 web 工程的两步操作。
 */
export async function linkCompToWebCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  const webDir = await pickWebProject(root);
  if (!webDir) return;
  const compDir = await pickCompProject(root);
  if (!compDir) return;

  const compPkgName = readPackageName(compDir);
  if (!compPkgName) {
    void vscode.window.showErrorMessage(
      `未读取到 ${path.basename(compDir)}/package.json 的 name 字段`
    );
    return;
  }

  const setupPath = findSetupFile(webDir);
  if (!setupPath) {
    void vscode.window.showErrorMessage(
      `未在 ${path.basename(webDir)}/src 下找到 setup.js / setup.ts`
    );
    return;
  }
  const webPkgPath = path.join(webDir, 'package.json');

  const identifier = pkgNameToIdentifier(compPkgName);
  log(`[linkComp] web=${webDir} comp=${compPkgName} identifier=${identifier}`);

  try {
    const r1 = addWorkspaceDependency(webPkgPath, compPkgName);
    log(`[linkComp][pkg] ${r1.message}`);

    const r2 = injectComponentIntoSetup(setupPath, compPkgName, identifier);
    log(`[linkComp][setup] ${r2.message}`);

    const summary =
      `[1/2] ${r1.changed ? '✏️' : '✅'} ${r1.message}\n` +
      `[2/2] ${r2.changed ? '✏️' : '✅'} ${r2.message}`;

    if (r1.changed || r2.changed) {
      const ans = await vscode.window.showInformationMessage(
        `已接入 ${compPkgName} 到 ${path.basename(webDir)}：\n${summary}\n建议运行 pnpm install 与 eui-cli build。`,
        '运行 pnpm install',
        '查看 setup 文件',
        '关闭'
      );
      if (ans === '运行 pnpm install') {
        await vscode.commands.executeCommand('f10.installDeps');
      } else if (ans === '查看 setup 文件') {
        const doc = await vscode.workspace.openTextDocument(setupPath);
        await vscode.window.showTextDocument(doc);
      }
    } else {
      void vscode.window.showInformationMessage(`${compPkgName} 已接入，无需修改`);
    }
  } catch (e) {
    void vscode.window.showErrorMessage(`接入失败：${(e as Error).message}`);
  }
}

/**
 * 命令：在组件工程的 src/views 下生成新页面
 *
 * - 用户选择组件工程
 * - 用户输入相对路径，例如 `demo` / `demo/index` / `user/list`
 *   * 生成 src/views/<相对路径>.vue
 *   * 自动创建中间目录
 *   * 已存在则不覆盖
 */
export async function createPageCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  const compDir = await pickCompProject(root);
  if (!compDir) return;

  const relPath = await vscode.window.showInputBox({
    prompt: `在 ${path.basename(compDir)}/src/views 下创建页面，输入相对路径（不含 .vue）`,
    placeHolder: '例如 demo/index、user/list、profile',
    ignoreFocusOut: true,
    validateInput: (v) => {
      if (!v || !v.trim()) return '路径不能为空';
      if (/[<>"|?*]/.test(v)) return '路径包含非法字符';
      return undefined;
    }
  });
  if (!relPath) return;

  const title = await vscode.window.showInputBox({
    prompt: '页面标题（可留空）',
    placeHolder: '例如：示例页面',
    ignoreFocusOut: true
  });

  try {
    const result = createViewPage(compDir, relPath.trim(), title?.trim() || undefined);
    log(`[createPage] ${result.message}`);
    if (result.changed && result.filePath) {
      void vscode.window.showInformationMessage(`✅ ${result.message}`);
      const doc = await vscode.workspace.openTextDocument(result.filePath);
      await vscode.window.showTextDocument(doc);
    } else {
      void vscode.window.showWarningMessage(result.message);
    }
  } catch (e) {
    void vscode.window.showErrorMessage(`创建页面失败：${(e as Error).message}`);
  }
}
