class SSHPortForwardingManager {
    constructor() {
        this.connections = new Map();
        this.init();
    }

    init() {
        this.loadSSHConfigs();
        this.loadActiveConnections();
        this.bindEvents();
        this.startAutoRefresh();
    }

    async loadSSHConfigs() {
        try {
            const response = await fetch('/api/ssh-configs');
            const configs = await response.json();

            const select = document.getElementById('sshConfig');
            select.innerHTML = '<option value="">Select SSH host...</option>';

            configs.forEach(config => {
                const option = document.createElement('option');
                option.value = config.host;
                option.textContent = `${config.host} (${config.user}@${config.hostname}:${config.port})`;
                select.appendChild(option);
            });

            if (configs.length === 0) {
                this.showNotification('No SSH configurations found. Please create a ssh-config file.', 'warning');
            }
        } catch (error) {
            console.error('Error loading SSH configs:', error);
            this.showNotification('Failed to load SSH configurations', 'error');
        }
    }

    async loadActiveConnections() {
        try {
            const response = await fetch('/api/connections');
            const connections = await response.json();
            this.renderConnections(connections);
        } catch (error) {
            console.error('Error loading connections:', error);
        }
    }

    bindEvents() {
        const form = document.getElementById('forwardForm');
        form.addEventListener('submit', this.handleFormSubmit.bind(this));
    }

    startAutoRefresh() {
        setInterval(() => {
            this.loadActiveConnections();
        }, 3000);
    }

    async handleFormSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const data = {
            host: document.getElementById('sshConfig').value,
            localPort: document.getElementById('localPort').value,
            remoteHost: 'localhost',
            remotePort: document.getElementById('remotePort').value
        };

        if (!data.host || !data.localPort || !data.remotePort) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        this.setButtonLoading(submitBtn, true);

        try {
            const response = await fetch('/api/forward', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(result.message, 'success');
                event.target.reset();
                this.loadActiveConnections();
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            console.error('Error creating port forwarding:', error);
            this.showNotification('Failed to create port forwarding', 'error');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }

    async stopConnection(connectionKey) {
        try {
            const response = await fetch(`/api/forward/${encodeURIComponent(connectionKey)}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(result.message, 'success');
                this.loadActiveConnections();
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            console.error('Error stopping connection:', error);
            this.showNotification('Failed to stop connection', 'error');
        }
    }

    renderConnections(connections) {
        const container = document.getElementById('connectionsList');

        if (connections.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔌</div>
                    <p>No active connections</p>
                </div>
            `;
            return;
        }

        container.innerHTML = connections.map(conn => {
            const [host, localPort, remotePort] = conn.connectionKey.split(':');
            const startTime = new Date(conn.startTime).toLocaleString();
            const duration = this.formatDuration(new Date() - new Date(conn.startTime));

            return `
                <div class="connection-item fade-in">
                    <div class="connection-info">
                        <div class="connection-title">
                            localhost:${localPort} → ${host}:${remotePort}
                        </div>
                        <div class="connection-details">
                            <span>Started: ${startTime}</span>
                            <span>Duration: ${duration}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="connection-status">
                            <div class="status-indicator"></div>
                            Active
                        </div>
                        <button
                            class="btn btn-danger"
                            onclick="app.stopConnection('${conn.connectionKey}')"
                        >
                            Stop
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;

        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }
}

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new SSHPortForwardingManager();
});

window.addEventListener('beforeunload', () => {
    app.connections.forEach(async (_, connectionKey) => {
        try {
            await fetch(`/api/forward/${encodeURIComponent(connectionKey)}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Error cleaning up connection:', error);
        }
    });
});