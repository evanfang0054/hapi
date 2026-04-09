# HAPI

在本地运行官方 Claude Code / Codex / Gemini / OpenCode 会话，并通过 Web / PWA / Telegram Mini App 进行远程控制。

> **为什么选择 HAPI？** HAPI 是 Happy 的本地优先替代方案。详见 [为什么不用 Happy？](docs/guide/why-hapi.md)

## 功能特性

- **无缝切换** - 本地工作，需要时切换到远程，随时切回。不丢失上下文，无需重启会话。
- **原生体验** - HAPI 包装你的 AI 代理而非替代它。相同的终端、相同的体验、相同的操作习惯。
- **离开不中断** - 离开电脑？在手机上一键批准 AI 请求。
- **自由选择** - Claude Code、Codex、Cursor Agent、Gemini、OpenCode——不同模型，统一工作流。
- **随处终端** - 在手机或浏览器中运行命令，直接连接工作机器。
- **语音控制** - 使用内置语音助手，解放双手与 AI 代理对话。

## 演示

https://github.com/user-attachments/assets/38230353-94c6-4dbe-9c29-b2a2cc457546

## 快速开始

```bash
npx @twsxtd/hapi hub --relay     # 启动带端到端加密中继的 hub
npx @twsxtd/hapi                 # 运行 claude code
```

`hapi server` 仍作为别名支持。

终端会显示 URL 和二维码。用手机扫描二维码或打开 URL 即可访问。

> 中继使用 WireGuard + TLS 进行端到端加密。你的数据从设备到机器全程加密。

自托管选项（Cloudflare Tunnel、Tailscale）请参见 [安装指南](docs/guide/installation.md)

## 文档

- [应用](docs/guide/pwa.md)
- [工作原理](docs/guide/how-it-works.md)
- [Cursor Agent](docs/guide/cursor.md)
- [语音助手](docs/guide/voice-assistant.md)
- [为什么选择 HAPI](docs/guide/why-hapi.md)
- [常见问题](docs/guide/faq.md)

## 从源码构建

```bash
bun install
bun run build:single-exe
```

## 致谢

HAPI 意为"哈皮"，是 [Happy](https://github.com/slopus/happy) 的中文音译。感谢原项目的贡献。
