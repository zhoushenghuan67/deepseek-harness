# Code Wiki — 依赖关系

> 本文说明工作区内部的依赖结构、依赖规则、中心包（hub）排序，以及外部依赖的分布。

---

## 1. 总量

| 指标 | 数值 |
| --- | --- |
| 工作区包总数 | **375**（`packages/*/*/` 下 370 + `apps/*/` 下 5） |
| 包组数 | **53** |
| 内部依赖边总数 | **1,721** |
| ├ `dependencies` | 694 |
| └ `peerDependencies` | 1,027 |
| 有 ≥1 个内部依赖方的包 | **337** |
| 恰有 1 个依赖方的包 | **143** |
| 无内部依赖方的包 | **38** |

> 内部边只统计 `@deepseek-ai/dsh-*` 之间的声明；`@deepseek-ai/cordis` 等 vendor 与外部依赖另计。

---

## 2. 依赖声明规则

| 规则 | 说明 |
| --- | --- |
| 包名 | `@deepseek-ai/dsh-<name>` |
| Vendor | `@deepseek-ai/cordis` 被 **rescope**；vendor 包 `private: true` |
| Harness 包的框架依赖 | `@deepseek-ai/cordis` 写在 **`peerDependencies` / `devDependencies`**，不写进 `dependencies` |
| 工作区依赖 | DSH 包用 `workspace:*`；vendor / native 用 `workspace:~` |
| 本地相对导入 | 用包名跨包导入；包内相对导入写 `.ts` 扩展名 |
| ESM | 全部 `"type": "module"` |

**为什么 `peerDependencies` 占 1,027 条（60%）**：Harness 包声明的是「我需要这个能力存在」，而不是「我打包了这份实现」。同一能力可以有本地、沙箱、SSH 等多个提供方，运行时由 profile 决定启用哪一个。

---

## 3. 中心包（Hub）排序

按「有多少个不同的包依赖它」排序。这份榜单就是**改动影响面**的度量。

| 排名 | 包 | 依赖方数量 | 作用 | 改动风险 |
| --- | --- | --- | --- | --- |
| 1 | `dsh-session` | 110 | 会话与事件模型 | **极高** |
| 2 | `dsh-llm` | 105 | 模型运行时与适配器 | **极高** |
| 3 | `dsh-agent` | 86 | Agent 注册表与生命周期 | **极高** |
| 4 | `dsh-tools` | 68 | 工具注册与执行 | **高** |
| 5 | `dsh-brand` | 65 | 品牌化 id | 高 |
| 6 | `dsh-util-values` | 63 | 值工具 | 高 |
| 7 | `dsh-typert-protocol` | 46 | 远程协议类型 | 高 |
| 8 | `dsh-system-prompt` | 42 | 系统提示词拼装 | 高 |
| 9 | `dsh-timeout` | 39 | 超时工具 | 中 |
| 10 | `dsh-session-projection` | 34 | 投影注册表 | 中 |
| 11 | `dsh-working-directory` | 30 | 工作目录 | 中 |
| 12 | `dsh-subprocess` | 30 | 子进程管理 | 中 |
| 13 | `dsh-scope` | 26 | 作用域系统 | 中 |
| 14 | `dsh-subagent` | 25 | 子代理 | 中 |
| 15 | `dsh-sandbox` | 25 | 沙箱接口 | 中 |
| 16 | `dsh-fs` | 23 | 文件系统接口 | 中 |
| 17 | `dsh-sandbox-policy` | 23 | 沙箱策略 | 中 |
| 18 | `dsh-session-persistence` | 14 | 会话持久化 | 中 |
| 19 | `dsh-attachment` | 13 | 附件 | 低 |
| 20 | `dsh-credentials` | 13 | 凭据 | 低 |
| 21 | `dsh-launch-environment` | 13 | 启动环境 | 低 |
| 22 | `dsh-app-boot` | 12 | 应用引导 | 低 |
| 23 | `dsh-commands` | 12 | 命令 | 低 |
| 24 | `dsh-user-approval` | 12 | 用户审批 | 低 |
| 25 | `dsh-skill` | 11 | 技能 | 低 |
| 26 | `dsh-shell` | 11 | Shell 接口 | 低 |
| 27 | `dsh-workspace` | 10 | 工作区实体 | 低 |
| 28 | `dsh-home-paths` | 10 | 路径工具 | 低 |
| 29 | `dsh-atomic-write` | 10 | 原子写 | 低 |
| 30 | `dsh-agent-preset-registry` | 9 | 预设注册表 | 低 |
| 31 | `dsh-client-connection` | 9 | 前端连接 | 低 |
| 32 | `dsh-session-title` | 9 | 会话标题 | 低 |

### 改动前三名的影响面

- **`dsh-session`** —— 110 个依赖方。`SessionEventMap` 的任何改动都要同时更新 TypeScript SDK 与 Python SDK 的期望输出。
- **`dsh-llm`** —— 105 个依赖方。适配器接口、`LlmError` 的错误码表、`PreparedLlmCall` 的字段都是跨包契约。
- **`dsh-agent`** —— 86 个依赖方。`AgentRegistry` 的方法签名、`AgentHandle` 的 `commit()`/`dispose()` 语义。

---

## 4. 依赖层级

依赖方向自下而上（详见 [architecture.md](architecture.md#2-分层模型)）：

```text
vendor/cordis
      ↓
util (21)   brand  values  timeout  home-paths  official-bundles  …
      ↓
core (10)   agent  session  tools  system-prompt  scope  agent-loop
      ↓
session (22)  llm (9)  fs (8)  shell (10)  subprocess (3)  sandbox (4)
terminal (2)  web (5)  mcp (3)  lsp (3)  skill (5)  subagent (9)  …
      ↓
typert (4)  api (10)  client (70)  host (9)  sdk (3)
      ↓
apps (5)
```

### 4.1 组间依赖实测

括号内是跨组边的条数（`dependencies` + `peerDependencies`，仅统计 `@deepseek-ai/dsh-*`）。

| 消费组 | 依赖的其它组（跨组，条数） |
| --- | --- |
| `core` | `util`(10), `llm`(7), `session`(4), `interaction`(2), `sandbox`(2), `boot`(1), `ptc-runtime`(1), `typert`(1), `workspace`(1) |
| `session` | `core`(22), `util`(15), `llm`(11), `compaction`(1), `feedback`(2), `fs`(1), `identity`(1), `storage`(1), `telemetry`(1) |
| `llm` | `util`(20), `core`(5), `credentials`(4), `attachment`(2), `compaction`(2), `fs`(2), `session`(2), `identity`(1), `preset`(1), `typert`(1) |
| `fs` | `core`(7), `sandbox`(7), `util`(6), `llm`(3), `session`(2), `attachment`(1), `interaction`(1), `spill`(1), `subprocess`(1) |
| `shell` | `core`(11), `sandbox`(9), `util`(7), `session`(4), `subprocess`(3), `interaction`(2), `jobs`(2), `llm`(2), `terminal`(2), `boot`(1) |
| `api` | `util`(18), `typert`(10), `core`(8), `session`(5), `credentials`(3), `client`(3), `preset`(2), `settings`(2), `workspace`(2), `attachment`(1), `context`(1), `fs`(1), `host`(1), `interaction`(1), `llm`(1), `session-query`(1), `skill`(1), `storage`(1), `subagent`(1), `subprocess`(1) |
| `client` | `typert`(5), `util`(4), `core`(1), `credentials`(1) |
| `host` | `util`(5), `client`(4), `preset`(1), `subprocess`(1), `telemetry`(1), `typert`(1) |
| `sdk` | `core`(5), `interaction`(5), `llm`(4), `subagent`(2), `apps`(1), `attachment`(1), `goal`(1), `schedule`(1), `session`(1), `util`(1) |
| `bundle` | 46 个组（overlay 层需要引用所有被启用插件） |
| `acp` | `attachment`(1), `core`(2), `interaction`(1), `llm`(2), `mcp`(1), `session`(1), `util`(1) |
| `context` | `core`(17), `session`(8), `util`(7), `llm`(3), `compaction`(1), `fs`(1), `session-query`(1), `shell`(1), `spill`(1), `subagent`(1), `typert`(1) |
| `compaction` | `core`(6), `llm`(6), `interaction`(3), `util`(4) |

---

## 5. 依赖环与约束

- **无环**：内部依赖图无循环（`pnpm run duplication` 与 `hygiene` 门禁会检查包路径与依赖约束）。
- **层内自由，层间单向**：表现层可以依赖能力层与核心层；能力层**不得**依赖表现层。
- **`bundle` 是例外**：`packages/bundle/*` 引用几乎所有插件——因为 overlay 的职责就是「点名要启用哪些插件」。这不构成运行时循环，因为 overlay 只引用**包名**，不引用其实现。

---

## 6. 外部依赖

外部依赖在 `packages/` 的 370 个包里共 **83 个**不同的运行时包名（`dependencies` + `peerDependencies` + `optionalDependencies`）；连同 `apps/` 与 `devDependencies` 一并计入是 165 个。主要集中在：

| 类别 | 代表包 |
| --- | --- |
| UI 框架 | `react`、`react-dom` |
| CLI | `commander` |
| 终端 | `node-pty`、`@xterm/headless`、`@xterm/addon-serialize` |
| 浏览器自动化 | `@playwright/mcp`、`@puppeteer/browsers`、`@browserbasehq/stagehand`、`chrome-devtools-mcp` |
| MCP | `@modelcontextprotocol/sdk`、`@modelcontextprotocol/client` |
| AI SDK | `@anthropic-ai/sdk`、`@anthropic-ai/claude-agent-sdk`、`@earendil-works/pi-ai`、`@openai/codex` |
| ACP | `@agentclientprotocol/sdk` |
| 计算机使用 | `@trycua/cua-driver`、`koffi`、`sherpa-onnx-node` |
| 遥测 | `@opentelemetry/*`（api / core / resources / sdk-logs / otlp-exporter-base / otlp-transformer） |
| 校验 | `zod`、`ajv` |
| 文档转换 | `turndown`、`@joplin/turndown-plugin-gfm`、`@yarnpkg/parsers`、`sharp` |
| 杂项 | `execa`、`cross-spawn`、`chokidar`、`ws`、`fflate`、`got`、`undici`、`p-limit`、`minisearch`、`rrule`、`shell-quote`、`semver`、`yaml`、`mime` |
| 测试 | `vitest`、`@vitest/spy`、`@testing-library/dom`、`@testing-library/react` |

### 6.1 依赖策略

**优先使用维护中的依赖，而不是手搓**——前提是该依赖**真正删掉了我们自己的代码和测试**（`.agents/notes/implemented/process/2026-07-26-dependencies-over-hand-rolling.md`）。

反向约束：

| 规则 | 说明 |
| --- | --- |
| `util/*` | 以**零依赖**为目标。实测 21 个包里 16 个无外部运行时依赖；5 个例外：`chunked-list`（`zod`）、`file-drag`（`mime`）、`http-proxy`（`undici`）、`plugin-market-index`（`semver`）、`time`（`@js-temporal/polyfill`、`rrule`） |
| `vendor/*` | 上游源码快照，带 manifest 记录上游 SHA |
| `native/*` | Node 原生插件（`@deepseek-ai/node-addon-system`） |
| 偏好维护中的依赖 | 仅当确实删掉自有代码与测试时 |
| 不用 `as unknown` | 不新增对 `unknown` 的断言 |

---

## 7. 依赖变更的检查清单

改动某个包的导出时：

1. **查影响面**：用上面的 hub 表与 `pnpm run duplication` 判断波及范围。
2. **更新所有消费方**：公共 API 是 pre-stable，改一处就要更新**每一个**消费者。
3. **持久化类型变更要显式承认**：按 `docs/cookbook/reviewing-persistence-type-changes.md` 处理。
4. **Session 格式**：若涉及既有判别字段无法防止的不安全解读，才提升 `SESSION_FORMAT_VERSION`；同版本改动必须保证旧读者的安全行为。
5. **升级指南**：任何外部可感知的破坏性变更，立即记录到升级指南（`.agents/skills/dsh-create-upgrade-guide/SKILL.md`）。
6. **跑门禁**：`pnpm run typecheck`、`pnpm run lint`、`pnpm run build`、`pnpm run hygiene`。

---

## 8. 相关文档

- 包分组总览：[packages/README.md](../packages/README.md)
- 模块地图：[modules.md](modules.md)
- 架构分层：[architecture.md](architecture.md)
- 依赖策略决议：[.agents/notes/implemented/process/2026-07-26-dependencies-over-hand-rolling.md](../.agents/notes/implemented/process/2026-07-26-dependencies-over-hand-rolling.md)
- Rescope 说明：[docs/rescope.md](../docs/rescope.md)
