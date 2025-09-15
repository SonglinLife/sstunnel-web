const express = require('express');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { Client } = require('ssh2');
const { NodeSSH } = require('node-ssh');
const SSHConfig = require('ssh-config');
const WebSocket = require('ws');

const app = express();

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    let port = 7432;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
            const portArg = args[i + 1];
            if (portArg && !isNaN(portArg)) {
                port = parseInt(portArg);
                if (port < 1 || port > 65535) {
                    console.error('❌ Port must be between 1-65535');
                    process.exit(1);
                }
            } else {
                console.error('❌ Please specify a valid port number');
                console.error('Usage: node server.js --port 8080');
                process.exit(1);
            }
            break;
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
SSH Port Forwarding Server

Usage:
  node server.js [options]
  npm start -- --port 8080

Options:
  -p, --port <port>    Specify port to use (default: 7432)
  -h, --help          Show this help message

Examples:
  node server.js --port 8080
  npm start -- --port 9000
`);
            process.exit(0);
        }
    }

    return port;
}

const PORT = parseArgs();

app.use(express.json());
app.use(express.static('public'));

let activeConnections = new Map();

// 持久化配置文件路径
const SAVED_FORWARDS_FILE = path.join(process.cwd(), 'saved-forwards.json');

// 保存转发配置到文件
function saveForwardsToFile() {
    try {
        const forwardsData = Array.from(activeConnections.entries()).map(([key, conn]) => {
            const [host, localPort, remotePort] = key.split(':');
            return {
                connectionKey: key,
                host,
                localPort: parseInt(localPort),
                remotePort: parseInt(remotePort),
                remoteHost: conn.config.dstHost,
                startTime: conn.startTime
            };
        });

        fs.writeFileSync(SAVED_FORWARDS_FILE, JSON.stringify(forwardsData, null, 2));
        console.log(`Saved ${forwardsData.length} forward(s) to file`);
    } catch (error) {
        console.error('Error saving forwards to file:', error);
    }
}

// 从文件加载转发配置
function loadForwardsFromFile() {
    try {
        if (!fs.existsSync(SAVED_FORWARDS_FILE)) {
            console.log('No saved forwards file found');
            return [];
        }

        const data = fs.readFileSync(SAVED_FORWARDS_FILE, 'utf8');
        const forwardsData = JSON.parse(data);
        console.log(`Loaded ${forwardsData.length} saved forward(s) from file`);
        return forwardsData;
    } catch (error) {
        console.error('Error loading forwards from file:', error);
        return [];
    }
}

function checkPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.listen(port, '127.0.0.1', () => {
            server.close(() => {
                resolve(true);
            });
        });

        server.on('error', () => {
            resolve(false);
        });
    });
}

// 创建单个端口转发的核心函数
async function createSingleForward(host, localPort, remotePort, remoteHost = 'localhost') {
    const configs = parseSSHConfig();
    const config = configs.find(c => c.host === host);

    if (!config) {
        throw new Error('SSH config not found');
    }

    const connectionKey = `${host}:${localPort}:${remotePort}`;

    if (activeConnections.has(connectionKey)) {
        throw new Error('Port forwarding already active');
    }

    const portNum = parseInt(localPort);
    const isPortAvailable = await checkPortAvailable(portNum);
    if (!isPortAvailable) {
        throw new Error(`Local port ${portNum} is already in use`);
    }

    const forwardConfig = {
        srcHost: '127.0.0.1',
        srcPort: parseInt(localPort),
        dstHost: remoteHost,
        dstPort: parseInt(remotePort)
    };

    // 使用ssh2 Client创建本地端口转发
    const sshClient = new Client();

    await new Promise((resolve, reject) => {
        sshClient.on('ready', () => {
            console.log(`SSH connection established for ${host}`);
            resolve();
        });

        sshClient.on('error', (err) => {
            console.error('SSH connection error:', err);
            reject(err);
        });

        const sshOptions = {
            host: config.hostname,
            port: config.port,
            username: config.user,
        };

        if (config.identityFile) {
            const keyPath = config.identityFile.replace('~', process.env.HOME);
            sshOptions.privateKey = fs.readFileSync(keyPath);
        }

        sshClient.connect(sshOptions);
    });

    // 创建本地服务器监听指定端口
    const localServer = net.createServer((localSocket) => {
        console.log(`New connection to local port ${forwardConfig.srcPort}`);

        // 通过SSH客户端转发连接
        sshClient.forwardOut(
            '127.0.0.1', // 本地绑定地址
            0,           // 本地端口(0让系统分配)
            forwardConfig.dstHost, // 目标主机
            forwardConfig.dstPort, // 目标端口
            (err, stream) => {
                if (err) {
                    console.error('SSH forwardOut error:', err);
                    localSocket.end();
                    return;
                }

                console.log(`Connected to remote ${forwardConfig.dstHost}:${forwardConfig.dstPort}`);

                // 双向数据转发
                localSocket.pipe(stream);
                stream.pipe(localSocket);

                // 错误处理
                localSocket.on('error', (err) => {
                    console.error('Local socket error:', err);
                    stream.end();
                });

                stream.on('error', (err) => {
                    console.error('SSH stream error:', err);
                    localSocket.end();
                });

                // 连接关闭处理
                localSocket.on('close', () => {
                    console.log('Local connection closed');
                    stream.end();
                });

                stream.on('close', () => {
                    console.log('Remote connection closed');
                    localSocket.end();
                });
            }
        );
    });

    // 监听本地端口
    await new Promise((resolve, reject) => {
        localServer.listen(forwardConfig.srcPort, forwardConfig.srcHost, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log(`Local server listening on ${forwardConfig.srcHost}:${forwardConfig.srcPort}`);
                resolve();
            }
        });

        localServer.on('error', reject);
    });

    activeConnections.set(connectionKey, {
        ssh: sshClient,
        server: localServer,
        config: forwardConfig,
        startTime: new Date()
    });

    // 保存到文件
    saveForwardsToFile();

    return { connectionKey, message: `Port forwarding active: localhost:${localPort} -> ${host}:${remotePort}` };
}

function parseSSHConfig() {
    try {
        const configPath = path.join(process.cwd(), 'ssh-config');
        if (!fs.existsSync(configPath)) {
            return [];
        }

        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = SSHConfig.parse(configContent);

        return config.filter(entry => entry.type === 1 && entry.param === 'Host').map(entry => {
            const host = entry.value;
            const hostname = entry.config.find(c => c.param === 'HostName')?.value || host;
            const port = entry.config.find(c => c.param === 'Port')?.value || '22';
            const user = entry.config.find(c => c.param === 'User')?.value || 'root';
            const identityFile = entry.config.find(c => c.param === 'IdentityFile')?.value;

            return {
                host,
                hostname,
                port: parseInt(port),
                user,
                identityFile
            };
        });
    } catch (error) {
        console.error('Error parsing SSH config:', error);
        return [];
    }
}

app.get('/api/ssh-configs', (req, res) => {
    const configs = parseSSHConfig();
    res.json(configs);
});

app.post('/api/forward', async (req, res) => {
    const { host, localPort, remotePort, remoteHost = 'localhost' } = req.body;

    if (!host || !localPort || !remotePort) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const portNum = parseInt(localPort);
    if (portNum < 1 || portNum > 65535) {
        return res.status(400).json({ error: 'Local port must be between 1-65535' });
    }

    try {
        const result = await createSingleForward(host, localPort, remotePort, remoteHost);
        res.json({
            success: true,
            message: result.message,
            connectionKey: result.connectionKey
        });
    } catch (error) {
        console.error('Port forwarding error:', error);

        let errorMessage = error.message;

        if (error.message.includes('ECONNREFUSED')) {
            errorMessage = `Cannot connect to SSH server`;
        } else if (error.message.includes('Authentication failed')) {
            errorMessage = 'SSH authentication failed. Check your SSH key.';
        } else if (error.message.includes('ENOENT')) {
            errorMessage = 'SSH private key file not found';
        } else if (error.message.includes('Unable to bind')) {
            errorMessage = `Local port ${localPort} is already in use`;
        } else if (error.message.includes('Connection refused')) {
            errorMessage = `Cannot connect to remote port ${remotePort} on ${remoteHost}`;
        }

        res.status(500).json({ error: errorMessage });
    }
});

app.delete('/api/forward/:connectionKey', async (req, res) => {
    const { connectionKey } = req.params;

    if (!activeConnections.has(connectionKey)) {
        return res.status(404).json({ error: 'Connection not found' });
    }

    try {
        const connection = activeConnections.get(connectionKey);

        if (connection.server) {
            connection.server.close();
        }

        if (connection.ssh) {
            connection.ssh.end();
        }

        activeConnections.delete(connectionKey);

        // 保存更新后的配置到文件
        saveForwardsToFile();

        res.json({ success: true, message: 'Port forwarding stopped' });

    } catch (error) {
        console.error('Error stopping port forwarding:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/connections', (req, res) => {
    const connections = Array.from(activeConnections.entries()).map(([key, conn]) => ({
        connectionKey: key,
        config: conn.config,
        startTime: conn.startTime
    }));

    res.json(connections);
});

// 新增调试和管理API端点

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeConnections: activeConnections.size,
        uptime: process.uptime()
    });
});

// 获取系统状态
app.get('/api/status', (req, res) => {
    const status = {
        server: {
            status: 'running',
            port: PORT,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        },
        connections: {
            total: activeConnections.size,
            active: Array.from(activeConnections.entries()).map(([key, conn]) => {
                const [host, localPort, remotePort] = key.split(':');
                return {
                    connectionKey: key,
                    host,
                    localPort: parseInt(localPort),
                    remotePort: parseInt(remotePort),
                    startTime: conn.startTime,
                    duration: Date.now() - new Date(conn.startTime).getTime()
                };
            })
        }
    };
    res.json(status);
});

// 测试SSH连接
app.post('/api/test-ssh', async (req, res) => {
    const { host } = req.body;

    if (!host) {
        return res.status(400).json({ error: 'Host parameter is required' });
    }

    try {
        const configs = parseSSHConfig();
        const config = configs.find(c => c.host === host);

        if (!config) {
            return res.status(404).json({ error: 'SSH config not found' });
        }

        const ssh = new NodeSSH();
        const connectionConfig = {
            host: config.hostname,
            port: config.port,
            username: config.user,
        };

        if (config.identityFile) {
            connectionConfig.privateKeyPath = config.identityFile.replace('~', process.env.HOME);
        }

        const startTime = Date.now();
        await ssh.connect(connectionConfig);
        const connectTime = Date.now() - startTime;

        // 测试一个简单的命令
        const result = await ssh.execCommand('echo "SSH connection test successful"');
        ssh.dispose();

        res.json({
            success: true,
            host: config.host,
            hostname: config.hostname,
            port: config.port,
            user: config.user,
            connectTime: `${connectTime}ms`,
            testCommand: result.stdout
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            host: host
        });
    }
});

// 快速创建端口转发（简化参数）
app.post('/api/quick-forward', async (req, res) => {
    const { host, localPort, remotePort } = req.body;

    // 复用现有的forward逻辑
    req.body.remoteHost = 'localhost';

    // 调用原有的forward处理逻辑
    const originalUrl = req.url;
    req.url = '/api/forward';

    // 使用相同的处理逻辑
    return app._router.handle(req, res, () => {});
});

// 停止所有连接
app.delete('/api/connections', async (req, res) => {
    const errors = [];
    const stopped = [];

    for (const [key, connection] of activeConnections) {
        try {
            if (connection.server) {
                connection.server.close();
            }
            if (connection.ssh) {
                connection.ssh.dispose();
            }
            stopped.push(key);
        } catch (error) {
            errors.push({ connectionKey: key, error: error.message });
        }
    }

    activeConnections.clear();

    // 保存空的配置到文件
    saveForwardsToFile();

    res.json({
        success: true,
        message: `Stopped ${stopped.length} connections`,
        stopped,
        errors: errors.length > 0 ? errors : undefined
    });
});

// 获取端口使用情况
app.get('/api/ports/check/:port', async (req, res) => {
    const port = parseInt(req.params.port);

    if (isNaN(port) || port < 1 || port > 65535) {
        return res.status(400).json({ error: 'Invalid port number' });
    }

    const isAvailable = await checkPortAvailable(port);

    res.json({
        port,
        available: isAvailable,
        status: isAvailable ? 'free' : 'in_use'
    });
});

// 启动时恢复保存的端口转发
async function restoreSavedForwards() {
    const savedForwards = loadForwardsFromFile();

    if (savedForwards.length === 0) {
        return;
    }

    console.log(`\n🔄 Restoring ${savedForwards.length} saved port forward(s)...`);

    let restored = 0;
    let failed = 0;

    for (const forward of savedForwards) {
        try {
            console.log(`Restoring: localhost:${forward.localPort} -> ${forward.host}:${forward.remotePort}`);
            await createSingleForward(forward.host, forward.localPort, forward.remotePort, forward.remoteHost);
            restored++;
            console.log(`✅ Restored: ${forward.host}:${forward.localPort}:${forward.remotePort}`);
        } catch (error) {
            failed++;
            console.error(`❌ Failed to restore ${forward.host}:${forward.localPort}:${forward.remotePort}:`, error.message);
        }
    }

    console.log(`\n📊 Restoration complete: ${restored} successful, ${failed} failed\n`);
}

// 启动服务器并处理端口占用错误
function startServer() {
    const server = app.listen(PORT, async () => {
        console.log(`\n🚀 SSH Port Forwarding Server started successfully!`);
        console.log(`📡 Server running on: http://localhost:${PORT}`);
        console.log(`🌐 Web UI: http://localhost:${PORT}`);
        console.log(`🔌 API Base: http://localhost:${PORT}/api`);
        console.log(`\n💡 Press Ctrl+C to stop the server\n`);

        // 启动后恢复保存的转发
        setTimeout(async () => {
            try {
                await restoreSavedForwards();
            } catch (error) {
                console.error('Error restoring saved forwards:', error);
            }
        }, 1000); // 延迟1秒启动恢复，确保服务器完全启动
    });

    // 处理端口占用错误
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`\n❌ Port ${PORT} is already in use!`);
            console.error(`💡 Please specify a different port:`);
            console.error(`   npm start -- --port 8080\n`);
            process.exit(1);
        } else if (error.code === 'EACCES') {
            console.error(`\n❌ Permission denied to use port ${PORT}!`);
            console.error(`💡 Use a port above 1024:`);
            console.error(`   npm start -- --port 8080\n`);
            process.exit(1);
        } else {
            console.error(`\n❌ Server error:`, error.message);
            process.exit(1);
        }
    });

    return server;
}

const server = startServer();

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

process.on('SIGINT', async () => {
    console.log('\nShutting down server...');

    for (const [key, connection] of activeConnections) {
        try {
            if (connection.server) {
                connection.server.close();
            }
            if (connection.ssh) {
                connection.ssh.dispose();
            }
        } catch (error) {
            console.error(`Error closing connection ${key}:`, error);
        }
    }

    activeConnections.clear();
    process.exit(0);
});