import * as vscode from 'vscode';
import * as path from 'path';
import { runInTerminal } from '../utils/runner';
import { getWorkspaceRoot, exists } from '../utils/workspace';

/**
 * 命令：快速开始
 * - 在工作区根目录下，git clone epoint-demo 仓库
 * - 自动切换到指定分支（默认 develop）
 * 对应文档：vue-docs-for-ai-main/vue-docs/getting-started/getting-started-quick-start.md
 */
export async function quickStartCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  const cfg = vscode.workspace.getConfiguration('f10');
  const repoDefault = cfg.get<string>('demoGitRepo') ?? 'git@192.168.217.8:epoint-framework/datamodel/epoint-demo.git';
  const branchDefault = cfg.get<string>('demoBranch') ?? 'develop';

  const repo = await vscode.window.showInputBox({
    prompt: '示例仓库 git 地址',
    value: repoDefault,
    ignoreFocusOut: true
  });
  if (!repo) return;

  const branch = await vscode.window.showInputBox({
    prompt: '要使用的分支',
    value: branchDefault,
    ignoreFocusOut: true
  });
  if (!branch) return;

  // 推断目录名：从仓库 url 末段去掉 .git
  const inferredName = path.basename(repo).replace(/\.git$/, '');
  const target = path.join(root, inferredName);

  if (exists(target)) {
    const choice = await vscode.window.showWarningMessage(
      `目录 ${target} 已存在。是否进入该目录并切换分支？`,
      { modal: true },
      '是',
      '取消'
    );
    if (choice !== '是') return;
    runInTerminal(
      `cd "${target}" && git fetch && git checkout ${branch} && git pull`,
      { cwd: root, terminalName: 'F10 快速开始' }
    );
    return;
  }

  // 拉取仓库 + 进入 + 切分支
  const cmd = `git clone ${repo} "${target}" && cd "${target}" && git checkout ${branch}`;
  runInTerminal(cmd, { cwd: root, terminalName: 'F10 快速开始' });

  void vscode.window.showInformationMessage(
    `已在终端拉取 ${repo} 到 ${target}。完成后请按需要在主 web 工程的 setup.js 中注册组件。`
  );
}
