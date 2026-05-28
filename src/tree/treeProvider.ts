import * as vscode from 'vscode';

/**
 * 侧边栏树节点。
 *
 * 顶层节点为 5 大功能分组：初始化、配置接入、开发、部署、设置。
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

  /** 顶层节点定义，结构与主要开发流程对应 */
  private readonly roots: TreeNodeData[] = [
    {
      label: '初始化',
      icon: 'rocket',
      tooltip: '环境与项目初始化相关命令',
      children: [
        {
          label: '环境安装',
          commandId: 'f10.installEnvironment',
          tooltip: '一键安装 nvm、Node.js、nrm 与公司私有源、pnpm、@epframe/eui-cli'
        },
        {
          label: '添加公司私有源',
          commandId: 'f10.addEpointRegistry',
          tooltip: '添加并切换到公司私有源，随后引导执行 npm login'
        },
        {
          label: '安装 eui-cli',
          commandId: 'f10.installEuiCli',
          tooltip: '全局安装公司组件化脚手架'
        },
        {
          label: '创建工作区',
          commandId: 'f10.createWorkspace',
          tooltip: '使用 eui-cli ws 创建 F10 工作区'
        },
        {
          label: '创建 web 工程',
          commandId: 'f10.createWebProject',
          tooltip: '使用 eui-cli web 创建 F10 web 启动工程'
        },
        {
          label: '创建组件工程',
          commandId: 'f10.createCompProject',
          tooltip: '使用 eui-cli comp 创建 F10 组件工程'
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
          commandId: 'f10.enableMockMode',
          tooltip: 'PC web 工程开启 isMock=true'
        },
        {
          label: '接入组件工程',
          commandId: 'f10.linkCompToWeb',
          tooltip: '把组件工程加入 web 工程的 dependencies 与 deps'
        }
      ]
    },
    {
      label: '开发',
      icon: 'play',
      children: [
        {
          label: '安装依赖',
          commandId: 'f10.installDeps',
          tooltip: '在工作区根目录安装依赖'
        },
        {
          label: '编译所有包',
          commandId: 'f10.buildAll',
          tooltip: '在工作区根目录编译所有包'
        },
        {
          label: '启动工程',
          commandId: 'f10.startProject',
          tooltip: '选择 web 工程并启动开发服务'
        },
        {
          label: '创建页面',
          commandId: 'f10.createPage',
          tooltip: '在组件工程的 src/views 下创建 Vue 页面'
        },
        {
          label: '页面预览',
          commandId: 'f10.previewPage',
          tooltip: '扫描组件工程 src/views，分级选择页面后用浏览器打开 vite dev 地址'
        }
      ]
    },
    {
      label: '部署',
      icon: 'cloud-upload',
      children: [
        {
          label: '打包部署',
          commandId: 'f10.buildProject',
          tooltip: '选择 web 工程并执行打包'
        },
        {
          label: '上传应用',
          commandId: 'f10.uploadApp',
          tooltip: '基于 f10-tool.config.json 上传应用'
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
