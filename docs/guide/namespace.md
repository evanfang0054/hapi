# 命名空间（高级）

命名空间适用于共享单个公共 HAPI hub 的小型团队。每个团队成员使用不同的命名空间来隔离会话和机器，无需运行单独的 hub。

这不是大多数用户的默认设置路径。

## 工作原理

- Hub 使用单个基础 `CLI_API_TOKEN`。
- 客户端在令牌后附加 `:<namespace>` 进行隔离。

## 设置

1. 在 hub 上，只配置基础令牌：

```
CLI_API_TOKEN="your-base-token"
```

2. 为每个用户，在客户端令牌中附加命名空间：

```
CLI_API_TOKEN="your-base-token:alice"
```

3. Web 登录和 Telegram 绑定应使用相同的 `base:namespace` 令牌。

## 限制和注意事项

- Hub 端的 `CLI_API_TOKEN` 不能包含 `:<namespace>`。如果包含，hub 会去掉后缀并记录警告。
- 命名空间是隔离的：会话、机器和用户在命名空间之间不可见。
- 同一机器 ID 不能在多个命名空间中重复使用。
  - 要在一台机器上运行多个命名空间，请为每个命名空间使用单独的 `HAPI_HOME`，或在切换前使用 `hapi auth logout` 清除机器 ID。
- 远程启动是命名空间范围的。如果需要在同一台机器上为多个命名空间远程启动，请为每个命名空间运行单独的 runner（使用单独的 `HAPI_HOME`）。
