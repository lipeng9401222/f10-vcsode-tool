import * as fs from 'fs';
import * as path from 'path';
import { exists } from './workspace';

/**
 * 组件工程 src/views 下的视图条目。
 *
 * 树形结构以便 QuickPick 分级选择：
 * - kind = 'dir' 表示目录，需要继续向下钻取
 * - kind = 'file' 表示一个 .vue 文件，对应一个可访问的页面路由
 *
 * routePath 是相对于 views 根的路由路径（不含扩展名、不含前导斜杠），
 * 例如 `home/car-apply-list`、`user/list`、`profile`。
 */
export type ViewNode =
  | {
      kind: 'dir';
      /** 显示名（dirname） */
      name: string;
      /** 相对 views 根的子路径（用 `/` 分隔） */
      relPath: string;
      /** 子节点 */
      children: ViewNode[];
    }
  | {
      kind: 'file';
      /** 显示名（basename without extension） */
      name: string;
      /** 路由路径，例如 `home/car-apply-list` */
      routePath: string;
      /** 文件绝对路径 */
      filePath: string;
    };

/**
 * 递归扫描组件工程的 src/views 目录，返回页面树。
 *
 * 规则：
 * - 仅识别 `.vue` 文件作为可访问页面
 * - 目录名 `index.vue` 与父目录路由相同：例如 `home/index.vue` 路由是 `home`，单独保留为同级 file 节点
 * - 跳过 `components/` 子目录（约定它是页面用到的局部子组件，非页面）
 * - 跳过下划线开头的目录与文件（约定为非路由文件）
 */
export function scanViews(compRoot: string): ViewNode[] {
  const viewsDir = path.join(compRoot, 'src', 'views');
  if (!exists(viewsDir)) return [];
  return walk(viewsDir, '');
}

function walk(absDir: string, relDir: string): ViewNode[] {
  const result: ViewNode[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(absDir);
  } catch {
    return result;
  }

  for (const name of entries.sort()) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const abs = path.join(absDir, name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    const childRel = relDir ? `${relDir}/${name}` : name;

    if (stat.isDirectory()) {
      // 跳过明显是子组件目录的命名
      if (name === 'components' || name === 'images' || name === 'assets') continue;
      const children = walk(abs, childRel);
      if (children.length > 0) {
        result.push({ kind: 'dir', name, relPath: childRel, children });
      }
    } else if (stat.isFile() && name.endsWith('.vue')) {
      const baseNoExt = name.slice(0, -'.vue'.length);
      // index.vue 当成"父目录的入口"，路由就是父目录路径
      // 但当父目录就是 views 根时，index.vue 仍然算一个独立条目，路由 = 'index'
      const routePath = relDir
        ? baseNoExt === 'index'
          ? relDir
          : `${relDir}/${baseNoExt}`
        : baseNoExt;
      result.push({ kind: 'file', name: baseNoExt, routePath, filePath: abs });
    }
  }

  // 排序：目录在前，文件在后
  result.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

/**
 * 把页面树拍平成"全部叶子"，可用于一次性选择。
 */
export function flattenViews(nodes: ViewNode[]): Array<{ routePath: string; filePath: string }> {
  const out: Array<{ routePath: string; filePath: string }> = [];
  const dfs = (list: ViewNode[]): void => {
    for (const n of list) {
      if (n.kind === 'file') out.push({ routePath: n.routePath, filePath: n.filePath });
      else dfs(n.children);
    }
  };
  dfs(nodes);
  return out;
}
