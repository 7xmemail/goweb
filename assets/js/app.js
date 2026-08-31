
// Main Application Logic
const qs = (s) => document.querySelector(s);
const qsa = (s) => document.querySelectorAll(s);
const loadingMarkup = (label = 'Loading…') => `<div class="loading-state"><span class="loading-spinner"></span><span>${label}</span></div>`;

const App = {
    state: {
        user: null,
        currentApp: null,
        currentPath: '',
        codeEditor: null,
        editorDirty: false,
        editorLoading: false
    },

    async init() {
        this.refreshIcons();
        this.initializeCodeEditor();
        await this.checkAuth();
        this.setupNavigation();
        this.setupModals();
        this.loadDashboard();
    },

    refreshIcons() {
        if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
    },

    escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    },

    notify(message, type = 'info', title = '') {
        const region = document.getElementById('toastRegion');
        if (!region) return;
        const labels = { success: 'Success', error: 'Something went wrong', warning: 'Attention', info: 'Information' };
        const icons = { success: 'circle-check', error: 'circle-x', warning: 'triangle-alert', info: 'info' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.innerHTML = `<i data-lucide="${icons[type] || icons.info}"></i>`;
        const copy = document.createElement('div');
        copy.className = 'toast-copy';
        const heading = document.createElement('strong');
        heading.textContent = title || labels[type] || labels.info;
        const body = document.createElement('span');
        body.textContent = String(message || '');
        copy.append(heading, body);
        const close = document.createElement('button');
        close.className = 'toast-close'; close.type = 'button'; close.setAttribute('aria-label', 'Dismiss notification');
        close.innerHTML = '<i data-lucide="x"></i>';
        const dismiss = () => { toast.classList.add('leaving'); window.setTimeout(() => toast.remove(), 180); };
        close.onclick = dismiss;
        toast.append(icon, copy, close);
        region.prepend(toast);
        this.refreshIcons();
        window.setTimeout(dismiss, type === 'error' ? 7000 : 4500);
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

    async loadSettings() {
        const area = document.getElementById('contentArea');
        this.setPage('Settings', 'Manage account access and panel preferences.');
        let panelSettings = { app_base_domain: '', ssl_email: '' };
        try {
            const response = await fetch('api/settings.php');
            const payload = await response.json();
            if (response.ok && payload.settings) panelSettings = payload.settings;
        } catch (error) {
            this.notify('Could not load domain automation settings.', 'error');
        }
        area.innerHTML = `
            <div class="settings-layout">
                <div class="panel">
                    <div class="panel-heading">
                        <span class="stat-icon"><i data-lucide="wand-sparkles"></i></span>
                        <div><h3>Automatic app subdomains</h3><p>Used by the one-click random subdomain button.</p></div>
                    </div>
                    <div class="panel-body">
                    <form id="domainSettingsForm">
                        <div class="form-group">
                            <label>App base domain</label>
                            <input type="text" name="app_base_domain" required value="${this.escapeHtml(panelSettings.app_base_domain || '')}" placeholder="apps.example.com">
                            <small class="field-hint">Your Hostinger wildcard record should be *.apps for this example.</small>
                        </div>
                        <div class="form-group">
                            <label>SSL notification email</label>
                            <input type="email" name="ssl_email" value="${this.escapeHtml(panelSettings.ssl_email || '')}" placeholder="admin@example.com">
                            <small class="field-hint">When provided, one-click assignment also enables HTTPS.</small>
                        </div>
                        <button type="submit" class="btn primary"><i data-lucide="save"></i>Save domain settings</button>
                    </form>
                    </div>
                </div>
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

        document.getElementById('domainSettingsForm').onsubmit = async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button');
            button.disabled = true;
            try {
                const data = Object.fromEntries(new FormData(e.target).entries());
                const response = await fetch('api/settings.php', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
                });
                const payload = await response.json();
                if (!response.ok || !payload.success) throw new Error(payload.error || 'Settings could not be saved');
                this.notify(`Random applications will use *.${payload.settings.app_base_domain}.`, 'success', 'Domain automation configured');
            } catch (error) {
                this.notify(error.message, 'error', 'Settings not saved');
            } finally {
                button.disabled = false;
            }
        };

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
                    this.notify('Your panel password has been updated.', 'success');
                    e.target.reset();
                } else {
                    this.notify(json.error || 'Password could not be updated.', 'error');
                }
            } catch (err) {
                this.notify('Could not connect to the server.', 'error');
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

        btn.onclick = () => this.openNewAppModal();
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
                    this.notify('Application created. Add your Go source, then use Restart to build and deploy it.', 'success', 'Application ready');
                } else {
                    this.notify(json.error || 'Application could not be created.', 'error');
                }
            } catch (err) {
                this.notify('Could not connect to the server.', 'error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };

        document.getElementById('saveFileBtn').onclick = () => this.saveCurrentFile();

        qsa('.close-modal').forEach(el => {
            el.addEventListener('click', () => {
                el.closest('.modal').classList.remove('active');
            });
        });
        qsa('.modal').forEach(el => el.addEventListener('click', (event) => {
            if (event.target !== el) return;
            if (el.id === 'editorModal') this.closeCodeEditor();
            else el.classList.remove('active');
        }));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (event.target.closest && event.target.closest('.ace_search')) return;
                document.body.classList.remove('sidebar-open');
                if (document.getElementById('editorModal').classList.contains('active')) {
                    this.closeCodeEditor();
                    return;
                }
                qsa('.modal.active').forEach(el => el.classList.remove('active'));
            }
        });

        // Specific close for editor
        const closeEditBtn = document.getElementById('closeEditorBtn');
        if (closeEditBtn) {
            closeEditBtn.onclick = () => this.closeCodeEditor();
        }
    },

    initializeCodeEditor() {
        if (!window.ace) return;

        window.ace.config.set('basePath', 'assets/vendor/ace');
        const editor = window.ace.edit('codeEditor');
        editor.setTheme('ace/theme/one_dark');
        editor.setOptions({
            mode: 'ace/mode/text',
            fontSize: '13px',
            fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, monospace',
            showPrintMargin: false,
            showGutter: true,
            displayIndentGuides: true,
            highlightActiveLine: true,
            highlightSelectedWord: true,
            behavioursEnabled: true,
            wrapBehavioursEnabled: true,
            animatedScroll: false,
            scrollPastEnd: 0.35
        });
        editor.session.setUseWorker(false);
        editor.session.setTabSize(4);
        editor.session.setUseSoftTabs(true);
        editor.renderer.setScrollMargin(8, 8);

        editor.commands.addCommand({
            name: 'saveFile',
            bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
            exec: () => this.saveCurrentFile()
        });

        editor.session.on('change', () => {
            if (this.state.editorLoading) return;
            this.state.editorDirty = true;
            document.getElementById('editorUnsaved').classList.add('active');
        });

        const updatePosition = () => {
            const cursor = editor.getCursorPosition();
            const selected = editor.getSelectedText().length;
            document.getElementById('editorCursorPosition').textContent = `Ln ${cursor.row + 1}, Col ${cursor.column + 1}`;
            document.getElementById('editorSelectionStatus').textContent = selected ? `${selected} selected` : '';
        };
        editor.selection.on('changeCursor', updatePosition);
        editor.selection.on('changeSelection', updatePosition);

        document.getElementById('editorFindBtn').onclick = () => {
            editor.focus();
            editor.execCommand('find');
        };
        document.getElementById('editorReplaceBtn').onclick = () => {
            editor.focus();
            editor.execCommand('replace');
        };
        document.getElementById('editorWrapBtn').onclick = (event) => {
            const enabled = !editor.session.getUseWrapMode();
            editor.session.setUseWrapMode(enabled);
            event.currentTarget.classList.toggle('active', enabled);
            event.currentTarget.title = enabled ? 'Disable word wrap' : 'Enable word wrap';
        };

        this.state.codeEditor = editor;
        updatePosition();
    },

    getEditorLanguage(path) {
        const filename = path.split('/').pop().toLowerCase();
        const extension = filename.includes('.') ? filename.split('.').pop() : '';
        if (filename === 'dockerfile') return ['dockerfile', 'Dockerfile'];
        if (filename === 'makefile') return ['sh', 'Makefile'];
        const modes = {
            go: ['golang', 'Go'], js: ['javascript', 'JavaScript'], mjs: ['javascript', 'JavaScript'],
            ts: ['typescript', 'TypeScript'], tsx: ['typescript', 'TypeScript'],
            json: ['json', 'JSON'], html: ['html', 'HTML'], htm: ['html', 'HTML'], css: ['css', 'CSS'],
            php: ['php', 'PHP'], sh: ['sh', 'Shell'], bash: ['sh', 'Shell'], env: ['sh', 'Environment'],
            md: ['markdown', 'Markdown'], markdown: ['markdown', 'Markdown'], yaml: ['yaml', 'YAML'], yml: ['yaml', 'YAML'],
            xml: ['xml', 'XML'], svg: ['xml', 'SVG'], sql: ['sql', 'SQL'], py: ['python', 'Python'],
            rs: ['rust', 'Rust'], c: ['c_cpp', 'C'], h: ['c_cpp', 'C header'], cpp: ['c_cpp', 'C++'],
            txt: ['text', 'Plain text']
        };
        return modes[extension] || ['text', extension ? extension.toUpperCase() : 'Plain text'];
    },

    openCodeEditor(path, content) {
        if (!this.state.codeEditor) {
            this.notify('The code editor could not be loaded.', 'error');
            return;
        }

        const [mode, label] = this.getEditorLanguage(path);
        this.state.currentEditorFile = path;
        this.state.editorLoading = true;
        this.state.codeEditor.session.setMode(`ace/mode/${mode}`);
        this.state.codeEditor.setValue(content || '', -1);
        this.state.codeEditor.session.getUndoManager().reset();
        this.state.codeEditor.clearSelection();
        this.state.editorLoading = false;
        this.state.editorDirty = false;

        document.getElementById('editorFileName').textContent = path;
        document.getElementById('editorLanguage').textContent = label;
        document.getElementById('editorModeStatus').textContent = label;
        document.getElementById('editorUnsaved').classList.remove('active');
        document.getElementById('editorModal').classList.add('active');

        requestAnimationFrame(() => {
            this.state.codeEditor.resize(true);
            this.state.codeEditor.focus();
        });
    },

    async saveCurrentFile() {
        if (!this.state.currentEditorFile || !this.state.codeEditor) return;

        const button = document.getElementById('saveFileBtn');
        const original = button.innerHTML;
        button.disabled = true;
        button.textContent = 'Saving…';

        try {
            const res = await fetch('api/files.php?action=save&app=' + encodeURIComponent(this.state.currentApp.name), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: this.state.currentEditorFile,
                    content: this.state.codeEditor.getValue()
                })
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');

            this.state.editorDirty = false;
            document.getElementById('editorUnsaved').classList.remove('active');
            button.textContent = 'Saved';
            this.notify(`${this.state.currentEditorFile} was saved successfully.`, 'success', 'Changes saved');
            window.setTimeout(() => { button.innerHTML = original; this.refreshIcons(); }, 900);
        } catch (error) {
            this.notify(error.message, 'error', 'Save failed');
            button.innerHTML = original;
            this.refreshIcons();
        } finally {
            button.disabled = false;
        }
    },

    closeCodeEditor() {
        if (this.state.editorDirty && !confirm('Close the editor and discard unsaved changes?')) return;
        this.state.editorDirty = false;
        document.getElementById('editorUnsaved').classList.remove('active');
        document.getElementById('editorModal').classList.remove('active');
    },

    async openNewAppModal() {
        const modal = document.getElementById('appModal');
        const portInput = modal.querySelector('[name="port"]');
        const hint = document.getElementById('portAvailabilityHint');

        modal.classList.add('active');
        portInput.disabled = true;
        hint.textContent = 'Finding the next available port…';

        try {
            const res = await fetch('api/apps.php?action=next_port');
            const data = await res.json();
            if (!res.ok || !data.port) throw new Error(data.error || 'No port available');
            portInput.value = data.port;
            hint.textContent = `Port ${data.port} is the next available application port.`;
        } catch (error) {
            hint.textContent = error.message || 'Could not determine an available port.';
        } finally {
            portInput.disabled = false;
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
            <div class="list-toolbar">
                <label class="search-field"><i data-lucide="search"></i><input id="appNameFilter" type="search" placeholder="Filter applications by name" aria-label="Filter applications by name"></label>
                <select id="appSort" class="sort-select" aria-label="Sort applications">
                    <option value="port-asc">Port: low to high</option>
                    <option value="name-asc">Name: A to Z</option>
                    <option value="name-desc">Name: Z to A</option>
                </select>
                <span class="result-count" id="appResultCount"></span>
            </div>
            <div class="app-grid" id="applicationsGrid"></div>
        `;

        const renderFilteredApps = () => {
            const query = document.getElementById('appNameFilter').value.trim().toLocaleLowerCase();
            const sort = document.getElementById('appSort').value;
            const visibleApps = apps
                .filter(app => app.name.toLocaleLowerCase().includes(query))
                .sort((left, right) => {
                    if (sort === 'name-asc') return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
                    if (sort === 'name-desc') return right.name.localeCompare(left.name, undefined, { sensitivity: 'base' });
                    return Number(left.port) - Number(right.port) || left.name.localeCompare(right.name);
                });

            document.getElementById('applicationsGrid').innerHTML = visibleApps.length
                ? this.renderAppCards(visibleApps)
                : `<div class="empty-state"><span class="empty-icon"><i data-lucide="search-x"></i></span><h3>No matching applications</h3><p>Try a different name or clear the filter.</p></div>`;
            document.getElementById('appResultCount').textContent = `${visibleApps.length} of ${apps.length}`;
            this.refreshIcons();
        };

        document.getElementById('appNameFilter').addEventListener('input', renderFilteredApps);
        document.getElementById('appSort').addEventListener('change', renderFilteredApps);
        renderFilteredApps();
    },

    renderAppCards(apps) {
        if (apps.length === 0) return `<div class="empty-state"><span class="empty-icon"><i data-lucide="package-plus"></i></span><h3>No applications yet</h3><p>Deploy your first Go service to start managing it from this workspace.</p></div>`;

        return apps.map(app => `
            <div class="app-card" data-name="${app.name}">
                <div class="app-card-body"><div class="app-header">
                    <div class="app-title"><span class="app-title-icon"><i data-lucide="box"></i></span><span class="app-title-text"><strong>${app.name}</strong><small>Go application</small></span></div>
                    <span class="app-header-right">
                        <span class="status-badge ${app.status === 'active' ? 'status-active' : 'status-inactive'}">${app.status || 'unknown'}</span>
                        ${app.domain ? `<a class="card-visit-link" href="${app.email ? 'https' : 'http'}://${app.domain}" target="_blank" rel="noopener noreferrer" title="Visit ${app.domain}" aria-label="Visit ${app.domain}"><i data-lucide="external-link"></i></a>` : ''}
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
        if (!domain) return this.notify('Configure a domain for this application first.', 'warning');

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
                    this.notify('Nginx configuration was saved and reloaded.', 'success');
                    document.getElementById('nginxModal').classList.remove('active');
                } else {
                    this.notify(json.error || 'Nginx configuration could not be saved.', 'error');
                }
            } catch (e) {
                this.notify('Could not connect to the server.', 'error');
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

        const randomButton = document.getElementById('randomDomainBtn');
        randomButton.onclick = async () => {
            randomButton.disabled = true;
            const result = await this.runStreamCommand(
                'Assigning random subdomain',
                'api/domains.php?action=random&stream=1',
                { app: appName, port }
            );
            randomButton.disabled = false;
            if (result?.success) {
                const match = result.output.match(/Public URL:\s+(https?:\/\/[^\s]+)/);
                if (match) this.notify(match[1], 'success', 'Random subdomain assigned');
                await this.loadApps();
            }
        };

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

            if (!res.ok || !res.body) throw new Error(`Server returned ${res.status}`);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let completeOutput = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                completeOutput += text;
                termOut.textContent += text;
                termOut.scrollTop = termOut.scrollHeight;
            }
            const failed = /\[(?:DEPLOYMENT|DOMAIN) FAILED\]/.test(completeOutput);
            if (failed) {
                termOut.textContent += '\n\n[Failed — review the detailed output above]';
                this.notify('The operation failed. Review the detailed output above.', 'error', title);
            } else {
                termOut.textContent += '\n\n[Completed]';
                this.notify('The operation completed successfully.', 'success', title);
            }
            return { success: !failed, output: completeOutput };
        } catch (e) {
            termOut.textContent += '\n\n[Error: ' + e + ']';
            this.notify(e.message || 'The operation could not be completed.', 'error', title);
            return { success: false, output: termOut.textContent };
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
        if (action === 'delete' && !confirm(`Permanently delete ${name}? This removes its service, files, caches, proxy configuration, certificate, and releases its port.`)) return;

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
                const message = action === 'delete'
                    ? `${name} was completely deleted${json.deleted?.port ? ` and port ${json.deleted.port} is available again` : ''}.`
                    : `${name} was ${action === 'stop' ? 'stopped' : 'started'} successfully.`;
                this.notify(message, 'success');
            } else {
                this.notify(json.error || 'The requested action failed.', 'error');
            }
        } catch (e) {
            this.notify(e.message || 'Could not perform the requested action.', 'error');
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
        try {
            const res = await fetch(`api/files.php?app=${this.state.currentApp.name}&action=read&file=${path}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not read file');
            this.openCodeEditor(path, data.content);
        } catch (e) {
            this.notify(e.message, 'error', 'Could not read file');
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
                this.notify(`${path} was deleted.`, 'success');
            } else {
                this.notify(json.error || 'The file could not be deleted.', 'error');
            }
        } catch (e) { this.notify(e.message || 'The file could not be deleted.', 'error'); }
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
                this.notify(`${oldName} was renamed to ${newName}.`, 'success');
            } else {
                this.notify(json.error || 'The file could not be renamed.', 'error');
            }
        } catch (e) { this.notify(e.message || 'The file could not be renamed.', 'error'); }
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
                    this.notify(`${name} was updated successfully.`, 'success');
                } else {
                    this.notify(json.error || 'Application could not be updated.', 'error');
                }
            } catch (err) {
                this.notify('Could not connect to the server.', 'error');
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
                    this.notify(`${file.name} was uploaded.`, 'success');
                } else {
                    this.notify(json.error || 'Upload failed.', 'error');
                }
            } catch (e) { this.notify(e.message || 'Upload failed.', 'error'); }
        };
        input.click();
    },

    newFileModal(path) {
        const name = prompt("Enter file name:");
        if (!name) return;
        this.openCodeEditor((path ? path + '/' : '') + name, '');
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
            if (json.success) {
                this.loadFileBrowser(path);
                this.notify(`${name} was created.`, 'success');
            } else this.notify(json.error || 'Failed to create folder.', 'error');
        } catch (e) { this.notify(e.message || 'Failed to create folder.', 'error'); }
    }
};

// Make Global
window.App = App;

// Init
document.addEventListener('DOMContentLoaded', () => App.init());
