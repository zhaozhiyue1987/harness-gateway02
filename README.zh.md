# AsiaInfo AIGW 凭证路由 Harness 插件

这是独立于 `dsh-higress-ai-route-plugin` 的新插件项目，不覆盖旧插件。

对于任意 Harness 源码部署，可运行 [`scripts/install-native-harness.sh`](./scripts/install-native-harness.sh) 一键完成锁定依赖构建、测试、打包和原生 CLI 安装。脚本不会保存 Console 密码、网关凭证或发现令牌。

插件允许同一 Harness profile 同时绑定多个 Higress `BEARER` 网关凭证。每个连接通过 Console 凭证发现接口读取该凭证可调用的全部 AI 路由，并按“连接 + 路由”创建独立 Provider。路由切换使用 Harness 原生 Provider/模型选择器。

## 克隆并安装

把本仓库克隆到指定目录，再对已有 Harness 源码 checkout 执行一键安装。`PROFILE` 必须已经存在；脚本不会创建 profile 或绑定某个特定运行实例。

```bash
PLUGIN_ROOT="/opt/harness-plugins"
HARNESS_SRC="/opt/harness"
PROFILE="<existing-profile>"

mkdir -p "$PLUGIN_ROOT"
git clone https://github.com/zhaozhiyue1987/harness-gateway02.git \
  "$PLUGIN_ROOT/harness-gateway02"
cd "$PLUGIN_ROOT/harness-gateway02"
HARNESS_SRC="$HARNESS_SRC" PROFILE="$PROFILE" \
  ./scripts/install-native-harness.sh
```

脚本会完成锁定依赖检查、构建、测试、打包和原生 Harness CLI 安装。安装后请重启所选 profile 对应的 Harness Web 进程；Console 地址、Bearer 凭证和路由选择在插件 UI 中配置。

目标 profile 必须已存在。安装完成后需要重启 Harness Web 进程，业务上的 Console 地址、Bearer 凭证和路由选择仍需在 Harness UI 中人工配置。

## 从 Harness 源码 checkout 安装

以下代码块可从任意目录开始。`cd "$PLUGIN_ROOT/harness-gateway02"` 之后，`npm` 命令只在本插件 clone 目录执行；`cd "$HARNESS_SRC"` 之后，`pnpm dsh` 命令只在 Harness 源码目录执行。Harness 源码仓库是 pnpm workspace，不能在 Harness 根目录运行 `npm install`；源码 checkout 也不保证提供全局 `dsh` 命令。

手工安装应使用 Harness 源码 checkout 的 CLI 入口：

```bash
PLUGIN_ROOT="/opt/harness-plugins"
HARNESS_SRC="/opt/harness"
PROFILE="<existing-profile>"

# 插件 clone 目录：在这里执行 npm 命令
cd "$PLUGIN_ROOT/harness-gateway02"
npm ci
npm run typecheck
npm run build
npm test
npm pack

# Harness 源码目录：在这里执行 Harness CLI
cd "$HARNESS_SRC"
pnpm dsh plugin --profile "$PROFILE" add \
  "file:$PLUGIN_ROOT/harness-gateway02/dsh-higress-credential-routes-plugin-0.1.0.tgz"
```

## 源码构建

```bash
npm install
npm run typecheck
npm run build
npm test
npm pack
```

## 安全边界

- 只支持 `BEARER`；暂不支持 `HEADER/QUERY` 和无认证路由。
- 原始网关凭证只保存在 Host credential store，并用于数据面调用和首次 exchange。
- Browser 只获得连接状态、路由摘要和错误码，不获得长期凭证或发现令牌。
- 同一路由被多个凭证连接发现时，Provider ID、凭证引用和 owner 清单相互隔离。
