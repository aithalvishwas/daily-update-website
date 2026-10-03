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

DB_PASSWORD=$(random 16)
JWT=$(random 32)
MANAGER_PW=$(random 8)

# Rewrite the file, filling only empty or placeholder values.
awk -v db="$DB_PASSWORD" -v jwt="$JWT" -v mpw="$MANAGER_PW" '
  BEGIN { FS = OFS = "=" }
  /^POSTGRES_PASSWORD=/ && ($2 == "" || $2 ~ /^change-me/) { $2 = db; print; next }
  /^JWT_SECRET=/ && length($2) < 32 { $2 = jwt; print; next }
  /^MANAGER_PASSWORD=/ && ($2 == "" || $2 ~ /^change-me/) { $2 = mpw; filled_manager = 1; print; next }
  { print }
  END { if (filled_manager) print "# setup.sh generated MANAGER_PASSWORD above; change it if you like" }
' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "config/.env is ready."
echo "Manager login: $(grep '^MANAGER_EMAIL=' "$ENV_FILE" | cut -d= -f2-) / $(grep '^MANAGER_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
if ! grep -q '^ANTHROPIC_API_KEY=.' "$ENV_FILE"; then
  echo "Tip: add your ANTHROPIC_API_KEY to config/.env for AI summaries (optional)."
fi
echo "Start the app with: docker compose -f config/docker-compose.yml up -d --build"
