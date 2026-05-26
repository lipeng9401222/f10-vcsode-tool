# F10 VSCode Tool

F10 Vue 组件化框架一站式开发助手。把官方文档里的零散命令变成 VSCode 侧边栏的一组按钮：环境安装、工程初始化、启动、打包、上传部署，全部点一下就能跑。

文档来源：

- [开发环境准备](../../vue-docs-for-ai-main/vue-docs/getting-started/getting-started-development-environment.md)
- [快速开始](../../vue-docs-for-ai-main/vue-docs/getting-started/getting-started-quick-start.md)
- [创建 web 工程](../../vue-docs-for-ai-main/vue-docs/getting-started/getting-started-create-web-project.md)
- [创建组件工程](../../vue-docs-for-ai-main/vue-docs/getting-started/getting-started-create-component-project.md)
- [启动工程](../../vue-docs-for-ai-main/vue-docs/getting-started/getting-started-start-project.md)
- [工程部署](../../vue-docs-for-ai-main/vue-docs/getting-started/getting-started-deploy-project.md)
- [全流程体验](../../vue-docs-for-ai-main/vue-docs/getting-started/getting-started-full-process-experience.md)

## 功能

侧边栏 `F10 VSCode Tool` 视图包含以下命令组：

### 初始化

| 命令 | 描述 |
| --- | --- |
| 环境安装 | 一键安装 nvm / Node.js 22.21.1 / pnpm@10 / @epframe/eui-cli，并配置公司私有源（mac/win 各一份脚本） |
| 快速开始 | `git clone http://192.168.217.8/epoint-framework/datamodel/epoint-demo/` 并切换到 develop 分支 |
| 创建工作区 | `eui-cli ws` |
| 创建 web 工程 | `eui-cli web` |
| 创建组件工程 | `eui-cli comp` |

### 开发

| 命令 | 描述 |
| --- | --- |
| 安装依赖 | 工作区根 `pnpm install` |
| 编译所有包 | 工作区根 `eui-cli build`（源码依赖的子组件必须先 build） |
| 启动工程 | web 工程目录 `pnpm run dev` |

### 部署

| 命令 | 描述 |
| --- | --- |
| 打包部署 | web 工程目录 `pnpm run build`，输出到 `dist/` |
| 上传应用 | 读取 `f10-tool.config.json`，把 dist 打成 zip 后 multipart/form-data 上传 |

### 设置

打开 / 创建工作区根目录下的 `f10-tool.config.json`。

## 上传配置

上传命令依赖工作区根下的 `f10-tool.config.json`，结构如下：

```json
{
  "uploadUrl": "http://your-server.example.com/api/app/upload",
  "appName": "demo-web",
  "version": "1.0.0",
  "distDir": "dist",
  "fileField": "file",
  "extraFields": {
    "channel": "beta"
  },
  "headers": {
    "Authorization": "Bearer xxxxx"
  }
}
```

字段说明：

| 字段 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| uploadUrl | ✅ | - | 后端接收上传的接口地址 |
| appName | ✅ | - | 应用标识，会作为 form-data 字段一起上传 |
| version | ✅ | - | 版本号，会作为 form-data 字段一起上传 |
| distDir | ❌ | dist | 待打包的目录名 |
| fileField | ❌ | file | multipart/form-data 中文件字段名 |
| extraFields | ❌ | {} | 额外要附带的表单字段 |
| headers | ❌ | {} | 额外的 HTTP 请求头（如鉴权 token） |

执行流程：

1. 找到 dist 目录（先看工作区根 `dist/`，再让你选择 web 工程下的 dist）
2. 用内置 ZIP 实现把它压成 `<appName>-<version>.zip`，放在 `.f10-upload/` 临时目录
3. multipart/form-data POST 到 `uploadUrl`，附带 `appName / version / extraFields`
4. 输出 HTTP 状态码与响应内容到 "F10 VSCode Tool" 输出面板

## 设置

可在 VSCode 设置中调整：

- `f10.nodeVersion`：环境安装的 Node.js 版本，默认 `22.21.1`
- `f10.npmRegistry`：公司私有源地址
- `f10.demoGitRepo`：epoint-demo 默认仓库地址
- `f10.demoBranch`：epoint-demo 默认分支

## 开发

```sh
cd vscode-plugin/f10-vscode-tool
npm install
npm run build       # 一次性构建
npm run watch       # 开发态监听
npm run package     # 打包成 .vsix（需先安装 @vscode/vsce）
```

按 F5 在 VSCode 中调试插件（或在该目录用 "Run Extension" 启动）。

## 注意

- 多数命令直接在 VSCode 集成终端中执行，便于交互（如 `eui-cli web` 需要选条线、输入名称；`npm login` 需要密码）
- 一键环境安装是"尽力而为"的脚本，不同电脑环境差异较大，如某一步失败，请打开输出面板按提示手工执行剩余步骤
- 如果你已经在公司内网，可以直接使用 `npmRegistry` 配置项指定的私有源，不必重复执行 `nrm add epoint`
