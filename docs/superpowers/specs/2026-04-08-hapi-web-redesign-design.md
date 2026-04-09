# 2026-04-08 hapi web redesign design

## 背景

当前 `web` 项目功能完整，覆盖 session list、chat、new session、files、file viewer、terminal、settings 等主要工作流，但界面整体仍偏内部工具风格，视觉语言不统一，层级感不足，产品气质较弱。用户希望对整个 `web` 做一次系统性重设计，严格参考 `web/design/DESIGN.md` 提供的 Claude 风格设计资料，同时继续支持现有浅色/深色主题切换。

本次改版的核心目标不是改功能，而是在 **不改变现有功能逻辑、路由结构和后端接口** 的前提下，重建视觉系统、页面层级与关键组件表现，使整个 web 从“能用但丑”提升为“清晰、统一、高级的正式产品工作台”。

## 已确认约束

- 改版范围是整个 `web` 项目，不是单页修补
- 采用“稳妥升级”策略：保留现有功能、路由和主要组件骨架
- 目标同时覆盖：**更清晰、更统一、更高级**
- 只允许改前端 UI 表现层，不改功能逻辑、状态组织和后端接口
- 主视觉方向选择：**Claude 式温润编辑感**
- 设计基准：**严格按照 `web/design/DESIGN.md`**
- 必须兼容现有浅色/深色主题切换
- **当前页面已经展示的信息，在改版后必须继续完整展示，不能因为重设计而丢失**

## 总体设计方向

整体风格采用 Claude 式温润编辑感，以 warm neutrals、paper-like surfaces、serif headline hierarchy、terracotta accent 为核心特征。浅色主题作为主参考，深色主题不是简单反色，而是使用设计资料中对应的深色语义色和容器层级，保证两种主题都属于同一个设计系统。

整体产品气质应从“管理后台/内部工具”转向“有审美、有秩序的 agent 工作台”。视觉上更柔和、更克制、更有产品感，但信息组织上必须更清楚，不能牺牲效率，也不能删减现有信息展示。

## 设计目标

### 1. 清晰

- 页面主次结构一眼可读
- 主操作与次操作分层明确
- 核心信息优先级稳定，不再互相抢视线
- 聊天、文件、终端、设置等不同页面的阅读节奏更自然

### 2. 统一

- 全站共享同一套设计 token 和组件语法
- 列表页、聊天页、创建页、文件页、终端页、设置页都像同一个产品
- 按钮、输入框、卡片、badge、header、dialog、menu 等控件外观保持统一

### 3. 高级

- 摆脱冷硬、默认、模板化的后台风格
- 用更克制的暖色层次、圆角、边框、阴影和字体层级建立精致感
- 在不增加无谓装饰的前提下，提高产品完成度

## 视觉系统策略

### 1. Token 策略

现有项目已大量使用 `--app-*` 变量。为了最大化复用当前组件结构、最小化逻辑层影响，本次改版不重建一套全新 token API，而是：

- 保留现有 `--app-*` 命名体系
- 将其语义整体重映射到 `web/design/DESIGN.md` 的设计语义
- 页面和组件只做必要的视觉结构调整

这样可以在不重写大量组件调用方式的前提下，系统性更新全站观感。

### 2. 浅色主题映射

浅色主题以 Claude 风格的温润纸面感为核心：

- 页面主背景：`Parchment #f5f4ed`
- 卡片/容器背景：`Ivory #faf9f5` 或局部 `#ffffff`
- 次级交互表面：`Warm Sand #e8e6dc`
- 主文本：`Anthropic Near Black #141413`
- 次级/辅助文本：`Olive Gray #5e5d59` / `Stone Gray #87867f`
- 标准边框：`Border Cream #f0eee6`
- 主强调色：`Terracotta #c96442`
- 焦点蓝：仅用于 focus 可访问性，不参与主品牌表现

目标层次是：**纸面背景 → 象牙卡片 → 温砂控件 → terracotta 强调**。

### 3. 深色主题映射

深色主题严格按设计资料的深色语义建立，不做简单反色：

- 页面背景：`Deep Dark #141413`
- 二级容器：`Dark Surface #30302e`
- 主文本：`Ivory` / `Warm Silver #b0aea5`
- 次级文本：暖灰而非冷灰
- 主强调：保持 terracotta，但降低用量，避免过于跳脱
- 焦点态继续仅由 focus blue 承担

深色目标是“温暖的深色纸面工作台”，而不是 IDE 风的冰冷黑面板。

### 4. 字体体系

严格遵循设计资料的角色分工：

- 标题 / 大 section heading：serif
- 功能性 UI / 正文 / 控件文字：sans
- 代码 / diff / terminal：mono

如果无法引入 Anthropic 官方字体资源，则以：

- serif fallback：`Georgia`
- sans：沿用当前可用字体体系，但调整字号、字重、行高与层级关系
- mono：保持代码区现有 mono 能力

重点是先恢复“字体角色关系”，而不是为了字体资源问题放弃整体调性。

### 5. 阴影与边框原则

遵循设计资料的“warm ring / subtle containment”方法：

- 主要依赖 warm border 与 ring-shadow 建立层次
- 仅使用极轻的 drop shadow 做辅助提升
- 避免传统 SaaS 风格的重阴影、强悬浮
- 通过背景明度差、圆角和边界控制卡片层次

## 组件语言

### Buttons

统一收敛为三类语义：

- **Primary**：Terracotta brand button
- **Secondary**：Warm Sand secondary button
- **Dark / inverted**：深色表面反相按钮

按钮的圆角、边框、hover、pressed、focus 状态需要全站统一，不允许不同页面按钮像不同产品。

### Cards / Panels

Session item、group 容器、chat shell、form section、settings panel、file panel、terminal panel 等都进入统一卡片体系：

- 大圆角
- 轻暖边框
- 极轻阴影/环形边界
- 一致的内部留白节奏

### Inputs / Selectors

输入控件应从当前偏“默认表单”感，升级为更圆润、更厚实、更温暖的组件：

- 输入背景与边框具备明确层级
- focus 态统一
- dropdown / selector / menu 外观与主表单体系一致

### Status / Badge

active、pending、thinking、error、success、archived 等状态应统一到一套 badge / dot / pill 体系中：

- 语义清晰
- 对比适中
- 不使用生硬、默认后台式标签表达

### Message Blocks

聊天页中的 user / assistant / tool / system message 必须统一进入同一消息系统：

- 使用相同的外部布局逻辑
- 通过背景、边框、标题、密度、强调方式区分不同消息类型
- 保证工具卡、权限卡、问题卡与普通消息并存时仍然有秩序

## 页面级设计

### 1. `sessions` 会话列表页

目标：从“普通列表页”升级成真正的 workspace 首页。

#### 会话列表改版方向

- 顶部区域升级为完整 page header，而非简单工具条
- 页面有更明确的标题、主 CTA 和当前上下文感知
- session group 变为更明确的分组内容卡片
- machine / path / 更新时间等信息弱化但保留展示
- 每个 session item 更像内容卡，而不是拥挤 row
- active / pending / thinking / todo 进度等状态继续展示，但进入统一状态系统
- 空状态需要做成正式产品空状态

#### 信息保留要求

当前页已有的状态、summary、todo progress、pending request count、agent flavor、model mode、path / machine 相关信息必须继续展示，只能调整层级和样式，不允许删减。

### 2. `sessions/$sessionId` 聊天主界面

目标：保留高效率工作区特征，同时整体升级成高质量对话工作台。

#### 聊天页改版方向

- `SessionHeader` 重做为稳定、清晰的顶部工作栏
- 标题、状态、模型、模式切换、二级动作拥有明确层级
- 聊天区域拥有统一主容器壳层
- 消息块统一分层，但不同消息类型保持可区分
- composer 做精致化升级，成为页面最核心控件之一
- pending approvals、todo、summary、上下文指标等不再与正文抢层级

#### 信息保留要求

当前聊天页里已有的 header 信息、消息内容、工具输出、权限请求、slash / model / effort / mode 等控制信息，都必须在改版后继续保留展示。

### 3. `sessions/new` 新建会话页

目标：从参数表单页升级为创建入口页。

#### 新建会话页改版方向

- 页面先提供创建意图与结构，再组织表单字段
- 机器、目录、agent、model、effort、session type、yolo 等进入统一 section card
- 流程顺序更清楚，用户知道先做什么、后做什么
- 警告与错误提示进入统一状态样式
- CTA 区域明确，避免信息堆叠

#### 信息保留要求

当前页所有已有字段、最近路径建议、目录存在性状态、worktree 相关输入、错误提示和创建逻辑对应的提示信息必须保留展示。

### 4. `files`

目标：变成更易读、更有秩序的仓库浏览界面。

#### 文件页改版方向

- 顶部 header 统一化，搜索、返回、筛选与上下文进入同一语法
- git 状态色映射到新的暖色语义体系，但语义区分继续保持
- 文件列表项更紧凑、更规整
- 文件内容与 diff 外层进入统一 card shell
- 外围 UI Claude 化，代码阅读区保持克制和专业

#### 信息保留要求

当前页面中的 git 状态信息、搜索能力、文件列表、路径上下文、diff 展示、文件内容展示等信息均需保留。

### 5. `terminal`

目标：让终端页成为更成熟的嵌入式工具面板，而不是临时拼出的调试页。

#### 终端页改版方向

- 导航、标题、错误态、输入区、控制区统一回到设计系统
- terminal viewport 本体保持功能性，不追求花哨装饰
- 外围容器、按钮、状态信息统一升级

#### 信息保留要求

当前 terminal 页已有的 tab / pane / 连接状态 / 错误信息 / 输入区 / 辅助操作按钮都必须继续展示。

### 6. `settings`

目标：从设置列表升级为整洁一致的偏好中心。

#### 改版方向

- 各设置类别进入独立 section
- dropdown / selector / current value 的视觉统一
- 关于、语言、主题、字体、语音等模块共享同一节奏
- 菜单与 hover/focus 态统一

#### 信息保留要求

当前设置页已有的全部设置项和当前值展示必须保留，不允许为简化外观而折叠或丢失已有信息。

## 文件与落点范围

本次改版预计影响以下层级：

### 全局主题与 token 层

- `web/src/index.css`
- `web/src/hooks/useTheme.ts`
- 其他承载全局 theme / token 的样式入口

### 通用 UI 组件层

- `web/src/components/ui/*`
- banner / dialog / menu / toast / empty state 等通用组件
- 各页面内直接声明样式的交互控件

### 页面骨架层

- `web/src/components/SessionList.tsx`
- `web/src/components/SessionChat.tsx`
- `web/src/components/NewSession/index.tsx`
- `web/src/routes/sessions/files.tsx`
- `web/src/routes/sessions/file.tsx`
- `web/src/routes/sessions/terminal.tsx`
- `web/src/routes/settings/index.tsx`

### 聊天相关细节层

- `web/src/components/AssistantChat/messages/*`
- `web/src/components/AssistantChat/HappyComposer.tsx`
- `web/src/components/AssistantChat/HappyThread.tsx`
- `web/src/components/SessionHeader.tsx`
- `web/src/components/ToolCard/*`

## 明确不在范围内

本次设计不包含以下内容：

- 不修改 API
- 不改 session/chat/files/terminal 的业务逻辑
- 不改后端接口
- 不重写状态管理
- 不新增新的页面流或业务功能
- 不做与 UI 改版无关的重构

## 验收标准

本次改版完成后，应满足以下标准：

1. 浅色 / 深色主题都明显符合 `web/design/DESIGN.md` 的设计语义
2. 页面观感从内部工具升级为正式产品级工作台
3. 全站按钮、输入框、卡片、badge、header、dialog、menu 外观统一
4. `sessions`、`chat`、`new session`、`files`、`terminal`、`settings` 六类核心页面风格统一
5. 聊天、工具卡、文件、终端等高密度区域依然保持可读和高效
6. **改版前页面已展示的信息，在改版后继续完整保留展示，不丢字段、不丢状态、不丢上下文信息**
7. 改动只发生在 UI 表现层，不引入功能行为变化

## 推荐后续实施顺序

1. 先重建全局 token 与 light/dark 主题映射
2. 再统一按钮、输入框、卡片、badge、dialog/menu 等通用组件外观
3. 接着改造页面骨架：session list、chat、new session
4. 然后覆盖 files、file viewer、terminal、settings
5. 最后集中打磨消息块、tool card、composer、状态细节和空状态

## 结论

这次 hapi web 重设计应被视为一次 **基于 Claude 风格设计资料的系统性 UI 翻新**。它的重点不是“做新功能”，而是通过全局 token 重建、页面层级调整和组件表现统一，提升整个 web 的清晰度、统一性和高级感。同时，现有信息展示完整性必须作为硬约束，在任何页面都不能因为重设计而丢失当前已经呈现给用户的信息。