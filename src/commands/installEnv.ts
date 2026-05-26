import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { runInTerminal } from '../utils/runner';
import { getOutput, log } from '../utils/output';

/**
 * 命令：环境安装
 * - 检测当前平台，调用对应的一键安装脚本
 * - 在终端中执行，便于用户观察进度并交互（npm login 等）
 */
export async function installEnvCommand(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('f10');
  const nodeVersion = cfg.get<string>('nodeVersion') ?? '22.21.1';
  const registry = cfg.get<string>('npmRegistry') ?? 'http://192.168.0.99:8081/nexus/repository/npmpublic/';

  const choice = await vscode.window.showInformationMessage(
    `F10 环境安装将自动安装 nvm / Node.js ${nodeVersion} / pnpm@10 / @epframe/eui-cli，并配置公司私有源。\n\n是否继续？`,
    { modal: true },
    '继续',
    '查看脚本'
  );
  if (!choice) return;

  const isWin = process.platform === 'win32';
  const scriptName = isWin ? 'install-env-win.ps1' : 'install-env-mac.sh';
  const scriptPath = path.join(context.extensionPath, 'dist', 'scripts', scriptName);

  if (choice === '查看脚本') {
    const doc = await vscode.workspace.openTextDocument(scriptPath);
    await vscode.window.showTextDocument(doc);
    return;
  }

  log(`开始执行环境安装脚本：${scriptPath}`);
  getOutput().show(true);

  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir();

  if (isWin) {
    // 使用 PowerShell 执行
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
    runInTerminal(cmd, {
      cwd,
      terminalName: 'F10 环境安装',
      env: { NODE_VERSION: nodeVersion, EPOINT_REGISTRY: registry }
    } as any);
  } else {
    // mac/linux：先 chmod +x，再执行；通过 env 设置变量
    const cmd = `NODE_VERSION="${nodeVersion}" EPOINT_REGISTRY="${registry}" bash "${scriptPath}"`;
    runInTerminal(cmd, { cwd, terminalName: 'F10 环境安装' });
  }

  void vscode.window.showInformationMessage(
    'F10 环境安装脚本已在终端启动。安装完成后请重启 VSCode 以加载最新的环境变量。'
  );
}
