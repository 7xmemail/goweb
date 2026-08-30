
// Main Application Logic
const qs = (s) => document.querySelector(s);
const qsa = (s) => document.querySelectorAll(s);
const loadingMarkup = (label = 'Loading…') => `<div class="loading-state"><span class="loading-spinner"></span><span>${label}</span></div>`;

const App = {
    state: {
        user: null,
        currentApp: null,
        currentPath: ''
    },

    async init() {
        this.refreshIcons();
        await this.checkAuth();
        this.setupNavigation();
        this.setupModals();
        this.loadDashboard();
    },

    refreshIcons() {
        if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
    },

    setPage(title, description) {
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageDescription').textContent = description;
    },

    async checkAuth() {
        const res = await fetch('api/auth.php?action=check');
        const data = await res.json();
        if (!data.loggedIn) {
            window.location.href = 'login.html';
        } else {
            this.state.user = data.user;
            document.getElementById('usernameDisplay').textContent = data.user;
            document.getElementById('userAvatar').textContent = data.user.charAt(0).toUpperCase();
        }

        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await fetch('api/auth.php?action=logout');
            window.location.href = 'login.html';
        });
    },

    setupNavigation() {
        const closeSidebar = () => document.body.classList.remove('sidebar-open');
        document.getElementById('menuToggle').onclick = () => document.body.classList.add('sidebar-open');
        document.getElementById('sidebarClose').onclick = closeSidebar;
        document.getElementById('sidebarBackdrop').onclick = closeSidebar;
        qsa('.nav-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                qsa('.nav-item').forEach(n => n.classList.remove('active'));
                el.classList.add('active');
                closeSidebar();
                const tab = el.dataset.tab;
                if (tab === 'dashboard') this.loadDashboard();
                if (tab === 'apps') this.loadApps();
                if (tab === 'settings') this.loadSettings();
            });
        });
    },

    loadSettings() {
        const area = document.getElementById('contentArea');
        this.setPage('Settings', 'Manage account access and panel preferences.');
        area.innerHTML = `
            <div class="settings-layout">
                <div class="panel">
                    <div class="panel-heading">
                        <span class="stat-icon"><i data-lucide="key-round"></i></span>
                        <div><h3>Change password</h3><p>Choose a unique password to protect server access.</p></div>
                    </div>
                    <div class="panel-body">
                    <form id="changePasswordForm">
                        <div class="form-group">
                            <label>New Password</label>
                            <input type="password" name="new_password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters">
                        </div>
                        <button type="submit" class="btn primary"><i data-lucide="shield-check"></i>Update password</button>
                    </form>
                    </div>
                </div>
            </div>
        `;
        this.refreshIcons();

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
        qsa('.modal').forEach(el => el.addEventListener('click', (event) => {
            if (event.target === el) el.classList.remove('active');
        }));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                document.body.classList.remove('sidebar-open');
                qsa('.modal.active').forEach(el => el.classList.remove('active'));
            }
        });

        // Specific close for editor
        const closeEditBtn = document.getElementById('closeEditorBtn');
        if (closeEditBtn) {
            closeEditBtn.onclick = () => document.getElementById('editorModal').classList.remove('active');
        }
    },

    async loadDashboard() {
        const area = document.getElementById('contentArea');
        this.setPage('Overview', 'Monitor and manage your server applications.');
        area.innerHTML = loadingMarkup('Loading server overview…');

        // Fetch Apps
        const res = await fetch('api/apps.php?action=list');
        const data = await res.json();
        const apps = data.apps || [];

        const activeCount = apps.filter(a => a.status === 'active').length;
        document.getElementById('appCount').textContent = apps.length;

        area.innerHTML = `
            <div class="quick-stats">
                <div class="stat-card">
                    <div class="stat-top"><span class="stat-label">Total applications</span><span class="stat-icon"><i data-lucide="boxes"></i></span></div>
                    <div class="stat-value">${apps.length}</div><div class="stat-meta">Configured on this server</div>
                </div>
                 <div class="stat-card">
                    <div class="stat-top"><span class="stat-label">Running</span><span class="stat-icon success"><i data-lucide="activity"></i></span></div>
                    <div class="stat-value">${activeCount}</div><div class="stat-meta">${apps.length ? Math.round(activeCount / apps.length * 100) : 0}% of applications online</div>
                </div>
                 <div class="stat-card">
                    <div class="stat-top"><span class="stat-label">Server status</span><span class="stat-icon neutral"><i data-lucide="server"></i></span></div>
                    <div class="stat-value">Online</div><div class="stat-meta">System is operational</div>
                </div>
            </div>
            <div class="section-header"><div><h2>Running applications</h2><p>Services currently accepting traffic.</p></div></div>
            <div class="app-grid">
                ${this.renderAppCards(apps.filter(a => a.status === 'active'))}
            </div>
        `;

        this.refreshIcons();
        this.bindAppActions();
    },

    async loadApps() {
        const area = document.getElementById('contentArea');
        this.setPage('Applications', 'Deploy, configure, and operate your Go services.');
        area.innerHTML = loadingMarkup('Loading applications…');

        const res = await fetch('api/apps.php?action=list');
        const data = await res.json();
        const apps = data.apps || [];
        this.state.apps = apps; // Cache for lookup
        document.getElementById('appCount').textContent = apps.length;

        area.innerHTML = `
            <div class="section-header"><div><h2>All applications</h2><p>${apps.length} service${apps.length === 1 ? '' : 's'} configured on this server.</p></div></div>
            <div class="app-grid">
                ${this.renderAppCards(apps)}
            </div>
        `;

        this.refreshIcons();
        this.bindAppActions();
    },

    renderAppCards(apps) {
        if (apps.length === 0) return `<div class="empty-state"><span class="empty-icon"><i data-lucide="package-plus"></i></span><h3>No applications yet</h3><p>Deploy your first Go service to start managing it from this workspace.</p></div>`;

        return apps.map(app => `
            <div class="app-card" data-name="${app.name}">
                <div class="app-card-body"><div class="app-header">
                    <div class="app-title"><span class="app-title-icon"><i data-lucide="box"></i></span><span class="app-title-text"><strong>${app.name}</strong><small>Go application</small></span></div>
                    <span class="status-badge ${app.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${app.status || 'unknown'}
                    </span>
                </div>
                <dl class="app-metadata"><dt>Port</dt><dd>${app.port || '8080'}</dd><dt>Path</dt><dd title="${app.path}">${app.path}</dd>${app.domain ? `<dt>Domain</dt><dd>${app.domain}</dd>` : ''}</dl></div>
                <div class="app-actions">
                    <button class="icon-btn" onclick="App.controlApp('${app.name}', 'start')" title="Start"><i data-lucide="play"></i></button>
                    <button class="icon-btn" onclick="App.controlApp('${app.name}', 'stop')" title="Stop"><i data-lucide="square"></i></button>
                    <button class="icon-btn" onclick="App.controlApp('${app.name}', 'restart')" title="Restart"><i data-lucide="rotate-cw"></i></button>
                    <button class="icon-btn" onclick="App.showLogs('${app.name}')" title="View logs"><i data-lucide="scroll-text"></i></button>
                    <button class="icon-btn" onclick="App.openFileManager('${app.name}')" title="Manage files"><i data-lucide="folder-open"></i></button>
                    <button class="icon-btn" onclick="App.editAppModal('${app.name}', ${app.port || 8080})" title="Edit application"><i data-lucide="sliders-horizontal"></i></button>
                    <button class="icon-btn" onclick="App.openDomainMgr('${app.name}', ${app.port || 8080})" title="Domain and SSL"><i data-lucide="globe-2"></i></button>
                    <button class="icon-btn" onclick="App.openNginxEditor('${app.domain || ''}')" title="Nginx configuration" ${!app.domain ? 'disabled' : ''}><i data-lucide="file-cog"></i></button>
                    <button class="icon-btn danger" onclick="App.controlApp('${app.name}', 'delete')" title="Delete application"><i data-lucide="trash-2"></i></button>
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
        this.setPage('File manager', `Browse and edit files for ${appName}.`);
        area.innerHTML = loadingMarkup('Loading files…');

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
            let breadcrumb = `<div class="file-toolbar">
                <button class="btn secondary small" onclick="App.loadApps()"><i data-lucide="arrow-left"></i>Applications</button>
                <span class="file-path">/var/go-apps/${appName}/${path}</span>
                <div class="file-actions">
                     <button class="btn primary small" onclick="App.uploadFileModal('${path}')"><i data-lucide="upload-cloud"></i>Upload</button>
                     <button class="btn secondary small" onclick="App.newFileModal('${path}')"><i data-lucide="file-plus-2"></i>New file</button>
                     <button class="btn secondary small" onclick="App.newDirModal('${path}')"><i data-lucide="folder-plus"></i>New folder</button>
                </div>
            </div>`;

            let list = `
                <div class="table-wrap"><table class="file-table">
                    <thead>
                        <tr>
                            <th>Name</th><th>Size</th><th>Modified</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            if (path !== '') {
                const parent = path.split('/').slice(0, -1).join('/');
                list += `
                    <tr onclick="App.loadFileBrowser('${parent}')">
                        <td><span class="file-name"><i data-lucide="corner-left-up"></i>..</span></td>
                        <td>-</td>
                        <td>-</td>
                        <td></td>
                    </tr>
                `;
            }

            files.forEach(f => {
                const icon = f.type === 'directory' ? 'folder' : 'file';
                const clickAction = f.type === 'directory'
                    ? `App.loadFileBrowser('${f.path}')`
                    : `App.editFile('${f.path}')`;

                list += `
                    <tr>
                        <td onclick="${clickAction}"><span class="file-name"><i data-lucide="${icon}"></i>${f.name}</span></td>
                        <td>${f.type === 'directory' ? '—' : (f.size / 1024).toFixed(1) + ' KB'}</td>
                        <td>${new Date(f.mtime * 1000).toLocaleString()}</td>
                        <td><span class="table-actions">
                            <button class="icon-btn" title="Rename" onclick="App.renameFile('${f.path}', '${f.name}')">
                                <i data-lucide="pencil"></i>
                            </button>
                            <button class="icon-btn danger" title="Delete" onclick="App.deleteFile('${f.path}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </span></td>
                    </tr>
                `;
            });

            list += '</tbody></table></div>';

            area.innerHTML = breadcrumb + list;
            this.refreshIcons();

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
        modal.querySelector('[name="name_display"]').value = name;
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
