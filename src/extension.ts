import * as vscode from 'vscode';
import { F10TreeDataProvider } from './tree/treeProvider';
import { installEnvCommand } from './commands/installEnv';
import { quickStartCommand } from './commands/quickStart';
import {
  createWorkspaceCommand,
  createWebProjectCommand,
  createCompProjectCommand
} from './commands/createProject';
import {
  installDepsCommand,
  buildAllCommand,
  startProjectCommand,
  buildProjectCommand
} from './commands/devCommands';
import { uploadAppCommand, openSettingsCommand } from './commands/uploadApp';
import {
  enableMockModeCommand,
  linkCompToWebCommand,
  createPageCommand
} from './commands/integrate';
import { log } from './utils/output';

/**
 * 插件激活入口。
 * 注册侧边栏视图与所有命令。
 */
export function activate(context: vscode.ExtensionContext): void {
  log('F10 VSCode Tool 激活');

  const tree = new F10TreeDataProvider();
  const view = vscode.window.createTreeView('f10VscodeTool.tree', {
    treeDataProvider: tree,
    showCollapseAll: false
  });
  context.subscriptions.push(view);

  /**
   * 注册命令简写。
   */
  const reg = (id: string, fn: (...args: unknown[]) => unknown): void => {
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  };

  reg('f10.installEnvironment', () => installEnvCommand(context));
  reg('f10.quickStart', () => quickStartCommand());

  reg('f10.createWorkspace', () => createWorkspaceCommand());
  reg('f10.createWebProject', () => createWebProjectCommand());
  reg('f10.createCompProject', () => createCompProjectCommand());

  reg('f10.enableMockMode', () => enableMockModeCommand());
  reg('f10.linkCompToWeb', () => linkCompToWebCommand());
  reg('f10.createPage', () => createPageCommand());

  reg('f10.installDeps', () => installDepsCommand());
  reg('f10.buildAll', () => buildAllCommand());
  reg('f10.startProject', () => startProjectCommand());

  reg('f10.buildProject', () => buildProjectCommand());
  reg('f10.uploadApp', () => uploadAppCommand());
  reg('f10.openSettings', () => openSettingsCommand());

  reg('f10.refreshTree', () => tree.refresh());
  reg('f10.runTreeItem', async (...args: unknown[]) => {
    const node = args[0] as { commandId?: string } | undefined;
    if (node?.commandId) {
      await vscode.commands.executeCommand(node.commandId);
    }
  });
}

/** 插件停用 */
export function deactivate(): void {
  log('F10 VSCode Tool 停用');
}
