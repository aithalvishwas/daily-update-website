#!/bin/sh
# Creates config/.env with strong random secrets so the stack can start.
# Safe to run again: it only fills values that are empty or still placeholders.
set -eu

DIR=$(cd "$(dirname "$0")" && pwd)
ENV_FILE="$DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  cp "$DIR/.env.example" "$ENV_FILE"
  echo "Created config/.env from config/.env.example"
fi

random() { openssl rand -hex "$1"; }

# Older .env files have no admin settings yet; add them.
if ! grep -q '^ADMIN_EMAIL=' "$ENV_FILE"; then
  printf '\n# First admin account (manages every account). Created on first start if no admin exists.\nADMIN_NAME=Admin\nADMIN_EMAIL=admin@example.com\nADMIN_PASSWORD=change-me-please\n' >> "$ENV_FILE"
  echo "Added admin settings to config/.env"
fi

DB_PASSWORD=$(random 16)
JWT=$(random 32)
MANAGER_PW=$(random 8)
ADMIN_PW=$(random 8)

# Rewrite the file, filling only empty or placeholder values.
awk -v db="$DB_PASSWORD" -v jwt="$JWT" -v mpw="$MANAGER_PW" -v apw="$ADMIN_PW" '
  BEGIN { FS = OFS = "=" }
  /^POSTGRES_PASSWORD=/ && ($2 == "" || $2 ~ /^change-me/) { $2 = db; print; next }
  /^JWT_SECRET=/ && length($2) < 32 { $2 = jwt; print; next }
  /^MANAGER_PASSWORD=/ && ($2 == "" || $2 ~ /^change-me/) { $2 = mpw; print; next }
  /^ADMIN_PASSWORD=/ && ($2 == "" || $2 ~ /^change-me/) { $2 = apw; print; next }
  { print }
' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "config/.env is ready."
echo "Admin login:   $(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2-) / $(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
echo "Manager login: $(grep '^MANAGER_EMAIL=' "$ENV_FILE" | cut -d= -f2-) / $(grep '^MANAGER_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
if ! grep -q '^ANTHROPIC_API_KEY=.' "$ENV_FILE"; then
  echo "Tip: add your ANTHROPIC_API_KEY to config/.env for AI summaries (optional)."
fi
echo "Start the app with: docker compose -f config/docker-compose.yml up -d --build"
