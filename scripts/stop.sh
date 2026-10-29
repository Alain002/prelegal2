#!/usr/bin/env bash
# Stops and removes the Prelegal container. Shared by stop-mac.sh and stop-linux.sh.
set -euo pipefail

if [ -n "$(docker ps -aq --filter 'name=^prelegal$')" ]; then
  docker rm -f prelegal >/dev/null
  echo "Prelegal stopped"
else
  echo "Prelegal was not running"
fi
