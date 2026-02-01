#!/bin/bash
HOST="173.212.221.22"
USER="root"
PASS="yJaCuv8G8DcCKf2RpI35"
REMOTE_DIR="/var/www/panel"

echo "Deploying to $HOST..."

# Use expect to handle the password prompt
expect -c "
set timeout -1
spawn scp -r -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null . $USER@$HOST:$REMOTE_DIR
expect \"password:\"
send \"$PASS\r\"
expect eof
"

echo "Deployment Complete."
