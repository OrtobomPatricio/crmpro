#!/bin/bash

# =====================================================
# HTTPS Setup Script for CRM PRO VPS
# =====================================================
# This script installs and configures:
# - Nginx as reverse proxy
# - Certbot for free SSL certificates
# - Auto-renewal of certificates
# =====================================================

set -e  # Exit on error

echo "🔒 CRM PRO - HTTPS Setup Script"
echo "================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

# Variables (customize these)
DOMAIN="${DOMAIN:-crm.yourdomain.com}"
APP_PORT="${APP_PORT:-3000}"
EMAIL="${EMAIL:-admin@yourdomain.com}"

echo "Configuration:"
echo "  Domain: $DOMAIN"
echo "  App Port: $APP_PORT"
echo "  Email: $EMAIL"
echo ""

read -p "Continue with these settings? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# ===== Step 1: Install Nginx =====
echo "📦 Installing Nginx..."
apt update
apt install -y nginx

# ===== Step 2: Install Certbot =====
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# ===== Step 3: Create Nginx configuration =====
echo "⚙️  Creating Nginx configuration..."

cat > /etc/nginx/sites-available/crm << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Redirect all HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL certificates (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy configuration
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Standard proxy headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Increase max body size for file uploads
    client_max_body_size 50M;
}
EOF

# ===== Step 4: Enable site =====
echo "🔗 Enabling Nginx site..."
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# ===== Step 5: Temporarily configure for HTTP only =====
echo "⚙️  Creating temporary HTTP-only config for Certbot..."

cat > /etc/nginx/sites-available/crm-temp << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/crm-temp /etc/nginx/sites-enabled/crm

# Test and reload Nginx
nginx -t
systemctl reload nginx

# ===== Step 6: Obtain SSL certificate =====
echo "🔒 Obtaining SSL certificate from Let's Encrypt..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

# ===== Step 7: Switch to HTTPS config =====
echo "🔄 Switching to HTTPS configuration..."
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm

# Test and reload Nginx
nginx -t
systemctl reload nginx

# ===== Step 8: Setup auto-renewal =====
echo "⏰ Setting up automatic certificate renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer

# Test renewal
certbot renew --dry-run

echo ""
echo "✅ HTTPS setup complete!"
echo ""
echo "Your CRM is now accessible at: https://$DOMAIN"
echo ""
echo "Next steps:"
echo "1. Update your .env file with the HTTPS URL:"
echo "   VITE_OAUTH_PORTAL_URL=https://$DOMAIN"
echo "   CLIENT_URL=https://$DOMAIN"
echo "   VITE_API_URL=https://$DOMAIN"
echo ""
echo "2. Update server/_core/index.ts to enable HSTS:"
echo "   hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }"
echo ""
echo "3. Rebuild Docker containers:"
echo "   docker compose down && docker compose up -d --build"
echo ""
echo "Certificate auto-renewal is configured and will run daily."
echo "Check status with: systemctl status certbot.timer"
