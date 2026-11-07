# Code Wiki — 表现层与远程

> 本文说明前端 UI、Host 宿主、Remote BFF（Typert）、桌面与 Web 应用、SDK 的分工与数据流。

---

## 1. 总体拓扑

```text
┌───────────────────────────────┐
│  Browser                       │
│  ┌─────────────────────────┐  │
│  │ Client (packages/client)│  │
│  │  70 个包 → UI slots     │  │
│  └───────────┬─────────────┘  │
│              │ ctx.remote (Typert RPC)   │
└──────────────┼────────────────┘
               │
┌──────────────▼────────────────┐
│  Host process                  │
│  ┌───────────────────────────┐ │
│  │ API / BFF (packages/api) │ │
│  │  gateway + remotes       │ │
│  │  ctx.typertGateway       │ │
│  └───────────┬───────────────┘ │
│              │                 │
│  ┌───────────▼───────────────┐ │
│  │ Cordis services          │ │
│  │  agent / session / tools │ │
│  └───────────┬───────────────┘ │
│              │                 │
│  ┌───────────▼───────────────┐ │
│  │ webserver (packages/host)│ │
│  └───────────────────────────┘ │
└──────────────┬────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌───────────┐     ┌────────────┐
│ Session   │     │ SDK server │
│ log(JSONL)│     │ (JSON-RPC) │
└───────────┘     └────────────┘
```

三种接入方式共用同一套 Cordis 服务层：

| 接入 | 客户端 | 传输 | 入口包 |
| --- | --- | --- | --- |
| Web | 浏览器 | HTTP + Typert RPC | `apps/web` + `packages/api/gateway` |
| Desktop | Electron 壳 | 本地 HTTP + Typert RPC | `apps/desktop` + `apps/desktop-host` |
| SDK | 任意进程 | stdio JSON-RPC | `packages/sdk/server` |
| ACP | 自动化客户端 | ACP 协议 | `packages/acp` |

---

## 2. Client：浏览器 UI（`packages/client`，70 包）

### 2.1 UI 槽位（Slot）模型

前端不使用「一个大组件树」，而是**槽位注册 + 独立 bundle**：

```text
packages/client/ui-slots/src/index.ts
  SlotMap / SlotFactoryMap          ← 槽位类型表（声明合并扩展）
  SlotKind = 'single' | 'list' | 'keyed' | 'chain' | 'hoc'
  SlotScope = 'root' | 'session-maybe' | 'session'
  SlotEntryDef / SlotFactoryDef     ← 槽位条目与工厂定义
packages/client/ui-slots/src/renderer.ts
  SlotRenderer / SlotRendererHost   ← 渲染器与宿主
  StaleAuthorizationError            ← 授权过期
  SlotOwnershipError                 ← 槽位归属冲突
```

关键类型：

| 类型 | 作用 |
| --- | --- |
| `SlotKind` | 槽位语义：`single`（单占位）、`list`（列表）、`keyed`（按键）、`chain`（链式装饰）、`hoc`（高阶） |
| `SlotScope` | 槽位作用域：全局、可能带会话、必须带会话 |
| `SlotRendererHost` | 渲染宿主：提供 store、locale、资源等标准源 |
| `StandardSourceBinding` / `ScopedStandardSourceBinding` | 标准源绑定（全局或按作用域） |
| `SlotScopeAdapter` | 作用域适配器 |

### 2.2 客户端模块打包（`packages/client/modules`）

**一个包的 `dsh.client` 声明会被自动转成可加载的浏览器 bundle，无需逐插件接线。**

包 `package.json` 里的声明形式：

```json
{
  "dsh.client": {
    "platform": "web",
    "exports": "./client",
    "external": { ... }
  }
}
```

工作流程：

| 阶段 | 说明 |
| --- | --- |
| **解析** | `src/client/manifest.ts` 解析 `dsh.client` 声明 |
| **组合** | 把声明转成 `/plugins` 下托管的 bundle，**动态提供方排在消费者之前** |
| **注入** | Host 生成 **boot manifest** 注入页面 |
| **加载** | 浏览器按 manifest 加载；`ReleaseChangeGate` 只重载变更的模块 |
| **归属** | `entries.ts` 只管理由 Host manifest 创建的条目，其他 Loader 贡献者保持自己的归属 |

### 2.3 共享模块表

`packages/client/web` 持有冻结的 `PLATFORM_MODULES` 表——所有动态 bundle 的 externals **只针对这张基线表解析**。`dsh.client.external` 只能追加**精确的非基线请求**，每个请求要么由它点名的动态包行提供，要么命中静态表的精确键。

组合阶段会拒绝：格式错误的请求、缺失的供应方、自请求、同步请求环。

### 2.4 状态与连接

| 包 | 职责 |
| --- | --- |
| `store` | 前端状态容器（`ctx.store`） |
| `connection` | 与 Gateway 的连接状态；暴露 `state` 与 `reconnect()` |
| `resources` | 资源（图片、字体等）加载 |
| `locale` | 国际化字典（`ctx.locale`） |
| `hmr` | 热重载 |
| `shortcuts` | 键盘快捷键 |
| `file-upload` | 文件上传 |
| `product-analytics` | 产品分析埋点 |

### 2.5 i18n 约束

**客户端 UI 文案归 locale 所有。** 所有产品文字走类型化字典 + `t()`（或带本地化 prop 的基础组件）；`verify-client-ui-i18n` 会拒绝硬编码文案。英文文案（含插件标题）使用 sentence case。

### 2.6 UI 包清单（按类别）

| 类别 | 包 |
| --- | --- |
| 基础 | `ui-primitives`、`ui-theme`、`ui-layout`、`ui-dockkit`、`ui-brand-official`、`ui-renderer`、`ui-slots` |
| 会话 | `ui-conversation`、`ui-chat`、`ui-session`、`ui-message-feedback`、`ui-trajectory`、`ui-input-trigger` |
| 工具 | `ui-tool`、`ui-approval`、`ui-context-menu`、`ui-file-actions`、`ui-file-drag`、`ui-secret-mask` |
| 侧边栏 | `ui-sidebar` + `ui-sidebar-browser`、`ui-sidebar-documentpreview`、`ui-sidebar-files`、`ui-sidebar-right`、`ui-sidebar-terminal` |
| 设置 | `ui-settings` + 10 个子页（general / models / plugins / plugin-inventory / shell / subagent / web-search / session-log / agent-loop / account） |
| 功能 | `ui-plan`、`ui-goal`、`ui-jobs`、`ui-schedule`、`ui-skill`、`ui-subagent`、`ui-agent-team`、`ui-agent-preset`、`ui-workflow-run`、`ui-user-questions`、`ui-deliverables`、`ui-workspace`、`ui-reference`、`ui-commands`、`ui-attachment`、`ui-plugin-manager`、`ui-plugin-market`、`ui-directory-picker-browse`、`ui-directory-picker-native`、`ui-open-in-app`、`ui-model-selection`、`ui-permission-presets`、`ui-shortcuts`、`ui-entry-customization` |

---

## 3. Host：宿主进程（`packages/host`，9 包）

| 包 | 职责 | `ctx` 键 |
| --- | --- | --- |
| `webserver` | HTTP 服务 | `ctx.webServer` |
| `frontend-static` | 前端静态资源托管 | — |
| `directory-picker` | 目录选择接口 | `ctx.directoryPicker` |
| `directory-picker-auto` / `-browse` / `-native` | 目录选择的具体实现（自动 / 浏览器内 / 原生） | — |
| `open-in-app` | 在外部应用中打开文件 | — |
| `plugin-inventory` | 插件清单 | — |
| `product-telemetry-otel` | 产品遥测 | `ctx.productTelemetry` |

**目录选择器的浏览器自动化约定**：用 `pnpm dsh web --patch apps/web/tests/pin-browse-picker.overlay.yml` 启动，以使用页面内目录选择器；只有明确测试原生选择器行为时才省略该覆盖。

---

## 4. API / Remote BFF（`packages/api`，10 包）

### 4.1 Typert 双向 RPC 端点

`packages/api/gateway` 提供**双侧** Typert RPC 端点：

| 侧 | 服务 | `ctx` 键 | 位置 |
| --- | --- | --- | --- |
| Host | `TypertGatewayService` | `ctx.typertGateway` | `packages/api/gateway`（Host 入口） |
| Client | `ClientRemote` | `ctx.remote` | `@deepseek-ai/dsh-api-gateway/client` |

两侧消费**同一份生成的 `InvocationDescriptor` 契约**；业务选择留给 API Remotes。

### 4.2 Host 侧调用流程

`ctx.typertGateway.invoke()` 的步骤：

1. 解析当前的 descriptor 与 Cordis Service
2. 校验**精确命名参数**
3. 解析已注册的对象或 Context 身份
4. 调用公开业务方法

业务 Service 继承 `TypertRemoteService`，用 `@Remote` 或 `@RemoteScope`（来自 `dsh-typert-protocol`）标注方法；若另一个基类已占用继承链，用 `bindTypertRemote()`。

### 4.3 连接与流

| 关注点 | 归属 |
| --- | --- |
| 一元请求的关联、信任、响应封装 | Connection |
| 多路复用的 Remote 流 | Gateway |
| 每条 Remote 流携带的 Client→Host **上行通道** | Gateway（同一逻辑流上） |

取消感知的方法：Host 参数**最后一个**声明 `signal: AbortSignal`。signal 是 **descriptor 元数据而非线上参数**——Connection 提供给 Gateway，Gateway 在解码业务参数之后注入。

### 4.4 事件转发

`getPendingRemoteEvents()` 返回**已分离**的事件名与 Agent ID 元数据，按到达顺序排列。它**不暴露请求体**，也不改变事件生命周期，且不提供变更通知。

### 4.5 客户端约定

`ctx.remote` **不暴露** Connection 的生命周期控制。需要恢复职责的消费者读 `ctx.connection.state` 并直接调 `ctx.connection.reconnect()`；普通 Remote 消费者只用生成的命名空间与 `$stream()`。

生成的声明合并提供 TypeScript API。Client 入口**不含** Host Service，也**不含** Host Cordis 接口合并；方法查找与调用用普通对象和函数，**不用 JavaScript Proxy**。

### 4.6 Remote 控制器

| 包 | 覆盖域 |
| --- | --- |
| `session-controller` | 会话（`ctx.sessions`、`ctx.sessionController`、`ctx.sessionFileReferences`、`ctx.sessionSkillCatalog`） |
| `job-controller` | 后台任务（`ctx.jobController`、`ctx.jobs`） |
| `settings-controller` | 设置（`ctx.settingsController`、`ctx.credentialsController`） |
| `terminal-controller` | 终端（`ctx.terminalController`、`ctx.webTerminals`） |
| `workspace-controller` | 工作区（`ctx.workspaceController`、`ctx.workspaces`、`ctx.directoryPickerController`） |
| `account-controller` | 账号 |
| `remote-access` | 远程访问控制（`ctx.remoteAccess`） |
| `remotes` | 远程服务集合（`ctx.remote`） |
| `workspace-files` | 工作区文件（`ctx.workspaceFiles`） |

---

## 5. Typert：类型图到远程协议（`packages/typert`，4 包）

| 包 | 职责 | 关键导出 |
| --- | --- | --- |
| `protocol` | 远程协议定义 | `TypertLookup`、`TypertContext`、`TypertResource`、`RemoteResult`、`RemoteFailure`、`RemoteStream`、`TypertOwnedValue` |
| `registry` | 类型与服务注册表 | 类型图索引 |
| `loader` | 加载类型图 | 从包元数据装载 |
| `generator` | 生成 RPC 客户端/服务端代码 | 由类型图产出线上类型 |

协议核心类型：

| 类型 | 说明 |
| --- | --- |
| `TypertLookup<Host, Wire>` | 一条查找：宿主类型 ↔ 线上类型 |
| `TypertContext<Wire>` | 上下文（`ctx`）的线上表示 |
| `TypertResource<Id>` | 带 id 的资源 |
| `RemoteWireValue<Value>` / `RemoteWireArgs<Args>` | 宿主值到线上值的映射 |
| `RemoteResult<T>` | 成功/失败判别联合 |
| `RemoteErrorDetailsMap` / `RemoteErrorCode` | 类型化错误码表 |
| `RemoteStream<Out, In>` | 流：输出 + 可选上行输入 |
| `TypertOwnedValue<Value>` | 带释放钩子的跨边界值（`Symbol.for('dsh.typert.owned-value')`） |

---

## 6. 应用（`apps/`，5 包）

| 应用 | 包名 | 说明 |
| --- | --- | --- |
| `apps/cli` | `@deepseek-ai/dsh` | `dsh` CLI 入口 |
| `apps/web` | `@deepseek-ai/dsh-web-frontend` | Web 前端 |
| `apps/desktop` | `@deepseek-ai/dsh-desktop` | 桌面应用 |
| `apps/desktop-host` | `@deepseek-ai/dsh-desktop-host` | 桌面宿主进程 |
| `apps/plugin-market-generator` | `@deepseek-ai/dsh-plugin-market-generator` | 插件市场索引生成 |

### 6.1 Desktop 结构

```text
apps/desktop          ← Electron 主进程 / 窗口
   └─ 启动 apps/desktop-host（真正的 Cordis 宿主）
         └─ 承载 webserver + api gateway + 全部能力插件
```

桌面形态下，**宿主**是真正的服务进程，Electron 只是外壳。

### 6.2 Web 结构

```text
apps/web              ← Vite 构建的前端
   └─ 由 packages/host/webserver 托管
       └─ api gateway 提供 Typert RPC
```

---

## 7. SDK（`packages/sdk`，3 包 + Python）

### 7.1 TypeScript

| 包 | 职责 |
| --- | --- |
| `server` | stdio JSON-RPC 服务端 |
| `client` | 客户端 |
| `protocol` | 线协议 |

### 7.2 Python

`python/sdk-runtime` 是 Python 侧运行时，`python/README.md` 是入口说明。

### 7.3 SDK 投影约定

**两套 SDK 都投影 Agent 循环。** Agent-loop、session-lifecycle 与 `SessionEventMap` 的改动，**必须在同一个 PR 里**更新 TypeScript 与 Python SDK 的期望输出。`pnpm run test` 不覆盖这两处（见 `docs/testing.md#when-a-snapshot-test-is-required`）。

---

## 8. 远程访问与安全

| 关注点 | 位置 |
| --- | --- |
| 远程访问控制 | `packages/api/remote-access`（`ctx.remoteAccess`） |
| 授权 | `packages/credentials/authorization`（`ctx.authorization`） |
| 凭据存储 | `packages/credentials/credentials` + `credentials-local` |
| 匿名身份 | `packages/identity/anonymous-user-id` |
| 用户审批 | `packages/interaction/user-approval`（`ctx.approval`） |
| 权限预设 | `packages/interaction/permission-presets`（`ctx.permissionPresets`） |

---

## 9. 相关文档

- API 层：[packages/api/README.md](../packages/api/README.md)
- Host 层：[packages/host/README.md](../packages/host/README.md)
- Typert 协议：[packages/typert/protocol/README.md](../packages/typert/protocol/README.md)
- 客户端 UI 设计：[.agents/skills/dsh-client-ui-ux/SKILL.md](../.agents/skills/dsh-client-ui-ux/SKILL.md)
- 响应式 UI：[.agents/skills/dsh-responsive-ui/SKILL.md](../.agents/skills/dsh-responsive-ui/SKILL.md)
