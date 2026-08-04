#!/bin/bash
set -eo pipefail

# 1. Environment Configs
BACKUP_DIR="/tmp/backups"
S3_BUCKET="s3://lifelink-production-backups/db"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/lifelink-db-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting database pg_dump for LifeLink..."

# 2. Execute pg_dump and compress
if pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${BACKUP_FILE}"; then
  echo "[INFO] pg_dump completed successfully. Output size: $(du -sh ${BACKUP_FILE} | cut -f1)"
  
  # 3. Upload to AWS S3
  echo "[INFO] Uploading backup archive to S3 bucket ${S3_BUCKET}..."
  if aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/lifelink-db-${TIMESTAMP}.sql.gz"; then
    echo "[INFO] Database backup successfully archived in S3 Glacier."
    # Cleanup local storage
    rm -f "${BACKUP_FILE}"
  else
    echo "[ERROR] S3 copy failed." >&2
    exit 1
  fi
else
  echo "[ERROR] pg_dump execution failed." >&2
  exit 1
fi
