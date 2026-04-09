# 快速开始

<Steps>

## 安装 HAPI

::: code-group

```bash [npm]
npm install -g @twsxtd/hapi --registry=https://registry.npmjs.org
```

```bash [Homebrew]
brew install tiann/tap/hapi
```

```bash [npx (一次性)]
npx @twsxtd/hapi
```

:::

> 建议：全局安装时使用官方 npm 源。部分镜像可能无法及时同步平台包。

其他安装方式：[安装指南](./installation.md)

## 启动 Hub

```bash
hapi hub --relay
```

首次运行时，HAPI 会打印访问令牌并保存到 `~/.hapi/settings.json`。

`hapi server` 仍作为别名支持。

终端会显示远程访问的 URL 和二维码。

> 使用 WireGuard + TLS 进行端到端加密。

## 启动编程会话

```bash
hapi
```

这会启动由 HAPI 包装的 Claude Code。会话会出现在 Web UI 中。

## 打开界面

打开终端显示的 URL，或用手机扫描二维码。

输入访问令牌登录。

</Steps>

## 下一步

- [无缝切换](./how-it-works.md#无缝切换) - 在终端和手机间无缝切换
- [Hub 设置](./installation.md#hub-设置) - 从任何地方访问 HAPI
- [通知](./installation.md#telegram-设置) - 设置 Telegram 通知
- [安装应用](./pwa.md) - 将 HAPI 添加到主屏幕
