import * as vscode from 'vscode';
import * as path from 'path';
import { runInTerminal } from '../utils/runner';
import { getWorkspaceRoot, pickWebProject, exists } from '../utils/workspace';
import {
  CONFIG_FILE_NAME,
  readUploadConfig,
  writeDefaultUploadConfig,
  UploadConfig
} from '../utils/config';
import * as fs from 'fs';
import { log } from '../utils/output';

/**
 * 命令：安装依赖（pnpm install）
 * 对应文档：getting-started-quick-start.md 第五步、getting-started-start-project.md 第一步
 */
export async function installDepsCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;
  runInTerminal('pnpm install', { cwd: root, terminalName: 'F10 pnpm install' });
}

/**
 * 命令：编译所有包（eui-cli build）
 * 对应文档：getting-started-deploy-project.md - 编译所有包；
 *         getting-started-quick-start.md 第六步：直接通过源码依赖子组件必须 build 后才能在主 web 运行。
 */
export async function buildAllCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;
  runInTerminal('eui-cli build', { cwd: root, terminalName: 'F10 eui-cli build' });
}

/**
 * 命令：启动工程（pnpm run dev --force）
 * 在 web 工程目录下执行。`--force` 用于强制重新预构建，避免 vite 缓存导致问题。
 */
export async function startProjectCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;
  const webDir = await pickWebProject(root);
  if (!webDir) return;
  runInTerminal('pnpm run dev --force', { cwd: webDir, terminalName: 'F10 启动工程' });
}

/**
 * 命令：打包部署（pnpm run build）
 *
 * 改造点：允许用户输入"打包产物名"。例如输入 `manage`，则：
 *   1) 跑完 `pnpm run build` 后产物默认在 dist/
 *   2) 把 dist 重命名为 manage（已存在同名目录会先删除，避免残留）
 *   3) 同步把工作区根 f10-tool.config.json 的 distDir / appName 改成 manage
 *      下游"上传应用"会自动用对的目录，无需再手工改配置
 *
 * 注意：
 * - 用户不输入或保留默认 dist 时，行为与之前完全一致（不改配置）
 * - 单条复合命令在终端里执行，便于用户看到完整过程
 *
 * 对应文档：getting-started-deploy-project.md - 打包 web 工程
 */
export async function buildProjectCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;
  const webDir = await pickWebProject(root);
  if (!webDir) return;

  // 默认值优先取已有 config 中的 distDir，便于多次打包保持一致
  let defaultName = 'dist';
  try {
    const cfg = readUploadConfig(root);
    if (cfg?.distDir) defaultName = cfg.distDir;
  } catch {
    /* ignore parse errors */
  }

  const outName = await vscode.window.showInputBox({
    prompt: '输入打包产物名（默认 dist；自定义后会把 dist 重命名为该名称）',
    value: defaultName,
    ignoreFocusOut: true,
    validateInput: (v) => {
      const t = (v ?? '').trim();
      if (!t) return '名称不能为空';
      if (!/^[A-Za-z0-9_.-]+$/.test(t)) return '名称仅支持字母、数字、下划线、短横线、点';
      if (t === 'node_modules' || t === 'src') return '该名称为常用目录，请避免使用';
      return undefined;
    }
  });
  if (!outName) return;
  const trimmed = outName.trim();

  // 构造命令：pnpm run build && rm -rf <name> && mv dist <name>
  // 默认情况下（用户输入 dist）只跑 pnpm run build
  const isDefault = trimmed === 'dist';
  const isWin = process.platform === 'win32';
  const renameCmd = isWin
    ? `if exist "${trimmed}" rmdir /s /q "${trimmed}" && rename dist "${trimmed}"`
    : `rm -rf "${trimmed}" && mv dist "${trimmed}"`;
  const command = isDefault ? 'pnpm run build' : `pnpm run build && ${renameCmd}`;

  log(`[buildProject] webDir=${webDir} outName=${trimmed}`);
  runInTerminal(command, { cwd: webDir, terminalName: 'F10 打包部署' });

  // 同步 f10-tool.config.json：distDir / appName 都跟随产物名
  if (!isDefault) {
    try {
      await syncUploadConfigForBuild(root, trimmed);
      void vscode.window.showInformationMessage(
        `打包命令已发到终端。完成后产物会重命名为 ${trimmed}/。已同步 ${CONFIG_FILE_NAME} 的 distDir 与 appName。`
      );
    } catch (e) {
      void vscode.window.showWarningMessage(
        `配置同步失败：${(e as Error).message}（请手动检查 ${CONFIG_FILE_NAME}）`
      );
    }
  }
}

/**
 * 把 f10-tool.config.json 的 distDir / appName 同步成本次打包的产物名。
 * 配置文件不存在时按默认模板创建，并立即应用名称。
 */
async function syncUploadConfigForBuild(root: string, outName: string): Promise<void> {
  const file = path.join(root, CONFIG_FILE_NAME);
  let cfg: UploadConfig | undefined;
  if (!exists(file)) {
    writeDefaultUploadConfig(root);
  }
  try {
    cfg = readUploadConfig(root);
  } catch (e) {
    throw new Error(`读取 ${CONFIG_FILE_NAME} 失败：${(e as Error).message}`);
  }
  if (!cfg) throw new Error(`未能读取 ${CONFIG_FILE_NAME}`);
  cfg.distDir = outName;
  cfg.appName = outName;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
}
