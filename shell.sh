#!/bin/bash
set -e
cd "$(dirname "$0")"

docker exec -w /app -it resumeplay_web bash
