#!/bin/bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-patient-portal:latest}"

docker-compose -f docker-compose.unified.yml build --no-cache
docker tag patient_portal-app:latest "$IMAGE_NAME"

echo "Built $IMAGE_NAME"
echo "Push it with: docker push $IMAGE_NAME"
