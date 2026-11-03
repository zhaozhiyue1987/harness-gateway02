# AsiaInfo AIGW 凭证路由 Harness 插件

这是独立于 `dsh-higress-ai-route-plugin` 的新插件项目，不覆盖旧插件。

使用 Harness 源码部署时，可运行 [`scripts/install-native-harness.sh`](./scripts/install-native-harness.sh) 一键完成锁定依赖构建、测试、打包和原生 CLI 安装。脚本不会保存 Console 密码、网关凭证或发现令牌。

插件允许同一 Harness profile 同时绑定多个 Higress `BEARER` 网关凭证。每个连接通过 Console 凭证发现接口读取该凭证可调用的全部 AI 路由，并按“连接 + 路由”创建独立 Provider。路由切换使用 Harness 原生 Provider/模型选择器。

```bash
HARNESS_SRC=/opt/dsh/harness PROFILE=web \
  ./scripts/install-native-harness.sh
```

目标 profile 必须已存在。安装完成后需要重启 Harness Web 进程，业务上的 Console 地址、Bearer 凭证和路由选择仍需在 Harness UI 中人工配置。

## 从 Harness 源码 checkout 安装

`npm` 命令只应在本插件目录执行。Harness 源码仓库是 pnpm workspace，不能在 Harness 根目录运行 `npm install`；源码 checkout 也不保证提供全局 `dsh` 命令。

如果当前 Harness 源码位于 `/Users/zhao/项目开发/harness`，手工安装应使用源码 CLI 入口：

```bash
PLUGIN_DIR="/Users/zhao/项目开发/ctc-ctcics-harness-repository/dsh-higress-credential-routes-plugin"
PROFILE="web"

cd "$PLUGIN_DIR"
npm ci
npm run typecheck
npm run build
npm test
npm pack

cd /Users/zhao/项目开发/harness
pnpm dsh plugin --profile "$PROFILE" add \
  file:"$PLUGIN_DIR/dsh-higress-credential-routes-plugin-0.1.0.tgz"
```

当前 `127.0.0.1:3080` 使用 `web` profile；安装到 `demo` profile 不会出现在该实例中。安装后必须重启对应 Harness Web 进程，新的 bundle 才会加载。

## 本地构建

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
