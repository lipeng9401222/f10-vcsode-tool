import * as vscode from 'vscode';
import { F10TreeDataProvider } from './tree/treeProvider';
import { installEnvCommand } from './commands/installEnv';
import { addEpointRegistryCommand, installEuiCliCommand } from './commands/registry';
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
import { isF10Project } from './utils/workspace';
import { log } from './utils/output';

/** 处于 F10 工程时的禁用提示文案 */
const DISABLE_HINT = '当前已是 F10 工程，初始化与配置接入相关命令已禁用。如需使用，请在非 F10 工程目录中操作。';

/**
 * 计算并刷新 F10 工程上下文。
 * - 探测当前活动 workspace 是否是 F10 工程
 * - 同步给 TreeDataProvider 与 setContext('f10.inF10Project', boolean)，
 *   后者可在 package.json menus 中通过 when 引用，做更细粒度的控制
 */
function refreshF10Context(tree: F10TreeDataProvider): void {
  const folders = vscode.workspace.workspaceFolders;
  let inProject = false;
  if (folders && folders.length > 0) {
    inProject = folders.some((f) => isF10Project(f.uri.fsPath));
  }
  tree.setInF10Project(inProject);
  void vscode.commands.executeCommand('setContext', 'f10.inF10Project', inProject);
  log(`[context] f10.inF10Project = ${inProject}`);
}

/**
 * 包装一条会被"F10 工程内禁用"的命令：
 * 处于 F10 工程时直接弹错并 return，不执行原有逻辑。
 */
function disabledInF10<T>(tree: F10TreeDataProvider, fn: () => T | Promise<T>): () => Promise<T | void> {
  return async () => {
    if (tree.inF10Project) {
      void vscode.window.showErrorMessage(DISABLE_HINT);
      return;
    }
    return fn();
  };
}

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

  // 首次探测 + 监听 workspace 变化与关键文件改动，同步禁用态
  refreshF10Context(tree);
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => refreshF10Context(tree))
  );
  // 监听 package.json / pnpm-workspace.yaml 的增删改：用户一旦完成 eui-cli ws/web/comp，
  // 这两类文件会增多，重新计算 F10 工程上下文，及时切换禁用态。
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/{package.json,pnpm-workspace.yaml}'
  );
  const onChange = (): void => refreshF10Context(tree);
  context.subscriptions.push(
    watcher,
    watcher.onDidCreate(onChange),
    watcher.onDidDelete(onChange),
    watcher.onDidChange(onChange)
  );

  /**
   * 注册命令简写。
   */
  const reg = (id: string, fn: (...args: unknown[]) => unknown): void => {
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  };

  // 初始化 + 配置接入相关命令：在 F10 工程内调用时直接弹错拒绝执行。
  // 这样除了点侧边栏外，命令面板触发也能拦住。
  reg('f10.installEnvironment', disabledInF10(tree, () => installEnvCommand(context)));
  reg('f10.addEpointRegistry', disabledInF10(tree, () => addEpointRegistryCommand()));
  reg('f10.installEuiCli', disabledInF10(tree, () => installEuiCliCommand()));

  reg('f10.createWorkspace', disabledInF10(tree, () => createWorkspaceCommand()));
  reg('f10.createWebProject', disabledInF10(tree, () => createWebProjectCommand()));
  reg('f10.createCompProject', disabledInF10(tree, () => createCompProjectCommand()));

  reg('f10.enableMockMode', () => enableMockModeCommand());
  reg('f10.linkCompToWeb', () => linkCompToWebCommand());
  reg('f10.createPage', () => createPageCommand());

  reg('f10.installDeps', () => installDepsCommand());
  reg('f10.buildAll', () => buildAllCommand());
  reg('f10.startProject', () => startProjectCommand());

  reg('f10.buildProject', () => buildProjectCommand());
  reg('f10.uploadApp', () => uploadAppCommand());
  reg('f10.openSettings', () => openSettingsCommand());

  reg('f10.refreshTree', () => {
    refreshF10Context(tree);
    tree.refresh();
  });
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
