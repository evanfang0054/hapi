# 2026-04-13 upstream A/B 档功能融合设计

## 背景

当前仓库 `evanfang0054/hapi` 是从 `tiann/hapi` fork 出来的，并且已经在以下方向做了较多自定义扩展：

- session continuity（draft / message snapshot / view state / 连接状态）
- visibility tracking
- toast / push 双通道路由
- notification dedupe
- PWA / Android notification 相关能力
- Web UI 重构、i18n、会话页与状态展示改造

用户要求：

1. 将 upstream 中先前整理出的 **A 档**、**B 档**功能点也实现在当前项目中
2. **以当前项目为主**，不能因为合并 upstream 改动而回退或破坏现有功能
3. 如果 upstream 实现与当前实现冲突，需要做**融合式迁移**，而不是机械覆盖
4. 希望采用 **分批渐进融合** 的方式推进

## 目标

在保持当前项目既有能力和交互体验不回退的前提下，将 upstream 中高价值的新功能和修复拆成两个阶段融合：

- **A 档：稳定性 / 安全 / 基础兼容增强**
- **B 档：用户可感知的体验与展示增强**

所有融合均以当前仓库结构、状态管理方式、现有 UI 和现有行为为基准，只迁移 upstream 中解决具体问题所需的最小逻辑。

## 非目标

本次融合不包含以下内容：

- 不整体回退到 upstream 的 Web 结构、路由结构或 chat reducer 设计
- 不直接整包引入 upstream 的 sidebar redesign
- 不直接替换当前 continuity / visibility / notifications / i18n 体系
- 不为追求与 upstream 结构一致而做额外重构
- 不引入与 A/B 档目标无关的顺手优化

---

## 总体策略

采用 **两阶段渐进融合**：

### 阶段 A：稳定性优先
先融合会影响可靠性、安全性和基础兼容性的改动，确保现有主链路更稳：

- Windows command injection 防护
- terminal reconnect / terminal namespace 连接修复
- auth token 生命周期调整与刷新策略校准
- SSE 从后台切回前台时的立即恢复
- PATCH CORS 修复
- 上传体积限制修复

### 阶段 B：体验增强
在 A 档稳定后，再融合用户可见的新能力：

- LaTeX / KaTeX 公式渲染
- assistant message copy button
- background task count
- 可选的 composer / mobile keyboard 体验增强

### 融合原则

1. **当前项目行为优先**
   - continuity、notifications、visibility、UI/i18n 不能被 upstream 覆盖掉
2. **优先手工移植，谨慎 cherry-pick**
   - 只有小而独立、几乎无耦合的 patch 才考虑直接 cherry-pick
3. **迁移意图，不迁移形态**
   - 关注 upstream “解决了什么问题”，不是“文件长得像不像 upstream”
4. **按链路做真实回归**
   - 不能只看 diff 或日志，要验证真实用户路径

---

## A 档融合设计

### A1. Windows command injection 防护

**来源提交**
- `03b6a66`

**目标**
在不改变当前 opencode 启动链路的情况下，增加 Windows 下 `sessionId` 的安全校验，避免 `shell: true` 场景中的潜在命令注入风险。

**融合方案**
- 在 `cli/src/opencode/opencodeLocal.ts` 中加入对 `sessionId` 的 Windows 特殊字符校验
- 保持当前 `spawnWithTerminalGuard` 调用方式不变
- 不新增抽象层或通用 helper

**兼容性约束**
- 非 Windows 平台行为不变
- 正常 sessionId 不受影响
- 仅非法输入被拒绝

**推荐集成方式**
- 直接手工移植，或小范围 cherry-pick 后人工复查

---

### A2. terminal 重连重新注册

**来源提交**
- `92d3685`

**目标**
解决浏览器/PWA 重连后，terminalId 仍被旧 socket 占用而导致 “already in use” 的问题。

**融合方案**
- 在 `hub/src/socket/terminalRegistry.ts` 中调整 `register()`：
  - 同 terminalId + 同 socketId：幂等返回现有 entry
  - 同 terminalId + 同 sessionId + 不同 socketId：视为 stale entry，清理后重新注册
  - 同 terminalId + 不同 sessionId：仍然拒绝
- 在 `hub/src/socket/handlers/terminal.ts` 中调整 quota check：
  - reconnect 场景下不因为 stale entry 占位而误判超限

**兼容性约束**
- 保留当前 idle timeout 和 registry 索引结构
- 不改变 terminal 事件协议
- 不改变正常新建 terminal 的行为

**推荐集成方式**
- 以当前 registry 结构为基础手工融合；不建议盲目覆盖整个文件

---

### A3. terminal namespace 连接修复

**来源提交**
- `f04a6fa`

**目标**
避免某些环境中 `io(baseUrl + '/terminal')` 被解析成错误的 Engine.IO 路径。

**融合方案**
- 在 `web/src/hooks/useTerminalSocket.ts` 中将 terminal socket 建立方式改为：
  - `new Manager(baseUrl)`
  - `manager.socket('/terminal')`
- 保留当前 token 更新、重连参数、事件绑定和对外 API

**兼容性约束**
- 不改变 `connect/write/resize/disconnect/onOutput/onExit` 这些接口
- 不改变 terminal 页面使用方式

**推荐集成方式**
- 手工移植最小 patch

---

### A4. auth token 生命周期与刷新策略最终态

**来源提交**
- `9a48d5a`
- `3b92268`

**目标**
降低后台 tab 恢复时 token 过期导致的意外退出，同时避免每次 focus 都发起不必要的 auth 请求。

**融合方案**
- 在 `hub/src/web/routes/auth.ts` 与 `hub/src/web/routes/bind.ts` 中：
  - JWT 过期时间由 `15m` 提升为 `4h`
- 在 `web/src/hooks/useAuth.ts` 中：
  - 保持当前定时 refresh 机制
  - 页面 focus / visibility 恢复时继续采用 `minTtlMs: 60_000`
  - 不采用“每次恢复都 force refresh”的中间策略

**兼容性约束**
- 保留当前 `refreshPromiseRef / tokenRef / onUnauthorized` 机制
- 保留 Telegram / accessToken 双认证来源
- 不改变现有 auth API 结构

**推荐集成方式**
- 手工融合到当前 auth 流程中，禁止直接覆盖 `useAuth.ts`

---

### A5. SSE 前台立即恢复

**来源提交**
- `450b4f8`

**目标**
当页面在后台期间 SSE 已 stale 时，用户切回前台即可立即触发恢复，而不是继续等待 watchdog 下一个周期。

**融合方案**
- 在 `web/src/hooks/useSSE.ts` 现有 reconnect/watchdog 基础上增加 `visibilitychange` 监听
- 当页面恢复到 `visible` 且 `lastActivityAtRef` 已超过 stale 阈值时，触发 `requestReconnect('visibility-recovery')`
- 在 `web/src/components/ReconnectingBanner.tsx` 中新增该 reason 的文案映射
- 在 locale 中补齐 `visibilityRecovery` 文案 key

**兼容性约束**
- 保留当前 query cache patching、toast、message ingest、session patch 逻辑
- 只新增更快的恢复入口，不重写现有 SSE 机制

**推荐集成方式**
- 手工移植最小逻辑补丁

---

### A6. PATCH CORS 修复

**来源提交**
- `f970072`

**目标**
确保需要 PATCH 的 Web API（如 session rename）不会被 CORS 配置拦截。

**融合方案**
- 仅调整 `hub/src/web/server.ts` 中的 CORS `allowMethods`

**兼容性约束**
- 不改变其他 server 行为

**推荐集成方式**
- 直接手工修改

---

### A7. 上传限制修复

**来源提交**
- `4ffcb4c`

**目标**
提升文件上传成功率，同时保持当前附件 UI 与交互风格不变。

**融合方案**
- 在 `hub/src/web/server.ts` 中调整 `maxRequestBodySize`
- Web 侧只吸收必要兼容逻辑
- upstream 中伴随的附件展示细节变更，不默认照搬

**兼容性约束**
- 以当前附件交互为准
- 不借机修改现有上传 UX

**推荐集成方式**
- 手工融合 server 改动，前端只按实际需要补丁

---

## B 档融合设计

### B1. LaTeX / KaTeX 公式渲染

**来源提交**
- `813ac7f`

**目标**
让消息渲染链路支持数学公式，同时不破坏现有 markdown、代码块、工具卡片和消息样式。

**融合方案**
- 在当前 markdown renderer 链路上接入 KaTeX 支持
- 只扩展文本渲染能力，不修改消息数据结构
- 保持当前 assistant message / reasoning / tool cards 的组织方式

**兼容性约束**
- 普通 markdown 与代码块保持原样
- 公式渲染失败时应退回可读文本

**推荐集成方式**
- 手工融合 renderer 插件和样式

---

### B2. assistant message copy button

**来源提交**
- `139a21c`

**目标**
为 assistant 消息增加复制能力，同时不打乱已调整过的消息布局。

**融合方案**
- 在当前 `AssistantMessage` 体系中新增 copy action
- 保持当前布局优先
- 复制内容以用户需要的可读文本为主，不把无关结构性元数据混入

**兼容性约束**
- 不破坏现有 message actions 和样式结构
- 不影响 tool/message 卡片展示

**推荐集成方式**
- 手工移植

---

### B3. background task count

**来源提交**
- `0e1b653`

**目标**
将后台任务数量纳入当前状态栏/会话状态展示，但不抢占已有 continuity、connection、thinking 等主状态信息。

**融合方案**
- 先打通任务数量数据来源
- 再将其接入当前 `StatusBar` 信息体系
- 只作为新增状态项，不重排整体信息架构

**兼容性约束**
- 保留当前状态栏主语义
- 不影响已有文案和交互节奏

**推荐集成方式**
- 手工融合

---

### B4. composer / mobile keyboard 体验增强（可选纳入 B 档）

**相关 upstream 能力**
- multiline input with modifier+Enter
- allow sending while agent is running
- mobile keyboard 遮挡修复

**目标**
补齐真正缺失的输入体验能力，同时不破坏当前 draft persistence、continuity 和 send flow。

**融合方案**
- 不整包照搬 upstream composer 实现
- 只提炼行为规则：
  - Enter / modifier+Enter 的发送策略
  - agent 运行中是否允许继续输入或发送
  - 移动端 viewport / keyboard 适配
- 具体实现基于当前 `HappyComposer` 和 `SessionChat`

**兼容性约束**
- 不能破坏 session draft persistence
- 不能破坏 current continuity 逻辑
- 不能影响现有消息发送与恢复逻辑

**推荐集成方式**
- 放在 B 档末尾，作为最后一批评估与集成项

---

## 实施顺序

### A 档顺序
1. security + CORS
2. terminal reconnect + namespace
3. auth / SSE visibility
4. upload compatibility

### B 档顺序
1. markdown math
2. assistant copy
3. background task count
4. composer / mobile improvements

该顺序的目的：
- 先解决基础稳定性和安全问题
- 将高耦合的 composer 改动压到最后
- 每一批都能独立回归、独立回滚

---

## 验证与回归策略

由于本次目标是“不能影响现有功能”，验证必须覆盖 upstream 修复点与当前自定义链路两方面。

### A 档验证

#### terminal
- 页面断网 / 刷新 / 切后台再恢复后 terminal 能重新连通
- 同 terminalId stale entry 不再导致“already in use”
- quota check 不误伤重连路径

#### auth
- 长时间后台后回到前台不应轻易掉登录
- focus/visibility 恢复不应触发 auth 风暴
- Telegram / accessToken 两种来源都可继续工作

#### SSE
- 后台恢复后若 SSE stale，能立即重连
- reconnect banner 中原因文案显示正确
- 不影响现有事件分发、query patching、toast 处理

#### upload
- 较大的附件上传可成功
- 不破坏现有附件 UI

#### 现有功能回归
- session continuity
- session draft persistence
- message snapshot / view state persistence
- visibility tracking
- toast / push routing
- notification dedupe
- terminal page

### B 档验证

#### LaTeX
- 行内公式、块级公式正常渲染
- 普通 markdown / code block / tool card 不回退

#### copy button
- assistant message 可复制
- 复制结果正确
- 布局不乱

#### background task count
- 计数准确
- 不干扰现有主状态

#### composer/mobile（若纳入）
- 键盘行为符合预期
- 不破坏 draft persistence / continuity
- 移动端输入区域可正常使用

---

## 提交与集成策略

不建议做单个大提交。应按能力拆分，以便回滚和定位问题。

### 建议的提交拆分

#### A 档
1. security + CORS
2. terminal reconnect + namespace
3. auth + SSE visibility recovery
4. upload compatibility

#### B 档
1. markdown math
2. assistant copy
3. background task count
4. composer / mobile improvements

每个提交都应满足：
- 只解决一个明确问题域
- 自带对应测试或至少有明确的验证步骤
- 不混入无关重构

---

## 关键设计决策

### 决策 1：采用分批渐进融合，而不是一次性大合并
**原因**：当前仓库已对多个核心链路做过深度定制，一次性合并会放大回归风险。

### 决策 2：以“迁移问题修复意图”为主，而不是对齐 upstream 文件形态
**原因**：当前仓库的 `useSSE`、`useAuth`、`useTerminalSocket`、`terminalRegistry` 均已发生结构性演进，直接覆盖更容易破坏既有能力。

### 决策 3：B 档中把 composer/mobile 放最后
**原因**：该区域与 continuity、draft persistence、message send flow 强耦合，是高风险区域。

---

## 结论

本次 upstream 融合将按 **A 档稳定性增强 → B 档体验增强** 的两阶段方式推进。整个过程遵循“当前项目优先、最小必要迁移、真实链路验证”的原则。

最终目标不是让当前仓库“看起来像 upstream”，而是在保住现有定制成果的前提下，吸收 upstream 中真正有价值的新能力与问题修复。
