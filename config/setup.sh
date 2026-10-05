#!/bin/sh
# Creates config/.env with strong random secrets so the stack can start.
# Safe to run again: it only fills values that are empty or still placeholders.
# To choose the first admin's login email, pass it in:
#   ADMIN_EMAIL=you@workpulselens.com ./config/setup.sh
set -eu

NEW_ADMIN_EMAIL=${ADMIN_EMAIL:-}
if [ -n "$NEW_ADMIN_EMAIL" ] && ! printf '%s' "$NEW_ADMIN_EMAIL" | grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
  echo "ADMIN_EMAIL doesn't look like an email address: $NEW_ADMIN_EMAIL"
  exit 1
fi

DIR=$(cd "$(dirname "$0")" && pwd)
ENV_FILE="$DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  cp "$DIR/.env.example" "$ENV_FILE"
  echo "Created config/.env from config/.env.example"
fi

random() { openssl rand -hex "$1"; }

# Older .env files have no admin settings yet; add them.
if ! grep -q '^ADMIN_EMAIL=' "$ENV_FILE"; then
  printf '\n# First admin account (manages every account). Created on first start if no admin exists.\nADMIN_NAME=Vishwas\nADMIN_EMAIL=vishwas@workpulselens.com\nADMIN_PASSWORD=change-me-please\n' >> "$ENV_FILE"
  echo "Added admin settings to config/.env"
fi

DB_PASSWORD=$(random 16)
JWT=$(random 32)
MANAGER_PW=$(random 8)
ADMIN_PW=$(random 8)

# Rewrite the file, filling only empty or placeholder values.
awk -v email="$NEW_ADMIN_EMAIL" -v db="$DB_PASSWORD" -v jwt="$JWT" -v mpw="$MANAGER_PW" -v apw="$ADMIN_PW" '
  BEGIN { FS = OFS = "=" }
  /^POSTGRES_PASSWORD=/ && ($2 == "" || $2 ~ /^change-me/) { $2 = db; print; next }
  /^JWT_SECRET=/ && length($2) < 32 { $2 = jwt; print; next }
  /^MANAGER_PASSWORD=/ && ($2 == "" || $2 ~ /^change-me/) { $2 = mpw; print; next }
  /^ADMIN_PASSWORD=/ && ($2 == "" || $2 ~ /^change-me/) { $2 = apw; print; next }
  /^ADMIN_EMAIL=/ && email != "" { $2 = email; print; next }
  { print }
' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "WorkPulseLens: config/.env is ready."
if [ -n "$NEW_ADMIN_EMAIL" ]; then
  echo "Admin email set to $NEW_ADMIN_EMAIL. It's created on the next start if the database has no admin yet;"
  echo "if it already has one, sign in as that admin and add this account on the Accounts page instead."
fi
echo "Admin login:   $(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2-) / $(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
echo "Manager login: $(grep '^MANAGER_EMAIL=' "$ENV_FILE" | cut -d= -f2-) / $(grep '^MANAGER_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
if ! grep -q '^ANTHROPIC_API_KEY=.' "$ENV_FILE"; then
  echo "Tip: add your ANTHROPIC_API_KEY to config/.env for AI summaries (optional)."
fi
echo "Start WorkPulseLens with: docker compose -f config/docker-compose.yml up -d --build"
echo "Then log in to the default workspace at http://$(grep '^DEFAULT_WORKSPACE=' "$ENV_FILE" | cut -d= -f2- | grep . || echo app).localhost:8080"
