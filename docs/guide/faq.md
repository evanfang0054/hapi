# 常见问题

## 基础问题

### 什么是 HAPI？

HAPI 是一个本地优先、自托管的平台，用于远程运行和控制 AI 编程代理（Claude Code、Codex、Gemini、OpenCode）。它让你可以在电脑上启动编程会话，并通过手机进行监控和操作。

### HAPI 是什么意思？

HAPI（哈皮）是 "Happy" 的中文音译，体现了项目的目标：让你从终端中解放出来，享受更愉快的 AI 编程辅助体验。

### HAPI 免费吗？

是的，HAPI 是开源项目，采用 AGPL-3.0-only 许可证，可免费使用。

### HAPI 支持哪些 AI 代理？

- **Claude Code**（推荐）
- **OpenAI Codex**
- **Cursor Agent**
- **Google Gemini**
- **OpenCode**

## 安装与配置

### 我需要单独部署 hub 吗？

HAPI 内置了 hub。只需在你的电脑上运行 `hapi hub` 即可，无需外部 hub。

`hapi server` 作为别名仍然可用。

### 如何从手机访问 HAPI？

局域网访问：
```
http://<你的电脑IP>:3006
```

如果手机无法连接，请确保 hub 不是只监听 `127.0.0.1`。要支持局域网访问，在 `~/.hapi/settings.json` 中设置 `listenHost` 为 `0.0.0.0`，或设置环境变量 `HAPI_LISTEN_HOST=0.0.0.0`，然后重启 `hapi hub`。

外网访问：
- 如果 hub 有公网 IP，可直接访问（生产环境建议通过反向代理使用 HTTPS）
- 如果在 NAT 后面，可设置隧道（Cloudflare Tunnel、Tailscale 或 ngrok）

### 访问令牌是做什么用的？

`CLI_API_TOKEN` 是一个共享密钥，用于验证：
- CLI 连接到 hub
- Web 应用登录
- Telegram 账号绑定

它在 hub 首次启动时自动生成，保存在 `~/.hapi/settings.json` 中。

### 支持多账户吗？

支持。我们通过命名空间提供轻量级的多账户访问，适用于团队共享 hub 的场景。详见 [命名空间（高级）](./namespace.md)。

### 可以不用 Telegram 吗？

可以。Telegram 是可选的。你可以直接在任何浏览器中使用 Web 应用，或将其安装为 PWA。

## 使用指南

### 如何远程审批权限？

1. 当 AI 代理请求权限时（例如编辑文件），你会收到通知
2. 在手机上打开 HAPI
3. 进入活跃的会话
4. 批准或拒绝待处理的权限请求

### 如何接收通知？

HAPI 支持两种方式：

1. **PWA 推送通知** - 按提示启用，即使应用关闭也能收到
2. **Telegram Bot** - 详见 [Telegram 设置](./installation.md#telegram-setup)

### 可以远程启动会话吗？

可以，使用 runner 模式：

1. 在电脑上运行 `hapi runner start`
2. 你的机器会出现在 Web 应用的「机器」列表中
3. 点击即可从任何地方创建新会话

### 如何查看文件变更？

在会话视图中，点击「文件」标签页可以：
- 浏览项目文件
- 查看 git 状态
- 查看已修改文件的 diff

### 可以从手机向 AI 发送消息吗？

可以。打开任意会话，使用聊天界面直接向 AI 代理发送消息。

### 可以远程访问终端吗？

可以，支持 Linux 和 macOS 主机。在 Web 应用中打开会话，点击「终端」标签页即可使用远程 shell。

Windows 主机暂不支持远程终端，因为 HAPI 使用的 Bun PTY API 目前仅支持 POSIX 系统。

### 如何使用语音控制？

设置 `ELEVENLABS_API_KEY`，在 Web 应用中打开会话，点击麦克风按钮。详见 [语音助手](./voice-assistant.md)。

## 安全性

### 我的数据安全吗？

安全。HAPI 采用本地优先设计：
- 所有数据都保存在你的机器上
- 不会上传到任何外部服务器
- 数据库存储在本地 `~/.hapi/` 目录

### 令牌认证有多安全？

自动生成的令牌是 256 位（加密安全）。外网访问时，请务必通过隧道使用 HTTPS。

### 其他人能访问我的 HAPI 实例吗？

只有拥有你的访问令牌才能访问。为了更高的安全性：
- 使用强密码且唯一的令牌
- 外网访问时始终使用 HTTPS
- 考虑使用 Tailscale 进行私有网络连接

## 故障排查

### "Connection refused" 错误

- 确保 hub 正在运行：`hapi hub`
- 检查防火墙是否允许 3006 端口
- 验证 `HAPI_API_URL` 是否正确

### 手机无法在局域网访问 HAPI

如果 HAPI 在电脑上正常工作，但同一局域网的其他设备无法访问，请先检查 hub 绑定地址。默认情况下，HAPI 监听 `127.0.0.1`，只接受本机连接。

使用以下方法之一：

```json
{
  "listenHost": "0.0.0.0"
}
```

```bash
export HAPI_LISTEN_HOST=0.0.0.0
```

然后重启 `hapi hub` 并打开：

```bash
http://<你的电脑IP>:3006
```

同时确认操作系统防火墙允许 `3006` 端口的入站连接。

### "Invalid token" 错误

- 重新运行 `hapi auth login`
- 检查 CLI 和 hub 中的令牌是否一致
- 验证 `~/.hapi/settings.json` 中的 `cliApiToken` 是否正确

### Runner 无法启动

```bash
# 检查状态
hapi runner status

# 清除过期的锁文件
rm ~/.hapi/runner.state.json.lock

# 查看日志
hapi runner logs
```

### 找不到 Claude Code

安装 Claude Code 或设置自定义路径：
```bash
npm install -g @anthropic-ai/claude-code
# 或
export HAPI_CLAUDE_PATH=/path/to/claude
```

### 找不到 Cursor Agent

安装 Cursor Agent CLI：
```bash
# macOS/Linux
curl https://cursor.com/install -fsS | bash

# Windows (PowerShell)
irm 'https://cursor.com/install?win32=true' | iex
```

确保 `agent` 在你的 PATH 中。

### 如何运行诊断？

```bash
hapi doctor
```

这会检查 hub 连接性、令牌有效性、代理可用性等。

## 对比

### HAPI vs Happy

| 方面 | Happy | HAPI |
|--------|-------|------|
| 设计理念 | 云优先 | 本地优先 |
| 用户 | 多用户 | 单用户 |
| 部署 | 多个服务 | 单一二进制 |
| 数据 | 服务器加密存储 | 永不离开你的机器 |

详见 [为什么选择 HAPI](./why-hapi.md)。

### HAPI vs 直接使用 Claude Code

| 功能 | Claude Code | HAPI + Claude Code |
|---------|-------------|-------------------|
| 远程访问 | 否 | 是 |
| 移动端控制 | 否 | 是 |
| 权限审批 | 仅终端 | 手机/Web |
| 会话持久化 | 否 | 是 |
| 多机器管理 | 手动 | 内置 |

## 贡献

### 如何参与贡献？

访问我们的 [GitHub 仓库](https://github.com/tiann/hapi)：
- 报告问题
- 提交 PR
- 建议新功能

### 在哪里报告 Bug？

请在 [GitHub Issues](https://github.com/tiann/hapi/issues) 上提交。
