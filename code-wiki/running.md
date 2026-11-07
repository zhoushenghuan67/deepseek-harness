# Code Wiki — 运行与开发

> 本文说明如何安装、构建、运行、测试、配置与扩展 DeepSeek Harness。

---

## 1. 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | **>= 24.9**（`package.json` 的 `engines`） |
| 包管理器 | **pnpm 11.28.5**（工作区使用 `workspace:*` / `workspace:~` 协议） |
| API Key | `DEEPSEEK_API_KEY`（真实 API 测试与 demo 需要）；可选 `DEEPSEEK_BASE_URL` |

工作区定义在 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'vendor/*'
  - 'packages/*/*'
  - 'native/system'
  - 'native/system/packages/*'
  - 'apps/*'
  - 'benchmarks'
  - 'website'
  - 'python/sdk-runtime'
```

---

## 2. 安装与构建

```sh
pnpm install              # 安装工作区依赖
pnpm run clean            # 清理构建产物与已删除包的残留
pnpm run build            # build:artifacts + build:check，并发执行
```

| 命令 | 作用 |
| --- | --- |
| `pnpm run build:artifacts` | `tsc` 产出 `lib/` 与类型，`tsdown` 打包运行时，Web 前端打包 |
| `pnpm run build:check` | 对着**当前** `build:artifacts` 产物做类型检查（含测试与脚本） |

**源平面 vs 产物平面不可混用**：静态门禁与测试通过 tsconfig `paths` 解析到 `src`，在干净树上即可通过；消费构建产物的门禁必须显式声明该依赖。

**开发时用 `build:artifacts`；声称完成前，在最新一次 `build:artifacts` 之后跑 `build:check`（或 `build`）。**

---

## 3. 运行

### 3.1 从源码直接运行

```sh
pnpm dsh --profile headless "task"   # 从源码跑一个任务（需要 DEEPSEEK_API_KEY）
pnpm run demo:ptc -- "task"          # headless PTC 模式运行
```

`dsh` 的源码启动走 tsx 的 **ESM-only** hook（`node --import tsx/esm`）；它能加载到的模块必须保持 ESM（不能有仅 CJS 的导出）。

### 3.2 Make 目标

```sh
make web            # 同 pnpm run dev:web
make dev-web        # 同 pnpm run dev:web
make desktop        # 同 pnpm run dev:desktop
make dev-desktop    # 同 pnpm run dev:desktop
make build          # 同 pnpm run build
ARGS='--no-open'    # 把选项透传给应用
```

### 3.3 开发模式

```sh
pnpm run dev:web        # build:artifacts 后启动 Web
pnpm run dev:desktop    # build:artifacts 后启动 Desktop
pnpm run start:web      # 跳过构建，直接启动
pnpm run start:desktop  # 跳过构建，直接启动
```

Web 开发模式会在文件编辑时**重新打包前端 bundle**。

### 3.4 浏览器自动化约定

启动 Web 时带上页面内目录选择器覆盖：

```sh
pnpm dsh web --patch apps/web/tests/pin-browse-picker.overlay.yml
```

只有**明确测试原生选择器行为**时才省略这个覆盖。

---

## 4. CLI 参考

完整帮助见 `docs/cli-help.md`（由 `scripts/gen-cli-help.ts` 生成，用 `pnpm run verify-cli-help` 检查新鲜度）。

### 4.1 启动器

```text
Usage: dsh [--profile] <name> [options] [app-args...]
       dsh plugin --profile <name> <pnpm-args...>
```

| 选项 | 说明 |
| --- | --- |
| `-V, --version` | 输出版本号 |
| `--profile <name>` | 启动 `$DSH_HOME/profiles` 下的 profile |
| `--from-default-profile <name>` | 用内置模板**重建**自定义 profile |
| `--patch <path>` | 在 profile 层之后追加 overlay（可重复） |
| `--dump-config` | 打印组合后的 profile 树并退出 |
| `--dump-config-schema` | 打印 profile 条目与 patch 的 JSON Schema（不挂载） |
| `--dump-default-config` | 打印不含用户层与 `--patch` 的 profile 树并退出 |

### 4.2 子命令

| 命令 | 说明 |
| --- | --- |
| `dsh plugin --profile <name> <pnpm-args...>` | 管理 profile 的插件（`add` / `remove` / `why` 等参数原样转发给 pnpm） |
| `dsh acp` | 以 Agent Client Protocol 的 stdio 服务自动化客户端 |
| `dsh headless` | 回答一个任务后退出；答案到 stdout，诊断信息到 stderr |
| `dsh sdk` | 以 stdio JSON-RPC 服务 SDK 客户端 |
| `dsh sdk-minimal` | 同上，最小形态 |
| `dsh web` | 提供浏览器 UI |

### 4.3 `dsh headless` 选项

| 选项 | 说明 |
| --- | --- |
| `--json` | 向 stdout 输出换行分隔的运行事件，而不是最终消息 |
| `--session-id <id>` | 接管指定 id 的持久化 Session（id 未知则报错） |
| `--permission-mode <preset>` | 选择已配置的权限预设（恢复会话时同样适用） |
| `--approval-policy <policy>` | 选择预设后设定审批行为（`ask` / `never`） |
| `--add-dir <path>` | 在 workspace-write 模式下额外允许一个物理绝对目录（可重复） |

### 4.4 `dsh web` 选项

| 选项 | 说明 |
| --- | --- |
| `--host <host>` | 绑定地址：本机某个接口的**具体** IPv4/IPv6 字面量；**拒绝**通配地址 |
| `--no-open` | 不自动打开浏览器 |
| `--port <port>` | 监听端口；传 `0` 让操作系统选空闲端口 |
| `--public-url <url>` | 在打印的、打开的、运行时上下文与 `DSH_WEB_URL` 形式中公布 HTTP(S) 根；**不授予任何信任** |
| `--trusted-host <authority...>` | `/api` 浏览器信任栅栏额外接受的 authority（host 或 host:port；可重复） |
| `--tls-cert <file>` | PEM 服务器证书链；需要 `--tls-key` |
| `--tls-key <file>` | 未加密 PEM 私钥；需要 `--tls-cert` |

### 4.5 典型命令

```sh
dsh web                                   # 等同 dsh --profile web
dsh rescue --from-default-profile web     # 用内置 web 模板重建 rescue 再启动
dsh headless "run the tests"              # 回答一个任务并退出
dsh tui --patch ./extra.yml               # 带额外 overlay 启动自定义 profile
dsh tui --resume <session>                # 启动器标志之后的参数传给应用
dsh plugin --profile tui add <package>    # 往 tui profile 安装插件
```

---

## 5. Profile 与配置

### 5.1 Profile 位置

```text
$DSH_HOME/profiles/<name>/package.json
```

其中声明 `dsh.profile.bundles`（bundle 名数组）。`$DSH_HOME` 由 `packages/util/home-paths` 解析。

### 5.2 配置层级

```text
cordis.yml                            # 插件启用、config、entry.disabled
  + profile 的 bundle 列表              # 每个 bundle 一层 cordis.patch.yml
  + 用户 profile 自己的 patch 层
  + 命令行 --patch <file>              # 可重复
```

### 5.3 `cordis.yml` 规则

- `plugin.config` 与 `entry.disabled` 下允许 `!!js`（**不是** `!js`）。
- 其他元数据保持字面量。
- 需要条件组合时用 **overlay**，而不是在 `cordis.yml` 里写条件表达式。

### 5.4 内置 Profile 模板

| Profile | Bundles | 用途 |
| --- | --- | --- |
| `web` | `base` + `web-app` | 浏览器 UI |
| `desktop` | `base` + `web-app` + desktop 主机层 | 桌面应用 |
| `headless` | `base` + `headless` | 单任务终端形态 |
| `sdk` | `base` + `sdk-app` | JSON-RPC SDK |
| `sdk-minimal` | `sdk-minimal` | 最小 SDK（不含 `base`） |
| `acp` | `base` + `acp-app` | 自动化 ACP |

未命名 profile 的默认 bundle 是 `['@deepseek-ai/dsh-base']`。

---

## 6. 环境变量与密钥

| 变量 | 用途 |
| --- | --- |
| `DEEPSEEK_API_KEY` | 真实 API 测试与 demo 的凭据 |
| `DEEPSEEK_BASE_URL` | 可选，自定义 API 基址 |
| `DSH_HOME` | profile 与数据根目录 |
| `DSH_WEB_URL` | Web 运行时公布的 URL |

- 根目录 `.env` 会被读取。
- **绝不提交凭据。**
- CI 的 e2e 在没有 Key 时自动跳过；Key 策略由 `docs/testing.md` 定义。

---

## 7. 测试

```sh
pnpm run test            # 单元测试
pnpm run test:coverage   # CI 覆盖率门禁：packages/*/*/src 逐文件 100%
pnpm run test:e2e        # 真实 API 测试；没有 DEEPSEEK_API_KEY 时自跳过
pnpm run test:expected   # owner 本地进程期望
pnpm run test:snapshot   # 无密钥的录制会话回放（走已发布 profile）；过滤：-t <name>
pnpm run test:snapshot:record  # 重录期望输出（需要 Key）
```

### 7.1 覆盖率门禁是 `test:coverage`，不是 `test`

CI 的覆盖率门禁跑 `pnpm run test:coverage`（理由见 `docs/testing.md`）。

### 7.2 快照测试何时必须更新

**任何非平凡的、模型可见或产品用户可见的改动，都要更新无密钥的录制会话快照。**

- 顶层 `snapshots/` 树保留给「会话驱动」的场景；其它期望输出放在各自的 owner 位置。
- 快照夹具在 macOS/Linux 上回放。**修夹具，不要改 normalizer。**

### 7.3 门禁与改动面的匹配

| 改动面 | 该跑什么 |
| --- | --- |
| 某个行为 | 聚焦的行为测试 |
| 模型输出 / 用户输出 | 快照测试 |
| 文档 | `pnpm run doc-sync` |
| 已发布的路径 | 构建后的冒烟测试 |
| 提供方 | 真实 API 的 e2e |

**不要默认跑全量套件**，也不要把已通过的检查为了提交或推送再跑一遍。CI 负责穷尽覆盖率与平台矩阵；只有在明确要求、为诊断 CI、或改动确实牵涉全仓库时才本地全量演练。

### 7.4 文档门禁

```sh
pnpm run doc-sync       # 文档门禁（scripts/run-gates.ts）
pnpm run test:docs      # 快速文档检查（不构建；doc-quick 聚合）
pnpm run website:build  # VitePress 构建（顺带做死链检查）
```

---

## 8. 其它常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm run typecheck` | 类型检查 |
| `pnpm run lint` | Lint |
| `pnpm run duplication` | 跨文件 TypeScript 克隆检测 |
| `pnpm run hygiene` | publint + 工作区/包/依赖检查 + NodeNext 消费检查 |
| `pnpm run clean` | 清理构建产物与已删除包的残留 |

---

## 9. 扩展开发

### 9.1 加一个插件

1. 在 `packages/<group>/<name>/` 建包，包名 `@deepseek-ai/dsh-<name>`。
2. `package.json` 里声明 `@deepseek-ai/cordis` 到 `peerDependencies` 与 `devDependencies`。
3. 依赖写 `workspace:*`。
4. 用 `ctx.effect()` / `ctx.on()` 注册所有贡献。
5. 在目标 bundle 的 `cordis.patch.yml` 里启用它。
6. 写 README（含 JSDoc 契约）并更新受影响的上层文档。
7. 补齐单元、e2e 与快照覆盖。

### 9.2 加一个工具

见 `docs/cookbook/adding-a-tool.md` 与 [capabilities.md](capabilities.md#6-扩展一个能力的步骤)。

关键点：
- 用 `defineTool()` 从 `ValueSchemaSpec` 声明参数（类型自动推导，无需手写重复类型）。
- **设计 UI 呈现要在动手前完成**：Host presenter 保持纯净；Web 卡片从原始事件与持久化结果元数据派生。
- 工具结果进入模型上下文，因此必须是**可从 session log 重建**的。

### 9.3 加一个客户端 UI 插件

见 `packages/client/modules/README.md`：
- 在 `package.json` 声明 `dsh.client`（`platform: 'web'`，导出 `./client` bundle）。
- 非基线模块请求列在 `dsh.client.external` 下。
- 动态提供方必须排在消费者之前加载。

### 9.4 扩展点一览

| 扩展点 | 形式 |
| --- | --- |
| `agent/pre-step` | waterfall |
| `tools/pre-execute` / `tools/execute` / `tools/post-execute` | waterfall |
| `tool/result` | 事件 |
| `ctx.effect()` / `ctx.on()` | 通用副作用注册 |
| `ctx.tools.register(definition)` | 工具注册 |
| `ctx.systemPrompt.section()` / `.context()` / `.variable()` / `.tools()` | 提示词拼装 |
| `ctx.sessionProjections.register(definition)` | 投影注册 |
| `ctx.slots` / `ctx.uiRenderer` | UI 槽位 |

**Waterfall 监听器必须调用 `next()`**，否则短路整条链。

### 9.5 改 `agent-loop` 的规则

新行为要放在**有文档的扩展点**上。直接改 `agent-loop` 需要同步更新 `docs/architecture.md`。

---

## 10. 提交前检查

按 `.agents/skills/dsh-pre-push-checks/SKILL.md` 选择**覆盖改动面**的最小检查集；**只报告实际跑过的命令**。

推送后若执行了 `gh stack sync`，**立即**重新验证；检查未通过前不要合并。

---

## 11. 排障

| 现象 | 检查项 |
| --- | --- |
| 源码启动报 CJS 错误 | 该模块必须保持 ESM（tsx ESM-only hook 的限制） |
| 插件未加载 | `cordis.yml` 的 `entry.disabled`；overlay 是否叠加正确；`--dump-config` 看组合结果 |
| 配置被覆盖 | overlay 顺序：profile 层 → 用户层 → `--patch` |
| Web 目录选择器在自动化里点不到 | 加上 `--patch apps/web/tests/pin-browse-picker.overlay.yml` |
| e2e 全部跳过 | 没有 `DEEPSEEK_API_KEY` |
| 依赖装不上 | 确认 pnpm 版本与 `workspace:` 协议 |
| 沙箱内命令失败 | 检查 `sandbox-policy` 与 `--add-dir` 授权范围 |

---

## 12. 相关文档

- 开发布局（源平面 vs 产物平面）：[docs/development.md](../docs/development.md)
- 测试策略：[docs/testing.md](../docs/testing.md)
- Cordis 语义：[docs/cordis-primer.md](../docs/cordis-primer.md)
- CLI 完整帮助：[docs/cli-help.md](../docs/cli-help.md)
- 配置目录：[docs/config-catalog.md](../docs/config-catalog.md)
- 提交前检查：[.agents/skills/dsh-pre-push-checks/SKILL.md](../.agents/skills/dsh-pre-push-checks/SKILL.md)
