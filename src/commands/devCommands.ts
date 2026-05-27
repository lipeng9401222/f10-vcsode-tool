import * as vscode from 'vscode';
import { runInTerminal } from '../utils/runner';
import { getWorkspaceRoot, pickWebProject } from '../utils/workspace';

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
 * 在 web 工程目录下执行 build，产出 dist 目录。
 * 对应文档：getting-started-deploy-project.md - 打包 web 工程
 */
export async function buildProjectCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;
  const webDir = await pickWebProject(root);
  if (!webDir) return;
  runInTerminal('pnpm run build', { cwd: webDir, terminalName: 'F10 打包部署' });
}
