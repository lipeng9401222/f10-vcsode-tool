import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { runInTerminal } from '../utils/runner';
import { getOutput, log } from '../utils/output';

/**
 * 命令：环境安装（一键）
 *
 * 流程：在 VSCode 终端中执行平台对应的脚本，依次完成：
 *   nvm → Node → nrm → 公司私有源 → pnpm@10 → @epframe/eui-cli。
 * 最后一步 `npm login` 因为是交互式输入，由脚本提示用户在同一终端中手动完成。
 */
export async function installEnvCommand(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('f10');
  const nodeVersion = cfg.get<string>('nodeVersion') ?? '22.21.1';
  const registry = cfg.get<string>('npmRegistry') ?? 'http://192.168.0.99:8081/nexus/repository/npmpublic/';

  const choice = await vscode.window.showInformationMessage(
    `F10 环境安装将依次：\n\n` +
      `  1) 安装 nvm（如未安装）\n` +
      `  2) 配置 nvm 国内镜像\n` +
      `  3) 安装 Node.js ${nodeVersion}\n` +
      `  4) 安装 nrm 并添加 epoint 私有源\n` +
      `  5) 安装 pnpm@10\n` +
      `  6) 安装 @epframe/eui-cli\n\n` +
      `完成后会提示你在同一终端执行 npm login（用户名 epointfe / 密码 11111）。\n\n是否继续？`,
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
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
    runInTerminal(cmd, {
      cwd,
      terminalName: 'F10 环境安装',
      env: { NODE_VERSION: nodeVersion, EPOINT_REGISTRY: registry }
    });
  } else {
    // mac/linux：直接通过环境变量喂给 bash
    const cmd = `NODE_VERSION="${nodeVersion}" EPOINT_REGISTRY="${registry}" bash "${scriptPath}"`;
    runInTerminal(cmd, { cwd, terminalName: 'F10 环境安装' });
  }

  void vscode.window.showInformationMessage(
    'F10 环境安装脚本已在终端启动。脚本结束后请按提示执行 npm login，并重启 VSCode 让新环境变量生效。'
  );
}
