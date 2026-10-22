#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p deploy/backups
backup_file="deploy/backups/ragnar-$(date -u +%Y%m%dT%H%M%SZ).dump"
if [[ -e "$backup_file" ]]; then
  echo "Ya existe un respaldo con esta fecha." >&2
  exit 1
fi
docker compose --env-file .env.production exec -T db pg_dump -U ragnar -d ragnar -Fc > "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"
echo "Respaldo creado: $backup_file. Copialo cifrado a otro servidor."
