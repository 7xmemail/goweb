
// Main Application Logic
const qs = (s) => document.querySelector(s);
const qsa = (s) => document.querySelectorAll(s);

const App = {
    state: {
        user: null,
        currentApp: null,
        currentPath: ''
    },

    async init() {
        await this.checkAuth();
        this.setupNavigation();
        this.setupModals();
        this.loadDashboard();
    },

    async checkAuth() {
        const res = await fetch('api/auth.php?action=check');
        const data = await res.json();
        if (!data.loggedIn) {
            window.location.href = 'login.html';
        } else {
            this.state.user = data.user;
            document.getElementById('usernameDisplay').textContent = data.user;
        }

        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await fetch('api/auth.php?action=logout');
            window.location.href = 'login.html';
        });
    },

    setupNavigation() {
        qsa('.nav-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                qsa('.nav-item').forEach(n => n.classList.remove('active'));
                el.classList.add('active');
                const tab = el.dataset.tab;
                if (tab === 'dashboard') this.loadDashboard();
                if (tab === 'apps') this.loadApps();
                // Settings...
            });
        });
    },

    setupModals() {
        const modal = document.getElementById('appModal');
        const btn = document.getElementById('newAppBtn');
        const close = modal.querySelector('.close-modal');

        btn.onclick = () => modal.classList.add('active');
        close.onclick = () => modal.classList.remove('active');

        // Form Type Switch
        const typeSelect = document.getElementById('deployType');
        const binaryGroup = document.getElementById('binaryUploadGroup');
        const gitGroup = document.getElementById('gitRepoGroup');

        typeSelect.onchange = () => {
            if (typeSelect.value === 'binary') {
                binaryGroup.classList.remove('hidden');
                gitGroup.classList.add('hidden');
            } else {
                binaryGroup.classList.add('hidden');
                gitGroup.classList.remove('hidden');
            }
        };

        // Create App Submit
        document.getElementById('createAppForm').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Deploying...';
            btn.disabled = true;

            const formData = new FormData(e.target);
            try {
                const res = await fetch('api/apps.php?action=create', {
                    method: 'POST',
                    body: formData
                });
                const json = await res.json();
                if (json.success) {
                    modal.classList.remove('active');
                    this.loadApps();
                } else {
                    alert('Error: ' + json.error);
                }
            } catch (err) {
                alert('Connection error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };

        // Editor Save
        document.getElementById('saveFileBtn').onclick = async () => {
            if (!this.state.currentEditorFile) return;
            const content = document.getElementById('codeEditor').value;
            try {
                const res = await fetch('api/files.php?action=save&app=' + this.state.currentApp.name, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file: this.state.currentEditorFile,
                        content: content
                    })
                });
                const json = await res.json();
                if (json.success) {
                    document.getElementById('editorModal').classList.remove('active');
                } else {
                    alert('Save failed: ' + json.error);
                }
            } catch (err) {
                alert('Error saving file');
            }
        };

        qsa('.close-modal').forEach(el => {
            el.addEventListener('click', () => {
                el.closest('.modal').classList.remove('active');
            });
        });
    },

    async loadDashboard() {
        const area = document.getElementById('contentArea');
        document.getElementById('pageTitle').textContent = 'Dashboard';
        area.innerHTML = '<div class="loading-spinner">Loading...</div>';

        // Fetch Apps
        const res = await fetch('api/apps.php?action=list');
        const data = await res.json();
        const apps = data.apps || [];

        const activeCount = apps.filter(a => a.status === 'active').length;

        area.innerHTML = `
            <div class="quick-stats">
                <div class="stat-card">
                    <div class="stat-label">Total Apps</div>
                    <div class="stat-value">${apps.length}</div>
                </div>
                 <div class="stat-card">
                    <div class="stat-label">Running</div>
                    <div class="stat-value" style="color:var(--primary)">${activeCount}</div>
                </div>
                 <div class="stat-card">
                    <div class="stat-label">Server Status</div>
                    <div class="stat-value" style="color:#34d399">Online</div>
                </div>
            </div>
            
            <h3>Running Applications</h3>
            <div class="app-grid" style="margin-top:1rem;">
                ${this.renderAppCards(apps.filter(a => a.status === 'active'))}
            </div>
        `;

        this.bindAppActions();
    },

    async loadApps() {
        const area = document.getElementById('contentArea');
        document.getElementById('pageTitle').textContent = 'Applications';
        area.innerHTML = '<div class="loading-spinner">Loading...</div>';

        const res = await fetch('api/apps.php?action=list');
        const data = await res.json();
        const apps = data.apps || [];

        area.innerHTML = `
            <div class="app-grid">
                ${this.renderAppCards(apps)}
            </div>
        `;

        this.bindAppActions();
    },

    renderAppCards(apps) {
        if (apps.length === 0) return '<p style="color:var(--text-muted)">No applications found.</p>';

        return apps.map(app => `
            <div class="app-card" data-name="${app.name}">
                <div class="app-header">
                    <strong>${app.name}</strong>
                    <span class="status-badge ${app.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${app.status || 'unknown'}
                    </span>
                </div>
                <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:0.5rem;">
                    Port: ${app.port || '8080'} <br>
                    Path: ${app.path}
                </div>
                <div class="app-actions">
                    <button class="icon-btn" onclick="App.controlApp('${app.name}', 'start')" title="Start"><ion-icon name="play-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.controlApp('${app.name}', 'stop')" title="Stop"><ion-icon name="square-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.controlApp('${app.name}', 'restart')" title="Restart"><ion-icon name="refresh-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.showLogs('${app.name}')" title="Logs"><ion-icon name="document-text-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.openFileManager('${app.name}')" title="Files"><ion-icon name="folder-open-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.openDomainMgr('${app.name}', ${app.port || 8080})" title="Domains"><ion-icon name="globe-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.controlApp('${app.name}', 'delete')" title="Delete" style="color:#ef4444; border-color:#ef4444"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
            </div>
        `).join('');
    },

    openDomainMgr(appName, port) {
        // Simple domain mgr for now
        const modal = document.getElementById('domainModal');
        document.getElementById('domainAppPort').value = port;
        // Pre-fill domain input with appname.com as hint just for UI
        modal.classList.add('active');

        // Setup forms if not already (naively re-binding here is okay for simple prototype)
        document.getElementById('domainForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            try {
                const res = await fetch('api/domains.php?action=create', {
                    method: 'POST', body: JSON.stringify(data)
                });
                const json = await res.json();
                if (json.success) alert('Nginx Config Created! Reloading Nginx...');
                else alert('Error: ' + json.error);
            } catch (err) { alert('Api Error'); }
        };

        document.getElementById('sslForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            try {
                alert('Issuing SSL... this may take a minute.');
                const res = await fetch('api/domains.php?action=ssl', {
                    method: 'POST', body: JSON.stringify(data)
                });
                const json = await res.json();
                if (json.success) alert('SSL Certificate Issued!');
                else alert('Error: ' + json.error);
            } catch (err) { alert('Api Error'); }
        };
    },

    async showLogs(appName) {
        document.getElementById('logsModal').classList.add('active');
        const pre = document.getElementById('logsVal');
        document.getElementById('logsTitle').textContent = `Logs: ${appName}`;
        pre.textContent = 'Loading logs...';

        try {
            const res = await fetch(`api/apps.php?action=logs&name=${appName}`);
            const json = await res.json();
            if (json.logs) {
                pre.textContent = json.logs;
            } else {
                pre.textContent = 'No logs found or permission denied.';
            }
        } catch (e) {
            pre.textContent = 'Error fetching logs.';
        }
    },

    async controlApp(name, action) {
        if (action === 'delete' && !confirm('Are you sure you want to delete ' + name + '?')) return;

        try {
            const res = await fetch('api/apps.php?action=control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, command: action })
            });
            const json = await res.json();
            if (json.success) {
                // Refresh current view
                const currentTab = qs('.nav-item.active').dataset.tab;
                if (currentTab === 'dashboard') this.loadDashboard();
                else this.loadApps();
            } else {
                alert('Action failed: ' + json.error);
            }
        } catch (e) {
            alert('Error performing action');
        }
    },

    bindAppActions() {
        // Since we insert HTML strings, the onclick inline handlers handle the binding to global App object.
        // We just need to ensure App is global.
    },

    async openFileManager(appName) {
        this.state.currentApp = { name: appName };
        const area = document.getElementById('contentArea');
        document.getElementById('pageTitle').textContent = `Files: ${appName}`;
        area.innerHTML = '<div class="loading-spinner">Loading Files...</div>';

        await this.loadFileBrowser('');
    },

    async loadFileBrowser(path) {
        const area = document.getElementById('contentArea');
        const appName = this.state.currentApp.name;

        try {
            const res = await fetch(`api/files.php?app=${appName}&action=list&path=${path}`);
            const data = await res.json();
            const files = data.files || [];

            // Build Breadcrumb
            let breadcrumb = `<div style="margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem">
                <button class="btn secondary" onclick="App.loadApps()">Back to Apps</button> 
                <span style="color:var(--text-muted)">/ var / go-apps / ${appName} / ${path}</span>
            </div>`;

            let list = `
                <table style="width:100%; text-align:left; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border); color:var(--text-muted)">
                            <th style="padding:0.5rem">Name</th>
                            <th style="padding:0.5rem">Size</th>
                            <th style="padding:0.5rem">Modified</th>
                            <th style="padding:0.5rem">Action</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            if (path !== '') {
                const parent = path.split('/').slice(0, -1).join('/');
                list += `
                    <tr style="border-bottom:1px solid var(--border); cursor:pointer" onclick="App.loadFileBrowser('${parent}')">
                        <td style="padding:0.75rem"><ion-icon name="arrow-back-outline"></ion-icon> ..</td>
                        <td>-</td>
                        <td>-</td>
                        <td></td>
                    </tr>
                `;
            }

            files.forEach(f => {
                const icon = f.type === 'directory' ? 'folder' : 'document';
                const clickAction = f.type === 'directory'
                    ? `App.loadFileBrowser('${f.path}')`
                    : `App.editFile('${f.path}')`;

                list += `
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:0.75rem; display:flex; align-items:center; gap:0.5rem; cursor:pointer;" onclick="${clickAction}">
                             <ion-icon name="${icon}-outline"></ion-icon> ${f.name}
                        </td>
                        <td style="color:var(--text-muted)">${f.type === 'directory' ? '-' : (f.size / 1024).toFixed(1) + ' KB'}</td>
                        <td style="color:var(--text-muted)">${new Date(f.mtime * 1000).toLocaleString()}</td>
                        <td>
                            <button class="icon-btn" style="padding:4px;" onclick="if(confirm('Delete?')) App.deleteFile('${f.path}')">
                                <ion-icon name="trash-outline"></ion-icon>
                            </button>
                        </td>
                    </tr>
                `;
            });

            list += '</tbody></table>';

            area.innerHTML = breadcrumb + list;

        } catch (e) {
            area.innerHTML = '<div class="error-text">Failed to load files</div>';
        }
    },

    async editFile(path) {
        this.state.currentEditorFile = path;
        try {
            const res = await fetch(`api/files.php?app=${this.state.currentApp.name}&action=read&file=${path}`);
            const data = await res.json();

            document.getElementById('editorFileName').textContent = path;
            document.getElementById('codeEditor').value = data.content;
            document.getElementById('editorModal').classList.add('active');
        } catch (e) {
            alert('Failed to read file');
        }
    },

    async deleteFile(path) {
        // Implement delete file logic call to API
    }
};

// Make Global
window.App = App;

// Init
document.addEventListener('DOMContentLoaded', () => App.init());
