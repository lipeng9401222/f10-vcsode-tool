# F10 VSCode Tool

F10 Vue 组件化框架一站式开发助手。把官方文档里的零散命令变成 VSCode 侧边栏的一组按钮：环境安装、添加私有源、工程初始化、Mock 模式、组件接入、创建页面、启动、打包、上传部署，全部点一下就能跑。

文档来源（公司内网）：

- 开发环境准备 `http://192.168.219.170/docs/vue/latest/frame/getting-started/development-environment/`
- 创建 web 工程 `http://192.168.219.170/docs/vue/latest/frame/getting-started/create-web-project/`
- 创建组件工程 `http://192.168.219.170/docs/vue/latest/frame/getting-started/create-component-project/`
- 启动工程 `http://192.168.219.170/docs/vue/latest/frame/getting-started/start-project/`
- 工程部署 `http://192.168.219.170/docs/vue/latest/frame/getting-started/deploy-project/`

## 功能

侧边栏 `F10 VSCode Tool` 视图包含以下命令组。所有命令在 F10 工程内也保持可点击；涉及重复初始化的命令会在执行流程中按需提示确认。

### 初始化

| 命令 | 描述 |
| --- | --- |
| 环境安装 | 一键安装 nvm / Node.js / nrm + 公司私有源 / pnpm@10 / @epframe/eui-cli，最后引导执行 `npm login` |
| 添加公司私有源 | `npm i -g nrm` → `nrm add epoint <url>` → `nrm use epoint`，并提示 `npm login` |
| 安装 eui-cli | `npm install -g @epframe/eui-cli` |
| 创建工作区 | `eui-cli ws` |
| 创建 web 工程 | `eui-cli web`，结束后弹出"开启 Mock 模式"快捷入口 |
| 创建组件工程 | `eui-cli comp`，结束后弹出"接入组件工程"快捷入口 |

### 配置接入

| 命令 | 描述 |
| --- | --- |
| 开启 Mock 模式 | 把 web 工程 `src/config.js` 的 `isMock` 改为 `true`（幂等） |
| 接入组件工程 | 自动改 web 工程的 `package.json.dependencies` 与 `src/setup.js` 的 import 与 `deps` 数组 |

### 开发

| 命令 | 描述 |
| --- | --- |
| 安装依赖 | 工作区根 `pnpm install` |
| 编译所有包 | 工作区根 `eui-cli build`（源码依赖的子组件必须先 build） |
| 启动工程 | web 工程目录 `pnpm run dev --force` |
| 创建页面 | 在组件工程的 `src/views/<相对路径>.vue` 创建 Vue 页面（自动建多级目录、不覆盖） |
| 页面预览 | 扫描组件工程 `src/views`，选择页面后在浏览器中打开 |

### 部署

| 命令 | 描述 |
| --- | --- |
| 打包部署 | web 工程目录 `pnpm run build`，输出到 `dist/` |
| 上传应用 | 读取 `f10-tool.config.json`，校验必填字段，把 dist 打成 zip 后 multipart/form-data 上传 |

### 设置

打开 / 创建工作区根目录下的 `f10-tool.config.json`。

## 上传配置

上传命令依赖工作区根下的 `f10-tool.config.json`，结构如下：

```json
{
  "uploadUrl": "http://your-server.example.com/api/app/upload",
  "appName": "demo-web",
  "version": "1.0.0",
  "sdocKey": "",
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
| sdocKey | ✅ | - | 魔方平台应用 Key，未填会弹错"请前往魔方平台创建应用获取应用 key" |
| distDir | ❌ | dist | 待打包的目录名 |
| fileField | ❌ | file | multipart/form-data 中文件字段名 |
| extraFields | ❌ | {} | 额外要附带的表单字段 |
| headers | ❌ | {} | 额外的 HTTP 请求头（如鉴权 token） |

执行流程：

1. 找到 dist 目录（先看工作区根 `dist/`，再让你选择 web 工程下的 dist）
2. 用内置 ZIP 实现把它压成 `<appName>-<version>.zip`，放在 `.f10-upload/` 临时目录
3. multipart/form-data POST 到 `uploadUrl`，附带 `appName / version / sdocKey / extraFields`
4. 输出 HTTP 状态码与响应内容到 "F10 VSCode Tool" 输出面板

## 设置

可在 VSCode 设置中调整：

- `f10.nodeVersion`：环境安装的 Node.js 版本，默认 `22.21.1`
- `f10.npmRegistry`：公司私有源地址，默认 `http://192.168.0.99:8081/nexus/repository/npmpublic/`

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
- 如果你已经在公司内网且配过私有源，可以跳过"环境安装"，单独使用"安装 eui-cli"命令
