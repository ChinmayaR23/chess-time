#!/bin/bash
# Run once on a fresh Amazon Linux 2023 EC2 instance as ec2-user.
# Usage: bash ec2-setup.sh <EC2_HOSTNAME>
# Example: bash ec2-setup.sh ec2-13-234-56-78.ap-south-1.compute.amazonaws.com
set -e

EC2_HOSTNAME=${1:?Usage: bash ec2-setup.sh <EC2_HOSTNAME>}

echo "==> Installing Java 21 (Corretto)"
sudo dnf install -y java-21-amazon-corretto-headless

echo "==> Installing Node.js 20"
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

echo "==> Installing nginx + certbot"
sudo dnf install -y nginx python3-certbot-nginx

echo "==> Creating app directories"
sudo mkdir -p /opt/chess-time-frontend /opt/chess-time-api /etc/chesstime
sudo chown ec2-user:ec2-user /opt/chess-time-frontend /opt/chess-time-api
sudo chmod 700 /etc/chesstime

echo "==> Copying nginx config"
sudo cp /home/ec2-user/infra/nginx.conf /etc/nginx/conf.d/chesstime.conf
sudo sed -i "s/EC2_HOSTNAME/${EC2_HOSTNAME}/g" /etc/nginx/conf.d/chesstime.conf
sudo nginx -t
sudo systemctl enable --now nginx

echo "==> Obtaining SSL certificate (Let's Encrypt)"
sudo certbot --nginx -d "$EC2_HOSTNAME" --non-interactive --agree-tos -m chinmayarayee@gmail.com

echo "==> Setting up certbot auto-renewal"
(sudo crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet") | sudo crontab -

echo "==> Copying systemd services"
sudo cp /home/ec2-user/infra/chess-time-api.service /etc/systemd/system/
sudo cp /home/ec2-user/infra/chess-time-frontend.service /etc/systemd/system/
sudo cp /home/ec2-user/infra/ssm-env.sh /opt/chess-time-api/ssm-env.sh
sudo chmod +x /opt/chess-time-api/ssm-env.sh
sudo systemctl daemon-reload

echo "==> Done. Upload your app artifacts, then:"
echo "    sudo systemctl enable --now chess-time-api chess-time-frontend"
