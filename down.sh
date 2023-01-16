#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Stop :"
docker stop resumeplay_web
echo "Remove :"
docker rm resumeplay_web
