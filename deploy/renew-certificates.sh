#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose --env-file .env.production run --rm certbot renew --webroot -w /var/www/certbot --quiet
docker compose --env-file .env.production exec -T nginx nginx -t
docker compose --env-file .env.production exec -T nginx nginx -s reload
