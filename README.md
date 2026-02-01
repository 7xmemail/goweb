# Go App Control Panel

A lightweight, premium control panel for managing Go applications on Linux VPS.

## Features
- **Deploy Apps**: Upload binaries or deploy from Git.
- **Process Management**: Start, Stop, Restart Go apps (Systemd).
- **File Manager**: Edit configs, upload files, manage directories.
- **Domain & SSL**: Auto-configure Nginx and Let's Encrypt SSL.
- **Logs**: View application logs in real-time.

## Installation via GitHub (Fresh VPS)

1.  **SSH into your VPS** (Root access required).

2.  **Clone the Repository**:
    ```bash
    cd /var/www
    git clone https://github.com/7xmemail/goweb.git
    cd panel
    ```

3.  **Run Installer**:
    ```bash
    chmod +x install.sh
    sudo ./install.sh
    ```
    This script will:
    - Install Nginx, PHP, Go, Certbot.
    - Set up the database and permissions.
    - Configure Nginx to serve the panel on **Port 8888**.

4.  **Access the Panel**:
    - Open your browser and go to: `http://YOUR_VPS_IP:8888`
    - **Default Login**: `admin` / `admin`

## Security Note
- **Change Password**: Immediately change your password by editing `config/users.json` or adding a password change feature in the code.
- **Firewall**: Ensure port 8888 is open if you have an external firewall (AWS Security Groups, etc.).

## Security Note
This panel executes system commands via PHP. The `install.sh` restricts these commands via `sudoers` to only specific actions (systemctl, nginx, certbot), but you should essentially treat the panel admin as a sudo user. Secure your panel with strong passwords and consider IP restrictions.
