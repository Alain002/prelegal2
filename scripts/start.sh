#!/usr/bin/env bash
# Builds the Prelegal image and (re)starts it at http://localhost:8000.
# Shared by start-mac.sh and start-linux.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t prelegal .
docker rm -f prelegal >/dev/null 2>&1 || true

# Pass secrets such as OPENROUTER_API_KEY at run time; they are never baked into the image.
if [ -f .env ]; then
  docker run -d --name prelegal -p 8000:8000 --env-file .env prelegal >/dev/null
else
  docker run -d --name prelegal -p 8000:8000 prelegal >/dev/null
fi

echo "Prelegal is running at http://localhost:8000"
