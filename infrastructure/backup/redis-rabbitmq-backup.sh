#!/bin/bash
set -eo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
S3_BUCKET_REDIS="s3://lifelink-production-backups/redis"
S3_BUCKET_RABBIT="s3://lifelink-production-backups/rabbitmq"

echo "[INFO] Running Redis and RabbitMQ backups..."

# 1. Redis Cache State Snapshot Copy
if [ -f "/data/dump.rdb" ]; then
  echo "[INFO] Copying Redis RDB snapshot..."
  aws s3 cp /data/dump.rdb "${S3_BUCKET_REDIS}/redis-dump-${TIMESTAMP}.rdb"
  echo "[INFO] Redis RDB successfully archived."
else
  echo "[WARN] Redis dump.rdb file not found at /data/dump.rdb."
fi

# 2. RabbitMQ Schema definitions export
echo "[INFO] Exporting RabbitMQ definitions using rabbitmqadmin..."
if rabbitmqadmin -H "${RABBITMQ_HOST}" -u "${RABBITMQ_USER}" -p "${RABBITMQ_PASS}" export /tmp/rabbitmq-defs.json; then
  gzip /tmp/rabbitmq-defs.json
  aws s3 cp /tmp/rabbitmq-defs.json.gz "${S3_BUCKET_RABBIT}/rabbitmq-defs-${TIMESTAMP}.json.gz"
  rm -f /tmp/rabbitmq-defs.json.gz
  echo "[INFO] RabbitMQ definitions successfully archived in S3."
else
  echo "[ERROR] RabbitMQ definitions export failed." >&2
  exit 1
fi
