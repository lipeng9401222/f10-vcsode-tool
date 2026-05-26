import * as vscode from 'vscode';
import { spawn, SpawnOptions } from 'child_process';
import { log } from './output';

/**
 * 运行命令的方式。
 * - terminal: 在 VSCode 集成终端中执行（用户可见、可交互）
 * - process: 子进程后台执行（用于脚本化、阻塞等待结果）
 */
export type RunMode = 'terminal' | 'process';

export interface RunOptions {
  /** 工作目录 */
  cwd: string;
  /** 终端名称（terminal 模式下） */
  terminalName?: string;
  /** 是否复用同名终端 */
  reuseTerminal?: boolean;
  /** 子进程模式下额外环境变量 */
  env?: Record<string, string>;
}

/**
 * 在 VSCode 集成终端运行命令，便于交互式 cli（eui-cli web、npm login 等）。
 */
export function runInTerminal(command: string, options: RunOptions): vscode.Terminal {
  const name = options.terminalName ?? 'F10';
  let term: vscode.Terminal | undefined;
  if (options.reuseTerminal !== false) {
    term = vscode.window.terminals.find((t) => t.name === name);
  }
  if (!term) {
    term = vscode.window.createTerminal({ name, cwd: options.cwd });
  }
  term.show(true);
  term.sendText(command, true);
  log(`[terminal:${name}] ${command}  (cwd: ${options.cwd})`);
  return term;
}

/**
 * 子进程模式运行命令，stdout/stderr 重定向到 OutputChannel。
 * @returns 进程退出码
 */
export function runProcess(
  command: string,
  args: string[],
  options: RunOptions,
  onLine?: (line: string) => void
): Promise<number> {
  return new Promise((resolve) => {
    log(`[exec] ${command} ${args.join(' ')} (cwd: ${options.cwd})`);
    const isWin = process.platform === 'win32';
    const spawnOpts: SpawnOptions = {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: isWin
    };
    const child = spawn(command, args, spawnOpts);
    const handle = (chunk: Buffer): void => {
      const text = chunk.toString();
      text.split(/\r?\n/).forEach((line) => {
        if (line) {
          log(line);
          onLine?.(line);
        }
      });
    };
    child.stdout?.on('data', handle);
    child.stderr?.on('data', handle);
    child.on('close', (code) => {
      log(`[exec] exit code: ${code}`);
      resolve(code ?? 0);
    });
    child.on('error', (err) => {
      log(`[exec] error: ${err.message}`);
      resolve(-1);
    });
  });
}
