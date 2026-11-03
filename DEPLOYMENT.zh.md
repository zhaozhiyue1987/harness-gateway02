# 部署说明

本目录生成的新包为 `dsh-higress-credential-routes-plugin`，与父目录旧插件独立安装、启停和卸载。以下流程面向任意具备 Harness 源码 checkout 的目标环境。

## 先确认两个目录

本手册会在两个不同目录中执行命令：

- **插件目录**：从本仓库 clone 得到的 `harness-gateway02` 目录。`npm ci`、`npm run typecheck`、`npm run build`、`npm test` 和 `npm pack` 都在这里执行。目录中应有 `package.json`、`scripts/` 和 `src/`。
- **Harness 源码目录**：Harness 主仓库 checkout 的根目录。`pnpm dsh plugin ... add` 在这里执行。目录中应有 `package.json`、`apps/cli/src/bin.ts` 和 `apps/`。

两个目录应当并列，例如：

```text
/Users/你的用户名/
├── harness-plugins/harness-gateway02/  ← 插件目录
└── harness/                           ← Harness 源码目录
```

`PROFILE` 是已有 Harness profile 的名称（例如 `web`），不是目录路径。

## Windows WSL2 环境

WSL2 的命令顺序与 macOS 相同，但所有命令必须在 WSL 的 Ubuntu 终端执行，不能在 PowerShell 中执行。建议把两个 checkout 放在 WSL Linux 文件系统中：

```bash
export PLUGIN_ROOT="$HOME/harness-plugins"
export HARNESS_SRC="$HOME/harness"
export PROFILE="web"

mkdir -p "$PLUGIN_ROOT"
cd "$HARNESS_SRC"
pnpm install --frozen-lockfile
test -f package.json && test -f apps/cli/src/bin.ts && \
  echo "Harness 源码目录正确：$HARNESS_SRC"
```

不要把插件或 Harness 源码放在 `/mnt/c`、`/mnt/d` 等 Windows 挂载盘中运行 `npm ci`，否则可能出现 `node_modules` 权限、软链接和速度问题。后续步骤仍保持“插件目录执行 npm、Harness 源码目录执行 pnpm dsh”的规则。

WSL 默认不一定启用 systemd。一键脚本在无法检测到 `dsh-harness` systemd 服务时不会报安装失败，但不会自动重启 Web；安装完成后请在 WSL 内按原有启动命令手动重启 Harness Web，再从 Windows 浏览器访问其实际端口。若已启用 systemd，可按普通 Linux 环境使用 `RESTART_SERVICE=always SERVICE_NAME=dsh-harness`。

## 1. 从 GitHub 克隆并一键安装

下面的命令块可从任意目录开始。请把三个变量改成真实值，`PROFILE` 必须是已经存在的 profile；脚本内部会先在插件目录执行 npm，再切换到 Harness 源码目录执行原生 CLI。

```bash
PLUGIN_ROOT="$HOME/harness-plugins"
HARNESS_SRC="$HOME/harness"
PROFILE="<existing-profile>"

test -f "$HARNESS_SRC/package.json" && \
test -f "$HARNESS_SRC/apps/cli/src/bin.ts" && \
echo "Harness 源码目录正确：$HARNESS_SRC"

mkdir -p "$PLUGIN_ROOT"
git clone https://github.com/zhaozhiyue1987/harness-gateway02.git \
  "$PLUGIN_ROOT/harness-gateway02"
cd "$PLUGIN_ROOT/harness-gateway02"
HARNESS_SRC="$HARNESS_SRC" PROFILE="$PROFILE" \
  ./scripts/install-native-harness.sh
```

将 `PLUGIN_ROOT`、`HARNESS_SRC` 和 `PROFILE` 改成目标环境的实际值后执行；不要原样保留 `<existing-profile>`。脚本在插件目录运行 npm 命令，在 Harness 源码目录通过原生 CLI 安装，不创建 profile、不读取业务密钥。

如果不使用一键脚本，请按第 3.1 节逐步执行；不要把 `npm` 命令和 `pnpm dsh` 命令混在同一个目录执行。

如果终端提示 `dsh: command not found`，请从 Harness 源码目录使用源码入口执行：

```bash
cd "$HARNESS_SRC"
pnpm dsh plugin --profile "$PROFILE" add \
  "file:$PLUGIN_ROOT/harness-gateway02/dsh-higress-credential-routes-plugin-0.1.0.tgz"
```

安装后需要重启所选 profile 对应的 Harness Web 进程，新的 bundle 才会加载。

Console 端需先部署凭证发现接口，并为三节点配置共享签名密钥。Harness 中新增连接时输入 Console 管理地址和已有 `BEARER` 网关凭证；同一路由关联多个凭证时，可分别建立多个连接验证隔离行为。

## Console 端配置门禁

三台 Console 必须引用同一 Kubernetes Secret（示例命令只在目标集群执行，密钥不要写入 Git）：

```bash
kubectl -n <namespace> create secret generic higress-credential-discovery-signing \
  --from-literal=active-key="$(openssl rand -base64 48)"
```

将 Secret 的 `active-key` 注入每个 Console Pod 的以下环境变量：

```text
HIGRESS_CREDENTIAL_DISCOVERY_SIGNING_KEY
HIGRESS_CREDENTIAL_DISCOVERY_SIGNING_KEY_ID=active
HIGRESS_CREDENTIAL_DISCOVERY_TOKEN_TTL_SECONDS=600
```

密钥至少 32 字节；轮换时先把旧值作为 `HIGRESS_CREDENTIAL_DISCOVERY_PREVIOUS_SIGNING_KEY` 保留一个令牌 TTL，再移除旧值。未配置签名密钥时，交换接口返回 `503`，不会降级为无签名令牌。

接口验证：

```text
POST /v1/ai/credential-discovery/exchange
Authorization: Bearer <网关 BEARER 凭证>

GET /v1/ai/credential-discovery/routes
Authorization: Bearer <短时发现令牌>
```

生产入口还应在 Ingress/API Gateway 配置 TLS、请求头大小限制和跨三副本的全局限流；插件内置的是单副本有界保护。

## 3. 人工配置与验证步骤

请准备两个稳定入口地址：

- `CONSOLE_URL`：Higress Console 稳定入口，例如 `https://console.example.com`；插件配置填写这个地址，不要填写 `/v1/ai/credential-discovery/...` 子路径。
- `GATEWAY_URL`：AI 数据面稳定入口，例如 `https://gateway.example.com`；Console 的“网关公网地址”必须配置为该地址，插件返回的路由调用地址会在它后面追加路由前缀和 `/v1`。

### 3.1 构建并安装新插件

下面按“每一步都能检查结果”的方式执行。可以从任意目录开始，但不能跳过目录切换：

#### 第 1 步：设置路径和 profile

在终端输入以下内容。`PLUGIN_ROOT` 是插件仓库的父目录，`HARNESS_SRC` 是 Harness 源码 checkout 根目录，`PROFILE` 是已经存在的 profile 名称。

```bash
PLUGIN_ROOT="$HOME/harness-plugins"
HARNESS_SRC="$HOME/harness"
PROFILE="web"
```

如果目标环境的 profile 不是 `web`，把 `PROFILE` 改成真实名称；不要保留 `<existing-profile>`。然后确认 `HARNESS_SRC` 确实是 Harness 源码根目录：

```bash
test -f "$HARNESS_SRC/package.json" && \
test -f "$HARNESS_SRC/apps/cli/src/bin.ts" && \
echo "Harness 源码目录正确：$HARNESS_SRC"
```

如果没有打印“目录正确”，先修正 `HARNESS_SRC`，不要继续执行后面的安装命令。

如果执行 `cd "$HARNESS_SRC"` 报 `no such file or directory`，不要继续在插件目录执行安装命令。`cd` 失败后当前目录不会改变，因此 `pwd` 仍显示 `harness-gateway02` 并不表示目录正确。请先定位真正的 Harness 源码入口：

```bash
find "$HOME" -path "*/apps/cli/src/bin.ts" -print 2>/dev/null
```

例如输出 `/Users/你的用户名/项目开发/harness/apps/cli/src/bin.ts` 时，应执行：

```bash
export HARNESS_SRC="$HOME/项目开发/harness"
cd "$HARNESS_SRC"
pwd
test -f package.json && test -f apps/cli/src/bin.ts && \
  echo "Harness 源码目录正确：$HARNESS_SRC"
```

只有 `pwd` 已切换到 Harness 源码根目录后，才执行第 5 步的 `pnpm dsh plugin ... add`。

#### 第 2 步：克隆插件并进入插件目录

```bash
mkdir -p "$PLUGIN_ROOT"
git clone https://github.com/zhaozhiyue1987/harness-gateway02.git \
  "$PLUGIN_ROOT/harness-gateway02"
cd "$PLUGIN_ROOT/harness-gateway02"
pwd
```

最后的 `pwd` 必须显示以 `harness-gateway02` 结尾的路径。下面的 `npm` 命令必须保持在这个目录执行：

#### 第 3 步：在插件目录安装依赖、构建、测试和打包

```bash
npm ci
npm run typecheck
npm run build
npm test
npm pack
ls -lh dsh-higress-credential-routes-plugin-0.1.0.tgz
```

预期结果：类型检查、构建和测试退出码为 0；当前目录出现 `dist/` 和 `dsh-higress-credential-routes-plugin-0.1.0.tgz`。如果 `ls` 找不到 tgz 文件，先修复构建问题，不要执行安装。

#### 第 4 步：切换到 Harness 源码目录

```bash
cd "$HARNESS_SRC"
pwd
```

最后的 `pwd` 必须显示 Harness 源码 checkout 路径，不能仍然显示 `harness-gateway02`。只有确认目录正确后，才执行下一步。

#### 第 5 步：使用 Harness 源码入口安装到已有 profile

保持当前目录为 `"$HARNESS_SRC"`，执行：

```bash
pnpm dsh plugin --profile "$PROFILE" add \
  "file:$PLUGIN_ROOT/harness-gateway02/dsh-higress-credential-routes-plugin-0.1.0.tgz"
```

如果出现 `dsh: command not found`，不要在插件目录安装全局命令；仍在 Harness 源码目录执行上面的 `pnpm dsh`。如果出现 `workspace:` 或找不到文件错误，检查是否运行了 `npm install`（而不是 `npm ci`）、tgz 路径是否正确，以及当前目录是否为 Harness 源码根目录。

#### 第 6 步：重启 Harness Web 并检查插件

安装后重启或刷新 Harness。在 Harness 的“设置 → 插件/插件配置”中应能看到 **AsiaInfo AIGW credential routes**。旧的 `dsh-higress-ai-route-plugin` 不需要卸载，两个插件使用不同的设置、凭证和 Provider 命名空间。

### 2. 在 Console 准备测试数据

1. 登录 Console，进入“系统设置”，确认网关公网地址为 `GATEWAY_URL`。
2. 进入“凭证管理”，创建一个 `BEARER` 凭证 A，复制凭证原文一次并放入密码管理器；后续不要把完整值写入截图、日志或报告。
3. 创建 AI 路由 R：配置有效上游和路由前缀，例如 `/aaa`；打开路由认证并绑定凭证 A。当前一期仅支持 `BEARER`，`HEADER/QUERY` 不纳入验证范围。
4. 如果验证多凭证：再创建凭证 B，并在同一路由 R 中同时选择 A、B；创建凭证 C 但不要绑定 R。
5. 如果验证默认模型：R 不配置具体 model id 或 model mapping，插件预期显示固定值 `higress-default-model`。

### 3. 直接验证 Console 发现接口

下面命令不会把访问令牌写入文件；`TOKEN` 仅保存在当前 shell 内存中。请将 `<BEARER-凭证原文>` 替换为测试凭证，避免在 shell 历史中直接保存长期凭证。

```bash
CONSOLE_URL='https://console.example.com'
GATEWAY_CREDENTIAL='<BEARER-凭证原文>'

EXCHANGE_JSON="$(curl -sS -X POST \
  -H "Authorization: Bearer ${GATEWAY_CREDENTIAL}" \
  "${CONSOLE_URL}/v1/ai/credential-discovery/exchange")"

printf '%s' "$EXCHANGE_JSON" | jq '{success, expiresIn: .data.expiresIn, hasToken: (.data.accessToken != null)}'
TOKEN="$(printf '%s' "$EXCHANGE_JSON" | jq -r '.data.accessToken')"

ROUTES_JSON="$(curl -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  "${CONSOLE_URL}/v1/ai/credential-discovery/routes")"

printf '%s' "$ROUTES_JSON" | jq '{success, collectionVersion: .data.collectionVersion, routes: [.data.routes[] | {name: .route.name, baseUrl: .endpoint.baseUrl, models: [.models[].id], authType: .authentication.type, credentials: .authentication.credentials, connectable: .eligibility.connectable}]}'
```

预期结果：

- exchange 返回 `success=true`、`hasToken=true`、`expiresIn` 在 300～900 秒之间；
- routes 只返回该凭证有权使用的路由；
- `authentication.credentials` 必须为空数组，不返回凭证 id、名称或密钥；
- 默认模型为 `higress-default-model`；
- 路由前缀 `/aaa` 时，`endpoint.baseUrl` 应为 `${GATEWAY_URL}/aaa/v1`；
- `sessionAffinityEnabled=true` 时 `effectivePriority=SESSION_AFFINITY_FIRST`，关闭时为 `ROUTE_POLICY_FIRST`。

### 4. 在 Harness 中绑定和切换

在插件配置页新增连接：

1. 填写 Console 管理地址 `CONSOLE_URL`；
2. 填写凭证 A 的 BEARER 原文；
3. 点击“绑定并同步”；
4. 确认连接状态为 `READY`，凭证输入框已清空；
5. 打开 Harness 原生 Provider/模型选择器，选择插件生成的路由 Provider，创建新会话并发送请求。

多凭证验证时，再新增一条连接绑定 B。A、B 连接会生成不同 Provider；断开 A 只能删除 A 所属 Provider，B 仍应可用。

### 5. 数据面和 Token 用量验证

以路由 `/aaa` 为例，直接调用网关：

```bash
GATEWAY_URL='https://gateway.example.com'
GATEWAY_CREDENTIAL='<BEARER-凭证原文>'

curl -sS -X POST "${GATEWAY_URL}/aaa/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${GATEWAY_CREDENTIAL}" \
  -d '{"model":"higress-default-model","messages":[{"role":"user","content":"请只回复 OK"}],"stream":false}' \
  | jq '{id, model, usage}'
```

再通过 Harness 使用同一 Provider 发起一次非流式和一次流式会话：

- 网关链路追踪中应出现对应请求；
- 原始响应存在 `usage` 时，Harness 底部 Token 用量应有数值；
- 原始响应缺少 `usage` 时，不应伪造为 0；
- Console“实例监控”和“链路追踪”的调用时间、调用次数、Token 总量应能对应本次请求。

### 6. 刷新和配置变更验证

1. 在 Console 给 R 增加一个 model mapping、修改路由前缀或绑定凭证；
2. 在插件页点击“刷新”，确认路由列表和 Provider 变化；
3. 开启自动刷新，配置不变时应通过 ETag 命中 `304`，不重复写入 Provider；
4. 临时让 Console 返回 503 时，旧 Provider 应保留，连接状态显示同步异常；恢复 Console 后刷新应回到 `READY`。

### 7. 负向验证

```bash
# 缺少认证：401
curl -i -X POST "${CONSOLE_URL}/v1/ai/credential-discovery/exchange"

# 不能使用原始网关凭证直接读取 routes：401
curl -i -H "Authorization: Bearer ${GATEWAY_CREDENTIAL}" \
  "${CONSOLE_URL}/v1/ai/credential-discovery/routes"
```

还应验证错误凭证、HEADER/QUERY 凭证、停用/轮换后的凭证均不会返回路由，且错误提示统一为“认证失败”，不暴露凭证状态、绑定数量或响应正文。

## 常见问题

| 现象 | 优先检查 |
| --- | --- |
| 插件列表找不到新插件 | 是否安装了新包 `dsh-higress-credential-routes-plugin-0.1.0.tgz`，以及是否重启/刷新 Harness |
| exchange 返回 503 | Console Pod 是否注入签名 Secret；三节点是否使用同一 active key |
| exchange 返回 401 | 是否使用凭证原文、`BEARER` scheme、凭证是否 ACTIVE/未过期 |
| routes 返回空数组 | 路由是否启用认证、是否绑定当前凭证、`allowedConsumers` 是否与凭证对应 |
| Provider 出现但请求失败 | 检查 Console 公网地址、路由前缀、网关 `/v1/chat/completions` 数据面和上游模型 |
| 刷新后旧 Provider 未删除 | 等待一次完整刷新，确认路由确实已解绑；临时 5xx 不会删除旧快照 |

## 测试记录模板

每次测试至少记录：Harness 版本、插件包版本、Console/Gateway 地址、Gateway commit、路由名称和前缀、凭证别名（不要记录原文）、执行时间、HTTP 状态、路由数量、Provider 数量、Token usage、Trace ID 和失败现象。截图和日志必须遮蔽 Authorization、Cookie、发现 Token 及上游密钥。
