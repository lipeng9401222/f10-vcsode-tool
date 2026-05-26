import * as vscode from 'vscode';
import { runInTerminal } from '../utils/runner';
import { getWorkspaceRoot, isPnpmWorkspace } from '../utils/workspace';

/**
 * 命令：创建 workspace 工作区（eui-cli ws）
 * 对应文档：getting-started-create-web-project.md 第一步
 */
export async function createWorkspaceCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  if (isPnpmWorkspace(root)) {
    const ans = await vscode.window.showWarningMessage(
      '当前根目录已是 pnpm workspace（已存在 package.json + pnpm-workspace.yaml），是否仍要执行？',
      '继续',
      '取消'
    );
    if (ans !== '继续') return;
  }

  // eui-cli ws 是交互式 cli，一律在终端跑，让用户输入项目名
  runInTerminal('eui-cli ws', { cwd: root, terminalName: 'F10 创建工作区' });
}

/**
 * 命令：创建 web 工程（eui-cli web）
 * 对应文档：getting-started-create-web-project.md 第二步
 */
export async function createWebProjectCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  if (!isPnpmWorkspace(root)) {
    const ans = await vscode.window.showWarningMessage(
      '当前目录还不是 pnpm workspace，建议先执行 "F10: 创建工作区"。是否仍要继续？',
      '仍然继续',
      '先创建工作区',
      '取消'
    );
    if (ans === '先创建工作区') {
      await createWorkspaceCommand();
      return;
    }
    if (ans !== '仍然继续') return;
  }

  runInTerminal('eui-cli web', { cwd: root, terminalName: 'F10 创建 web 工程' });
  void vscode.window.showInformationMessage(
    '终端中创建完成后：选 PC 工程的话，可执行 "F10: 开启 Mock 模式" 自动改 isMock=true。',
    '稍后再说',
    '现在执行'
  ).then((ans) => {
    if (ans === '现在执行') {
      void vscode.commands.executeCommand('f10.enableMockMode');
    }
  });
}

/**
 * 命令：创建组件工程（eui-cli comp）
 * 对应文档：getting-started-create-component-project.md
 */
export async function createCompProjectCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  if (!isPnpmWorkspace(root)) {
    const ans = await vscode.window.showWarningMessage(
      '当前目录还不是 pnpm workspace，建议先执行 "F10: 创建工作区"。是否仍要继续？',
      '仍然继续',
      '先创建工作区',
      '取消'
    );
    if (ans === '先创建工作区') {
      await createWorkspaceCommand();
      return;
    }
    if (ans !== '仍然继续') return;
  }

  runInTerminal('eui-cli comp', { cwd: root, terminalName: 'F10 创建组件工程' });
  void vscode.window.showInformationMessage(
    '终端中创建完成后：可执行 "F10: 接入组件工程" 自动写入 web 工程的 package.json 与 setup.js。',
    '稍后再说',
    '现在接入'
  ).then((ans) => {
    if (ans === '现在接入') {
      void vscode.commands.executeCommand('f10.linkCompToWeb');
    }
  });
}
