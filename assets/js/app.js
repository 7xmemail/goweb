
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
                if (tab === 'dashboard') this.loadDashboard();
                if (tab === 'apps') this.loadApps();
                if (tab === 'settings') this.loadSettings();
            });
        });
    },

    loadSettings() {
        const area = document.getElementById('contentArea');
        document.getElementById('pageTitle').textContent = 'Settings';
        area.innerHTML = `
            <div style="max-width:500px">
                <h3>Change Password</h3>
                <div class="glass-panel" style="padding:1.5rem; margin-top:1rem;">
                    <form id="changePasswordForm">
                        <div class="form-group">
                            <label>New Password</label>
                            <input type="password" name="new_password" required minlength="2">
                        </div>
                        <button type="submit" class="btn primary full-width">Update Password</button>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('changePasswordForm').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Updating...';
            btn.disabled = true;

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
                const res = await fetch('api/auth.php?action=change_password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const json = await res.json();
                if (json.success) {
                    alert('Password updated successfully');
                    e.target.reset();
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
        const emptyInfo = document.getElementById('emptyAppInfo');

        typeSelect.onchange = () => {
            if (typeSelect.value === 'binary') {
                binaryGroup.classList.remove('hidden');
                emptyInfo.classList.add('hidden');
            } else {
                binaryGroup.classList.add('hidden');
                emptyInfo.classList.remove('hidden');
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

        // Specific close for editor
        const closeEditBtn = document.getElementById('closeEditorBtn');
        if (closeEditBtn) {
            closeEditBtn.onclick = () => document.getElementById('editorModal').classList.remove('active');
        }
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
        this.state.apps = apps; // Cache for lookup

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
                    <button class="icon-btn" onclick="App.editAppModal('${app.name}', ${app.port || 8080})" title="Edit App"><ion-icon name="create-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.openDomainMgr('${app.name}', ${app.port || 8080})" title="Domains"><ion-icon name="globe-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.openNginxEditor('${app.domain || ''}')" title="Nginx Config" ${!app.domain ? 'disabled style="opacity:0.5"' : ''}><ion-icon name="settings-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="App.controlApp('${app.name}', 'delete')" title="Delete" style="color:#ef4444; border-color:#ef4444"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
            </div>
        `).join('');
    },

    async openNginxEditor(domain) {
        if (!domain) return alert('No domain configured for this app.');

        document.getElementById('nginxModal').classList.add('active');
        document.getElementById('nginxDomainDisplay').textContent = domain;
        document.getElementById('nginxEditor').value = 'Loading...';

        try {
            const res = await fetch(`api/domains.php?action=read_config&domain=${domain}`);
            const json = await res.json();

            if (json.error) {
                document.getElementById('nginxEditor').value = '# Error loading config: ' + json.error;
            } else {
                document.getElementById('nginxEditor').value = json.content;
            }
        } catch (e) {
            document.getElementById('nginxEditor').value = '# Error connecting to server';
        }

        document.getElementById('saveNginxBtn').onclick = async () => {
            const content = document.getElementById('nginxEditor').value;
            const btn = document.getElementById('saveNginxBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Saving...';
            btn.disabled = true;

            try {
                const res = await fetch('api/domains.php?action=save_config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain, content })
                });
                const json = await res.json();
                if (json.success) {
                    alert('Nginx configuration saved and reloaded!');
                    document.getElementById('nginxModal').classList.remove('active');
                } else {
                    alert('Error: ' + json.error);
                }
            } catch (e) {
                alert('Connection error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };

        document.getElementById('closeNginxBtn').onclick = () => {
            document.getElementById('nginxModal').classList.remove('active');
        };
    },

    openDomainMgr(appName, port) {
        const modal = document.getElementById('domainModal');
        document.getElementById('domainAppPort').value = port;
        modal.classList.add('active');

        const form = document.getElementById('domainForm');
        // Reset
        form.querySelector('[name="domain"]').value = '';
        document.getElementById('sslForm').querySelector('[name="email"]').value = '';

        // Try to pre-fill
        if (this.state.apps) {
            const app = this.state.apps.find(a => a.name === appName);
            if (app) {
                if (app.domain) form.querySelector('[name="domain"]').value = app.domain;
                if (app.email) document.getElementById('sslForm').querySelector('[name="email"]').value = app.email;
            }
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            formData.append('app', appName); // Add app name
            const data = Object.fromEntries(formData.entries());
            this.runStreamCommand('Create Nginx Config', 'api/domains.php?action=create&stream=1', data);
        };

        document.getElementById('sslForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            formData.append('app', appName); // Add app name
            formData.append('port', port);   // Add port explicitly from closure
            const data = Object.fromEntries(formData.entries());
            this.runStreamCommand('Issue SSL', 'api/domains.php?action=ssl&stream=1', data);
        };
    },

    async runStreamCommand(title, url, data) {
        // Show Terminal
        const termModal = document.getElementById('termModal');
        const termOut = document.getElementById('termOutput');
        document.getElementById('termTitle').textContent = title;
        termOut.textContent = 'Starting...\n';
        termModal.classList.add('active');

        // Hide previous modal if any
        document.querySelectorAll('.modal.active').forEach(m => {
            if (m.id !== 'termModal') m.classList.remove('active');
        });

        try {
            const res = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                termOut.textContent += text;
                termOut.scrollTop = termOut.scrollHeight;
            }
            termOut.textContent += '\n\n[Done]';
        } catch (e) {
            termOut.textContent += '\n\n[Error: ' + e + ']';
        }
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

        if (action === 'restart') {
            // Use streaming for restart to show build logs
            this.runStreamCommand('Restarting ' + name, 'api/apps.php?action=control&stream=1', { name, command: 'restart' });
            return;
        }

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
                <div style="margin-left:auto; display:flex; gap:0.5rem">
                     <button class="btn primary small" onclick="App.uploadFileModal('${path}')"><ion-icon name="cloud-upload-outline"></ion-icon> Upload</button>
                     <button class="btn secondary small" onclick="App.newFileModal('${path}')"><ion-icon name="add-outline"></ion-icon> New File</button>
                     <button class="btn secondary small" onclick="App.newDirModal('${path}')"><ion-icon name="folder-outline"></ion-icon> New Folder</button>
                </div>
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
                            <button class="icon-btn" style="padding:4px;" title="Rename" onclick="App.renameFile('${f.path}', '${f.name}')">
                                <ion-icon name="create-outline"></ion-icon>
                            </button>
                            <button class="icon-btn" style="padding:4px;" title="Delete" onclick="App.deleteFile('${f.path}')">
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
        if (!confirm('Are you sure you want to delete ' + path + '?')) return;
        try {
            const res = await fetch(`api/files.php?app=${this.state.currentApp.name}&action=delete`, {
                method: 'POST', body: JSON.stringify({ file: path })
            });
            const json = await res.json();
            if (json.success) {
                // Refresh current dir
                const parent = path.split('/').slice(0, -1).join('/');
                this.loadFileBrowser(parent);
            } else {
                alert('Delete failed');
            }
        } catch (e) { alert('Error deleting'); }
    },

    async renameFile(path, oldName) {
        const newName = prompt("Enter new name:", oldName);
        if (!newName || newName === oldName) return;

        // Construct new path. path is full relative path e.g. src/foo.txt
        const dir = path.split('/').slice(0, -1).join('/');
        const newPath = (dir ? dir + '/' : '') + newName;

        try {
            const res = await fetch(`api/files.php?app=${this.state.currentApp.name}&action=rename`, {
                method: 'POST', body: JSON.stringify({ old: path, new: newPath })
            });
            const json = await res.json();
            if (json.success) {
                this.loadFileBrowser(dir);
            } else {
                alert('Rename failed: ' + (json.error || 'Unknown'));
            }
        } catch (e) { alert('Error renaming'); }
    },

    editAppModal(name, port) {
        const modal = document.getElementById('editAppModal');
        modal.querySelector('[name="name"]').value = name;
        modal.querySelector('[name="port"]').value = port;
        modal.classList.add('active');

        document.getElementById('editAppForm').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Updating...';
            btn.disabled = true;

            const formData = new FormData(e.target);
            try {
                const res = await fetch('api/apps.php?action=update', {
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
    },

    uploadFileModal(path) {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async () => {
            if (input.files.length === 0) return;
            const file = input.files[0];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', path); // Directory inside app

            // Show a simple loading toast/alert
            const btn = document.querySelector('.btn.primary.small'); // bit hacky
            if (btn) btn.textContent = 'Uploading...';

            try {
                const res = await fetch(`api/files.php?app=${this.state.currentApp.name}&action=upload`, {
                    method: 'POST', body: formData
                });
                const json = await res.json();
                if (json.success) {
                    this.loadFileBrowser(path); // Refresh
                } else {
                    alert('Upload failed');
                }
            } catch (e) { alert('Error uploading'); }
        };
        input.click();
    },

    newFileModal(path) {
        const name = prompt("Enter file name:");
        if (!name) return;
        this.editFile((path ? path + '/' : '') + name); // Open editor for new file
    },

    newDirModal(path) {
        const name = prompt("Enter directory name:");
        if (!name) return;
        this.createDir(path, name);
    },

    async createDir(path, name) {
        const fullPath = (path ? path + '/' : '') + name;
        try {
            const res = await fetch(`api/files.php?app=${this.state.currentApp.name}&action=mkdir`, {
                method: 'POST',
                body: JSON.stringify({ dir: fullPath })
            });
            const json = await res.json();
            if (json.success) this.loadFileBrowser(path);
            else alert('Failed to create folder');
        } catch (e) { alert('Error'); }
    }
};

// Make Global
window.App = App;

// Init
document.addEventListener('DOMContentLoaded', () => App.init());
