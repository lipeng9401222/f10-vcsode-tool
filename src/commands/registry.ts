import * as vscode from 'vscode';
import { runInTerminal } from '../utils/runner';

/**
 * 命令：添加公司私有源（基于 nrm）
 *
 * 行为：
 *  1. 在终端执行 `npm i -g nrm --registry=https://registry.npmmirror.com`（已安装会跳过下载，但仍会输出确认信息）
 *  2. `nrm add epoint <地址>`（已存在会报错，但不影响后续 use）
 *  3. `nrm use epoint`
 *  4. 提示用户在同一终端继续执行 `npm login`（用户名 epointfe / 密码 11111 / 邮箱随意）
 *
 * 对应文档：development-environment.md - 添加公司私有源章节
 */
export async function addEpointRegistryCommand(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('f10');
  const registry = cfg.get<string>('npmRegistry') ?? 'http://192.168.0.99:8081/nexus/repository/npmpublic/';

  const ans = await vscode.window.showInformationMessage(
    `将依次执行：\n` +
      `1) 全局安装 nrm（如未安装）\n` +
      `2) 添加 epoint 源 → ${registry}\n` +
      `3) 切换到 epoint 源\n` +
      `4) 提示你在终端运行 npm login（用户名 epointfe / 密码 11111）\n\n是否继续？`,
    { modal: true },
    '继续'
  );
  if (ans !== '继续') return;

  // 单条复合命令一次性发到终端，便于用户观察整体进度
  const cmd = [
    'npm i -g nrm --registry=https://registry.npmmirror.com',
    `nrm add epoint ${registry} || true`,
    'nrm use epoint',
    'echo "👉 现在请运行 npm login，用户名 epointfe，密码 11111，邮箱随意"'
  ].join(' && ');
  runInTerminal(cmd, {
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
    terminalName: 'F10 添加公司私有源'
  });
}

/**
 * 命令：安装 @epframe/eui-cli。
 * 直接在终端跑 `npm install -g @epframe/eui-cli`。
 *
 * 对应文档：development-environment.md - 安装 create-eui 命令行工具章节
 */
export async function installEuiCliCommand(): Promise<void> {
  runInTerminal('npm install -g @epframe/eui-cli', {
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
    terminalName: 'F10 安装 eui-cli'
  });
}
