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
  /**
   * 当前 F10 工程内自动禁用的分组标识。
   * - 'init'   : 初始化分组（环境安装、快速开始、创建工程）
   * - 'config' : 配置接入分组（Mock、接入组件、新增页面）
   * 设置后，处于 F10 工程时会被置灰、点击禁用。
   */
  disableInF10?: 'init' | 'config';
}

class F10TreeItem extends vscode.TreeItem {
  /**
   * 构造侧边栏项。
   * @param data 节点定义
   * @param disabled 是否处于禁用态（置灰、不可触发命令）
   */
  constructor(public readonly data: TreeNodeData, disabled: boolean = false) {
    const collapsibleState = data.children && data.children.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    super(data.label, collapsibleState);
    this.tooltip = disabled
      ? `${data.tooltip ?? data.label}（已是 F10 工程，初始化与配置接入相关命令已禁用）`
      : data.tooltip ?? data.label;
    this.description = disabled && data.description
      ? `${data.description}（已禁用）`
      : disabled
        ? '（已禁用）'
        : data.description;
    if (data.icon) {
      this.iconPath = new vscode.ThemeIcon(disabled ? 'circle-slash' : data.icon);
    }
    if (data.commandId && !disabled) {
      this.command = {
        command: data.commandId,
        title: data.label
      };
      this.contextValue = 'f10.runnable';
    } else if (disabled) {
      this.contextValue = 'f10.disabled';
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

  /**
   * 当前是否处于 F10 工程上下文。
   * 设为 true 时，所有 disableInF10 标记的节点会被置灰且不可点击。
   */
  private _inF10Project = false;

  /** 顶层节点定义，结构与文档六大流程对应 */
  private readonly roots: TreeNodeData[] = [
    {
      label: '初始化',
      icon: 'rocket',
      tooltip: '环境与项目初始化相关命令',
      disableInF10: 'init',
      children: [
        {
          label: '环境安装',
          description: '一键：nvm / node / nrm / pnpm / eui-cli',
          icon: 'cloud-download',
          commandId: 'f10.installEnvironment',
          tooltip: '一键安装 nvm、Node.js、nrm 与公司私有源、pnpm、@epframe/eui-cli',
          disableInF10: 'init'
        },
        {
          label: '添加公司私有源',
          description: 'nrm add epoint',
          icon: 'globe',
          commandId: 'f10.addEpointRegistry',
          tooltip: '添加并切换到公司私有源，随后引导执行 npm login',
          disableInF10: 'init'
        },
        {
          label: '安装 eui-cli',
          description: 'npm i -g @epframe/eui-cli',
          icon: 'tools',
          commandId: 'f10.installEuiCli',
          tooltip: '全局安装公司组件化脚手架',
          disableInF10: 'init'
        },
        {
          label: '创建工作区',
          description: 'eui-cli ws',
          icon: 'new-folder',
          commandId: 'f10.createWorkspace',
          disableInF10: 'init'
        },
        {
          label: '创建 web 工程',
          description: 'eui-cli web',
          icon: 'new-file',
          commandId: 'f10.createWebProject',
          disableInF10: 'init'
        },
        {
          label: '创建组件工程',
          description: 'eui-cli comp',
          icon: 'symbol-package',
          commandId: 'f10.createCompProject',
          disableInF10: 'init'
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

  /**
   * 设置 F10 工程上下文。
   * 切换会触发整棵树刷新。
   */
  setInF10Project(value: boolean): void {
    if (this._inF10Project === value) return;
    this._inF10Project = value;
    this.refresh();
  }

  /** 当前是否处于 F10 工程内 */
  get inF10Project(): boolean {
    return this._inF10Project;
  }

  getTreeItem(element: TreeNodeData): vscode.TreeItem {
    const disabled = this._inF10Project && !!element.disableInF10;
    return new F10TreeItem(element, disabled);
  }

  getChildren(element?: TreeNodeData): TreeNodeData[] {
    if (!element) return this.roots;
    return element.children ?? [];
  }
}
