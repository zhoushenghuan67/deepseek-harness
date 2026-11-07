# DeepSeek Harness — Code Wiki

> 本仓库（`deepseek-harness`）的结构化代码文档：整体架构、模块职责、关键类与函数、依赖关系、运行方式。
>
> 文中所有事实均从当前工作区读出；路径均为仓库相对路径。

## 1. 这是什么项目

DeepSeek Harness（`dsh`）是一个 **Agent 运行时（agent harness）**：它承载 AI Agent，把工具暴露给 Agent，把每一轮对话记录成可持久化的会话日志，并可以用完全相同的核心跑在本地 CLI、桌面应用、浏览器应用、远程 BFF 或 SDK 服务端五种形态下。

技术底座是一个 **pnpm monorepo**，全部为 ESM TypeScript，构建在 vendored 的 [Cordis](https://cordis.js.org) 插件框架之上。

| 指标 | 数值 |
| --- | --- |
| `packages/*/*/` 下的包 | 370 |
| `apps/` 下的应用 | 5（`@deepseek-ai/dsh`、`@deepseek-ai/dsh-desktop`、`@deepseek-ai/dsh-desktop-host`、`@deepseek-ai/dsh-web-frontend`、`@deepseek-ai/dsh-plugin-market-generator`） |
| `packages/` 下的包组 | 53 |
| `vendor/` 下的 vendored Cordis 包 | 9 |
| 内部依赖边（`dependencies` + `peerDependencies`） | 1,721（694 + 1,027） |
| 源码中声明的 `ctx.*` 服务键 | 148 |
| 最低 Node 版本 | >= 24.9 |

## 2. 文档索引

| 文档 | 内容 |
| --- | --- |
| [architecture.md](architecture.md) | 分层模型、Cordis 插件框架、组装方式（Profile / Bundle）、Agent 回合生命周期、事件流 |
| [modules.md](modules.md) | 全部 53 个包组及其职责边界 |
| [core-runtime.md](core-runtime.md) | 关键类与函数：session、agent、agent-loop、tools、system-prompt、llm、scope、投影 |
| [capabilities.md](capabilities.md) | 能力接缝：shell、文件系统、子进程、沙箱、终端、Web、MCP、subagent、team；148 个 `ctx.*` 服务键全表 |
| [presentation.md](presentation.md) | 客户端 UI、Host 宿主、Remote BFF（Typert）、桌面与 Web 应用、SDK |
| [dependencies.md](dependencies.md) | 中心包排序、依赖规则、层级、组间依赖、外部依赖分布 |
| [running.md](running.md) | 安装、构建、运行、测试、Profile 与配置、扩展开发 |

## 3. 一段话总结

`dsh` 用插件组装出一切。一个 **Profile**（`$DSH_HOME/profiles/<name>/` 下的目录）列出一串 **Bundle**；一个 Bundle（`packages/bundle/*`）是一份 `cordis.patch.yml` overlay，写明要加载哪些插件、合并哪些配置。Loader 构建插件树，每个插件把自己的贡献注册进共享的 Cordis `Context`。运行时核心是 `dsh-session`（事件溯源存储）、`dsh-agent-loop`（ReAct 回合/步骤驱动）、`dsh-tools`（工具注册表与执行流水线）、`dsh-llm`（与提供方无关的模型接口）、`dsh-scope`（按 Agent 隔离的作用域）。其余一切——shell、文件系统、沙箱、终端、网页搜索、MCP、子代理——都挂在这些接缝上。同一套核心既能跑在 headless CLI 里，也能跑在 Electron 里、浏览器（类型化 RPC）里，也能从 Python 驱动。

## 4. 仓库布局

```text
vendor/      Vendored Cordis 框架（private，rescope 为 @deepseek-ai/cordis）
packages/    @deepseek-ai/dsh-<pkg> 工作区包，按能力域分组
apps/        可运行应用（CLI、desktop、desktop-host、web、plugin-market-generator）
python/      Python SDK 与运行时
native/      @deepseek-ai/node-addon-system（原生插件源码）
benchmarks/  性能门禁
scripts/     仓库质量门禁与生成器
website/     VitePress 文档投影
docs/        受维护的文档（子系统页面、目录、手册）
.agents/     Agent 工作流、技能与决策记录
```

`packages/` 组织成 53 个组。全部组及其内容见 [modules.md](modules.md)。

## 5. 关键源码位置

| 用途 | 路径 |
| --- | --- |
| Monorepo / 工作区定义 | `pnpm-workspace.yaml`（仓库根） |
| 根脚本与门禁 | `package.json` |
| 架构总览（权威） | `docs/architecture.md` |
| 包组索引 | `packages/README.md` |
| 包级指导 | `packages/AGENTS.md` |
| 内部依赖图 | `docs/module-graph.md` |
| 工具目录 | `docs/tool-catalog.md` |
| 配置目录 | `docs/config-catalog.md` |
| CLI 参考 | `docs/cli-help.md` |
| 子系统页面 | `docs/subsystems/*.md` |
| 开发流程 | `docs/development.md` |
| 测试策略 | `docs/testing.md` |

## 6. 读代码前必须知道的约定

这些约定由仓库门禁强制，几乎影响仓库里的每一个文件。

1. **用插件扩展，不用改循环。** 新行为放在有文档的扩展点上；改 `agent-loop` 要同步更新 `docs/architecture.md`。
2. **注册即副作用。** 每个贡献都走 `ctx.effect()` / `ctx.on()`；注册表的 `register()` 返回 disposer。
3. **类型化事件用声明合并。** 事件表可合并扩展；封闭联合以 `assertNever` 收尾，可合并联合走有文档的 default 分支。
4. **Waterfall 监听器必须调用 `next()`。** 不调用即短路整条链。
5. **模型可见 ⟺ 已记录。** 进入模型请求的任何内容都必须能从会话日志重建。
6. **包边界上显式优于隐式。** 默认值是拥有方实现里显式的 `resolve(request): Spec` 步骤，不是 `run()` 里藏着的 `?? default`。
7. **插件里没有硬编码可调项。** 部署相关的选择是 `cordis.yml` 里可改的 `Config` 字段。
8. **配置错误必须响亮失败。** 绝不静默跳过缺失的引用对象。
9. **跨边界 id 品牌化**（`Branded<B>`，来自 `dsh-brand`），不用裸 `string`。
10. **同进程有类型边界信任 TypeScript。** 运行时校验只出现在解析器/配置、排队、模型/工具 JSON、持久化/文件、worker、进程、wire 边界。

## 7. 从哪里开始读

| 目标 | 起点 |
| --- | --- |
| 熟悉整体 | `docs/architecture.md` → `packages/core/agent-loop/src/agent.ts` |
| 加一个工具 | `packages/core/tools/src/contracts.ts`（`ToolDefinition` 契约）→ `docs/cookbook/adding-a-tool.md` |
| 加一个模型提供方 | `packages/llm/llm/src/index.ts`（`llm/stream` waterfall） |
| 加前端 UI | `packages/client/ui-slots/README.md` → `packages/client/modules/README.md` |
| 加一个插件 | `packages/README.md`（包组与依赖规则）→ `docs/architecture.md`（扩展点） |
| 改会话格式 | `docs/session-format-status.md` → `packages/core/session/src/types.ts` |
| 了解某个能力域 | `docs/subsystems/` 下对应页面 → [capabilities.md](capabilities.md) |

## 8. 本套文档的边界

- 本文集是**阅读辅助**，不是仓库受维护文档的替代品。凡涉及契约的权威来源，一律是 `docs/` 下的文档与源码里的 JSDoc。
- 仓库的正式文档是**中英双语**的（`foo.md` + `foo.zh.md` + `foo.i18n.yaml`）。本套 Code Wiki 是单语（中文）的**外部交付物**，刻意放在 `code-wiki/` 下，不进入 `docs/` 的双语语料，因此不会被 `verify-translation-pairing` 门禁要求配对。
- 数字与列表都是**当前工作区的实测值**，不是估算。
