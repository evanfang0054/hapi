# 安装指南

安装 HAPI CLI 并设置 hub。

## 前置条件

- 已安装 Claude Code、OpenAI Codex CLI、Cursor Agent CLI、Google Gemini CLI 或 OpenCode CLI

验证 CLI 已安装：

```bash
# Claude Code
claude --version

# OpenAI Codex CLI
codex --version

# Cursor Agent CLI
agent --version

# Google Gemini CLI
gemini --version

# OpenCode CLI
opencode --version
```

## 架构

HAPI 有三个组件：

| 组件 | 角色 | 必需 |
|------|------|------|
| **CLI** | 包装 AI 代理（Claude/Codex/Cursor/Gemini/OpenCode），运行会话 | 是 |
| **Hub** | 中心协调器：持久化、实时同步、远程访问 | 是 |
| **Runner** | 用于远程启动会话的后台服务 | 可选 |

### 它们如何协同工作

```
┌─────────────────────────────────────────────────────┐
│              你的机器                                │
│                                                     │
│  ┌─────────┐    Socket.IO    ┌─────────────┐       │
│  │  CLI    │◄───────────────►│    Hub      │       │
│  │+ 代理   │                 │  + SQLite   │       │
│  └─────────┘                 └──────┬──────┘       │
│       ▲                             │ SSE          │
│       │ spawn                       ▼              │
│  ┌────┴────┐                 ┌─────────────┐       │
│  │ Runner  │◄────RPC────────►│   Web App   │       │
│  │(后台)   │                 └─────────────┘       │
│  └─────────┘                                       │
└─────────────────────────────────────────────────────┘
                    │
           [隧道 / 公网 URL]
                    │
              ┌─────▼─────┐
              │ 手机/Web  │
              └───────────┘
```

- **CLI**：使用 `hapi` 启动会话。CLI 包装你的 AI 代理并与 hub 同步。
- **Hub**：运行 `hapi hub`。存储会话，处理权限，启用远程访问。
- **Runner**：运行 `hapi runner start`。让你可以从手机/Web 远程启动会话，无需保持终端打开。

### 典型工作流

**仅本地**：`hapi hub` → `hapi` → 在终端工作

**远程访问**：`hapi hub --relay` → `hapi runner start` → 从手机/Web 控制

## 安装 CLI

```bash
npm install -g @twsxtd/hapi --registry=https://registry.npmjs.org
```

> 建议：全局安装时使用官方 npm 源。部分镜像可能无法及时同步平台包。

或使用 Homebrew：

```bash
brew install tiann/tap/hapi
```

## 其他安装方式

<details>
<summary>npx（免安装）</summary>

```bash
npx @twsxtd/hapi
```
</details>

<details>
<summary>预编译二进制文件</summary>

从 [GitHub Releases](https://github.com/tiann/hapi/releases) 下载最新版本。

```bash
xattr -d com.apple.quarantine ./hapi
chmod +x ./hapi
sudo mv ./hapi /usr/local/bin/
```
</details>

<details>
<summary>从源码构建</summary>

```bash
git clone https://github.com/tiann/hapi.git
cd hapi
bun install
bun build:single-exe

./cli/dist/hapi
```
</details>

## Hub 设置

Hub 可以部署在：

- **本地桌面**（默认）- 在你的开发机器上运行
- **远程主机** - 在 VPS、云主机或任何有网络访问的机器上部署 hub

### 默认：公共中继（推荐）

```bash
hapi hub --relay
```

终端显示 URL 和二维码。扫描即可从任何地方访问。

`hapi server` 仍作为别名支持。

- 使用 WireGuard + TLS **端到端加密**
- 无需配置
- 可穿透 NAT、防火墙和任何网络

> **提示：** 中继默认使用 UDP。如果遇到连接问题，设置 `HAPI_RELAY_FORCE_TCP=true` 强制使用 TCP 模式。

### 仅本地

```bash
hapi hub
# 或
hapi hub --no-relay
```

Hub 默认监听 `http://localhost:3006`。

首次运行时，HAPI：

1. 创建 `~/.hapi/`
2. 生成安全访问令牌
3. 打印令牌并保存到 `~/.hapi/settings.json`

<details>
<summary>配置文件</summary>

```
~/.hapi/
├── settings.json      # 主配置
├── hapi.db           # SQLite 数据库（hub）
├── runner.state.json  # Runner 进程状态
└── logs/             # 日志文件
```
</details>

<details>
<summary>环境变量</summary>

| 变量 | 默认值 | settings.json | 说明 |
|------|--------|---------------|------|
| `CLI_API_TOKEN` | 自动生成 | `cliApiToken` | 用于认证的共享密钥 |
| `HAPI_API_URL` | `http://localhost:3006` | `apiUrl` | CLI 连接的 Hub URL |
| `HAPI_LISTEN_HOST` | `127.0.0.1` | `listenHost` | Hub HTTP 绑定地址 |
| `HAPI_LISTEN_PORT` | `3006` | `listenPort` | Hub HTTP 端口 |
| `HAPI_PUBLIC_URL` | - | `publicUrl` | 外部访问的公网 URL |
| `CORS_ORIGINS` | - | `corsOrigins` | 允许的 CORS 源（逗号分隔） |
| `TELEGRAM_BOT_TOKEN` | - | `telegramBotToken` | Telegram Bot API 令牌 |
| `TELEGRAM_NOTIFICATION` | `true` | `telegramNotification` | 启用 Telegram 通知 |
| `HAPI_RELAY_FORCE_TCP` | `false` | - | 强制中继使用 TCP 模式 |
| `VAPID_SUBJECT` | `mailto:admin@hapi.run` | - | Web Push 联系信息 |
| `HAPI_HOME` | `~/.hapi` | - | 配置目录路径 |
| `DB_PATH` | `~/.hapi/hapi.db` | - | 数据库文件路径 |
| `ELEVENLABS_API_KEY` | - | - | ElevenLabs API 密钥（语音） |
| `ELEVENLABS_AGENT_ID` | 自动创建 | - | 自定义 ElevenLabs 代理 ID |
</details>

<details>
<summary>settings.json 示例</summary>

配置优先级：**环境变量 > settings.json > 默认值**

当环境变量设置但 settings.json 中没有时，会自动保存。

```json
{
  "$schema": "https://hapi.run/docs/schemas/settings.schema.json",
  "listenHost": "0.0.0.0",
  "listenPort": 3006,
  "publicUrl": "https://your-domain.com"
}
```

JSON Schema：[settings.schema.json](https://hapi.run/schemas/settings.schema.json)
</details>

## CLI 设置

如果 hub 不在 localhost，运行 `hapi` 前设置：

```bash
export HAPI_API_URL="http://your-hub:3006"
export CLI_API_TOKEN="your-token-here"
```

或使用交互式登录：

```bash
hapi auth login
```

认证命令：

```bash
hapi auth status
hapi auth login
hapi auth logout
```

每台机器会获得一个唯一 ID，存储在 `~/.hapi/settings.json`。这允许：

- 多台机器连接到一个 hub
- 在指定机器上远程启动会话
- 机器健康监控

## 运维

### 自托管隧道

如果你不想使用公共中继（例如为了更低延迟或自管基础设施），可以使用以下替代方案：

<details>
<summary>Cloudflare Tunnel</summary>

https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

> **注意：** Cloudflare 快速隧道（TryCloudflare）不支持，因为它们[不支持 SSE](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)，而 HAPI 使用 SSE 进行实时更新。请使用命名隧道。

**命名隧道设置：**

```bash
# 安装 cloudflared：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# 创建并配置命名隧道
cloudflared tunnel create hapi
cloudflared tunnel route dns hapi hapi.yourdomain.com

# 运行隧道
cloudflared tunnel --protocol http2 run hapi
```

> **提示：** 使用 `--protocol http2` 而不是 QUIC（默认），以避免长连接的潜在超时问题。

</details>

<details>
<summary>Tailscale</summary>

https://tailscale.com/download

```bash
sudo tailscale up
hapi hub
```

通过你的 Tailscale IP 访问：

```
http://100.x.x.x:3006
```
</details>

<details>
<summary>公网 IP / 反向代理</summary>

如果 hub 有公网 IP，直接通过 `http://your-hub-ip:3006` 访问。

生产环境使用 HTTPS（通过 Nginx、Caddy 等）。

**自签名证书（HTTPS）**

如果 `HAPI_API_URL` 设置为带有自签名（或其他不受信任）证书的 `https://...` URL，CLI 可能失败：

```
Error: self signed certificate
```

推荐修复（按顺序）：

1. 使用公开受信任的证书（例如 Let's Encrypt）
2. 信任你的私有 CA（推荐用于私有网络）
3. 仅开发环境：禁用 TLS 验证（不安全）

```bash
# 首选：信任你自己的 CA
export NODE_EXTRA_CA_CERTS="/path/to/your-ca.pem"

# 仅开发环境：禁用 TLS 验证（不安全）
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

如果使用仅开发环境的方法，假设存在 MITM 风险；不要在公共网络上使用。

</details>

### Telegram 设置

启用 Telegram 通知和 Mini App 访问：

1. 联系 [@BotFather](https://t.me/BotFather) 创建机器人
2. 设置机器人令牌和公网 URL
3. 启动 hub 并绑定账户

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export HAPI_PUBLIC_URL="https://your-public-url"

hapi hub
```

然后向你的机器人发送 `/start`，打开应用，输入你的 `CLI_API_TOKEN`。

**故障排除：**

- 如果绑定失败，验证 `HAPI_PUBLIC_URL` 可从互联网访问
- Telegram Mini App 需要 HTTPS（不是 HTTP）

### Runner 设置

运行后台服务以远程启动会话：

```bash
hapi runner start
hapi runner status
hapi runner logs
hapi runner stop
```

Runner 运行后：

- 你的机器出现在"机器"列表中
- 你可以从 Web 应用远程启动会话
- 即使终端关闭，会话也会持续

<details>
<summary>替代方案：pm2</summary>

如果你偏好使用 pm2 进行进程管理：

```bash
pm2 start "hapi runner start --foreground" --name hapi-runner
pm2 save
```
</details>

### 后台服务部署

保持 HAPI 持久运行，使其能在终端关闭、系统重启后继续运行。

<details>
<summary>快速：nohup</summary>

简单的一行命令用于快速后台运行：

```bash
# Hub
nohup hapi hub --relay > ~/.hapi/logs/hub.log 2>&1 &

# Runner
nohup hapi runner start --foreground > ~/.hapi/logs/runner.log 2>&1 &
```

查看日志：

```bash
tail -f ~/.hapi/logs/hub.log
tail -f ~/.hapi/logs/runner.log
```

停止进程：

```bash
pkill -f "hapi hub"
pkill -f "hapi runner"
```
</details>

<details>
<summary>pm2（推荐给 Node.js 用户）</summary>

pm2 提供进程管理，崩溃和系统重启时自动重启。

```bash
# 安装 pm2
npm install -g pm2

# 启动 hub 和 runner
pm2 start "hapi hub --relay" --name hapi-hub
pm2 start "hapi runner start --foreground" --name hapi-runner

# 查看状态和日志
pm2 status
pm2 logs hapi-hub
pm2 logs hapi-runner

# 系统重启时自动启动
pm2 startup    # 按照打印的指令操作
pm2 save       # 保存当前进程列表
```
</details>

<details>
<summary>macOS：launchd</summary>

创建 plist 文件以在 macOS 上自动启动。

**Hub**（`~/Library/LaunchAgents/com.hapi.hub.plist`）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.hapi.hub</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/hapi</string>
        <string>hub</string>
        <string>--relay</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/.hapi/logs/hub.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/.hapi/logs/hub.log</string>
</dict>
</plist>
```

**Runner**（`~/Library/LaunchAgents/com.hapi.runner.plist`）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.hapi.runner</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/hapi</string>
        <string>runner</string>
        <string>start</string>
        <string>--foreground</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/.hapi/logs/runner.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/.hapi/logs/runner.log</string>
</dict>
</plist>
```

加载/卸载服务：

```bash
# 加载（启动）
launchctl load ~/Library/LaunchAgents/com.hapi.hub.plist
launchctl load ~/Library/LaunchAgents/com.hapi.runner.plist

# 卸载（停止）
launchctl unload ~/Library/LaunchAgents/com.hapi.hub.plist
launchctl unload ~/Library/LaunchAgents/com.hapi.runner.plist
```

> **macOS 睡眠注意：** macOS 可能在显示器睡眠时暂停后台进程。使用 `caffeinate` 防止：
> ```bash
> caffeinate -dimsu hapi hub --relay
> ```
> 或在 HAPI 运行时在单独的终端运行 `caffeinate -dimsu`。
</details>

<details>
<summary>Linux：systemd</summary>

创建用户级 systemd 服务以自动启动。

**Hub**（`~/.config/systemd/user/hapi-hub.service`）：

```ini
[Unit]
Description=HAPI Hub
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/hapi hub --relay
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

**Runner**（`~/.config/systemd/user/hapi-runner.service`）：

```ini
[Unit]
Description=HAPI Runner
After=network.target hapi-hub.service

[Service]
Type=simple
ExecStart=/usr/local/bin/hapi runner start --foreground
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

启用并启动：

```bash
# 重新加载 systemd
systemctl --user daemon-reload

# 启用（登录时自动启动）
systemctl --user enable hapi-hub
systemctl --user enable hapi-runner

# 立即启动
systemctl --user start hapi-hub
systemctl --user start hapi-runner

# 查看状态/日志
systemctl --user status hapi-hub
journalctl --user -u hapi-hub -f
```

> **登出后持续运行：** 要在未登录时保持服务运行：
> ```bash
> loginctl enable-linger $USER
> ```
</details>

### 语音助手设置

启用语音控制：

1. 从 [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys) 获取 API 密钥
2. 设置环境变量：

```bash
export ELEVENLABS_API_KEY="your-api-key"
hapi hub --relay
```

详见 [语音助手](./voice-assistant.md) 了解使用方法。

### 安全注意事项

- 保密令牌并在需要时轮换
- 公开访问使用 HTTPS
- 生产环境限制 CORS 源

<details>
<summary>防火墙示例（ufw）</summary>

```bash
ufw allow from 192.168.1.0/24 to any port 3006
```
</details>
