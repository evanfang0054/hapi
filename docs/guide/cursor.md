# Cursor Agent

HAPI 支持 [Cursor Agent CLI](https://cursor.com/docs/cli/using)，可通过 Web 和手机远程控制 Cursor 的 AI 编程代理。

## 前置条件

安装 Cursor Agent CLI：

- **macOS/Linux:** `curl https://cursor.com/install -fsS | bash`
- **Windows:** `irm 'https://cursor.com/install?win32=true' | iex`

验证安装：

```bash
agent --version
```

## 使用方法

```bash
hapi cursor                    # 启动 Cursor Agent 会话
hapi cursor resume <chatId>    # 恢复指定会话
hapi cursor --continue         # 恢复最近的会话
hapi cursor --mode plan        # 以 Plan 模式启动
hapi cursor --mode ask         # 以 Ask 模式启动
hapi cursor --yolo             # 跳过审批提示 (--force)
hapi cursor --model <model>    # 指定模型
```

## 权限模式

| 模式 | 说明 |
|------|------|
| `default` | 标准代理行为 |
| `plan` | 计划模式 - 编码前先设计方案 |
| `ask` | 询问模式 - 探索代码但不编辑 |
| `yolo` | 跳过审批提示 |

通过 `--mode` 参数设置模式，或在会话期间通过 Web UI 更改。

## 运行模式

- **本地模式** - 在终端运行 `hapi cursor`。完整的交互体验。
- **远程模式** - 在没有终端时从 Web/手机启动。使用 `agent -p` 配合 `--output-format stream-json` 和 `--trust`。每条用户消息启动一个代理进程；通过 `--resume` 延续会话。

## 限制

- **工具审批** - 远程模式下使用 `--trust`；工具执行无需逐个请求审批。使用 `--yolo` 完全跳过审批。
- **会话恢复** - 传入 `--resume <chatId>` 或 `--continue` 来恢复。使用 `agent ls` 列出之前的会话并获取会话 ID。

## 集成

运行后，你的 Cursor 会话会出现在 HAPI Web 应用和 Telegram Mini App 中。你可以：

- 监控会话活动
- 在手机上审批权限
- 在本地模式下发送消息（消息会排队等待你切换时处理）

## 相关链接

- [Cursor CLI 文档](https://cursor.com/docs/cli/using)
- [工作原理](./how-it-works.md) - 架构和数据流
