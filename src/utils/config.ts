import * as fs from 'fs';
import * as path from 'path';

/**
 * 上传配置项结构。
 */
export interface UploadConfig {
  /** 上传接口 URL */
  uploadUrl: string;
  /** 应用名称（业务标识） */
  appName: string;
  /** 应用版本号 */
  version: string;
  /** dist 目录相对路径，默认 dist */
  distDir?: string;
  /** form-data 中文件字段名，默认 file */
  fileField?: string;
  /** 额外要附加的表单字段 */
  extraFields?: Record<string, string>;
  /** 额外的 HTTP 头 */
  headers?: Record<string, string>;
}

export const CONFIG_FILE_NAME = 'f10-tool.config.json';

/**
 * 默认配置模板。
 */
export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  uploadUrl: 'http://your-server.example.com/api/app/upload',
  appName: 'demo-web',
  version: '1.0.0',
  distDir: 'dist',
  fileField: 'file',
  extraFields: {},
  headers: {}
};

/**
 * 读取上传配置，找不到时返回 undefined。
 */
export function readUploadConfig(root: string): UploadConfig | undefined {
  const file = path.join(root, CONFIG_FILE_NAME);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as UploadConfig;
  } catch (e) {
    throw new Error(`读取 ${CONFIG_FILE_NAME} 失败：${(e as Error).message}`);
  }
}

/**
 * 在工作区根目录写入默认配置文件。
 */
export function writeDefaultUploadConfig(root: string): string {
  const file = path.join(root, CONFIG_FILE_NAME);
  fs.writeFileSync(file, JSON.stringify(DEFAULT_UPLOAD_CONFIG, null, 2), 'utf-8');
  return file;
}
