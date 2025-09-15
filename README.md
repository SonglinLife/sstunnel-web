# SSHTunnel Web

一个现代化的SSH端口转发管理工具，提供美观的Web界面和丰富的API接口。

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0-brightgreen.svg)

## ✨ 特性

- 🚀 **现代化界面** - 响应式设计，支持桌面和移动设备
- 📋 **配置管理** - 自动解析SSH配置文件（`~/.ssh/config`格式）
- 🔄 **持久化存储** - 重启后自动恢复端口转发设置
- ⚡ **实时监控** - 显示连接状态和持续时间
- 🔌 **丰富API** - 完整的REST API支持
- 🛡️ **安全可靠** - 基于SSH密钥认证
- 📊 **状态管理** - 详细的连接管理和错误处理

## 🚀 快速开始

### 安装

1. 克隆仓库：
```bash
git clone https://github.com/SonglinLife/sstunnel-web.git
cd sstunnel-web
```

2. 安装依赖：
```bash
npm install
```

3. 准备SSH配置文件：
```bash
# 复制你的SSH配置或创建新的配置文件
cp ~/.ssh/config ./ssh-config
```

### 使用

1. 启动服务器：
```bash
npm start                    # 默认端口7432
npm start -- --port 8080    # 指定端口
npm start -- --help         # 查看帮助
```

2. 打开浏览器访问：
```
http://localhost:7432
```

3. 选择SSH主机，设置本地和远程端口，开始端口转发！

## 📁 SSH配置格式

SSH配置文件应遵循标准的`~/.ssh/config`格式：

```
Host production-server
    HostName prod.example.com
    User admin
    Port 22
    IdentityFile ~/.ssh/prod_key

Host development-server
    HostName 192.168.1.100
    User developer
    Port 22
    IdentityFile ~/.ssh/id_rsa
```

## 🔌 API接口

### 基础接口
- `GET /api/health` - 健康检查
- `GET /api/status` - 系统状态
- `GET /api/ssh-configs` - 获取SSH配置列表

### 端口转发管理
- `POST /api/forward` - 创建端口转发
- `GET /api/connections` - 查看活动连接
- `DELETE /api/forward/:key` - 停止特定转发
- `DELETE /api/connections` - 停止所有转发

### 工具接口
- `GET /api/ports/check/:port` - 检查端口可用性
- `POST /api/test-ssh` - 测试SSH连接

### API使用示例

```bash
# 创建端口转发
curl -X POST http://localhost:7432/api/forward \\
  -H 'Content-Type: application/json' \\
  -d '{"host":"production-server","localPort":8080,"remotePort":80}'

# 查看活动连接
curl http://localhost:7432/api/connections

# 停止所有转发
curl -X DELETE http://localhost:7432/api/connections
```

## 🎯 使用场景

- **本地开发** - 转发远程数据库端口到本地
- **服务调试** - 访问远程服务器上的内部服务
- **安全访问** - 通过SSH隧道安全访问远程资源
- **团队协作** - 统一管理团队的SSH端口转发

## ⭐ 核心功能

### 持久化存储
- 自动保存端口转发配置
- 服务重启后自动恢复转发
- 支持批量管理和清理

### 智能错误处理
- 端口占用检测和提示
- SSH连接状态监控
- 详细的错误信息和解决建议

### 现代化界面
- 渐变背景和毛玻璃效果
- 实时状态更新
- 移动端适配

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **SSH**: ssh2 library
- **前端**: Vanilla JavaScript + Modern CSS
- **配置**: SSH Config Parser

## 📋 系统要求

- Node.js 14.0+
- SSH密钥配置
- 对目标服务器的SSH访问权限

## 🔧 开发

启动开发模式（自动重载）：
```bash
npm run dev
```

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 🐛 问题反馈

如果您发现任何问题，请在[Issues](https://github.com/SonglinLife/sstunnel-web/issues)页面提交。

## 📧 联系方式

如有疑问，请通过GitHub Issues联系我们。

---

**SSHTunnel Web** - 让SSH端口转发变得简单优雅 ✨