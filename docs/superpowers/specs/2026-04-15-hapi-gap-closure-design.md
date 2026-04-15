# HAPI 当前缺口补齐总规格

## 1. Context

这轮不是继续按 `tiann/hapi` 的 issue 标题做大而全补齐，而是基于当前仓库已实现能力，补 3 个已经确认的真实缺口：

1. `#444`：`exit_plan_mode` 审批闭环未完成
2. 批量删除会话：缺少高频管理动作
3. `#461`：多 session 场景仍缺共享 runtime 架构

这些工作项的共同特点是：
- 都已经有现有实现基础，不是从零开始
- 都存在明确的“最后一段没补齐”的缺口
- 都直接影响远程使用体验或多 session 可扩展性

本规格的目标不是把 issue 列表重新翻译一遍，而是给出一份统一的 product + architecture bridge spec，明确：
- 为什么这三项值得这一轮一起做
- 每一项的目标边界是什么，不做什么
- 基于当前仓库，最小增量怎么落
- 如何验证完成以及如何控制风险

## 2. Goals and non-goals

### Goals

- 把 `plan -> implementation` 的审批链路补成正式 contract，而不是继续依赖隐式桥接。
- 让用户可以批量删除多个 inactive session，降低会话管理成本。
- 定义覆盖所有 agent flavors 的 shared runtime 架构，用于后续降低多 session 内存占用。

### Non-goals

- 不重做整个 permission system。
- 不在批量删除 v1 中引入新的 bulk backend API。
- 不在这一轮直接完成所有 flavor 的 shared runtime 迁移。
- 不顺带做无关 UI 重构、session 管理体系重写或 runner 全量翻修。

## 3. Shared design principles

1. **先补闭环，再扩能力**
   优先把明确缺口补完整，不做借题发挥式扩展。

2. **优先复用现有链路**
   能复用现有 schema、route、cache、RPC、delete guard，就不新开旁路。

3. **跨包 contract 显式化**
   `web / hub / cli / shared` 对同一行为必须通过共享字段和显式语义对齐。

4. **用户可见行为优先于内部优雅**
   先保证审批、删除、恢复、回退这些真实流程可靠，再讨论抽象纯度。

5. **高风险架构项必须可回退**
   `#461` 的目标架构可以一次定义清楚，但实际接入必须保留渐进迁移和 fallback 边界。

## 4. Feature A: #444 exit-plan-mode approval closure

### 4.1 Current gap

当前 `exit_plan_mode` 的主链路已经“能跑通”，但还不是正式闭环。

现状本质上是：
- web 侧可以发起审批
- API client 已经支持对象化 approval payload
- CLI 侧在 `permissionHandler.ts` 里对 `exit_plan_mode` 做了特殊分支
- 批准后通过 `PLAN_FAKE_RESTART` + `PLAN_FAKE_REJECT` 把流程桥接到 implementation 阶段

这说明底层并不缺“继续执行”的能力，真正缺的是**正式 contract**。当前缺口有 3 个：

1. 审批时无法显式选择 **post-plan permission mode**
   - `default`
   - `acceptEdits`
   - `bypassPermissions`

2. 审批时无法显式选择 **implementation context mode**
   - `keep_context`
   - `clear_context`

3. `clear_context` 的语义没有被正式定义
   现在没有明确边界说明“该清什么、不该清什么”。

### 4.2 Design goal

把 `exit_plan_mode` 从“特殊 hack 分支”补成正式审批 contract：

- 用户审批 plan 时，同时决定：
  - implementation 阶段采用什么 permission mode
  - implementation 是沿用当前上下文，还是清理后开始
- `web / hub / cli / shared` 对这个审批结果的理解保持一致
- 普通工具审批行为完全不变，只对 `exit_plan_mode` 生效

### 4.3 Contract changes

建议在现有 approval payload 上新增显式字段：

```ts
contextAction: 'keep_context' | 'clear_context'
```

审批结果最终至少应能表达：

```ts
{
  mode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
  decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort'
  allowTools?: string[]
  answers?: ...
  contextAction?: 'keep_context' | 'clear_context'
}
```

采用单字段 `contextAction` 的原因是：这里真正需要表达的是“implementation 如何承接 plan 阶段上下文”，不是泛化的 session mutation。单枚举字段最简单，也最不容易把语义做散。

### 4.4 Web behavior

只在待审批工具为 `exit_plan_mode` / `ExitPlanMode` 时，审批 UI 展示两组额外选项：

#### A. Post-plan permission mode
- `default`
- `acceptEdits`
- `bypassPermissions`

#### B. Implementation mode
- `keep_context`
- `clear_context`

普通工具审批：
- 不展示这些附加控件
- 保持当前行为不变

UI 原则：
- 不把这两个选择做成隐藏高级选项
- 它们就是 `exit_plan_mode` 审批的核心内容，应直接可见
- 要有清晰默认值，推荐：
  - permission mode 默认 `default`
  - implementation mode 默认 `keep_context`

默认值保守，符合现有行为，也降低误操作概率。

### 4.5 Hub behavior

hub 侧的职责不应该是“重新解释” plan 语义，而是：

1. 按共享 schema 校验 approval payload
2. 把 `mode + contextAction + 现有字段` 正常透传给 CLI 审批处理链路
3. 保持权限记录与错误语义一致

也就是说，hub 在这个 feature 里主要是 **contract relay + validation layer**，不承担 implementation 阶段状态清理逻辑。这样能避免把状态机拆散到 web/hub/cli 多处。

### 4.6 CLI behavior

CLI 是这个 feature 的核心落点。

当前 `permissionHandler.ts` 的特殊分支，本质是在做两件事：
1. 决定 plan 被批准后是否继续
2. 通过 fake restart 把模型拉回 implementation

这轮不需要推翻这个总体方向，但要把它从“隐式行为”变成“显式输入驱动的行为”。

当审批通过时，CLI 读取：
- `response.mode`
- `response.contextAction`

然后进入 implementation 阶段。

#### `keep_context`
沿用当前行为：
- 保留现有上下文承接方式
- 继续通过 restart 进入 implementation 阶段
- 不主动清空 plan 阶段队列或 session 临时状态

#### `clear_context`
在进入 implementation 前，显式清理 plan 阶段残留执行上下文，再进入 implementation。

这里的重点不是“换一种重启方式”，而是**在 restart 之前做确定性的状态清理**。

### 4.7 clear_context boundary

这是本 feature 最重要的边界，必须在规格中写死。

#### 应清理
`clear_context` 至少应清理：
- 待消费的 plan 阶段消息队列
- 与本次 plan continuation 相关的临时队列状态
- 会导致 implementation 继续承接旧 planning prompt 的临时上下文

#### 不应清理
`clear_context` 不应删除或破坏：
- session 持久化消息历史
- session metadata
- session 本身的 identity
- 已完成的审批记录
- durable store 中已有的会话数据

第一性原则：`clear_context` 的目标不是“重建一个新 session”，而是“在同一个 session 里，以干净执行上下文进入 implementation”。所以它清的是 **execution context**，不是 **session record**。

### 4.8 Expected user-visible behavior

用户从 plan 阶段点击批准后，应当能稳定得到这几种结果：

#### 情况 A
- mode = `default`
- contextAction = `keep_context`

结果：
- implementation 继续当前上下文
- 后续工具审批恢复为默认权限模式

#### 情况 B
- mode = `acceptEdits`
- contextAction = `keep_context`

结果：
- implementation 沿用 plan 上下文
- 编辑类工具无需逐次审批

#### 情况 C
- mode = `bypassPermissions`
- contextAction = `keep_context`

结果：
- implementation 沿用 plan 上下文
- 工具调用进入 bypass 语义

#### 情况 D
- 任意 mode
- contextAction = `clear_context`

结果：
- implementation 以清理后的上下文开始
- 但仍属于同一个 session，历史可追溯、记录连续

### 4.9 Verification

#### Automated verification
- CLI permission handler 相关测试
- shared schema / payload 校验测试
- web 审批 UI 行为测试

#### Real flow verification
至少验证以下真实流程：

1. 进入 plan mode
2. 触发 `ExitPlanMode` 审批
3. 分别选择：
   - 3 种 permission mode
   - `keep_context` / `clear_context`
4. 确认 implementation 阶段：
   - 权限模式与选择一致
   - `clear_context` 不再消费 plan 残留上下文
   - session 历史与身份仍连续可见

## 5. Feature B: Batch delete inactive sessions

### 5.1 Current gap

当前系统已经具备：
- 单个 session 删除能力
- active session 删除保护
- 删除后的 `session-removed` 广播
- web 侧单删确认流

所以这块的真实缺口不是“后端不会删”，而是**缺少批量管理入口**。当 session 数量变多时，用户需要逐个删除 inactive session，操作成本高，也不适合手机端使用。

### 5.2 Design goal

v1 目标很明确：

- 用户可以一次选择多个 **inactive session**
- 一次发起批量删除
- 删除结果对列表、详情页、缓存和实时状态保持一致
- 若部分删除失败，用户能看到明确反馈

### 5.3 Non-goals

这一轮不做：
- 批量 archive
- 删除 active session
- 服务端 bulk-delete route
- 条件筛选后自动批量清理
- 回收站 / undo / soft delete 机制

这些都可能是后续演进方向，但不是这轮真实缺口。

### 5.4 Interaction model

建议在 `SessionList` 中引入一个明确的多选模式：

- `selectionMode: boolean`
- `selectedIds: Set<string>` 或等价结构

#### 进入方式
优先复用现有长按交互：
- 长按某个 session
- 进入多选模式
- 默认选中当前项

这样对移动端最自然，也不会额外扩大桌面端 UI 复杂度。

#### 选择规则
- **inactive session 可选**
- **active session 不可选**

active session 不建议做成“能选但提交时报错”，而应在 UI 层就限制：
- 要么禁选
- 要么点击时提示需先 archive / 结束 session

这样反馈更早，也更符合现有单删 guard。

### 5.5 Bulk delete execution model

v1 不新增 bulk API，客户端直接复用现有单删链路。

也就是说，批量删除本质上是：
- 收集多个目标 session id
- 客户端按顺序或受控并发调用现有 `DELETE /api/sessions/:id`
- 聚合结果后统一更新界面状态

先复用单删 API 的原因是：现有链路已经自带：
- active guard
- 删除失败语义
- SSE 事件广播
- store / cache 语义

当前最需要的是“批量入口”，不是“批量协议”。这也是最符合 KISS 的路径。

### 5.6 Concurrency choice

这里建议采用**受控并发**，不是完全串行，也不是全量并行。

原因：
- 完全串行在 session 多时会拖慢操作体验
- 全量并行可能让错误处理、刷新时序和用户反馈变乱
- 受控并发能兼顾速度与一致性

规格中不写死具体并发数，但应明确：
- 客户端执行时需要有上限
- 删除完成后统一收敛状态，而不是每删一个就触发整轮重算

### 5.7 Consistency requirements

批量删除不是“API 调完就结束”，关键在于删除后各层状态要一致。

至少要处理 3 类状态：

#### A. Session list
- 已删除项从列表中移除
- 退出多选模式或同步更新选中态
- 不残留已删除 id 的勾选状态

#### B. Active detail view
如果当前用户正打开某个已删除 session：
- 需要安全跳转
- 或清空详情缓存并返回列表
- 不能停留在失效详情页上

#### C. Query cache + SSE convergence
- 本地 mutation 后的缓存更新要和 SSE `session-removed` 收敛一致
- 不应出现已删 session 被 SSE 或旧 query 重新“闪回”

### 5.8 Partial failure handling

批量操作最容易做差的地方，是部分失败时只报一个模糊错误。

这里应该显式聚合结果：
- 成功数量
- 失败数量
- 失败原因摘要

例如用户删除 8 个 session 时：
- 6 个成功
- 2 个失败，其中 1 个是 active、1 个是 not found / backend error

界面应能给出类似：
- 已删除 6 个会话
- 2 个删除失败：`Cannot delete active session`、`Session not found`

这样用户才能知道是否需要重试、刷新或先处理 active session。

### 5.9 User-visible behavior

用户视角下，这个 feature 成功的标准应是：

1. 长按某个 session 后进入多选模式
2. 只能勾选 inactive session
3. 点击删除后出现明确确认
4. 删除完成后：
   - 列表立即收敛
   - 已删详情页不会残留
   - 失败项有清晰反馈
   - 选中态被正确清空或收敛

### 5.10 Verification

#### Automated verification
- `SessionList` 多选状态测试
- session actions mutation 聚合结果测试
- hub sessions route 单删保护测试

#### Real flow verification
至少验证：
1. 准备 active + inactive 混合会话集
2. 进入多选模式
3. 选择多个 inactive session
4. 发起批量删除
5. 确认：
   - active session 不会被误删
   - 删除后列表状态正确
   - 若当前正在查看已删 session，会安全跳转
   - 部分失败时能看到明确结果摘要

## 6. Feature C: #461 shared runtime architecture

### 6.1 Problem statement

当前多 session 模式下，runtime 基本还是按 session 独立持有执行环境。这带来的核心问题不是“实现不优雅”，而是更底层的两个现实约束：

1. **资源成本随 session 数量近似线性增长**
   - 多开 session 时，RSS 增长快
   - 空闲 session 也会长期占住不必要资源

2. **runner 能力与 flavor 差异耦合过深**
   - Claude / Codex / Cursor / Gemini / OpenCode 各自长逻辑
   - 一旦要做共享 runtime，很容易演变成每个 flavor 自己再做一套共享机制

所以这章真正要解决的，不是“把几个 session 塞进一个 Node.js 进程”这么表面的动作，而是：
- 把 **资源治理** 从单 session 模式提升到共享宿主层
- 把 **flavor 差异** 收敛到明确 adapter 边界
- 在不牺牲隔离性和回退能力的前提下，降低多 session 运行成本

### 6.2 Goal and scope

这轮 spec 对 `#461` 的目标是：
- 定义一个**通用 shared runtime architecture**
- 该架构原则上适用于：
  - Claude
  - Codex
  - Cursor
  - Gemini
  - OpenCode

但这轮 spec 的目标**不是**：
- 直接把所有 flavors 一次性迁移完成
- 为每个 flavor 立即交付完全一致的运行实现
- 追求最大化共享到忽略 flavor 现实差异

本轮真正交付的是一套统一架构规范，明确：
1. shared host 是什么
2. session worker 是什么
3. runner 与 worker 怎么通信
4. flavor adapter 的边界在哪里
5. 生命周期、故障隔离、自动回收怎么定义
6. 哪些 flavor 可以先接入，哪些先保留兼容层
7. 如何回退到当前独立 runtime 模式

### 6.3 Architecture overview

推荐把总体架构固定成三层：

#### Layer 1: Shared Runtime Host
统一的 runtime 宿主，负责：
- host 进程生命周期
- worker 创建 / 销毁
- 健康检查
- 资源治理
- 空闲回收
- 崩溃检测与上报

它不直接承载某个具体 session 的业务语义，也不直接理解某个 flavor 的细节。

#### Layer 2: Per-session Worker
每个 session 对应一个 worker，负责：
- 单 session 执行上下文
- 单 session 消息收发
- 单 session 工具调用状态
- 单 session 中断、恢复、终止

worker 是隔离的最小执行单元。共享的是 host，不是 session 上下文本身。

#### Layer 3: Flavor Adapter
flavor adapter 负责把：
- Claude
- Codex
- Cursor
- Gemini
- OpenCode

这些 flavor 的差异，转换成 shared runtime 可以理解的统一 contract。

adapter 处理的应包括：
- 启动参数
- resume 语义
- message bridge
- tool capability declaration
- flavor-specific lifecycle hook

### 6.4 Why this boundary is the right one

这套边界的关键价值是：**把“资源共享”问题和“agent 实现差异”问题拆开。**

如果不这么拆，常见失败路径会是：
- 先给 Claude 做一个共享 runtime
- 再发现 Codex 恢复语义不同
- 再给 Codex 打补丁
- 再发现 Gemini / Cursor 对事件模型不同
- 最终 shared runtime 里堆满 flavor if/else

那样得到的不是通用 runtime，而是一个更大的耦合体。

所以正确边界应是：
- **host** 只关心资源与生命周期
- **worker** 只关心 session 执行隔离
- **adapter** 才关心 flavor 差异

### 6.5 Baseline measurement

在 shared runtime 改造前，必须先建立 baseline。否则后续无法证明“省内存”到底有没有发生。

至少要定义这几组基线：
1. **单 session RSS**
2. **N 个并发 session RSS**
3. **session 空闲后的回落情况**
4. **session 销毁后的资源释放情况**
5. **host / worker 模型下的新增固定开销**

采样原则：
- 同一机器
- 同一 flavor / 相近工作负载
- 相同采样窗口
- 区分启动瞬时峰值与稳定期占用

否则后续很容易把偶然波动误认为架构收益。

### 6.6 Runner ↔ Worker communication contract

共享 runtime 真正困难的部分，不是“起 worker”，而是 runner 和 worker 的 contract。

这层至少要覆盖几类消息：

#### Command
runner 下发给 worker 的控制命令，例如：
- start session
- resume session
- send message
- abort
- terminate
- update config

#### Event
worker 回传给 runner / host 的运行事件，例如：
- started
- active
- thinking
- message emitted
- tool call requested
- completed
- failed
- terminated

#### Error
需要区分：
- 可恢复错误
- 不可恢复错误
- worker 级错误
- host 级错误
- adapter 级错误

#### Control / health
例如：
- heartbeat
- health status
- idle timeout reached
- reclaim requested
- reclaim completed

设计原则：
- 协议必须与具体 flavor 解耦
- message schema 要足够通用，能承接不同 agent 的事件模型
- 若 flavor 有特殊事件，优先通过 adapter 映射成统一事件，而不是把特殊格式泄露到 host

### 6.7 Lifecycle model

这一节必须明确写成行为定义，而不是一句“支持 lifecycle 管理”。

#### Session start
- runner 请求 host 创建 worker
- host 分配 worker 并绑定 session identity
- adapter 初始化 flavor-specific runtime
- worker 进入 ready / active 状态

#### Session active
- worker 持有该 session 的执行上下文
- host 持续跟踪心跳、资源占用、空闲状态

#### Session idle
- worker 可进入 idle
- host 根据策略判断是否保活或回收

#### Session resume
- 若 worker 尚在，可直接恢复
- 若 worker 已回收，则通过 session metadata + flavor adapter 决定恢复路径

#### Session terminate
- worker 清理会话级资源
- host 回收 worker 占用
- runner / hub 收到确定性终止结果

### 6.8 Failure isolation

shared runtime 如果没有明确的故障隔离，就会把“节省资源”换成“故障放大”。

规格中至少要明确以下边界：

#### Worker crash
- 单个 worker 崩溃不能拖死整个 host
- host 必须能感知并上报该 session 的失败状态
- 其他 session worker 应继续运行

#### Host crash
- host 崩溃是更高等级故障
- 必须定义 session 的统一语义：
  - 是全部标记失败
  - 还是进入可恢复待重连状态
- 恢复逻辑必须一致，不能由各 flavor 各自猜测

#### Adapter failure
- 某 flavor adapter 初始化失败，不应污染 host 全局状态
- 失败应限定在当前 worker/session 范围内

第一性原则：共享的是 runtime 宿主能力，不是故障域。故障域必须尽量仍然保持在 worker/session 级别。

### 6.9 Automatic reclamation

如果没有自动回收，shared runtime 只会把“多进程浪费”变成“单宿主囤积”。

所以规格必须把自动回收定义成一等能力，而不是后补优化。

应定义的内容包括：
1. **idle worker 的判定条件**
2. **保活阈值**
3. **最大 worker 数或资源阈值**
4. **触发回收的优先级规则**
5. **回收后的 resume 语义**

推荐原则：
- 活跃 session 不回收
- 仅空闲且满足阈值的 worker 才可回收
- 回收前必须确保恢复所需 metadata 已可用
- 回收行为应可观测、可记录、可调试

### 6.10 Flavor compatibility strategy

因为这轮已经决定 spec 要“直接做全量”，所以这里不能只写 Claude 试点，而要明确所有 flavors 的接入策略。

建议采用统一表述：
- **Direct-fit flavors**：可较直接接入 shared host / worker contract 的 flavor
- **Adapter-heavy flavors**：可以接入，但需要更厚适配层的 flavor
- **Fallback flavors**：暂时保留独立 runtime，但接口层对齐 shared contract，为后续迁移留口

这样就不用在 spec 阶段强行承诺“所有 flavor 同时完成迁移”，但架构覆盖范围已经是全量的。

### 6.11 Rollout and fallback

这一节非常重要。因为目标是“全量架构 spec”，不是“全量一次性交付”。

推荐 rollout 方式：

#### Step 1
先建立 baseline 与统一 contract

#### Step 2
实现 shared host + worker 基础设施

#### Step 3
优先接入最适合的 flavor，验证：
- RSS 改善
- lifecycle 稳定性
- 故障隔离
- resume 行为

#### Step 4
其它 flavors 按同一 contract 渐进接入

#### Step 5
未准备好的 flavor 保持独立 runtime fallback

回退原则：
- 若 shared runtime 在某 flavor 上出现稳定性回归，该 flavor 可单独回退
- 回退不应影响已稳定接入的其它 flavors
- 回退边界必须在 adapter / runner integration 层，而不是整套 host 全盘废弃

### 6.12 Verification

#### Architecture verification
- shared host 能同时承载多个 session worker
- worker 生命周期事件可观测
- worker crash 不影响其他 worker
- host 可执行 idle reclamation

#### Performance verification
- 对比优化前后的单 session / 多 session RSS
- 验证空闲回落与释放情况
- 确认 shared host 固定成本没有吞掉主要收益

#### Compatibility verification
- 至少验证已接入 flavor 的：
  - start
  - message
  - abort
  - terminate
  - resume
- 未接入 flavor 保持现有行为不回归

## 7. Implementation order

推荐落地顺序保持不变：

1. `#444` 审批闭环
2. 批量删除会话
3. `#461` shared runtime

原因如下：

### 先做 `#444`
因为它是当前最明确的主链路缺口。现有功能已经接近完成，只差正式 contract、UI 选择和 CLI 状态处理闭环。范围集中，且对用户实际流程直接可见。

### 再做批量删除会话
因为它是高频管理动作，产品价值直接，且实现风险低。同时它可以最大化复用现有单删语义，不需要等架构改造完成。

### 最后做 `#461`
因为它不是单点功能，而是 runner 层架构调整。它的正确做法是：在前两项稳定后，再基于统一 spec 做 baseline、contract 和渐进接入，而不是在产品闭环未补完前就把精力投入到高风险基础设施改造。

## 8. Cross-feature consistency rules

虽然这三项性质不同，但 implementation plan 里应统一遵守以下规则：

1. **不破坏现有可用主路径**
   - 普通工具审批行为不变
   - 单删 session 行为不变
   - 未迁移 flavor 行为不变

2. **所有新增行为都必须有显式边界**
   - `clear_context` 清什么、不清什么
   - 批量删除允许删什么、不允许删什么
   - shared runtime 共享什么、不共享什么

3. **先 contract，后行为扩展**
   - 先让 `shared / web / hub / cli` 对字段和语义达成一致
   - 再补具体实现和 UI

4. **真实流程验证优先**
   - 不只看单测通过
   - 必须走用户视角端到端路径

## 9. Key risks and mitigations

### 风险 A：`#444` contract drift
可能出现：
- web 发了新字段
- hub 没透传
- CLI 默认掉回旧逻辑

**缓解方式**
- 共享 schema 明确定义 `contextAction`
- 对 `exit_plan_mode` 单独做 approval payload 测试
- 用真实流程覆盖三种 permission mode + 两种 context mode

### 风险 B：`clear_context` 语义越界
最容易出现的问题是：
- 清得太少，implementation 还吃到旧 planning context
- 清得太多，把 session 历史或持久状态也破坏掉

**缓解方式**
- 在规格中明确 execution context vs session record 的边界
- 实现时只清 plan continuation 的临时执行状态
- 用真实流程验证“历史连续但执行上下文清洁”

### 风险 C：批量删除后的状态不一致
可能出现：
- 列表删了，详情页没跳走
- 本地删了，SSE 又把旧项闪回来
- 部分失败后提示不清楚

**缓解方式**
- mutation 完成后统一处理列表 / 详情 / 选中态
- 验证 query cache 与 SSE 收敛
- 对 partial failure 做聚合结果返回

### 风险 D：`#461` 把共享资源变成共享故障域
可能出现：
- 一个 worker 崩掉影响整个 host
- host 崩掉后恢复语义不一致
- adapter 错误泄漏成全局污染

**缓解方式**
- 明确 worker / host / adapter 三层故障边界
- 先建立统一 lifecycle 与 error contract
- rollout 时保留 flavor 级 fallback

### 风险 E：`#461` 没有可证明收益
最常见的问题不是改不动，而是改完后无法证明值不值得。

**缓解方式**
- baseline 先行
- 明确单 session / 多 session / idle reclaim 的比较口径
- 把 measurement 当作 feature 的一部分，而不是事后补充

## 10. Verification consolidation

最终验证建议分成三层：

### Layer 1: Feature-level verification

**`#444`**
- permission handler 相关测试
- web 审批 UI 测试
- shared contract 测试
- 真实路径：plan → approve → implementation

**批量删除会话**
- SessionList 多选状态测试
- session actions mutation 测试
- hub 单删 guard 测试
- 真实路径：多选 → 删除 → 列表/详情收敛

**`#461`**
- shared runtime lifecycle 测试
- host/worker communication 测试
- worker crash / reclaim 行为测试
- baseline vs shared runtime 对比验证

### Layer 2: Regression verification

确认以下旧行为不回归：
- 普通工具审批仍按原逻辑工作
- 单 session 删除流程仍正常
- 未迁移到 shared runtime 的 flavor 仍可运行
- session resume / archive / switch 等现有路径不被这轮改动破坏

### Layer 3: User-path verification

这轮最重要的是用户真实可感知路径：

1. **Founder / oncall 在手机上审批 plan**
   - 可选择 post-plan mode
   - 可选择 keep / clear context
   - implementation 行为符合预期

2. **用户批量清理历史 inactive session**
   - 多选自然
   - 删除反馈清楚
   - 不误伤 active session

3. **多 session 运行场景的资源治理**
   - 能看到 shared runtime 架构下的生命周期与资源回收行为
   - 至少对已接入 flavor 证明内存收益或资源收敛收益
