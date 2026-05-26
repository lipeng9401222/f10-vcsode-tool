import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  CONFIG_FILE_NAME,
  readUploadConfig,
  writeDefaultUploadConfig,
  UploadConfig
} from '../utils/config';
import { getWorkspaceRoot, exists, pickWebProject } from '../utils/workspace';
import { zipDirectory } from '../utils/zip';
import { uploadFile } from '../utils/upload';
import { getOutput, log } from '../utils/output';

/**
 * 命令：打开/创建上传配置文件。
 * 找不到时自动写入模板，并提示编辑。
 */
export async function openSettingsCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;
  const file = path.join(root, CONFIG_FILE_NAME);
  if (!exists(file)) {
    writeDefaultUploadConfig(root);
    void vscode.window.showInformationMessage(`已创建默认配置 ${CONFIG_FILE_NAME}，请编辑后再执行上传。`);
  }
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
}

/**
 * 命令：上传应用。
 * 流程：
 *  1. 检查配置文件 f10-tool.config.json，缺失则提示创建
 *  2. 找到 dist 目录（优先 web 工程下；否则用工作区根下的 dist）
 *  3. 将 dist 打包为 zip
 *  4. multipart/form-data POST 到配置的 uploadUrl，附带 appName / version 字段
 */
export async function uploadAppCommand(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  let cfg: UploadConfig | undefined;
  try {
    cfg = readUploadConfig(root);
  } catch (e) {
    void vscode.window.showErrorMessage((e as Error).message);
    return;
  }
  if (!cfg) {
    const ans = await vscode.window.showInformationMessage(
      `未找到 ${CONFIG_FILE_NAME}，是否现在创建模板？`,
      '创建并编辑',
      '取消'
    );
    if (ans === '创建并编辑') await openSettingsCommand();
    return;
  }

  if (!cfg.uploadUrl || cfg.uploadUrl.includes('your-server.example.com')) {
    void vscode.window.showErrorMessage(`请先在 ${CONFIG_FILE_NAME} 中填写真实的 uploadUrl 后再上传`);
    await openSettingsCommand();
    return;
  }

  // 确定 dist 目录：先看 web 工程，再看 root
  const distName = cfg.distDir ?? 'dist';
  let distDir: string | undefined;

  // 1. 工作区根下直接命中
  if (exists(path.join(root, distName))) {
    distDir = path.join(root, distName);
  } else {
    // 2. 让用户选择 web 工程
    const webDir = await pickWebProject(root);
    if (webDir && exists(path.join(webDir, distName))) {
      distDir = path.join(webDir, distName);
    }
  }
  if (!distDir) {
    void vscode.window.showErrorMessage(
      `未找到 ${distName} 目录，请先执行 "F10: 打包部署" 生成构建产物`
    );
    return;
  }

  getOutput().show(true);
  log(`使用配置：${JSON.stringify({ ...cfg, headers: cfg.headers ? '<redacted>' : undefined })}`);
  log(`待上传目录：${distDir}`);

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'F10 上传应用', cancellable: false },
    async (progress) => {
      try {
        progress.report({ message: '打包 dist 目录中...' });
        const zipName = `${cfg!.appName}-${cfg!.version}.zip`;
        const zipPath = path.join(root, '.f10-upload', zipName);
        zipDirectory(distDir!, zipPath);
        const stat = fs.statSync(zipPath);
        log(`打包完成：${zipPath}（${(stat.size / 1024).toFixed(1)} KB）`);

        progress.report({ message: `上传 ${zipName} 中...` });
        const fields: Record<string, string> = {
          appName: cfg!.appName,
          version: cfg!.version,
          ...(cfg!.extraFields ?? {})
        };
        const result = await uploadFile({
          url: cfg!.uploadUrl,
          filePath: zipPath,
          fileField: cfg!.fileField ?? 'file',
          fields,
          headers: cfg!.headers ?? {}
        });
        log(`服务端响应 [${result.status}]：${result.body}`);

        if (result.status >= 200 && result.status < 300) {
          void vscode.window.showInformationMessage(
            `✅ 上传成功（HTTP ${result.status}）：${cfg!.appName}@${cfg!.version}`
          );
        } else {
          void vscode.window.showErrorMessage(
            `❌ 上传失败（HTTP ${result.status}），详见输出面板。`
          );
        }
      } catch (e) {
        log(`[error] ${(e as Error).message}`);
        void vscode.window.showErrorMessage(`上传过程异常：${(e as Error).message}`);
      }
    }
  );
}
