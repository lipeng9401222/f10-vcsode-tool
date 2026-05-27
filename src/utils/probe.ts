import * as http from 'http';
import * as net from 'net';

/**
 * 端口/服务探活与等待工具，仅依赖 Node 内置模块。
 *
 * 设计动机：vite dev server 启动后没有"启动完成"事件可监听（终端里只是输出
 * "ready in xxx ms"），所以选用最稳的"端口轮询"做就绪判断。
 */

/**
 * 通过 TCP 连接探测 host:port 是否在监听。
 *
 * @param host  目标 host，例如 localhost
 * @param port  端口号
 * @param timeoutMs 单次连接超时
 */
export function probeTcp(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    try {
      sock.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

/**
 * 通过 HTTP GET 探测 url 是否能拿到响应。
 * 任何 HTTP 状态码（包括 4xx/5xx）都视为"服务存活"。
 */
export function probeHttp(url: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    try {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        // 任何响应都说明服务起来了；消费一下再 destroy 防止积压
        res.resume();
        finish(true);
      });
      req.on('timeout', () => {
        req.destroy();
        finish(false);
      });
      req.on('error', () => finish(false));
    } catch {
      finish(false);
    }
  });
}

/**
 * 轮询等待 host:port 可连通。
 *
 * @param host  目标 host
 * @param port  端口
 * @param totalTimeoutMs 总超时（默认 60s）
 * @param intervalMs     轮询间隔（默认 500ms）
 * @param signal         可选取消信号；触发取消时 Promise 立即 resolve(false)
 */
export async function waitForPort(
  host: string,
  port: number,
  totalTimeoutMs = 60_000,
  intervalMs = 500,
  signal?: { isCancellationRequested: boolean }
): Promise<boolean> {
  const deadline = Date.now() + totalTimeoutMs;
  while (Date.now() < deadline) {
    if (signal?.isCancellationRequested) return false;
    if (await probeTcp(host, port, Math.min(800, intervalMs * 2))) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
