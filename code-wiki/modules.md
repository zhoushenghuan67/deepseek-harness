# Code Wiki — 模块地图

> 本文按 `packages/<group>/<pkg>` 的分组列出全部 **53 个包组**、**375 个工作区包**（`packages/*/*/` 下 370 个 + `apps/*/` 下 5 个）的职责边界。

## 阅读说明

| 记号 | 含义 |
| --- | --- |
| `ctx.<name>` | 该组注册或消费的 Cordis 服务键（通过 `declare module '@deepseek-ai/cordis'` 扩展 `Context`） |
| 数量 | 该组下的包个数 |
| 角色 | `D` = Service Definition（定义接口）、`P` = Service Provider（提供实现）、`C` = Consumer（消费方） |

完整的 `ctx.*` 服务键清单（**148 个**声明于源码 `Context` 扩展中）见 [capabilities.md](capabilities.md)。

---

## 1. 核心域

### core — Agent / Session 核心 API（10 包）

整个运行时的心脏。定义 `Agent`、`Session`、`ToolsService`、`SystemPrompt` 等接口与契约。

| 包 | 职责 | 主要导出 |
| --- | --- | --- |
| `agent` | Agent 注册表与生命周期 | `AgentRegistry`、`AgentHandle`、`AgentFactory`、`CreateAgentOptions` |
| `agent-loop` | ReAct 主循环 | `AgentLoop`、`ReactLoopAgent`（见 `agent.ts`） |
| `agent-default-model` | 默认模型选择策略 | 默认模型解析 |
| `agent-tool-presentation` | 工具调用的可读呈现 | 工具调用视图投影 |
| `scope` | 作用域系统 | `createScope`、`scopeOf`、`scopeTarget`、`bindScopeParent` |
| `session` | 会话与事件模型 | `Session`、`SessionStore`、`SessionEventMap`、`SESSION_FORMAT_VERSION` |
| `system-prompt` | 系统提示词拼装 | `SystemPrompt`、`renderPrompt`、`PromptAssembly` |
| `tools` | 工具注册与执行服务 | `ToolsService`、`ToolDefinition`、`ToolExecutionPipeline` |
| `tool-executor-native` | 本地进程工具执行器 | 原生执行后端 |
| `tool-executor-ptc` | PTC 工具执行器 | PTC 后端 |

### session — 持久化会话（22 包）

事件格式、迁移、投影、遥测、标题等。

| 包 | 职责 |
| --- | --- |
| `session-format` | 会话格式的定义与类型 |
| `session-format-catalog` | 格式版本目录与消息投影清单 |
| `session-format-v0-to-v1`、`session-format-v1-to-v2`、`session-format-v2-to-v3`、`session-format-v3-to-v4` | 版本迁移器（**只新增，不改写既有代**） |
| `session-persistence` / `session-persistence-jsonl` | 会话持久化接口与 JSONL 实现 |
| `session-projection` / `session-projection-cache` | 投影注册表与缓存 |
| `session-checkpoint-policy` | 投影检查点策略 |
| `session-log-deepseek` | DeepSeek 会话日志后端 |
| `session-stats` | 会话统计投影 |
| `session-telemetry` / `session-telemetry-otel` | 会话遥测 |
| `session-title` / `session-title-llm` / `session-title-first-prompt-llm` | 会话标题生成 |
| `session-turn-outline` | 回合大纲投影 |
| `message-quotes` | 消息引用 |
| `tool-working-directory` / `working-directory` | 工作目录服务与工具 |
| `session-format-catalog` | 格式目录 |

### llm — 模型提供方（9 包）

| 包 | 职责 |
| --- | --- |
| `llm` | `LlmRuntime`、`LlmAdapter`、`PreparedLlmCall`、`LlmError` |
| `llm-deepseek` | DeepSeek 提供方 |
| `llm-deepseek-account` | 走账号体系（OAuth/云账号）的 DeepSeek 通道 |
| `llm-deepseek-api-key` | 走 API Key 的 DeepSeek 通道 |
| `llm-pi-ai` | 通用多提供方适配层 |
| `llm-retry` | 重试策略 |
| `token-meter` | Token 用量计量 |
| `deepseek-llm-api-extensions` | DeepSeek API 扩展参数 |
| `plugin-package-inventory-deepseek` | 插件包清单 |

### tools（见 core）· typert — 类型图与远程协议（4 包）

| 包 | 职责 |
| --- | --- |
| `protocol` | Typert 远程协议定义 |
| `registry` | 类型/服务注册表 |
| `loader` | 类型图加载 |
| `generator` | 由类型图生成 RPC 客户端/服务端代码 |

### util — 低依赖工具库（21 包）

`brand`（品牌化 id）、`values`（值工具）、`timeout`、`atomic-write`、`home-paths`、`launch-environment`、`http-proxy`、`package-manifest`、`plugin-detail`、`plugin-market-index`、`time`、`deque`、`chunked-list`、`code-language`、`crypto`、`file-drag`、`lazy-require`、`native-command`、`official-bundles`（**内置 bundle / profile 模板**）、`output-retention`、`workspace-path`。

---

## 2. 系统能力域

### fs — 文件系统（8 包）

`fs`（接口）、`fs-local`（本地实现）、`fs-sandbox`（沙箱内实现）、`fs-patch`（补丁式编辑）、`fs-observation-policy`（文件读取观测策略）、`tool-fs`（`read`/`write`/`edit`/`glob`/`grep`）、`tool-fs-search`（搜索工具）、`tool-str-replace-editor`（`str_replace_editor`）。

### shell — 命令执行（10 包）

`shell`（接口）、`shell-env`、`bash-local` / `bash-sandbox`、`pwsh-local` / `pwsh-sandbox`、`tool-bash` / `tool-bash-persistent`、`tool-pwsh` / `tool-pwsh-persistent`。

### subprocess — 子进程管理（3 包）

`subprocess`（接口）、`subprocess-local`（本地实现）、`win32-process`（Windows 进程语义）。

### sandbox — 进程隔离（4 包）

`sandbox`（接口）、`sandbox-local`、`sandbox-policy`（策略定义）、`sandbox-windows-acl`（Windows ACL 沙箱）。

### terminal — 持久终端（2 包）

`terminal`（接口）、`terminal-bash`（bash 后端）。

### ssh — SSH 执行提供方（5 包）

`ssh`、`fs-ssh`、`sandbox-ssh`、`subprocess-ssh`、`ssh-helper-runtime`。

### web — 搜索与抓取（5 包）

`web`（接口）、`web-deepseek-api`（DeepSeek 搜索 API）、`web-search-deepseek`（DeepSeek 搜索后端）、`web-fetch-http`（HTTP 抓取）、`tool-web`（`web_search` / `web_fetch` 工具）。

### mcp — Model Context Protocol（3 包）

`mcp-client`（单服务器客户端）、`mcp-manager`（多服务器管理）、`mcp-resources`（`list_mcp_resources` 等资源工具）。

### lsp — 语言服务器（3 包）

`lsp`（接口）、`lsp-stdio`（stdio 传输后端）、`tool-lsp`（`lsp` 工具）。

### skill — 技能加载（5 包）

`skill`（接口）、`skill-filesystem`、`skill-office`、`tool-skill`、`tool-workspace-dependencies`。

### jobs — 后台任务（3 包）

`jobs`（接口）、`jobs-local`（本地执行）、`tool-jobs`（`job_list` / `job_kill` / `job_output`）。

### storage — 非会话存储（4 包）

`storage`（接口）、`storage-domain`（领域划分）、`storage-json`（JSON 后端）、`storage-sqlite`（SQLite 后端）。

### session-query — 会话浏览与导出（3 包）

`session-query`（接口）、`session-query-sqlite`（SQLite 查询后端）、`session-log-export`（会话日志导出）。

### workspace — 工作区实体（1 包）

`workspace`：工作区实体定义。

### spill — 输出溢出（3 包）

`spill`（接口）、`spill-local`、`spill-policy`（何时溢出的策略）。

### attachment — 二进制附件（2 包）

`attachment`（接口）、`attachment-local`（本地后端）。

### browser-use / computer-use — 交互式操作

`browser-use`（浏览器交互服务）、`computer-use`（计算机交互服务）。两者在 `experimental` 下有更完整的实现（见第 6 节）。

### sandbox 相关工具组

`packages/ssh` 的 5 个包让上述所有能力都能跑在远程主机上，与本地实现共用同一套接口。

---

## 3. Agent 编排域

### subagent — 委派代理（9 包）

| 包 | 职责 |
| --- | --- |
| `subagent` | 子代理核心抽象 |
| `subagent-spawn-in-process` | 进程内派生 |
| `subagent-fork-in-process` | 进程内分叉（继承已有会话上下文） |
| `subagent-acp` / `subagent-claude-code` / `subagent-codex` / `subagent-dsh-sdk` | 委派到外部代理运行时 |
| `tool-subagent` | `subagent` 工具 |
| `tool-subagent-control` | `interrupt_agent` / `list_agents` / `send_message` / `wait_agent` 等控制工具 |

### team — 共享任务协作（2 包）

`agent-team`（团队协调）、`tool-agent-team`（`team_task_create` / `team_task_get` / `team_task_list` / `team_task_update`）。

### workflow — 工作流执行（3 包）

`workflow`（引擎）、`workflow-ptc`（PTC 后端）、`tool-workflow`（`workflow` 工具）。

### plan — 记录式规划（1 包）

`plan-mode`：`exit_plan_mode` 工具与规划模式。

### goal — 会话目标（4 包）

`goal`（目标服务）、`goal-round-driver`（回合驱动）、`tool-goal`（`create_goal` / `get_goal` / `update_goal`）、`command-goal`（CLI 命令）。

### todo — 任务清单（1 包）

`tool-todo`：`todo_write` 工具。

### schedule — 定时跟进（2 包）

`schedule`（调度服务）、`tool-schedule`（`schedule_create` / `schedule_edit` / `schedule_list` / `schedule_view`）。

### compaction — 上下文压缩（5 包）

`compaction`（接口）、`compaction-basic`（基础策略）、`compaction-image-offload`（图片卸载）、`compaction-tool-result-pruner`（工具结果裁剪）、`command-compact`（`/compact` 命令）。

### context — 请求上下文（7 包）

`agent-instructions`（AGENTS.md 等指令注入）、`file-reference` / `file-reference-local`、`session-reference`、`time-context`、`tmux-context`、`harness-dev-context`。

### interaction — 人机交互（5 包）

`commands`（斜杠命令）、`permission-presets`（权限预设）、`user-approval`（审批）、`user-questions`（提问）、`tool-ask-user`（`ask_user_question` 工具）。

### guard — 循环与工具守卫（2 包）

`repeat-tool-reminder`（重复工具调用提醒）、`timeout-policy`（超时策略）。

### preset — Agent 组合（3 包）

`agent-preset`、`agent-preset-registry`、`persona`（人格设定）。

### ptc-runtime — PTC 执行（2 包）

`ptc-runtime`（抽象）、`ptc-runtime-node`（Node 实现）。

### credentials / identity / settings

`credentials`（凭据接口）、`credentials-local`（本地后端）、`authorization`（授权）、`deepseek-account` / `deepseek-account-platform`（账号）；`identity/anonymous-user-id`（匿名身份）；`settings`（用户设置）。

### feedback — 人类反馈（2 包）

`command-feedback`（命令）、`message-feedback`（消息级反馈）。

---

## 4. 表现与传输域

### client — 浏览器 UI（70 包）

前端以「UI 槽位（slot）」方式组合。每个 `ui-*` 包声明自己填充哪个槽位，`packages/client/modules` 把它们转成懒加载浏览器 bundle。

| 类别 | 包 |
| --- | --- |
| 基础设施 | `ui-slots`（槽位注册）、`ui-renderer`（渲染）、`ui-primitives`（基础组件）、`ui-theme`、`ui-layout`、`ui-dockkit`（停靠布局） |
| 状态与连接 | `store`（状态）、`connection`（连接）、`resources`、`locale`（i18n 字典）、`hmr` |
| 会话主界面 | `ui-conversation`、`ui-chat`、`ui-session`、`ui-message-feedback`、`ui-trajectory`、`ui-input-trigger` |
| 工具与呈现 | `ui-tool`、`ui-approval`、`ui-context-menu`、`ui-file-actions`、`ui-file-drag` |
| 侧边栏 | `ui-sidebar` 及 5 个子面板：`ui-sidebar-browser`、`ui-sidebar-documentpreview`、`ui-sidebar-files`、`ui-sidebar-right`、`ui-sidebar-terminal` |
| 设置 | `ui-settings` 及 10 个子页：`ui-settings-general`、`ui-settings-models`、`ui-settings-plugins`、`ui-settings-plugin-inventory`、`ui-settings-shell`、`ui-settings-subagent`、`ui-settings-web-search`、`ui-settings-session-log`、`ui-settings-agent-loop`、`ui-settings-account` |
| 功能页 | `ui-plan`、`ui-goal`、`ui-jobs`、`ui-schedule`、`ui-skill`、`ui-subagent`、`ui-agent-team`、`ui-agent-preset`、`ui-workflow-run`、`ui-user-questions`、`ui-deliverables`、`ui-workspace`、`ui-reference`、`ui-commands`、`ui-trajectory`、`ui-attachment` |
| 其他 | `ui-brand-official`、`ui-entry-customization`、`ui-shortcuts`、`ui-model-selection`、`ui-permission-presets`、`ui-secret-mask`、`ui-plugin-manager`、`ui-plugin-market`、`ui-directory-picker-browse`、`ui-directory-picker-native`、`ui-open-in-app` |
| 承载 | `web`（前端入口）、`modules`（模块打包）、`file-upload`、`product-analytics` |

### host — 宿主进程（9 包）

`webserver`（HTTP 服务）、`frontend-static`（静态资源）、`directory-picker`、`directory-picker-auto`、`directory-picker-browse`、`directory-picker-native`（目录选择的后端）、`open-in-app`（在外部应用打开）、`plugin-inventory`（插件清单）、`product-telemetry-otel`（遥测）。

### api — Remote BFF（10 包）

| 包 | 职责 |
| --- | --- |
| `gateway` | Remote BFF 入口 |
| `remotes` | 远程服务集合 |
| `remote-access` | 远程访问控制 |
| `account-controller` / `session-controller` / `job-controller` / `settings-controller` / `terminal-controller` / `workspace-controller` | 各领域控制器 |
| `workspace-files` | 工作区文件服务 |

### sdk — JSON-RPC SDK（3 包）

`server`（stdio JSON-RPC 服务端）、`client`（客户端）、`protocol`（线协议）。

### acp — Automation-only ACP（1 包）

`acp`：Agent Client Protocol 接入，仅供自动化使用，不做产品支持承诺。

### telemetry — 遥测（1 包）

`otel`：OpenTelemetry 导出。

---

## 5. 引导与组装域

### boot — 应用引导（6 包）

`app-boot`（启动流程）、`cmdline`（命令行解析）、`config-editor`（配置编辑）、`hmr`（热重载）、`plugin-manager`（插件管理）、`plugin-market`（插件市场）。

### bundle — Profile Bundle（6 包）

`base`、`web-app`、`sdk-app`、`sdk-minimal`、`headless`、`acp-app`。每个包含一份 `cordis.patch.yml`。

### extensions — 运行时自修改（4 包）

`cordis-host-runner`、`cordis-client-runner`、`tool-cordis`（让 Agent 操作插件）、`ui-cordis`（前端插件面板）。

### document（1 包）

`office-to-pdf`：Office 文档转 PDF。

### deliverables — 回合交付物（3 包）

`tool-present`（`present` 工具，向用户呈现成果）、`deliverable-file-references`（文件引用）、`workspace-changes`（工作区变更摘要）。

---

## 6. experimental — 评估中能力（61 包）

**独立于可选交付**：`experimental` 包的「评估中」状态与「是否可选交付」是两件事。非 experimental 包需要产品用途或明确的分类（`scripts/product-package-policy.ts`）。

| 类别 | 包 |
| --- | --- |
| 浏览器 | `browser-use-runtime`、`browser-use-playwright-mcp`、`browser-use-chrome-devtools-mcp`、`browser-use-stagehand-native` |
| 计算机使用 | `cua`、`cua-macos`、`cua-bundle`、`computer-use-cua-driver-native`、`computer-use-cua-driver-mcp` |
| 语音 | `speech-to-text`、`speech-to-text-sensevoice`、`api-speech-to-text`、`client-ui-voice-input`、`voice-input-bundle` |
| 会话分析 | `session-inspector`、`session-search`、`tool-session-query`、`client-ui-stats` |
| 插件/技能增强 | `skill-badge`、`badge-skill-bundle`、`plugin-recommendations`、`personalized-recommendations`、`client-ui-plugin-recommendations`、`creation-recommendations`、`client-ui-creation-recommendations` |
| 运行时扩展 | `webworker-packer`、`webworker-runtime`、`ptc-runtime-python`、`tool-worktree`、`worktree`、`tool-ralph`、`ralph-bundle`、`tool-terminal`、`terminal-bundle` |
| 协议/钩子 | `hook-protocol`、`hooks-claude-code`、`hooks-codex`、`claude-code-mods`、`client-ui-claude-code-mods` |
| 其他 | `action-cards`、`client-ui-action-cards`、`auto-review`、`translator`、`client-ui-cot-translation`、`cot-translation-bundle`、`liveshare`、`liveshare-protocol`、`webhook`、`webhook-github`、`forge`、`forge-bundle`、`forge-github`、`forge-session`、`client-ui-forge`、`inspector`、`inspector-profile`、`plugin-market-bundle`、`session-title-all-prompts-llm`、`session-titles-bundle`、`subagent-oar`、`tool-subagent-oar` |

---

## 7. 测试支撑（8 包）

`packages/test-support/*`：`agent-loop-testkit`（Agent 循环测试工具）、`client-runtime`、`llm-mock-server`（本地假模型服务）、`llm-replay`（录制回放）、`loader-smoke`（加载器冒烟）、`remote-mock`（远程调用模拟）、`session-snapshot`（会话快照）、`tool-testkit`（工具测试工具）。

---

## 8. 分组索引速查（53 组）

| 组 | 包数 | 组 | 包数 | 组 | 包数 |
| --- | --- | --- | --- | --- | --- |
| acp | 1 | goal | 4 | shell | 10 |
| api | 10 | guard | 2 | skill | 5 |
| attachment | 2 | host | 9 | spill | 3 |
| boot | 6 | identity | 1 | ssh | 5 |
| browser-use | 1 | interaction | 5 | storage | 4 |
| bundle | 6 | jobs | 3 | subagent | 9 |
| client | 70 | llm | 9 | subprocess | 3 |
| compaction | 5 | lsp | 3 | team | 2 |
| computer-use | 1 | mcp | 3 | telemetry | 1 |
| context | 7 | plan | 1 | terminal | 2 |
| core | 10 | preset | 3 | test-support | 8 |
| credentials | 5 | ptc-runtime | 2 | todo | 1 |
| deliverables | 3 | sandbox | 4 | typert | 4 |
| document | 1 | schedule | 2 | util | 21 |
| experimental | 61 | sdk | 3 | web | 5 |
| extensions | 4 | session | 22 | workflow | 3 |
| feedback | 2 | session-query | 3 | workspace | 1 |
| fs | 8 | settings | 1 | — | — |

> 合计 375 个工作区包：`packages/*/*/` 下 370 个，`apps/*/` 下 5 个（`cli`、`desktop`、`desktop-host`、`plugin-market-generator`、`web`）。
