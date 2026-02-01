# Go App Control Panel

A lightweight, premium control panel for managing Go applications on a Linux VPS.

## Features
- **App Management**: Create, Start, Stop, Restart Go applications (Systemd integration).
- **Deployment**: Manual binary upload or "Empty App" creation for easy file management.
- **File Manager**: Edit configuration files, upload assets, and manage directories via the web UI.
- **Domain & SSL**: Auto-configure Nginx reverse proxies and issue Let's Encrypt SSL certificates.
- **Logs**: View application logs, access logs, and error logs in real-time.
- **System Cleanup**: auto-removes Nginx configs and SSL certs when an app is deleted.

---

## Installation Guide (Fresh VPS)

**Prerequisites:**
- A VPS running **Ubuntu 20.04/22.04/24.04** or **Debian 11/12**.
- Root access (or user with sudo).

### Step 1: Transfer Files to VPS

You need to get the source code onto your server. You can do this via **Git** (if hosted) or **SCP/SFTP** (manual upload).

#### Option A: Manual Upload (SCP)
If you have the code on your local computer:

1.  Open your local terminal.
2.  Navigate to the project folder.
3.  Run the following command (replace with your VPS details):
    ```bash
    # Create directory first
    ssh root@YOUR_VPS_IP "mkdir -p /var/www/panel"
    
    # Copy files
    scp -r ./* root@YOUR_VPS_IP:/var/www/panel
    ```

#### Option B: Git Clone
If you have pushed this code to a Git repository:

```bash
# SSH into VPS
ssh root@YOUR_VPS_IP

# Clone to /var/www/panel
git clone https://github.com/7xmemail/goweb.git /var/www/panel
```

---

### Step 2: Run the Installer

Once the files are on the server:

1.  **SSH into your VPS**:
    ```bash
    ssh root@YOUR_VPS_IP
    ```

2.  **Navigate to the folder**:
    ```bash
    cd /var/www/panel
    ```

3.  **Execute the install script**:
    ```bash
    I
    ```

    **What this does:**
    -   Installs core dependencies: `nginx`, `php-fpm`, `golang`, `certbot`, `zip`, `unzip`.
    -   Configures Nginx to serve the Panel on **Port 8888**.
    -   Sets up directory permissions and creates a `sudoers` config for web-based system management.
    -   Generates default admin credentials.

---

### Step 3: Access the Panel

1.  Open your browser.
2.  Navigate to: `http://YOUR_VPS_IP:8888`
3.  **Default Credentials**:
    -   **Username**: `admin`
    -   **Password**: `admin`

> [!WARNING]
> **Security Check**:
> 1.  **Change Password**: Immediately open `config/users.json` on the server and change the password, or use the panel settings provided.
> 2.  **Firewall**: Ensure Port 8888 is allowed through your firewall (`ufw allow 8888`).

---

## How to Deploy Your First App

1.  **Build Locally**: Compile your Go app for Linux (`GOOS=linux GOARCH=amd64 go build -o app main.go`).
2.  **Create App**:
    -   Go to Dashboard -> **New App**.
    -   Choose **"Upload Binary"** and select your `app` file.
    -   OR choose **"Empty App"** to create a placeholder, then use File Manager to upload files.
3.  **Start**: Click **Start** to launch your service.
4.  **Domain**: Click **Domain** to map a domain (e.g., `api.example.com`) and enable SSL.
