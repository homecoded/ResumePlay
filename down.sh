#!/bin/bash
set -e
cd "$(dirname "$0")"

# -f stops a running container first and doesn't fail if there is none
docker rm -f resumeplay_web >/dev/null
echo "Container resumeplay_web stopped and removed."
