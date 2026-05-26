import * as vscode from 'vscode';

/**
 * 侧边栏树节点。
 *
 * 顶层节点为 5 大功能分组：环境安装、快速开始、创建工程、启动工程、打包部署、上传应用、设置。
 * 叶子节点点击后触发对应的 VSCode 命令。
 */
export interface TreeNodeData {
  /** 显示名称 */
  label: string;
  /** 描述（次要文字） */
  description?: string;
  /** 图标 codicon 名称（不含 $()） */
  icon?: string;
  /** 触发的命令 id；有则视为可运行项 */
  commandId?: string;
  /** 子节点，存在子节点时折叠展示 */
  children?: TreeNodeData[];
  /** 鼠标提示 */
  tooltip?: string;
}

class F10TreeItem extends vscode.TreeItem {
  /**
   * 构造侧边栏项。
   * @param data 节点定义
   */
  constructor(public readonly data: TreeNodeData) {
    const collapsibleState = data.children && data.children.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    super(data.label, collapsibleState);
    this.tooltip = data.tooltip ?? data.label;
    this.description = data.description;
    if (data.icon) {
      this.iconPath = new vscode.ThemeIcon(data.icon);
    }
    if (data.commandId) {
      this.command = {
        command: data.commandId,
        title: data.label
      };
      this.contextValue = 'f10.runnable';
    } else {
      this.contextValue = 'f10.group';
    }
  }
}

/**
 * 侧边栏 TreeDataProvider 实现。
 */
export class F10TreeDataProvider implements vscode.TreeDataProvider<TreeNodeData> {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  /** 顶层节点定义，结构与文档六大流程对应 */
  private readonly roots: TreeNodeData[] = [
    {
      label: '初始化',
      icon: 'rocket',
      tooltip: '环境与项目初始化相关命令',
      children: [
        {
          label: '环境安装',
          description: 'nvm / node / pnpm / eui-cli',
          icon: 'cloud-download',
          commandId: 'f10.installEnvironment',
          tooltip: '一键安装 Node.js、pnpm、@epframe/eui-cli 与公司私有源'
        },
        {
          label: '快速开始',
          description: 'git clone epoint-demo',
          icon: 'rocket',
          commandId: 'f10.quickStart',
          tooltip: '从远程仓库拉取示例工程并切换到指定分支'
        },
        {
          label: '创建工作区',
          description: 'eui-cli ws',
          icon: 'new-folder',
          commandId: 'f10.createWorkspace'
        },
        {
          label: '创建 web 工程',
          description: 'eui-cli web',
          icon: 'new-file',
          commandId: 'f10.createWebProject'
        },
        {
          label: '创建组件工程',
          description: 'eui-cli comp',
          icon: 'symbol-package',
          commandId: 'f10.createCompProject'
        }
      ]
    },
    {
      label: '配置接入',
      icon: 'settings-gear',
      tooltip: '工程创建后的自动化配置',
      children: [
        {
          label: '开启 Mock 模式',
          description: '修改 src/config.js',
          icon: 'beaker',
          commandId: 'f10.enableMockMode',
          tooltip: 'PC web 工程开启 isMock=true'
        },
        {
          label: '接入组件工程',
          description: '修改 package.json + setup.js',
          icon: 'link',
          commandId: 'f10.linkCompToWeb',
          tooltip: '把组件工程加入 web 工程的 dependencies 与 deps'
        },
        {
          label: '新增页面',
          description: 'src/views/<dir>/<page>.vue',
          icon: 'file-add',
          commandId: 'f10.createPage',
          tooltip: '在组件工程的 src/views 下生成 Vue 页面'
        }
      ]
    },
    {
      label: '开发',
      icon: 'play',
      children: [
        {
          label: '安装依赖',
          description: 'pnpm install',
          icon: 'package',
          commandId: 'f10.installDeps'
        },
        {
          label: '编译所有包',
          description: 'eui-cli build',
          icon: 'tools',
          commandId: 'f10.buildAll'
        },
        {
          label: '启动工程',
          description: 'pnpm run dev',
          icon: 'play',
          commandId: 'f10.startProject'
        }
      ]
    },
    {
      label: '部署',
      icon: 'cloud-upload',
      children: [
        {
          label: '打包部署',
          description: 'pnpm run build',
          icon: 'package',
          commandId: 'f10.buildProject'
        },
        {
          label: '上传应用',
          description: '基于 f10-tool.config.json',
          icon: 'cloud-upload',
          commandId: 'f10.uploadApp'
        }
      ]
    },
    {
      label: '设置',
      icon: 'gear',
      commandId: 'f10.openSettings',
      tooltip: '打开/创建 f10-tool.config.json 上传配置'
    }
  ];

  /** 触发刷新 */
  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: TreeNodeData): vscode.TreeItem {
    return new F10TreeItem(element);
  }

  getChildren(element?: TreeNodeData): TreeNodeData[] {
    if (!element) return this.roots;
    return element.children ?? [];
  }
}
