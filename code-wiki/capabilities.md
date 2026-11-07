# Code Wiki — 能力接缝

> 本文说明「能力接缝」（Capability Seam）的构成规则、各能力域的职责，以及运行时暴露的 **148 个 `ctx.*` 服务键**。

---

## 1. 什么是能力接缝

一个能力接缝由**三个角色**组成，缺一不可：

| 角色 | 含义 | 判据 |
| --- | --- | --- |
| **Service Definition** | 声明接口与类型的包 | 在 `Context` 扩展里声明 `ctx.<name>` 的类型 |
| **Service Provider** | 提供实现的包 | 通过 `ctx.set()` 注册该服务的实现 |
| **Consumer** | 使用该能力的包 | 通过 `ctx.get()` / 依赖注入消费该服务 |

**拆分规则**：只有当三个角色需要**独立演进**时才拆成三个包。拆了但只有一个角色、或三个角色总是一起变，就是过度拆分。

**默认行为规则**：包边界上「显式优于隐式」——默认值必须是拥有方实现里的一个显式 `resolve(request): Spec` 步骤，而不是 `run()` 内部藏着的 `?? default`。

**配置规则**：没有硬编码的可调项。部署相关的选择必须是 `cordis.yml` 里可改的 `Config` 字段；`DEFAULT_*` 常量和测试钩子不算可配置性。协议常量、外部规范、安全不变量保持固定。

---

## 2. 能力域总览

```text
                       ┌────────────────────────────────┐
                       │           Agent 循环            │
                       │  (core/agent-loop, core/agent) │
                       └───────────────┬────────────────┘
                                       │ ctx.tools / ctx.llm / ctx.systemPrompt
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐
   │  fs     │   │  shell   │   │subprocess│   │ terminal │   │   mcp   │
   └────┬────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬────┘
        │              │              │              │              │
        └──────────────┴──────┬───────┴──────────────┘              │
                              ▼                                      ▼
                        ┌───────────┐                        ┌────────────┐
                        │  sandbox  │                        │    lsp     │
                        └───────────┘                        └────────────┘
```

| 能力域 | 定义 | 提供方 | 典型消费者 | 工具 |
| --- | --- | --- | --- | --- |
| **fs** | `packages/fs/fs` | `fs-local`、`fs-sandbox`、`fs-ssh` | `tool-fs`、`tool-fs-search`、`deliverables` | `read` `write` `edit` `glob` `grep` `read_image` `str_replace_editor` |
| **shell** | `packages/shell/shell` | `bash-local`、`bash-sandbox`、`pwsh-local`、`pwsh-sandbox` | `tool-bash`、`tool-pwsh` | `bash` `pwsh` |
| **subprocess** | `packages/subprocess/subprocess` | `subprocess-local`、`subprocess-ssh`、`win32-process` | `tool-executor-native`、`fs-patch` | —（底层） |
| **sandbox** | `packages/sandbox/sandbox` | `sandbox-local`、`sandbox-windows-acl`、`sandbox-ssh` | `fs-sandbox`、`shell-sandbox` | —（约束层） |
| **sandboxPolicy** | `packages/sandbox/sandbox-policy` | 同包 | `sandbox-local` | — |
| **terminal** | `packages/terminal/terminal` | `terminal-bash` | `packages/client/ui-sidebar-terminal`、`terminal-controller` | `terminal_open` `terminal_read` `terminal_send` `terminal_signal` `terminal_list` `terminal_close` |
| **web** | `packages/web/web` | `web-deepseek-api`、`web-fetch-http` | `tool-web` | `web_search` `web_fetch` |
| **mcp** | `packages/mcp/mcp-client`、`mcp-manager` | `mcp-manager` | `mcp-resources` | `list_mcp_resources` `list_mcp_resource_templates` `read_mcp_resource` |
| **lsp** | `packages/lsp/lsp` | `lsp-stdio` | `tool-lsp` | `lsp` |
| **skill** | `packages/skill/skill` | `skill-filesystem`、`skill-office` | `tool-skill` | `skill` `load_workspace_dependencies` |
| **jobs** | `packages/jobs/jobs` | `jobs-local` | `tool-jobs` | `job_list` `job_output` `job_kill` |
| **storage** | `packages/storage/storage` | `storage-json`、`storage-sqlite` | `storage-domain` 及各业务包 | — |
| **spill** | `packages/spill/spill` | `spill-local` | `compaction` | — |
| **attachment** | `packages/attachment/attachment` | `attachment-local` | `session-controller` | — |
| **sessions** | `packages/core/session` | `session-persistence`（JSONL） | `agent`、`session-controller` | — |
| **llm** | `packages/llm/llm` | `llm-deepseek`、`llm-pi-ai` | `agent-loop`、`context` | — |
| **subagents** | `packages/subagent/subagent` | `subagent-spawn-in-process`、`subagent-fork-in-process`、`subagent-claude-code` 等 | `tool-subagent` | `subagent` `list_agents` `send_message` `wait_agent` `interrupt_agent` |
| **agentTeams** | `packages/team/agent-team` | 同包 | `tool-agent-team` | `team_task_create` `team_task_get` `team_task_list` `team_task_update` |
| **workflowEngine** | `packages/workflow/workflow` | `workflow-ptc` | `tool-workflow` | `workflow` |
| **ptcRuntime** | `packages/ptc-runtime/ptc-runtime` | `ptc-runtime-node` | `tool-executor-ptc`、`workflow-ptc` | — |
| **userApproval** | `packages/interaction/user-approval` | 同包 | `tool-executor-*`、前端 | — |
| **userQuestions** | `packages/interaction/user-questions` | 同包 | `tool-ask-user` | `ask_user_question` |
| **commands** | `packages/interaction/commands` | 同包 | CLI 与前端 | — |
| **planMode** | `packages/plan/plan-mode` | 同包 | `agent-loop` | `exit_plan_mode` |
| **goals** | `packages/goal/goal` | `goal-round-driver` | `tool-goal` | `create_goal` `get_goal` `update_goal` |
| **schedule** | `packages/schedule/schedule` | 同包 | `tool-schedule` | `schedule_create` `schedule_edit` `schedule_list` `schedule_view` |
| **compaction** | `packages/compaction/compaction` | `compaction-basic`、`compaction-image-offload` | `context` | — |
| **toolResultPruner** | `packages/compaction/compaction-tool-result-pruner` | 同包 | `compaction` | — |
| **webServer** | `packages/host/webserver` | 同包 | `apps/web`、`apps/desktop` | — |
| **remote** | `packages/api/remotes` | `packages/api/gateway` | `packages/client/*` | — |
| **typert** | `packages/typert/protocol` | `packages/typert/loader`、`generator` | `api`、`client`、`sdk` | — |
| **settings** | `packages/settings/settings` | 同包 | `settings-controller` | — |
| **credentials** | `packages/credentials/credentials` | `credentials-local` | `llm-deepseek-api-key` | — |
| **authorization** | `packages/credentials/authorization` | 同包 | `remote-access` | — |
| **identity** | `packages/identity/anonymous-user-id` | 同包 | `product-analytics` | — |
| **sessionQuery** | `packages/session-query/session-query` | `session-query-sqlite` | `tool-session-query`、`session-search` | `session_search` `session_trace` |
| **sessionProjections** | `packages/session/session-projection` | 同包 | `agent`、`session-stats`、`session-title` | — |
| **systemPrompt** | `packages/core/system-prompt` | 同包 | `agent-loop` | — |
| **tools** | `packages/core/tools` | `tool-executor-native`、`tool-executor-ptc` | `agent-loop` | — |
| **workingDirectory** | `packages/session/working-directory` | 同包 | `fs`、`shell`、`tool-working-directory` | `working_directory` |
| **workspaces** | `packages/workspace/workspace` | `workspace-controller` | `client`、`api` | — |
| **workspaceFiles** | `packages/api/workspace-files` | 同包 | `workspace-controller` | — |
| **pluginManager** | `packages/boot/plugin-manager` | 同包 | `app-boot`、`ui-plugin-manager` | `plugin_manager` |
| **pluginMarket** | `packages/boot/plugin-market` | 同包 | `ui-plugin-market` | `plugin_market` |
| **browserUse** | `packages/browser-use/browser-use` | `experimental/browser-use-runtime` | `experimental` 工具 | `stagehand_*` |
| **computerUse** | `packages/computer-use/computer-use` | `experimental/cua` | `experimental` | — |
| **cuaAccess** | `packages/experimental/cua` | 同包 | `computer-use-cua-driver-*` | — |
| **otel** | `packages/telemetry/otel` | 同包 | `product-telemetry-otel` | — |
| **tokenMeter** | `packages/llm/token-meter` | 同包 | `llm` | — |
| **shellEnv** | `packages/shell/shell-env` | 同包 | `shell` | — |
| **fileReferences** | `packages/context/file-reference` | `file-reference-local` | `context` | — |
| **sessionReferenceResolver** | `packages/context/session-reference` | 同包 | `context` | — |
| **jobs / jobController** | `packages/jobs/jobs` | `jobs-local` | `api/job-controller` | `job_*` |
| **dshHomePath** | `packages/boot/app-boot` | 同包 | 多数包 | — |
| **launchEnvironment** | `packages/util/launch-environment` | 同包 | `app-boot` | — |
| **profileContext** | `packages/boot/app-boot` | 同包 | `app-boot` | — |
| **pluginPackages** | `packages/boot/app-boot` | 同包 | `plugin-manager` | — |

---

## 3. 本地与远端的双实现

多数系统能力都有 **local** 与 **sandbox/ssh** 两套实现，接口一致：

| 接口 | 本地 | 沙箱/远端 |
| --- | --- | --- |
| `ctx.fs` | `fs-local` | `fs-sandbox`、`fs-ssh` |
| `ctx.shell` | `bash-local`、`pwsh-local` | `bash-sandbox`、`pwsh-sandbox` |
| `ctx.subprocess` | `subprocess-local` | `subprocess-ssh` |
| `ctx.sandbox` | `sandbox-local`、`sandbox-windows-acl` | `sandbox-ssh` |

`packages/ssh/*` 的 5 个包（`ssh`、`fs-ssh`、`sandbox-ssh`、`subprocess-ssh`、`ssh-helper-runtime`）让同一套能力跑在远程主机上。

`ctx.terminal` 的 `terminal-bash` 后端通过 SSH 也能工作——这就是为什么 `ssh` 组要与 `terminal` 组并存。

---

## 4. `ctx.*` 服务键全表（148 个）

按字母序。「定义包」列指声明该键类型的包；多个包名表示多个包各自扩展了 `Context`（声明合并）。

| 服务键 | 定义包 |
| --- | --- |
| `ctx.actionCards` | action-cards, client-ui-action-cards |
| `ctx.agentDefaultModel` | agent-default-model |
| `ctx.agentLoop` | agent-loop |
| `ctx.agentPresets` | agent-preset-registry |
| `ctx.agents` | agent |
| `ctx.agentTeams` | agent-team |
| `ctx.appExit` | cmdline |
| `ctx.appReady` | cmdline |
| `ctx.approval` | user-approval |
| `ctx.attachments` | attachment |
| `ctx.authorization` | authorization |
| `ctx.browserUse` | browser-use |
| `ctx.chatFileMentions` | ui-chat |
| `ctx.claudeCodeMods` | claude-code-mods |
| `ctx.clientModules` | modules |
| `ctx.cmdlineArgs` | cmdline |
| `ctx.commands` | commands |
| `ctx.commandUi` | ui-commands |
| `ctx.compaction` | compaction |
| `ctx.computerUse` | computer-use |
| `ctx.configEditor` | config-editor |
| `ctx.configForms` | ui-settings |
| `ctx.configuredAgentIdentities` | agent-loop |
| `ctx.connection` | connection |
| `ctx.conversation` | ui-conversation |
| `ctx.cordisInspect` | cordis-client-runner, cordis-host-runner |
| `ctx.cotTranslation` | client-ui-cot-translation |
| `ctx.credentials` | credentials |
| `ctx.credentialsController` | settings-controller |
| `ctx.cuaAccess` | cua |
| `ctx.deepseekAccount` | deepseek-account |
| `ctx.deepseekLlmApiExtensions` | deepseek-llm-api-extensions |
| `ctx.directoryPicker` | directory-picker |
| `ctx.directoryPickerController` | workspace-controller |
| `ctx.documentPreviews` | ui-sidebar-documentpreview |
| `ctx.dshHomePath` | app-boot |
| `ctx.dynamicCordisRunner` | cordis-client-runner, cordis-host-runner |
| `ctx.feedbackUi` | ui-message-feedback |
| `ctx.fileDrag` | ui-file-drag |
| `ctx.fileReferences` | file-reference |
| `ctx.fileUpload` / `ctx.fileUploads` | file-upload |
| `ctx.forge` | forge |
| `ctx.forgePanel` | client-ui-forge |
| `ctx.forgeSession` | forge-session |
| `ctx.fs` | fs |
| `ctx.goals` | goal |
| `ctx.headlessStartup` | headless |
| `ctx.hmr` | hmr |
| `ctx.inputTriggers` | ui-input-trigger |
| `ctx.inspector` | inspector |
| `ctx.jobController` | job-controller |
| `ctx.jobs` | jobs, job-controller |
| `ctx.launchEnvironment` | launch-environment |
| `ctx.launcherSessionQueryPath` | session-query-sqlite |
| `ctx.layout` | ui-layout |
| `ctx.liveshareShares` | liveshare |
| `ctx.llm` | llm |
| `ctx.locale` | locale |
| `ctx.lsp` | lsp |
| `ctx.mcpManager` | mcp-manager |
| `ctx.mcpResources` | mcp-resources |
| `ctx.messageFeedback` | message-feedback |
| `ctx.modelDirectories` | ui-model-selection |
| `ctx.modules` | modules |
| `ctx.officeToPdf` | office-to-pdf |
| `ctx.otel` | otel |
| `ctx.permissionPresets` | permission-presets |
| `ctx.planMode` | plan-mode |
| `ctx.pluginChanges` | ui-plugin-manager |
| `ctx.pluginManager` | plugin-manager |
| `ctx.pluginMarket` | plugin-market |
| `ctx.pluginNavigation` | ui-plugin-manager |
| `ctx.pluginPackages` | app-boot |
| `ctx.pluginRecommendations` | plugin-recommendations |
| `ctx.pluginRegistryProbe` | ui-plugin-manager |
| `ctx.productAnalytics` | product-analytics |
| `ctx.productTelemetry` | product-telemetry-otel |
| `ctx.profileContext` | app-boot |
| `ctx.ptcRuntime` | ptc-runtime |
| `ctx.remote` | gateway, remotes |
| `ctx.remoteAccess` | remote-access |
| `ctx.resources` | resources |
| `ctx.sandbox` | sandbox |
| `ctx.sandboxPolicy` | sandbox-policy |
| `ctx.schedule` | schedule |
| `ctx.sessionController` | session-controller |
| `ctx.sessionFeedback` | command-feedback |
| `ctx.sessionFileReferences` | session-controller |
| `ctx.sessionLogDeepSeek` | session-log-deepseek |
| `ctx.sessionLogDownload` | session-log-export |
| `ctx.sessionPersistence` | session-persistence |
| `ctx.sessionProjectionCache` | session-projection-cache |
| `ctx.sessionProjections` | session-projection |
| `ctx.sessionQuery` | session-query |
| `ctx.sessionReferenceResolver` | session-reference |
| `ctx.sessions` | session, session-controller |
| `ctx.sessionSkillCatalog` | session-controller |
| `ctx.sessionTelemetry` | session-telemetry |
| `ctx.sessionTitle` | session-title |
| `ctx.settings` | settings |
| `ctx.settingsController` | settings-controller |
| `ctx.settingsSchema` | ui-settings |
| `ctx.shell` | shell |
| `ctx.shellEnv` | shell-env |
| `ctx.shortcuts` | shortcuts |
| `ctx.sidebarRight` / `ctx.sidebarRightTabs` | ui-sidebar-right |
| `ctx.skills` | skill |
| `ctx.slots` / `ctx.uiRenderer` | ui-renderer |
| `ctx.speechController` | api-speech-to-text |
| `ctx.speechToText` | speech-to-text |
| `ctx.spillStore` | spill |
| `ctx.ssh` | ssh |
| `ctx.storage` | storage |
| `ctx.storageDomain` | storage-domain |
| `ctx.subagentModelSelection` | tool-subagent |
| `ctx.subagents` | subagent |
| `ctx.subprocess` | subprocess |
| `ctx.systemPrompt` | system-prompt |
| `ctx.terminalController` | terminal-controller |
| `ctx.terminals` | terminal |
| `ctx.theme` | ui-theme |
| `ctx.tokenMeter` | token-meter |
| `ctx.toolResultPruner` | compaction-tool-result-pruner |
| `ctx.tools` | tools |
| `ctx.translator` | translator |
| `ctx.typert` | protocol |
| `ctx.typertGateway` | gateway |
| `ctx.uiConversation` | ui-conversation |
| `ctx.uiSession` | ui-session |
| `ctx.uiWorkspace` | ui-workspace |
| `ctx.userQuestionPanels` | ui-tool |
| `ctx.userQuestions` | user-questions |
| `ctx.web` | web |
| `ctx.webApp` | web-app |
| `ctx.webhookRuntime` | webhook |
| `ctx.webServer` | webserver |
| `ctx.webTerminals` | terminal-controller |
| `ctx.workflowEngine` | workflow |
| `ctx.workingDirectory` | working-directory |
| `ctx.workspaceChanges` | workspace-changes |
| `ctx.workspaceController` | workspace-controller |
| `ctx.workspaceFiles` | workspace-files |
| `ctx.workspaceRegistry` | workspace |
| `ctx.workspaces` | workspace-controller |
| `ctx.worktrees` | worktree |

---

## 5. 跨边界 id 与类型

- **跨边界 id 一律品牌化**：`Branded<B>`（来自 `packages/util/brand`），不用裸 `string`。例如 `SessionId`、`SessionSeq`、`ScopeKey`。
- **同进程有类型边界信任 TypeScript**：不为静态接口已保证的值加运行时校验。
- **必须校验的边界**：解析器/配置、排队、模型/工具 JSON、持久化/文件、worker、进程、wire。
- **禁止 `as unknown` / `<unknown>`**：保留或减少历史基线。

---

## 6. 扩展一个能力的步骤

以新增一个工具为例（完整流程见 `docs/cookbook/adding-a-tool.md`）：

1. **定义契约** —— 在 `packages/core/tools` 侧或独立包里定义接口。
2. **提供实现** —— 用 `ctx.effect()` 注册服务或 `ctx.tools.register(definition)` 注册工具。
3. **接入组装** —— 在对应 bundle 的 `cordis.patch.yml` 里启用插件。
4. **设计 UI 呈现** —— Host presenter 保持纯净；Web 卡片从原始事件与持久化结果元数据派生。
5. **补齐测试** —— 单元、e2e、快照；模型/用户可见的改动要更新无密钥录制快照。
6. **补齐文档** —— 包 README、JSDoc 契约、必要的升级指南条目。

---

## 7. 相关文档

- 能力接缝定义：[docs/capability-seams.md](../docs/capability-seams.md)
- 事件生产者/消费者：[docs/event-producer-consumer.md](../docs/event-producer-consumer.md)
- 工具目录：[docs/tool-catalog.md](../docs/tool-catalog.md)
- 添加工具手册：[docs/cookbook/adding-a-tool.md](../docs/cookbook/adding-a-tool.md)
- 子系统页面：[docs/subsystems/](../docs/subsystems/)
