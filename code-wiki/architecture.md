# Code Wiki — 整体架构

> 本文描述 DeepSeek Harness（`dsh`）的分层模型、插件框架、组装方式、Agent 回合生命周期与事件流。

## 1. 一句话定位

DeepSeek Harness 是一个 **插件化 Agent 运行时**：以 vendored Cordis 插件框架为底座，用「能力接缝」把模型调用、工具执行、会话持久化、终端/文件系统/子进程等系统能力缝合成一个可组合的 Agent；再通过 Profile/Bundle 机制把插件组合成可发布的产品形态（Web、Desktop、SDK、ACP、Headless）。

## 2. 分层模型

代码按依赖方向自下而上分为五层。层内允许自由依赖，层间依赖方向由 `check-workspace-constraints` 与各包自身的 `peerDependencies` 约束。

```text
┌──────────────────────────────────────────────────────────────┐
│ Tier 5  应用层    apps/cli  apps/web  apps/desktop  apps/desktop-host │
│                  apps/plugin-market-generator                │
├──────────────────────────────────────────────────────────────┤
│ Tier 4  表现层    packages/client/*  packages/host/*          │
│                  packages/api/*  packages/sdk/*                │
├──────────────────────────────────────────────────────────────┤
│ Tier 3  能力层    packages/fs  shell  subprocess  sandbox      │
│                  terminal  web  mcp  lsp  skill  llm          │
│                  subagent  team  jobs  workflow  compaction   │
│                  context  storage  spill  attachment          │
├──────────────────────────────────────────────────────────────┤
│ Tier 2  核心层    packages/core/*  packages/session/*         │
│                  packages/util/*  packages/typert/*           │
├──────────────────────────────────────────────────────────────┤
│ Tier 1  框架层    vendor/cordis  vendor/loader  vendor/schemastery │
│                  vendor/cosmokit  vendor/group  vendor/timer   │
│                  vendor/include  vendor/hmr  vendor/logger-console │
└──────────────────────────────────────────────────────────────┘
```

| 层 | 数量 | 说明 |
| --- | --- | --- |
| 框架层 `vendor/` | 9 个 vendored 包 | Cordis 上游源码快照，rescope 为 `@deepseek-ai/cordis`，`private: true` |
| 核心层 `packages/core` | 10 个包 | Agent/Session API、工具契约、系统提示词、作用域 |
| 能力层 | 30+ 组 | 每组一个能力域，各自带 Provider 与 Consumer |
| 表现层 `packages/client` `host` `api` `sdk` | 70 + 9 + 10 + 3 | 浏览器 UI、宿主进程、Remote BFF、JSON-RPC SDK |
| 应用层 `apps/` | 5 个包 | CLI、Web 前端、Desktop、Desktop Host、插件市场生成器 |

## 3. Cordis 插件框架

### 3.1 核心机制

DeepSeek Harness **不使用** vendored Cordis 的默认插件加载方式之外的自研框架；所有能力都以 Cordis 插件形式实现。

| 机制 | 说明 |
| --- | --- |
| `ctx.effect()` / `ctx.on()` | **注册即副作用**。每个贡献（服务注册、事件监听、命令注册）都通过它进入系统，返回的 disposer 负责回滚 |
| `ctx.set()` / `ctx.get()` | 服务存取。服务键用 `ctx.<name>` 命名，跨包通过 `declare module '@deepseek-ai/cordis'` 扩展 `Context` 接口实现**类型合并** |
| 作用域 | `ctx.scope(...)` 创建子上下文；子上下文继承父级服务，可覆盖单个服务；服务按作用域解析 |
| Waterfall | `ctx.on('event', async (payload, next) => ...)`。**监听器必须调用 `next()`** 才会把控制权交给下一个监听器；不调用即短路整条链 |
| 声明合并 | 事件用 `SessionEventMap` 这类可扩展映射表声明；payload 用 `@mode` 与 `@param` 注释描述 |

### 3.2 生命周期

```text
配置加载 (cordis.yml + patch 层)
   ↓
插件树实例化 → 插件被 import → 插件的 ctx.effect() 注册副作用
   ↓
ctx.start() → 各插件 setup() 阶段启动 → 监听器就绪
   ↓
运行期：用户输入 → 会话事件 → Agent 循环 → 工具执行 → 结果回灌
   ↓
ctx.stop() → disposer 逆序回滚
```

### 3.3 能力接缝（Capability Seam）

一个能力接缝由三个角色构成，缺一不可：

| 角色 | 含义 | 例子 |
| --- | --- | --- |
| Service Definition | 声明接口与类型的包 | `packages/fs/fs` 定义 `ctx.fs` |
| Service Provider | 提供实现的包 | `packages/fs/fs-local` 提供本地实现 |
| Consumer | 使用该能力的包 | `packages/fs/tool-fs` 消费 `ctx.fs` |

只有当三个角色需要独立演进时才拆分；只有一个角色时不算接缝。详见 [capabilities.md](capabilities.md)。

## 4. 组装模型：Profile 与 Bundle

### 4.1 概念

| 概念 | 载体 | 说明 |
| --- | --- | --- |
| **Bundle** | `packages/bundle/<name>/cordis.patch.yml` | 一份 Cordis **overlay**，声明 `dsh.bundle.patch`，描述「这一层启用哪些插件、覆盖哪些配置」 |
| **Profile** | `$DSH_HOME/profiles/<name>/package.json` | 声明 `dsh.profile.bundles`（bundle 名数组），是产品的顶层装配单元 |
| **Overlay 叠加** | 多层 patch 按顺序应用 | 后应用的层覆盖先应用的层，是唯一的配置覆盖机制 |

### 4.2 内置 Bundle

| Bundle | 位置 | 行数 | 作用 |
| --- | --- | --- | --- |
| `base` | `packages/bundle/base/cordis.patch.yml` | 99 | 共享核心层，几乎所有 profile 的基础 |
| `web-app` | `packages/bundle/web-app/cordis.patch.yml` | 121 | Web 客户端前端 + 完整能力集 |
| `sdk-app` | `packages/bundle/sdk-app/cordis.patch.yml` | 18 | JSON-RPC SDK 服务端 |
| `sdk-minimal` | `packages/bundle/sdk-minimal/cordis.patch.yml` | 37 | 最小 SDK，**不包含** `dsh-base` |
| `headless` | `packages/bundle/headless/cordis.patch.yml` | 8 | 无界面终端形态 |
| `acp-app` | `packages/bundle/acp-app/cordis.patch.yml` | 5 | ACP（Automation-only）接入 |

### 4.3 Profile 模板

定义在 `packages/util/official-bundles/src/bundles.ts` 的 `PROFILE_TEMPLATES`：

| Profile | Bundles |
| --- | --- |
| `acp` | `base` + `acp-app` |
| `web` | `base` + `web-app` |
| `headless` | `base` + `headless` |
| `sdk` | `base` + `sdk-app` |
| `sdk-minimal` | `sdk-minimal`（独立） |
| 未命名 profile（默认） | `base`（`DEFAULT_PROFILE_BUNDLES = ['@deepseek-ai/dsh-base']`） |

**启动约束**：只有 `dsh` profile 能启动受支持的 Node 应用。package bin、demo、公开 SDK 的 argv 逃逸都被禁止（见 `docs/architecture.md#application-launch`）。

## 5. Agent 回合生命周期

一次用户输入触发的完整流程（`docs/architecture.md` 的 turn flow 是权威版本）：

```text
用户输入
  │
  ├─▶ Session 写入 user message 事件（SESSION_FORMAT_VERSION = 4）
  │
  ▼
AgentRegistry.enter(agent)  ─── 当前发起者成为 initiator
  │
  ▼
ReactLoopAgent.send(message, target, wakeup)
  │
  ├─▶ 认领 inbox 中的目标消息（ReactLoopInbox 负责 claim）
  │
  ▼
┌─ ReAct 循环（每一步 = 一个 step）────────────────────────────┐
│  1. SystemPrompt.assemble(context)  → 拼装系统提示词        │
│  2. LlmRuntime 调用模型                → 流式返回             │
│  3. 若模型发出 tool_call：                                    │
│       ToolsService.resolve()  → 选定本次可用工具集            │
│       ToolExecutionPipeline：                                │
│         tools/pre-execute  → 判定是否允许执行                 │
│         tools/execute      → 实际执行（并发上限 10）          │
│         tools/post-execute → 规范化结果                        │
│       结果回灌为 tool message 事件                            │
│       → 回到步骤 1（下一 step）                               │
│  4. 若模型返回最终文本 → 本回合结束                            │
└───────────────────────────────────────────────────────────────┘
  │
  ▼
turn-end 事件写入会话（带 TurnEndReason）
```

### 5.1 关键扩展点

| 扩展点 | 类型 | 用途 |
| --- | --- | --- |
| `agent/pre-step` | waterfall | 在每个 step 前改写上下文、注入提示词、阻断本步 |
| `tools/pre-execute` | waterfall | 工具执行前审批 / 拦截 / 改参 |
| `tools/execute` | waterfall | 替换默认执行器（真实执行） |
| `tools/post-execute` | waterfall | 规范化 / 裁剪 / 改写结果 |
| `tool/result` | 事件 | 工具结果完成后的通知 |
| `ctx.effect()` | 副作用 | 任何自定义注册 |

Waterfall 监听器**必须调用 `next()`**，否则整条链被短路。

### 5.2 并发与限流

- 工具默认最大并发数为 **10**（`DEFAULT_MAX_PARALLEL_TOOL_CALLS`）。
- 同一模型回合内的多个 `tool_call` 会被批量提交（`ToolBatchInput` → `ToolBatchResult`），单条失败不阻断其余条目；批量级失败用 `ToolBatchExecutionError` 表达。

## 6. 事件流与可重放性

### 6.1 Session 事件

会话是 **事件溯源** 的：所有状态变更都是 `SessionEvent`，落在 append-only 日志里。

| 概念 | 说明 |
| --- | --- |
| `SessionEventMap` | 事件类型 → payload 的映射表。用声明合并扩展，新增事件类型不破坏旧读者 |
| `SessionEvent` | 带 `seq`、`type`、`data` 的判别联合 |
| `SESSION_FORMAT_VERSION` | 当前为 **4**。只在「既有判别字段无法防止不安全解读」时才升版本 |
| `Session` | 一次会话。提供 `eventAt()`、`snapshotEvents()`、`ownEvents()`、`deriveMessages()`、`toolHistory` 等只读投影 |
| `SessionStore` | 会话工厂与注册表。`create`、`prepare`、`enter`、`announce`、`flush`、`get`、`list`、`fork`、`registerMessageProjection` |

### 6.2 「模型可见 ⟺ 已记录」

**任何进入模型请求的内容，必须能从 session log 重建**。新增的模型可见输入必须伴随一个 session 事件，否则持久化后无法还原。这条约束是整个事件模型的设计基准。

### 6.3 投影（Projection）

从事件流派生出的只读视图，例如消息面（surface）、工具历史、回合大纲、会话标题、统计。

| 包 | 作用 |
| --- | --- |
| `packages/session/session-projection` | `SessionProjectionRegistry` 注册投影定义、维护检查点 |
| `packages/session/session-projection-cache` | 投影结果的缓存层 |
| `packages/core/session/src/surface.ts` | `foldSurface()` 把事件折叠成会话消息面 |
| `packages/session/session-turn-outline` | 回合大纲投影 |
| `packages/session/session-title` | 会话标题投影 |
| `packages/session/session-stats` | 会话统计投影 |

**投影规则**：新增/修改/评审投影必须遵循 `.agents/skills/dsh-session-projection/SKILL.md`。

## 7. 展示与远端

```text
                    ┌──────────────────────┐
                    │  Browser Client      │  packages/client/*
                    │  (UI slots, store)   │
                    └──────────┬───────────┘
                               │ Typert Remote (typed RPC)
                    ┌──────────▼───────────┐
                    │  API / BFF           │  packages/api/*
                    │  gateway + remotes   │
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  Host process │      │  Session log  │      │  SDK server   │
│  packages/host│      │  (JSONL)      │      │  packages/sdk │
└───────────────┘      └───────────────┘      └───────────────┘
```

- **Client**：`packages/client/*`（70 个包）以「浏览器懒加载 bundle」形态发布；`dsh.client` 插件声明会转换成前端 chunk。
- **API / BFF**：`packages/api/*`（10 个包）用 Typert 把服务方法暴露成远程 RPC，并提供 Host/Session/Jobs/Settings/Workspace/Terminal 等远程服务。
- **Host**：`packages/host/*`（9 个包）提供 WebServer、静态资源、目录选择器、插件清单、遥测等宿主能力。
- **Typert**：`packages/typert/protocol`、`packages/typert/registry`、`packages/typert/loader`、`packages/typert/generator` 实现「类型图 → 远程协议 → 代码生成」。
- **SDK**：`packages/sdk/*` 提供 JSON-RPC（stdio）服务端与客户端；`python/sdk-runtime` 是 Python 侧运行时。

详见 [presentation.md](presentation.md)。

## 8. 启动与配置

### 8.1 配置层级

```text
cordis.yml                 # 插件启用、config、entry.disabled
  + profile 的 bundle 列表  # 每个 bundle 提供一层 cordis.patch.yml
  + 用户 profile 的 patch    # $DSH_HOME/profiles/<name>/
  + 显式 --patch <file>     # 命令行追加 overlay
```

- `cordis.yml` 允许在 `plugin.config` 与 `entry.disabled` 下使用 `!!js`（**不是** `!js`）；其他元数据保持字面量。
- 需要条件组合时使用 **overlay**，而不是在 `cordis.yml` 里写条件表达式。

### 8.2 CLI

```sh
pnpm dsh --profile headless "task"   # 从源码运行一次任务
```

主要子命令（详见 `docs/cli-help.md`）：

| 子命令 | 作用 |
| --- | --- |
| `dsh profile` | 列出 / 创建 / 检查 profile |
| `dsh plugin` | 插件清单管理 |
| `dsh dump-config` | 打印生效配置 |
| `dsh dump-config-schema` | 打印配置 JSON Schema |

## 9. 相关文档

- 仓库权威架构文档：[docs/architecture.md](../docs/architecture.md)
- Cordis 语义（waterfall、loader 配置）：[docs/cordis-primer.md](../docs/cordis-primer.md)
- 能力接缝定义：[docs/capability-seams.md](../docs/capability-seams.md)
- 事件生产者/消费者：[docs/event-producer-consumer.md](../docs/event-producer-consumer.md)
- 工具目录：[docs/tool-catalog.md](../docs/tool-catalog.md)
- 子系统页面：[docs/subsystems/](../docs/subsystems/)
