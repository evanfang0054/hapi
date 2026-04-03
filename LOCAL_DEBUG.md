# 本地调试指南

本文档记录了如何在本地构建、链接和调试 HAPI CLI。

## 构建

```bash
# 构建 all-in-one 可执行文件（包含 web 资源）
bun run build:single-exe

# 输出位置
cli/dist-exe/bun-darwin-arm64/hapi
```

## npm link 本地开发版本

### 1. 链接主包和平台包

```bash
cd cli
npm link

cd cli/npm/darwin-arm64
npm link
```

### 2. 复制可执行文件

```bash
cp cli/dist-exe/bun-darwin-arm64/hapi cli/npm/darwin-arm64/bin/hapi
```

### 3. 签名可执行文件（macOS 必需）

Bun 编译的可执行文件需要重新签名，否则会被 macOS 安全机制 SIGKILL：

```bash
codesign --force --sign - cli/npm/darwin-arm64/bin/hapi
```

### 4. 验证

```bash
hapi --version
# 应输出: hapi version: x.x.x
```

## launchctl 服务配置

### plist 文件位置

- Hub: `~/Library/LaunchAgents/com.arwen.hapi.hub.plist`
- Runner: `~/Library/LaunchAgents/com.arwen.hapi.runner.plist`

### 示例配置（直接使用可执行文件）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.arwen.hapi.hub</string>
    <key>ProgramArguments</key>
    <array>
      <string>/Users/arwen/.nvm/versions/node/v20.19.2/lib/node_modules/@twsxtd/hapi-darwin-arm64/bin/hapi</string>
      <string>hub</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/arwen</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/Users/arwen/.nvm/versions/node/v20.19.2/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/arwen/.hapi/logs/launchd-hub.out.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/arwen/.hapi/logs/launchd-hub.err.log</string>
  </dict>
</plist>
```

### 服务管理命令

```bash
# 加载服务
launchctl load ~/Library/LaunchAgents/com.arwen.hapi.hub.plist

# 卸载服务
launchctl unload ~/Library/LaunchAgents/com.arwen.hapi.hub.plist

# 重启服务
launchctl stop com.arwen.hapi.hub
launchctl start com.arwen.hapi.hub

# 查看服务状态
launchctl list | grep hapi
```

### 查看日志

```bash
# 标准输出
tail -f ~/.hapi/logs/launchd-hub.out.log

# 错误输出
tail -f ~/.hapi/logs/launchd-hub.err.log
```

## 常见问题

### 1. SIGKILL - 可执行文件被杀死

**症状**: 运行 `hapi` 时提示 `Binary terminated by signal SIGKILL`

**解决**: 重新签名可执行文件
```bash
codesign --force --sign - /path/to/hapi
```

### 2. require.resolve 找到错误路径

**症状**: 错误日志显示找到了项目目录的路径而非全局安装路径

**原因**: 当前工作目录在项目内时，Node.js 会优先查找项目的 node_modules

**解决**: 在 plist 中直接指定可执行文件的绝对路径，而非通过 `hapi.cjs` 间接调用

### 3. 服务端口

默认端口配置:
- Hub: **3006**
- 检查端口: `lsof -i -P | grep hapi`

### 4. 更新后重新部署流程

```bash
# 1. 构建
bun run build:single-exe

# 2. 复制并签名
cp cli/dist-exe/bun-darwin-arm64/hapi cli/npm/darwin-arm64/bin/hapi
codesign --force --sign - cli/npm/darwin-arm64/bin/hapi

# 3. 也更新全局链接的版本
cp cli/dist-exe/bun-darwin-arm64/hapi ~/.nvm/versions/node/v20.19.2/lib/node_modules/@twsxtd/hapi-darwin-arm64/bin/hapi
codesign --force --sign - ~/.nvm/versions/node/v20.19.2/lib/node_modules/@twsxtd/hapi-darwin-arm64/bin/hapi

# 4. 重启服务
launchctl stop com.arwen.hapi.hub
launchctl stop com.arwen.hapi.runner
launchctl start com.arwen.hapi.hub
launchctl start com.arwen.hapi.runner
```

## npm 全局包结构

npm link 后会有两个全局包：

```
├── @twsxtd/hapi@x.x.x           # 主包（入口点）
├── @twsxtd/hapi-darwin-arm64@x.x.x  # 平台包（可执行文件）
```

这是正常的，主包通过 `optionalDependencies` 依赖平台特定包。
