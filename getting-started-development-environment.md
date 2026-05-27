---
title: 开发环境准备
originUrl: http://192.168.219.170/docs/vue/latest/frame/getting-started/development-environment/
---
> 📖 **原文档地址**: [点击查看线上文档](http://192.168.219.170/docs/vue/latest/frame/getting-started/development-environment/)

# 开发环境准备

## 环境准备

开始开发之前，请确认本地环境中安装好了 `nodejs` 的环境和 `git` 。

## nodejs 环境安装

### 通过 Node 版本管理器安装

随着开发的进行，不同的项目中可能会有不同 nodejs 版本的要求，因此推荐使用 nvm 来安装和管理 nodejs。

#### windows

大部分人的操作系统是 Windows，而 Windows 下安装 nodejs 推荐使用 nvm 安装, nvm 可以便捷的安装多个版本的 nodejs 并支持快速
切换当前使用的 nodejs 版本。

**安装 nvm**

可自行从 [https://github.com/coreybutler/nvm-windows](https://github.com/coreybutler/nvm-windows) 下载。

备用下载链接为 [http://192.168.219.54/software/](http://192.168.219.54/docs/software/nvm-setup.exe)

安装完成后可使用 nvm 来安装和管理 nodejs.

**设置国内下载镜像**

在 cmd 或者 powershell 中使用如下代码设置即可

```sh
nvm node_mirror  https://npmmirror.com/mirrors/node/
nvm npm_mirror https://npmmirror.com/mirrors/npm/
```

这样可以从国内地址开始下载，速度更快更稳定。

**安装特定版本的 nodejs**

对于 nodejs 的安装，正常情况下都是安装其 LTS 版本，也就是版本号首位是偶数的版本，如 22.x.x, 20.x.x, 18.x.x 等。

框架中使用推荐的 nodejs 版本为 22.21.1。

```sh
nvm install 22.21.1

# 查看已经安装的nodejs版本
nvm ls

# 切换并使用 nodejs 版本
nvm use xxx
```

#### Mac 和 Linux

mac 和 Linux 系统也可以使用 nvm 来安装 nodejs，你可以从此处
[https://github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm) 获取安装步骤和文件

在设置国内下载镜像时，mac 和 Linux 系统的设置方式和 windows 略有不同，这里使用的是环境变量，具体设置方式如下：

```sh
# 设置环境变量
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
# 进行安装
nvm install 22.21.1
```

后续步骤和 windows 相同，在安装完成后参考 windows 的设置即可。

:::warning

如果你是 M 系列设备，且需要使用 v16 以下版本的 nodejs, nvm 上的支持可能有问题，解决方案参考
[https://github.com/nvm-sh/nvm?tab=readme-ov-file#macos-troubleshooting](https://github.com/nvm-sh/nvm?tab=readme-ov-file#macos-troubleshooting)

:::

### 直接安装 nodejs

如果你不涉及多个版本的 nodejs，也可以直接从 [https://nodejs.org/](https://nodejs.org/) 下载安装包双击进行安装，此操作各
个系统基本均是一致的，不再展开描述。

注意需下载 LTS 的版本，如 22.x.x, 20.x.x, 18.x.x 等。

### nrm 安装

nrm 是一个可以管理和快速切换 npm 安装源的管理工具。 我们公司需要使用私有源，由于存在切换源的需求，建议安装 nrm 来管理源
，常用命令如下：

```sh
# 安装 (这时候通常还没有配置好私有源，且公司的私有源需要登录，因此对此工具的安装单独指定安装源)
npm install -g nrm  --registry=https://registry.npmmirror.com
# 查看可用
nrm ls
# 测试速度
nrm test
# 添加新的源
nrm add [名称] [地址]
# 切换源
nrm use [名称]
```

### 添加公司私有源 {#use-epoint-npm-repository}

```sh
# 设置新点源 通过 nrm add [名称] [地址]
nrm add epoint http://192.168.0.99:8081/nexus/repository/npmpublic/
# 切换到新点源
nrm use epoint
# 登录 用户名  epointfe  密码 11111 邮箱随便输入 （使用的是公司的nexus，因此也可以直接使用原本用户获取jar包的nexus-Maven的账号密码）
npm login

# 测试速度
nrm test
# 输出如下：
  npm ------------ timeout (Fetch timeout over 5000 ms)
  yarn ----------- 1009 ms
  tencent -------- 418 ms
  cnpm ----------- 1272 ms
  taobao --------- 139 ms
  npmMirror ------ 1806 ms
* epoint --------- 24 ms (Fetch error, if this is your private registry, please ignore)
  epointAdmin ---- 22 ms (Fetch error, if this is your private registry, please ignore)

# 查看
nrm ls
# 输出如下：
  npm ---------- https://registry.npmjs.org/
  yarn --------- https://registry.yarnpkg.com/
  tencent ------ https://mirrors.cloud.tencent.com/npm/
  cnpm --------- https://r.cnpmjs.org/
  taobao ------- https://registry.npmmirror.com/
  npmMirror ---- https://skimdb.npmjs.com/registry/
* epoint ------- http://192.168.0.99:8081/nexus/repository/npmpublic/
```

此时即可使用公司私有源进行安装依赖。

上面的登录步骤只需要进行一次，登录凭证会自动保存在用户目录下的 `.npmrc` 下。 如果你需要在集成平台、CICD 环境中也使用公司
的私有源，为避免重复进行上面的配置，你可以将这个 `.npmrc` 放到仓库的根目录下提交，源和登录配置是保存在此文件中的，将会被
自动使用。

正常情况下，在公司内使用时，直接上源设置成 `http://192.168.0.99:8081/nexus/repository/npmpublic/`，它将自动优先使用公司
内部的发布，但不存在时，将从 `https://registry.npmmirror.com/` 获取并缓存。

![](images/nexus-npm.png)

### 将包发布的到公司私有的仓库中

如果你开发的包需要发布到公司的 npm 仓库中，这需要新增一个源：

:::hl{title="注意"}

以下的 epointAdmin 只是一个名字，你可以自己随便取。

但 `http://192.168.0.99:8081/nexus/repository/epoint-hosted/` 这个仓库地址是前端研发的私有仓库地址，按照公司约定，不同产品线有自己的私有仓库地址以及账号密码，其后端的 Nexus 仓库共享账号密码。具体地址及其账号密码请咨询产品线负责人。

:::

```sh
# 新增新点发布源
nrm add epointAdmin http://192.168.0.99:8081/nexus/repository/epoint-hosted/
# 切换到新点源
nrm use epointAdmin
# 登录
npm login

# 发布 在你仓库的根目录下
npm publish
```

发布包的名字建议规范化。

前端研发部内部约定前端统一发布在 `@epoint-fe` 命令空间下，即 `package.json` 中的 `name` 为 `"@epoint-fe/*"`, 如：
`"@epoint-fe/eui-icon"` `"@epoint-fe/eui-components"` `"@epoint-fe/eui-theme-idea"`。

建议包安装功能或者相关业务，指定好统一的前缀：比如前端框架 ui 相关的全部以 `"@epoint-fe/eui-"` 开头， 电子表单相关的包，
名称都以 `"@epoint-fe/sform-"` 开头。

### 安装 pnpm

pnpm 是一个新的包管理器，其可以在电脑上的一个位置安装依赖，在使用的地方使用软连接，从而大幅提升安装速度并节约本地磁盘的
占用，具体可参阅 [pnpm](https://pnpm.io/zh/)

在已经具备 node 的环境下，直接将 pnpm 当作一个 npm 包安装即可：

```sh
# 安装 目前推荐使用 v10 版本
npm install -g pnpm@10
```

pnpm 的常规使用基本上和 npm 一样，将 npm 替换为 pnpm 即可，如：

```sh
# 运行定义好的 sctipts
pnpm run xxx
# 安装依赖
pnpm install xxx
# 安装依赖（作为开发环境的依赖）
pnpm install xxx -D
```

## Git 安装

Git 已经在公司使用多年，且掌握 git 的使用应该是每个程序员的基本能力，此处不再赘述。
[http://192.168.219.54/docs/software/Git-2.53.0.2-64-bit.exe](http://192.168.219.54/docs/software/Git-2.53.0.2-64-bit.exe)

## 安装 create-eui 命令行工具

```sh
npm install @epframe/eui-cli -g
```

`eui-cli` 为公司内部 vue 组件化开发的脚手架命令。

### 创建组件化开发工程

`eui-cli init` 命令是用来创建一个标准组件化开发工程的。

![init](./images/development-environment/cli-init.png)

第一步组织名称请根据自己所在的业务 BG 进行选择。

创建完成后，会在当前目录下新建一个以你输入的项目名字为命名的文件夹，作为组件化开发的工程。并在 `/packages` 目录下自动新
建好以你输入的项目名字为命名的 web 模板工程。

### 创建 web 开发模板

`eui-cli web` 命令是用来创建一个 web 开发模板的。

![web](./images/development-environment/cli-web.png)

创建完成后，会在当前目录下新建一个以你输入的项目名字为命名的 web 模板工程。

### 创建组件开发模板

`eui-cli comp` 命令是用来创建一个组件开发模板的。

![comp](./images/development-environment/cli-comp.png)

在创建过程中，会对你输入的组件名做重名检测，以保证你的组件发布后是唯一的。

创建完成后，会在当前目录下新建一个以你输入的组件名字为命名的组件模板工程。

### 创建 workspace 工作区

`eui-cli workspace` 命令（别名为 `eui-cli ws`）是用来创建一个 pnpm 的 workspace 工作区的。它适用于将原有非 pnpm 管理的工
程（例如后端工程）变成 pnpm 管理的工作区中，以便使用 pnpm 的[工作空间](https://www.pnpm.cn/workspaces) 功能。

该命令会在当前目录下创建一个 `package.json` 和 `pnpm-workspace.yaml` 文件。`pnpm-workspace.yaml` 文件中已配置了通用的工
作空间目录，让 pnpm 可以识别到我们的工程中的所有前端包。

![workspace](./images/development-environment/cli-workspace.png)

### 初始化配置

`eui-cli init-config` 命令（别名为 `eui-cli ic`）是用来初始化脚手架配置的。它会在当前目录下生成 `eui-cli.config.json` 配置文件。以后在该目录下再运行脚手架命令，就会自动去读取配置。

![init-config](./images/development-environment/cli-init-config.png)

目前支持 `build` 和 `update` 两个脚本命令参数的配置：

```json
{
  "build": {
    // 是否静默执行
    "silent": boolean,
    // 是否跳过版本检测
    "ignoreVersionCheck": boolean,
    // 要跳过编译的包目录
    "skipPackages": string[]
  },
  "update": {
    // 是否静默执行
    "silent": boolean,
    // 是否不自动更新 package.json 文件
    "noSave": boolean
  }
}
```

### 编译所有包

为了方便一次性编译所有包，脚手架工具提供了一个 `eui-cli build` 命令来编译所有包。

该命令会扫描当前目录下的所有 npm 包，然后依次执行包里面的 `build` 脚本命令。

![build](./images/development-environment/cli-build.png)

### 发布包

脚手架工具提供了一个 `eui-cli publish` 命令来进行包的发布。

该命令需要在要发布包的根目录下运行。该命令会根据你的选择来自动提升包的版本号，并发布到 npm 仓库中。

![publish](./images/development-environment/cli-publish.png)

**可选参数：**

- `--increment`：指定版本号升级类型，可选值为 "major"、"minor"、"patch" 或 "prerelease"，默认为 "patch"。对应命令行交互
  中的版本升级选项：

![publish-increment](./images/development-environment/cli-publish-increment.png)

- `--no-git-checks`：跳过 git 代码检测与提交流程。
- `--silent`：以静默模式执行发布，无需人工交互。可与 `--increment` 参数搭配使用，指定版本号的升级类型。

![publish-help](./images/development-environment/cli-publish-help.png)

### 更新包

脚手架工具提供了 `eui-cli update` 命令用于检测和更新依赖包。

**使用说明：**

- 该命令必须在 web 工程根目录下运行
- 仅检测并更新以 `@ep` 开头的自研包，不处理第三方依赖包
- 更新完成后会自动修改 `package.json` 和 `pnpm-lock.yaml` 文件中的版本信息

![cli-up](./images/development-environment/cli-up.png)

**可选参数：**

- `--no-save`：更新包但不修改 `package.json` 和 `pnpm-lock.yaml` 文件
- `--silent`：静默模式执行更新，自动将所有可更新的包升级到最新版本

:::warning

**注意**：更新后需手动将修改提交到 git 仓库中

:::
