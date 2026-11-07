# Code Wiki — 关键类与函数

> 本文说明运行时核心包中的关键类与函数：会话、Agent、Agent 循环、工具、系统提示词、模型运行时、作用域。

阅读顺序建议：`Session`（状态） → `AgentRegistry`（生命周期） → `ReactLoopAgent`（驱动） → `ToolsService` / `ToolExecutionPipeline`（行动） → `LlmRuntime`（思考）。

---

## 1. 会话：`packages/core/session`

### 1.1 `Session`（`src/index.ts`）

一次会话的**只读视图 + 事件追加入口**。它是事件溯源模型的中心对象。

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `eventAt` | `(seq: SessionSeq): SessionEvent \| undefined` | 按序号取单个事件 |
| `ownEvents` | `(): readonly SessionEvent[]` | 本会话自身产生的事件（不含插件记录） |
| `isOwnSeq` | `(seq: SessionSeq): boolean` | 判断序号是否属于本会话 |
| `requestHeader` | `(): EpochHeader \| undefined` | 当前轮次（epoch）的请求头 |
| `requestContext` | `(): RequestContext \| undefined` | 请求上下文 |
| `toolHistory` | `(): ToolHistory` | 工具调用历史 |
| `deriveMessages` | `(): Message[]` | **从事件重建模型可见消息序列**——「模型可见 ⟺ 已记录」的具体实现 |
| `deriveEventMessage` | `(event: SessionEvent): Message \| null` | 单个事件对应的消息（无对应消息时返回 `null`） |
| `detach` | `(): void` | 脱离（会话被关闭/移交时） |

**辅助函数**（同文件模块级导出）：

| 函数 | 说明 |
| --- | --- |
| `adoptSessionEvent` | 把外部事件收编为会话事件（补齐 seq/元数据） |
| `snapshotSessionEvent` | 事件快照（不可变副本） |
| `appendPluginRecord` / `pluginRecordOf` | 追加/读取插件私有记录。插件记录**不进入模型可见面**，但仍落在日志里 |

### 1.2 `SessionStore`（`src/index.ts`）

会话工厂与注册表，是 `ctx.sessions` 服务的实现。

| 方法 | 说明 |
| --- | --- |
| `create(id?, options?)` | 新建会话 |
| `prepare(id?, options?)` | 准备会话（可恢复既有会话） |
| `enter(session)` | 进入会话，返回 disposer |
| `announce(session)` | 广播会话开始 |
| `flush(session)` | 落盘，返回是否成功 |
| `get(id)` / `list()` | 查询 |
| `fork(source, boundary?, childSessionId?)` | 从某个序号分叉出新会话，失败时抛 `SessionForkError` |
| `registerMessageProjection(projection)` | 注册消息投影（异步注册，返回 Promise\<disposer\>） |

### 1.3 事件类型（`src/types.ts`）

| 导出 | 说明 |
| --- | --- |
| `SessionEventMap` | 事件类型 → payload 映射表。用**声明合并**扩展，新增事件不破坏旧读者 |
| `SessionEvent` | 带 `seq`、`type`、`data` 的**判别联合** |
| `SESSION_FORMAT_VERSION` | 当前版本号 **4**。只在既有判别字段无法防止不安全解读时才升版本；同版本改动必须保证旧读者的安全行为 |
| `SessionId` / `SessionSeq` / `SessionLogOffset` / `SessionSeqCursor` | **品牌化 id**（来自 `dsh-brand`），跨边界不混用 |
| `TurnEndReason` / `TurnEndReasonMap` | 回合结束原因 |
| `EpochHeader` / `RequestContext` | 轮次头与请求上下文 |
| `PluginRecordMap` / `PluginRecord` | 插件私有记录类型表 |

### 1.4 表面折叠（`src/surface.ts`）

| 导出 | 说明 |
| --- | --- |
| `foldSurface` | 把事件流折叠成**会话消息面**（用户实际看到的对话序列） |
| `SurfaceManager` | 维护消息面状态 |
| `deriveEventMessage` | 事件 → 消息 |
| `isSurfaceEvent` / `isAppendSurfaceEvent` / `isReplacementSurfaceEvent` | 判定事件是否属于消息面、是否为追加/替换型 |
| `validateSessionEventData` / `validateSurfaceMetadata` | 事件数据与表面元数据校验 |

### 1.5 其他

| 文件 | 关键导出 |
| --- | --- |
| `src/fork.ts` | `buildForkSeed`：构造分叉种子事件 |
| `src/repair.ts` | `TOOL_NOT_STARTED`、`TOOL_OUTCOME_UNKNOWN`、`ToolCallRecovery`、`openTurnClosers`：中断后修复未完成工具调用与悬空回合 |
| `src/request-header.ts` | `canonicalHeader`、`headerEquals`、`foldRequestHeader` |
| `src/seq-ranges.ts` | `EncodedSeq`、`encodeSeqRanges`、`decodeSeqRanges`：序号区间压缩 |
| `src/tool-history.ts` | `ToolHistoryProjection` |
| `src/preparation.ts` | `SessionPreparation`、`SessionPreparationOptions` |
| `src/known-event-types.ts` | `KNOWN_SESSION_EVENT_TYPES`、`MESSAGE_PROJECTION_EVENT_TYPES` |

---

## 2. Agent：`packages/core/agent`

### 2.1 `AgentRegistry`（`src/index.ts`）

`ctx.agents` 的实现，管理 Agent 实例的生命周期与「当前发起者」。

| 方法 | 说明 |
| --- | --- |
| `setFactory(factory)` | 设置 Agent 工厂（返回 disposer）。`AgentLoop` 启动时把自己的工厂注入这里 |
| `create(options)` | 通过工厂创建 Agent，返回 `AgentHandle` |
| `resume(options)` | 恢复既有 Agent |
| `register(agent)` | 注册 Agent 实例，返回 `Context['effect']`（即注册即副作用的 disposer） |
| `enter(agent)` | 把 Agent 设为当前发起者，返回 disposer |
| `announce(agent, source, signal?)` | 广播会话开始 |
| `get(id)` / `list()` | 查询 |
| `currentInitiator()` | 当前发起者（没有则 `undefined`） |
| `requireInitiator()` | 当前发起者（没有则抛错） |
| `turnBoundaryOf(session)` | 取回合边界投影 |

### 2.2 `AgentHandle`（接口）

| 成员 | 说明 |
| --- | --- |
| `commit(): void` | 提交初始化（把「已建立」的事实固化，使后续 `dispose` 能正确回滚） |
| `dispose(): Promise<void>` | 释放 Agent 及其作用域 |

### 2.3 `Agent` 接口要点

| 成员 | 说明 |
| --- | --- |
| `send(message, target, wakeup)` | 投递用户消息到 inbox。`wakeup` 决定是否立即唤醒循环 |
| `followup(input)` | 追加后续消息 |
| `steer(input)` | 引导（插入到当前回合） |
| `inject(input)` | 注入（不进入用户可见流） |
| `cancel(cause, options?)` | 取消 |
| `whenIdle(): Promise<void>` | 等待空闲 |
| `status` | `AgentStatus` |
| `scope` / `ctx` | Agent 作用域 |

---

## 3. Agent 循环：`packages/core/agent-loop`

### 3.1 `AgentLoop`（`src/index.ts`）

`ctx.agentLoop` 服务，实现 `AgentFactory`。它是把「Agent 概念」接到「具体循环实现」的接缝。

| 成员 | 说明 |
| --- | --- |
| `constructor(ctx, config)` | `Config` 含 `maxParallelToolCalls` 等运行参数 |
| `create(id, options, meta)` | 创建并返回一个 `Agent`（实际是 `ReactLoopAgent`） |
| `createAgent(ownerCtx, options)` | `AgentFactory` 接口实现 |
| `resume(ownerCtx, options)` | 恢复既有 Agent |
| `CONFIGURED_AGENT_IDENTITIES_KEY` | 从配置读取已冻结 Agent 身份的键 |

`AgentLoop` 内部还管理一组**生命周期跟踪器**（`track` / `trackStartup` / `trackWrapper` / `waitWhileActive` / `dispose`），确保启动期与包装层的异步任务在 Agent 退出时被等待或取消。

### 3.2 `ReactLoopAgent`（`src/agent.ts`）

**驱动一个会话跨越回合（turn）与步骤（step）边界的核心类**，实现 `Agent` 接口。

构造签名：

```ts
new ReactLoopAgent(
  loopCtx: Context,
  id: SessionId,
  options: AgentOptions,
  session: Session,
  projections: LoopProjections,
  lastTurn: number,
)
```

内部状态：

| 字段 | 说明 |
| --- | --- |
| `phase: Phase` | 当前阶段（`idle` / `maintenance` / 运行态）。`status` getter 由它派生：`idle`/`maintenance` → `'idle'`，其余 → `'running'` |
| `dispatch: AgentEventDispatch` | **熔合派发器**，构造时构建一次，热路径派发不产生分配 |
| `scope: Scope` | Agent 作用域；循环退出后由生命周期所有者解绑 |
| `model: AgentModel` | 模型选择 |
| `inbox: ReactLoopInbox` | 消息收件箱（负责认领 target 命中的消息） |
| `runtimeContext: RuntimeContextProjection` | 运行期上下文投影 |
| `systemPrompt: SystemPromptProjection` | 系统提示词投影 |
| `frozenMessages: WeakSet<Message>` | 被完全冻结的消息身份（弱引用不保留已替换的历史） |
| `assistantStreamRevision` / `assistantAttemptCounter` | 助手帧的进程内修订号与尝试计数，用于流式重试时去重 |

方法：

| 方法 | 说明 |
| --- | --- |
| `send(message, target, wakeup)` | 投递消息 |
| `followup(input)` / `steer(input)` / `inject(input)` | 三种不同的消息注入语义 |
| `cancel(cause, options?)` | 取消；`cause` 是封闭联合（`disposed` / `hook` / …），末尾 `assertNever` |
| `whenIdle()` | 等待循环进入空闲 |
| `setPhase(next)` | 提交阶段并在状态可见变化时发出 `agent/status` 事件 |

---

## 4. 工具：`packages/core/tools`

### 4.1 `ToolsService`（`src/index.ts`）

`ctx.tools` 服务：工具的注册、筛选、解析与执行调度。

| 方法 | 说明 |
| --- | --- |
| `register(definition, options?)` | 注册工具，返回 disposer |
| `restrict(filter: ToolRestriction)` | 施加限制（按 scope / 工具集过滤），返回 disposer |
| `get(name, scope?, toolSet?)` | 按名字取定义 |
| `executable(name, scope?, toolSet?)` | 取**当前可执行**的定义（考虑限制） |
| `resolve(context: ToolActivationContext)` | **解析本次请求实际可用的工具集**（`ResolvedToolSet`） |
| `definitions(scope?, toolSet?)` | 列出定义 |
| `schemas(scope?, toolSet?)` | 导出 JSON Schema（喂给模型） |
| `setExecutor(executor)` | 替换执行器（返回 disposer）。原生执行器与 PTC 执行器在此竞争 |
| `execute(input: ToolBatchInput)` | 执行一批工具调用，返回 `ToolBatchResult` |
| `guard(guard: ToolGuard)` | 注册守卫（返回 disposer） |
| `checkGuards(exec)` | 执行前跑守卫，返回拒绝理由（`string \| undefined`） |

内部还有一个 `ToolLayer`（按作用域编译的工具限制层，`isEmpty()` / `admits(name)`）。

### 4.2 工具契约（`src/contracts.ts`）

| 导出 | 说明 |
| --- | --- |
| `ToolDefinition` | 工具定义：名字、描述、参数 schema、执行函数、输出定义 |
| `ToolRegistrationOptions` | 注册选项（scope、来源包等） |
| `ToolActivationContext` | 工具集解析的输入上下文 |
| `ResolvedToolSet` | 解析后的工具集 |
| `ToolResult` / `ToolExecutionSuccess` / `ToolExecutionFailure` | 执行结果 |
| `ToolExecution` / `ToolExecutionInput` / `ToolExecutionMode` / `ToolRunContext` | 执行期数据 |
| `PreToolDecision` / `PostToolDecision` | 前置/后置决策 |
| `ToolGuard` | 守卫函数 |
| `ToolRestriction` | 限制条件 |
| `ToolNotFoundError` / `ToolOutputError` / `ToolActivationError` | 错误类型 |
| `TOOL_ABORTED` / `TOOL_ABORTED_BEFORE_DISPATCH` | 取消标记 |

### 4.3 `ToolExecutionPipeline`（`src/pipeline.ts`）

工具执行的**三段式流水线**：

| 方法 | 说明 |
| --- | --- |
| `executionMode(exec)` | 判定执行模式（直接执行 / 调度执行） |
| `prepare(input)` | 准备阶段：跑 `tools/pre-execute` waterfall，产出 `ScheduledToolPreparation` |
| `dispatch(exec)` | 执行阶段：跑 `tools/execute` waterfall，产出 `ScheduledToolDispatch` |
| `complete(exec, outcome)` | 完成阶段：跑 `tools/post-execute` waterfall，产出 `ToolExecutionResult` |

配套导出：`ToolExecutionSource`、`ScheduledToolPreparation`、`ScheduledToolDispatch`、`toolErrorMessage`。

### 4.4 参数 Schema（`src/schema.ts`）

| 导出 | 说明 |
| --- | --- |
| `ValueSchemaSpec` 及其子类型 | **声明式**的参数 schema（`String`/`Number`/`Integer`/`Boolean`/`Null`/`Array`/`Object`/`Json`/`OneOf`） |
| `InferValue` / `InferArgs` | 从 schema 推导 TypeScript 类型（无需手写重复类型） |
| `valueSchemaSpecToJsonSchema` | spec → JSON Schema |
| `parameterSchemaSpecToJsonSchema` | 参数 schema → JSON Schema |
| `defineTool(options)` | **定义工具的推荐入口**：输入 spec，自动推导类型并产出 `ToolDefinition` |
| `validateArgs` / `ToolArgsError` | 参数校验 |
| `projectToolSchema` | schema 投影（裁剪到模型可见形式） |

### 4.5 JSON Schema 工具（`src/json-schema.ts`）

`assertSupportedJsonSchema`、`assertObjectJsonSchema`、`validateJsonSchemaValue`、`isJsonSchemaRecord` 等——在**模型/工具 JSON 边界**做校验（这正是 AGENTS.md 允许做运行时校验的边界之一）。

### 4.6 呈现（`src/presentation.ts`）

工具调用的可读视图类型：`ToolCallView`、`GenericCallView`、`TerminalCallView`、`DiffCallView`、`ToolResultView`、`SearchResultView`、`ReadResultView`、`WebResultView` 等。**Host 侧 presenter 保持纯净**，Web 卡片从原始事件 + 持久化结果元数据派生。

---

## 5. 系统提示词：`packages/core/system-prompt`

### 5.1 `SystemPrompt`（服务）

| 方法 | 说明 |
| --- | --- |
| `section(section: PromptSection)` | 注册一个提示词片段，返回 disposer |
| `getSectionOrder(name)` / `getContextOrder(name)` | 查排序位次 |
| `context(context: PromptContext)` | 注册上下文片段 |
| `suppressRuntimeContext()` | 抑制运行期上下文（返回 disposer） |
| `tools(provider)` | 注册**工具提示词提供者**（provider 可依赖 `AssembleContext` 动态决定） |
| `variable(name, provider)` | 注册变量 |
| `refreshContext(assembly, context?)` | 刷新已组装提示词中的上下文部分 |
| `assemble(context?)` | **组装最终提示词**，返回 `PromptAssembly` |

### 5.2 纯函数

| 函数 | 说明 |
| --- | --- |
| `renderPrompt` | 把 `PromptAssembly` 渲染成最终文本 |
| `renderContextSnapshot` | 渲染上下文快照 |
| `joinContextSections` / `renderContextSections` | 拼接上下文片段 |
| `PERSONA_PREFIX_SECTION` / `PERSONA_SUFFIX_SECTION` | 人格前缀/后缀槽位 |
| `TOOL_ORDER_REST` | 工具在提示词中的默认排序标记 |

---

## 6. 模型运行时：`packages/llm/llm`

### 6.1 `LlmRuntime`

`ctx.llm` 的实现，多提供方注册中心。

| 方法 | 说明 |
| --- | --- |
| `registerAdapter(providers, adapter)` | 注册适配器，返回 `AdapterRegistrationHandle` |
| `listProviders()` | 列出提供方 |
| `registerConfigurableProviders(entries)` | 注册可配置提供方目录，返回 `DirectoryRegistrationHandle` |
| `listConfigurableProviders()` | 列出可配置提供方 |
| `providerRetryPolicy(provider)` | 解析重试策略 |
| `imageRequestPricing(provider, model)` / `imageRequestTarget(provider, model, ref)` | 图像请求定价与目标 |
| `fileRequestText(ref)` | 文件附件转文本 |
| `listModels(provider)` | 列出模型 |
| `resolveCallConfig(config, signal?)` | 解析调用配置（补齐凭证等） |
| `stream(options)` | **发起流式生成**，返回 `AsyncIterable<StreamChunk>` |

### 6.2 `LlmAdapter`（抽象基类）

| 成员 | 说明 |
| --- | --- |
| `stream(options)` | 流式生成（抽象） |
| `providerInfo(provider)` | 提供方元信息 |
| `providerRetryPolicy(provider)` | 提供方重试策略 |
| `imageRequestPricing` / `imageRequestTarget` | 图像请求相关 |
| `listModels(provider)` | 模型清单 |
| `prepareCall(provider, model, signal?)` | **准备一次调用**（校验 API Key、装配凭证），返回 `PreparedAdapterCall` |

### 6.3 其他

| 导出 | 说明 |
| --- | --- |
| `LlmError` | 类型化错误，带 `code` 与 `LlmErrorOptions` |
| `assertUsableApiKey` | 校验 API Key 可用 |
| `PreparedLlmCall` / `PreparedAdapterCall` | 准备好的调用参数 |
| `AdapterRegistrationHandle` / `DirectoryRegistrationHandle` | 注册句柄（撤销注册） |

---

## 7. 作用域：`packages/core/scope`

| 导出 | 说明 |
| --- | --- |
| `ScopeKey` | 作用域键（品牌化） |
| `Scoped` | 携带作用域的对象 |
| `Scope` | 作用域对象：`ctx`、`scopeKey`、`parent` 等 |
| `createScope(ctx, options?)` | **创建子作用域**（继承父级服务，可覆盖） |
| `scopeOf(target)` | 取目标的作用域 |
| `scopeTarget(scope)` | 取作用域的目标对象 |
| `isScopeCarrier(value)` / `carrierKeyOf(value)` | 判定是否携带作用域、读取其键 |
| `bindScopeParent` / `scopeParentOf` / `scopeChainOf` | 作用域父子绑定与链查询 |

---

## 8. 投影：`packages/session/session-projection`

| 导出 | 说明 |
| --- | --- |
| `SessionProjectionRegistry` | 投影注册表 |
| `ProjectionDefinition` | 投影定义 |
| `ProjectionHandle` | 投影句柄 |
| `ProjectionSnapshot` | 投影快照 |
| `ProjectionCheckpoint` / `ProjectionCheckpointRow` | 检查点（用于增量恢复） |
| `ProjectionChangeListener` / `ProjectionEventChangeListener` | 变更监听 |
| `ProjectionKeySelection` | 键选择策略 |

已注册的投影实例：

| 投影 | 位置 | 定义名 |
| --- | --- | --- |
| 会话统计 | `packages/session/session-stats/src/projection.ts` | `sessionStatsProjectionDefinition` |
| 会话标题 | `packages/session/session-title/src/index.ts` | `titleProjectionDefinition` |
| 回合大纲 | `packages/session/session-turn-outline/src/projection.ts` | `turnOutlineProjectionDefinition` |

---

## 9. 模型可见工具目录（72 个）

来自 `docs/tool-catalog.md`（权威目录，含各工具的所属包与门控条件）：

```text
plugin_manager  plugin_market  list_mcp_resource_templates  list_mcp_resources  read_mcp_resource
stagehand_act  stagehand_extract  stagehand_navigate  stagehand_observe  stagehand_screenshot  stagehand_tabs
propose_action  ask_user_question  run_code  exit_plan_mode
bash  pwsh  cordis_inspect_list  cordis_inspect_query
str_replace_editor  apply_patch  edit  read  read_image  write  glob  grep
terminal_close  terminal_list  terminal_open  terminal_read  terminal_send  terminal_signal
create_goal  get_goal  update_goal
schedule_create  schedule_edit  schedule_list  schedule_view
lsp  ralph  skill
session_event_read  session_event_search  session_event_trace  session_search  session_trace
subagent_oar  list_subagent_models  subagent  interrupt_agent  list_agents  send_message  wait_agent
job_kill  job_list  job_output
team_task_create  team_task_get  team_task_list  team_task_update
todo_write  working_directory  create_worktree  workflow  load_workspace_dependencies
web_fetch  web_search
```

其中 `bash` / `pwsh` 各出现两次（本地实现与沙箱实现是不同提供方下的同名工具）。

---

## 10. 关键常量

| 常量 | 值 | 位置 |
| --- | --- | --- |
| `SESSION_FORMAT_VERSION` | `4` | `packages/core/session/src/types.ts` |
| `DEFAULT_MAX_PARALLEL_TOOL_CALLS` | `10` | `packages/core/agent-loop/src/constants.ts` |
| `DEFAULT_PROFILE_BUNDLES` | `['@deepseek-ai/dsh-base']` | `packages/util/official-bundles/src/bundles.ts` |
| `PROFILE_TEMPLATES` | 5 个内置 profile 模板 | 同上 |
