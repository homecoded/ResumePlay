#!/bin/bash
set -e
cd "$(dirname "$0")"

CONTAINER=resumeplay_web
IMAGE=webdevops/apache:latest
DOCKER_HOST_PORT=80

if [ -f .env ]; then
  source .env
  DOCKER_HOST_PORT=${LOCAL_PORT:-$DOCKER_HOST_PORT}
fi

if [[ $1 == '--rebuild' ]]; then
  ./down.sh
  docker pull "$IMAGE"
elif docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  docker start "$CONTAINER" >/dev/null
  echo "Started existing container $CONTAINER (use --rebuild to re-create it, e.g. after changing .env)."
  exit 0
fi

docker run --name "$CONTAINER" \
    -p "$DOCKER_HOST_PORT:80" \
    -v "$(pwd)/src:/app" \
    -d "$IMAGE" >/dev/null

echo "ResumePlay is running on http://localhost:$DOCKER_HOST_PORT/"
