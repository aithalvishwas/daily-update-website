#!/bin/sh
# Puts WorkPulseLens live on your domain with HTTPS. Run it ON THE SERVER
# (Ubuntu 22.04 or 24.04), from the repository folder:
#   sudo ./config/deploy.sh workpulselens.com
# Optionally pass the first admin's login email (default vishwas@workpulselens.com):
#   sudo ./config/deploy.sh workpulselens.com you@workpulselens.com
# Run it again after `git pull` to update; your data is kept.
set -eu

DIR=$(cd "$(dirname "$0")" && pwd)
ENV_FILE="$DIR/.env"
DOMAIN_ARG=${1:-}
ADMIN_EMAIL_ARG=${2:-}

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo: sudo ./config/deploy.sh ${DOMAIN_ARG:-workpulselens.com}"
  exit 1
fi

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

# 2. Swap, so building the Java services doesn't run out of memory on small servers.
if [ "$(swapon --noheadings | wc -l)" -eq 0 ] && [ ! -f /swapfile ]; then
  echo "Adding 2 GB of swap..."
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 3. Firewall: only SSH and the website are reachable.
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443 >/dev/null
  ufw --force enable >/dev/null
  echo "Firewall: SSH, 80 and 443 open."
fi

# 4. Secrets (config/.env) and domain
ADMIN_EMAIL="$ADMIN_EMAIL_ARG" sh "$DIR/setup.sh" >/dev/null
if [ -n "$DOMAIN_ARG" ]; then
  if grep -q '^DOMAIN=' "$ENV_FILE"; then
    sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN_ARG|" "$ENV_FILE"
  else
    printf '\n# Domain WorkPulseLens is served on over HTTPS.\nDOMAIN=%s\n' "$DOMAIN_ARG" >> "$ENV_FILE"
  fi
fi
DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "$DOMAIN" ]; then
  echo "Tell me your domain: sudo ./config/deploy.sh workpulselens.com"
  exit 1
fi

# 5. Build and start everything
echo "Building and starting WorkPulseLens (the first build takes several minutes)..."
docker compose --env-file "$ENV_FILE" \
  -f "$DIR/docker-compose.yml" -f "$DIR/docker-compose.prod.yml" up -d --build --remove-orphans

echo
DEFAULT_WORKSPACE=$(grep '^DEFAULT_WORKSPACE=' "$ENV_FILE" | cut -d= -f2-)
echo "WorkPulseLens is starting at https://$DOMAIN (and https://www.$DOMAIN), where companies sign up."
echo "Each company gets https://<company>.$DOMAIN. Your own accounts are at https://${DEFAULT_WORKSPACE:-app}.$DOMAIN"
echo "HTTPS is set up automatically once DNS points to this server: records @, www and * (wildcard)."
echo "Admin login:   $(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2-) / $(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
echo "Manager login: $(grep '^MANAGER_EMAIL=' "$ENV_FILE" | cut -d= -f2-) / $(grep '^MANAGER_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
echo "Sign in as the admin at https://${DEFAULT_WORKSPACE:-app}.$DOMAIN and use the Accounts page to add people and give them a role (employee, manager or admin)."
