# 语音助手

使用由 ElevenLabs Conversational AI 驱动的内置语音助手，通过语音控制你的 AI 编程代理。

## 概述

语音助手可以：

- **与代理对话** - 提问、下达指令、请求代码修改，解放双手
- **语音审批权限** - 说"是"或"否"来批准或拒绝权限请求
- **监控进度** - 任务完成或发生错误时收到语音更新

助手连接语音通信与你的活跃编程代理（Claude Code、Codex、Gemini 或 OpenCode），转发你的请求并用自然语音总结响应。

## 前置条件

需要一个具有 API 访问权限的 [ElevenLabs](https://elevenlabs.io) 账户

## 设置

### 1. 获取 API 密钥

1. 在 [elevenlabs.io](https://elevenlabs.io) 注册或登录
2. 在账户设置中进入 [API Keys](https://elevenlabs.io/app/settings/api-keys)
3. 创建新的 API 密钥并复制

### 2. 配置 Hub

启动 hub 前设置环境变量：

```bash
export ELEVENLABS_API_KEY="your-api-key"
hapi hub --relay
```

Hub 会在首次使用时自动在你的 ElevenLabs 账户中创建一个"Hapi Voice Assistant"代理。

### 3.（可选）自定义代理

如果你想使用自己的 ElevenLabs 代理而不是自动创建的：

```bash
export ELEVENLABS_AGENT_ID="your-agent-id"
```

## 使用方法

### 启动语音会话

1. 在 Web 应用中打开一个会话
2. 点击编辑器中的**麦克风按钮**（或空白时的发送按钮）
3. 出现提示时授予麦克风权限
4. 开始说话

### 语音命令

| 说这个 | 会发生什么 |
|--------|------------|
| "让 Claude..." / "让它..." | 将你的请求发送给编程代理 |
| "重构认证模块" | 编程请求会自动转发 |
| "是" / "允许" / "继续" | 批准待处理的权限请求 |
| "否" / "拒绝" / "取消" | 拒绝待处理的权限请求 |
| 直接提问 | 语音助手会自己回答（如果能的话） |

## 工作原理

### 上下文同步

语音助手会在以下情况自动接收更新：

- 你聚焦一个会话（完整历史被加载）
- 代理发送消息或使用工具
- 权限请求到达
- 任务完成

你不需要询问状态更新——助手会主动总结相关变化。

### 工具

语音助手有两个工具与你的编程代理交互：

1. **messageCodingAgent** - 将你的请求转发给活跃代理
2. **processPermissionRequest** - 处理权限批准和拒绝

### 架构

```
浏览器 → WebRTC → ElevenLabs ConvAI → 语音助手 → HAPI Hub → 编程代理
```

语音连接使用 WebRTC 进行低延迟音频流。HAPI hub 提供会话令牌并处理认证。

## 技巧

- **具体一点** - 清晰、完整的请求效果更好
- **等待完成** - 代理工作时助手保持安静，然后总结结果
- **使用自然语言** - 不需要特殊的命令语法
- **保持会话专注** - 一次一个活跃会话，上下文最清晰

## 故障排除

### "ElevenLabs API key not configured"

在环境中设置 `ELEVENLABS_API_KEY` 并重启 hub。

### "Failed to get microphone permission"

- 检查浏览器的麦克风访问权限
- 确保没有其他应用在使用麦克风
- 尝试刷新页面

### 语音无响应

- 验证会话已连接（状态栏有绿点）
- 检查语音状态显示"connecting"或已连接状态
- 确保网络连接稳定

### "Failed to create ElevenLabs agent automatically"

- 验证 API 密钥有效
- 检查 ElevenLabs 账户是否有可用配额
- 尝试设置自定义 `ELEVENLABS_AGENT_ID`

### 音频质量差

- 使用耳机避免回声
- 减少背景噪音
- 检查网络连接稳定性
