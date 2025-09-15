# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SSHTunnel Web is a modern SSH port forwarding management tool with a web interface. It allows users to create, manage, and monitor SSH port forwarding connections through a beautiful web UI and comprehensive REST API.

## Core Architecture

### Server Architecture (server.js)
- **Express Web Server**: Serves static files from `public/` and provides REST API endpoints
- **SSH Connection Management**: Uses `ssh2` library directly for creating SSH tunnels, with `node-ssh` for configuration management
- **Persistent Storage**: Saves active port forwarding configurations to `saved-forwards.json` and automatically restores them on server restart
- **Connection Tracking**: Maintains active connections in a Map with connection keys format: `{host}:{localPort}:{remotePort}`

### Key Components
- **Port Forwarding Logic**: Creates local TCP servers that forward connections through SSH tunnels using `ssh2.Client.forwardOut()`
- **SSH Config Parser**: Reads `ssh-config` file in standard SSH config format to populate available hosts
- **Persistence Layer**: Automatically saves/loads port forwarding configurations for seamless restarts

### Frontend Architecture (public/)
- **Single Page Application**: Vanilla JavaScript with `SSHPortForwardingManager` class
- **Real-time Updates**: Polls server every 3 seconds for connection status updates
- **Modern UI**: CSS Grid/Flexbox layout with glassmorphism design and responsive breakpoints

## Development Commands

```bash
# Start server (default port 7432)
npm start

# Start with custom port
npm start -- --port 8080

# Development mode with auto-reload
npm run dev

# Show help
npm start -- --help
```

## SSH Configuration

The application reads from `ssh-config` file in project root, following standard SSH config format:

```
Host example-server
    HostName 192.168.1.100
    User developer
    Port 22
    IdentityFile ~/.ssh/id_rsa
```

## API Endpoints Structure

### Core Endpoints
- `POST /api/forward` - Creates port forwarding using `createSingleForward()` function
- `GET /api/connections` - Returns active connections from `activeConnections` Map
- `DELETE /api/forward/:key` - Stops specific forwarding and updates persistent storage

### Management Endpoints
- `GET /api/health` - Server health check
- `GET /api/status` - Detailed server status with memory usage and uptime
- `POST /api/test-ssh` - Tests SSH connectivity without creating tunnels

## Error Handling Patterns

- **Port Conflicts**: Server checks port availability before binding and provides clear error messages
- **SSH Authentication**: Handles key-based authentication failures with specific error messages
- **Connection Recovery**: Automatically restores saved port forwarding on server restart

## Important Implementation Details

- **Connection Keys**: Always use format `{host}:{localPort}:{remotePort}` for consistency
- **Persistence**: Every connection create/delete operation calls `saveForwardsToFile()`
- **SSH Client Management**: Each port forwarding uses its own `ssh2.Client` instance
- **Error Recovery**: Failed restoration attempts are logged but don't prevent other connections from restoring

## File Dependencies

- `saved-forwards.json` - Runtime persistence file (auto-generated)
- `ssh-config` - SSH host configurations (user-provided)
- `public/` - Static web assets served by Express