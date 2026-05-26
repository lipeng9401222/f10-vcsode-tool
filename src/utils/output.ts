import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

/**
 * 获取（懒创建）F10 插件统一日志输出通道。
 */
export function getOutput(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('F10 VSCode Tool');
  }
  return channel;
}

/**
 * 输出一条带时间戳的日志。
 */
export function log(msg: string): void {
  const ts = new Date().toLocaleTimeString();
  getOutput().appendLine(`[${ts}] ${msg}`);
}
