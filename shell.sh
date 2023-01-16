#!/bin/bash
set -e
cd "$(dirname "$0")"

docker exec -w /var/www/html -it resumeplay_web bash
