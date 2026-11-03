# AsiaInfo AIGW 凭证路由 Harness 插件

这是独立于 `dsh-higress-ai-route-plugin` 的新插件项目，不覆盖旧插件。

对于任意 Harness 源码部署，可运行 [`scripts/install-native-harness.sh`](./scripts/install-native-harness.sh) 一键完成锁定依赖构建、测试、打包和原生 CLI 安装。脚本不会保存 Console 密码、网关凭证或发现令牌。

插件允许同一 Harness profile 同时绑定多个 Higress `BEARER` 网关凭证。每个连接通过 Console 凭证发现接口读取该凭证可调用的全部 AI 路由，并按“连接 + 路由”创建独立 Provider。路由切换使用 Harness 原生 Provider/模型选择器。

## 克隆并安装

把本仓库克隆到指定目录，再对已有 Harness 源码 checkout 执行一键安装。`PROFILE` 必须已经存在；脚本不会创建 profile 或绑定某个特定运行实例。

### 先搞清楚两个目录

安装时一定会用到两个不同的目录，不能把它们填成同一个路径：

| 名称 | 含义 | 目录中应该有什么 | 示例 |
| --- | --- | --- | --- |
| 插件目录 | 从本 GitHub 仓库 clone 出来的 `harness-gateway02` 目录；这里执行 `npm` 命令 | `package.json`、`scripts/`、`src/` | `/Users/你的用户名/harness-plugins/harness-gateway02` |
| Harness 源码目录 | Harness 主仓库的源码 checkout 根目录；这里执行 `pnpm dsh` 命令 | `package.json`、`apps/cli/src/bin.ts`、`apps/` | `/Users/你的用户名/harness` |

目录关系应当类似下面这样。`harness-gateway02` 和 `harness` 是两个并列目录，不是父子目录：

```text
/Users/你的用户名/
├── harness-plugins/
│   └── harness-gateway02/   ← 插件目录：npm ci、npm run build、npm pack
└── harness/                 ← Harness 源码目录：pnpm dsh plugin ... add
```

`PROFILE` 不是目录路径，而是 Harness 中已经存在的 profile 名称，例如 `web`。如果你不知道 profile 名称，可在 Harness 源码目录执行 `pnpm dsh profile list`（以当前 Harness 版本支持的命令为准）或查看现有 `.dsh/profiles/` 目录。

```bash
PLUGIN_ROOT="$HOME/harness-plugins"
HARNESS_SRC="$HOME/harness"
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

如果你不知道 Harness 源码目录是哪一个，不要猜路径。进入你认为的 Harness 目录后执行：

```bash
test -f "$HARNESS_SRC/package.json" && \
test -f "$HARNESS_SRC/apps/cli/src/bin.ts" && \
echo "这是 Harness 源码目录：$HARNESS_SRC"
```

只有打印出确认信息，`HARNESS_SRC` 才填写正确。

## 从 Harness 源码 checkout 安装

下面按“小白可以照着执行”的方式说明。终端可以从任意目录开始，但不要跳过任何 `cd` 命令：`npm` 命令只在插件 clone 目录执行，`pnpm dsh` 命令只在 Harness 源码目录执行。Harness 源码仓库是 pnpm workspace，不能在 Harness 根目录运行 `npm install`；源码 checkout 也不保证提供全局 `dsh` 命令。

### 第 1 步：设置路径和 profile

手工安装应使用 Harness 源码 checkout 的 CLI 入口。下面这组变量可以从任意目录设置：

```bash
PLUGIN_ROOT="$HOME/harness-plugins"
HARNESS_SRC="$HOME/harness"
PROFILE="web"
```

请把路径换成真实值；不要保留 `<existing-profile>`。如果实际 profile 不是 `web`，请替换为实际名称。继续在任意目录确认 Harness 源码目录：

```bash
test -f "$HARNESS_SRC/package.json" && \
test -f "$HARNESS_SRC/apps/cli/src/bin.ts" && \
echo "Harness 源码目录正确：$HARNESS_SRC"
```

如果检查失败，请修正 `HARNESS_SRC`，直到它同时包含 `package.json` 和 `apps/cli/src/bin.ts`。

### 第 2 步：克隆插件并进入插件目录

```bash
mkdir -p "$PLUGIN_ROOT"
git clone https://github.com/zhaozhiyue1987/harness-gateway02.git \
  "$PLUGIN_ROOT/harness-gateway02"
cd "$PLUGIN_ROOT/harness-gateway02"
pwd
```

最后的 `pwd` 必须显示以 `harness-gateway02` 结尾的路径。保持在这个目录，逐条执行：

```bash
npm ci
npm run typecheck
npm run build
npm test
npm pack
ls -lh dsh-higress-credential-routes-plugin-0.1.0.tgz
```

### 第 3 步：切换到 Harness 源码目录

```bash
cd "$HARNESS_SRC"
pwd
```

最后的 `pwd` 必须显示 Harness 源码 checkout 路径，不能显示插件目录。保持在这个目录执行安装：

```bash
pnpm dsh plugin --profile "$PROFILE" add \
  "file:$PLUGIN_ROOT/harness-gateway02/dsh-higress-credential-routes-plugin-0.1.0.tgz"
```

### 第 4 步：重启并验证

按照目标环境原有方式重启 Harness Web，然后进入“设置 → 插件”，确认看到“**AsiaInfo AIGW credential routes**”。

如果要一键完成构建和安装，请先完成第 1～2 步并回到插件目录，再执行：

```bash
HARNESS_SRC="$HARNESS_SRC" PROFILE="$PROFILE" \
  ./scripts/install-native-harness.sh
```

## 源码构建

本节命令必须在已经克隆的 `harness-gateway02` 插件目录执行；如果是首次安装，请优先按上面的第 1～4 步，确认 `pwd` 以 `harness-gateway02` 结尾后再执行。

```bash
npm ci
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
