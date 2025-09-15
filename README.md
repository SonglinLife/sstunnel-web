# SSHTunnel Web

[简体中文](README.zh-CN.md) | English

A modern SSH port forwarding management tool with a beautiful web interface and comprehensive API.

![SSHTunnel Web Interface](https://github.com/user-attachments/assets/99dc9c27-9b5f-485c-bbdf-5299d4e30731)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0-brightgreen.svg)

## ✨ Features

- 🚀 **Modern Interface** - Responsive design for desktop and mobile devices
- 📋 **Configuration Management** - Auto-parse SSH config files (`~/.ssh/config` format)
- 🔄 **Persistent Storage** - Auto-restore port forwarding settings after restart
- ⚡ **Real-time Monitoring** - Display connection status and duration
- 🔌 **Rich API** - Complete REST API support
- 🛡️ **Secure & Reliable** - SSH key-based authentication
- 📊 **Status Management** - Detailed connection management and error handling

## 🚀 Quick Start

### Installation

1. Clone the repository:
```bash
git clone https://github.com/SonglinLife/sstunnel-web.git
cd sstunnel-web
```

2. Install dependencies:
```bash
npm install
```

3. Prepare SSH configuration file:
```bash
# Copy your SSH config or create a new one
cp ~/.ssh/config ./ssh-config
```

### Usage

1. Start the server:
```bash
npm start                    # Default port 7432
npm start -- --port 8080    # Custom port
npm start -- --help         # Show help
```

2. Open your browser and navigate to:
```
http://localhost:7432
```

3. Select SSH host, set local and remote ports, and start port forwarding!

## 📁 SSH Configuration Format

SSH config file should follow standard `~/.ssh/config` format:

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

## 🔌 API Endpoints

### Core Endpoints
- `GET /api/health` - Health check
- `GET /api/status` - System status
- `GET /api/ssh-configs` - Get SSH configuration list

### Port Forwarding Management
- `POST /api/forward` - Create port forwarding
- `GET /api/connections` - Get active connections
- `DELETE /api/forward/:key` - Stop specific forwarding
- `DELETE /api/connections` - Stop all forwarding

### Utility Endpoints
- `GET /api/ports/check/:port` - Check port availability
- `POST /api/test-ssh` - Test SSH connection

### API Usage Examples

```bash
# Create port forwarding
curl -X POST http://localhost:7432/api/forward \
  -H 'Content-Type: application/json' \
  -d '{"host":"production-server","localPort":8080,"remotePort":80}'

# Get active connections
curl http://localhost:7432/api/connections

# Stop all forwarding
curl -X DELETE http://localhost:7432/api/connections
```

## 🎯 Use Cases

- **Local Development** - Forward remote database ports to local
- **Service Debugging** - Access internal services on remote servers
- **Secure Access** - Safely access remote resources through SSH tunnels
- **Team Collaboration** - Centralized SSH port forwarding management

## ⭐ Core Features

### Persistent Storage
- Auto-save port forwarding configurations
- Auto-restore forwarding after server restart
- Batch management and cleanup support

### Smart Error Handling
- Port occupation detection and prompts
- SSH connection status monitoring
- Detailed error messages and solutions

### Modern Interface
- Gradient backgrounds and glassmorphism effects
- Real-time status updates
- Mobile-responsive design

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **SSH**: ssh2 library
- **Frontend**: Vanilla JavaScript + Modern CSS
- **Configuration**: SSH Config Parser

## 📋 Requirements

- Node.js 14.0+
- SSH key configuration
- SSH access to target servers

## 🔧 Development

Start development mode (auto-reload):
```bash
npm run dev
```

## 📄 License

This project is licensed under the [MIT](LICENSE) License.

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Bug Reports

If you find any issues, please submit them on the [Issues](https://github.com/SonglinLife/sstunnel-web/issues) page.

## 📧 Contact

For questions, please contact us through GitHub Issues.

---

**SSHTunnel Web** - Making SSH port forwarding simple and elegant ✨