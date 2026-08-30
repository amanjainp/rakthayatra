#!/usr/bin/env bash
# =============================================================================
# Rakthayatra — Staging Chaos & Disaster Recovery Validation Script
# =============================================================================
# PURPOSE: Simulate infrastructure failures in a STAGING namespace only.
# WARNING: DO NOT run against production. This script terminates pods and scales
#          down workloads. It is safe only in a dedicated staging namespace.
#
# PREREQUISITES:
#   - kubectl configured with staging cluster context
#   - k6 installed locally (https://k6.io/docs/get-started/installation/)
#   - STAGING_NAMESPACE env variable set (e.g. lifelink-staging)
#   - Backend load test URL set via STAGING_API_URL
# =============================================================================

set -euo pipefail

NAMESPACE="${STAGING_NAMESPACE:-lifelink-staging}"
API_URL="${STAGING_API_URL:-http://localhost:5000}"
SLEEP_RECOVER=30  # Seconds to wait after each fault injection

echo "========================================================"
echo " Rakthayatra Chaos Engineering Validation"
echo " Namespace:  $NAMESPACE"
echo " API URL:    $API_URL"
echo "========================================================"

# --- Helper Functions ---

check_health() {
  local label="$1"
  local expected="${2:-200}"
  echo "[CHECK] $label — Calling $API_URL/health/live..."
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health/live" || echo "000")
  if [ "$status" = "$expected" ]; then
    echo "[PASS]  $label health check returned $status as expected."
  else
    echo "[FAIL]  $label health check returned $status, expected $expected."
  fi
}

run_load_brief() {
  echo "[LOAD]  Running 30-second concurrency spike..."
  k6 run --duration 30s --vus 20 tests-e2e-load/k6/load-test.js || echo "[WARN]  Load test exited with non-zero status during chaos."
}

# =============================================================================
# SCENARIO 1: Pod Termination During Active Traffic
# =============================================================================
echo ""
echo "--- SCENARIO 1: Pod Termination ---"
echo "[INJECT] Deleting one backend pod..."
kubectl delete pod -n "$NAMESPACE" -l app=lifelink-backend --force --grace-period=0 \
  --field-selector=status.phase=Running 2>/dev/null | head -1 || echo "[INFO] No pod to delete."

sleep 5
check_health "After Pod Termination"
echo "[EXPECT] HPA + Ingress routes traffic to surviving pods. Request loss < 1%."

# =============================================================================
# SCENARIO 2: Redis Outage
# =============================================================================
echo ""
echo "--- SCENARIO 2: Redis Unavailability ---"
echo "[INJECT] Scaling Redis down to 0 replicas..."
kubectl scale deployment redis -n "$NAMESPACE" --replicas=0 2>/dev/null || echo "[INFO] No redis deployment found, check StatefulSet."
kubectl scale statefulset redis -n "$NAMESPACE" --replicas=0 2>/dev/null || true

sleep "$SLEEP_RECOVER"
check_health "After Redis Outage" "200"
echo "[EXPECT] App returns 200 on health check. Auth/rate-limit services degrade gracefully."
echo "[VERIFY] Manually confirm no 500 errors on /api/inventory/search or /api/auth/login."

echo "[RESTORE] Scaling Redis back to 1..."
kubectl scale deployment redis -n "$NAMESPACE" --replicas=1 2>/dev/null || true
kubectl scale statefulset redis -n "$NAMESPACE" --replicas=1 2>/dev/null || true

# =============================================================================
# SCENARIO 3: RabbitMQ Outage
# =============================================================================
echo ""
echo "--- SCENARIO 3: RabbitMQ Unavailability ---"
echo "[INJECT] Scaling RabbitMQ down to 0 replicas..."
kubectl scale deployment rabbitmq -n "$NAMESPACE" --replicas=0 2>/dev/null || true
kubectl scale statefulset rabbitmq -n "$NAMESPACE" --replicas=0 2>/dev/null || true

sleep "$SLEEP_RECOVER"
check_health "After RabbitMQ Outage" "200"
echo "[EXPECT] API returns 200. Blood requests succeed. Notifications are queued on reconnect."
echo "[VERIFY] /health/ready may return 503. Business transactions (inventory, requests) must not fail."

echo "[RESTORE] Scaling RabbitMQ back to 1..."
kubectl scale deployment rabbitmq -n "$NAMESPACE" --replicas=1 2>/dev/null || true
kubectl scale statefulset rabbitmq -n "$NAMESPACE" --replicas=1 2>/dev/null || true

# =============================================================================
# SCENARIO 4: Rolling Restart
# =============================================================================
echo ""
echo "--- SCENARIO 4: Rolling Restart (kubectl rollout restart) ---"
echo "[INJECT] Triggering rolling restart of backend deployment..."
kubectl rollout restart deployment/lifelink-backend -n "$NAMESPACE"
kubectl rollout status deployment/lifelink-backend -n "$NAMESPACE" --timeout=120s

check_health "After Rolling Restart"
echo "[EXPECT] Zero downtime. All replicas replaced with healthy pods."

# =============================================================================
# SCENARIO 5: Database Failover Simulation
# =============================================================================
echo ""
echo "--- SCENARIO 5: Database Failover (Simulate Primary Reboot) ---"
echo "[NOTE] This triggers an RDS manual reboot in staging, not production."
echo "[MANUAL] Run: aws rds reboot-db-instance --db-instance-identifier lifelink-staging-db"
echo "[EXPECT] Connection pool reconnects within 30s. Read replica routes read traffic."
echo "[EXPECT] Write operations return 503 briefly; retry mechanism handles requeue."
echo "[MANUAL] Verify recovery by checking /health/ready returns 200 within 60s post-reboot."

# =============================================================================
# SCENARIO 6: PITR (Point-in-Time Recovery) Restore Validation
# =============================================================================
echo ""
echo "--- SCENARIO 6: Point-in-Time Recovery Runbook ---"
echo "[RUNBOOK]"
echo "  1. Identify the target restore time: RESTORE_TIME=<ISO-8601 timestamp>"
echo "  2. Run: aws rds restore-db-instance-to-point-in-time \\"
echo "         --source-db-instance-identifier lifelink-staging-db \\"
echo "         --target-db-instance-identifier lifelink-staging-db-restored \\"
echo "         --restore-time \$RESTORE_TIME"
echo "  3. Wait for new instance to enter 'available' state."
echo "  4. Update DATABASE_URL in Secrets Manager to point to restored instance."
echo "  5. Restart backend pods to reload the new connection string."
echo "  6. Verify /health/ready returns 200 and run: npm run test"
echo ""
echo "[EXPECT] RTO < 30 minutes | RPO = near-zero with automated snapshots every 5 minutes."

# =============================================================================
# SCENARIO 7: Stale Cache (Redis TTL Flush)
# =============================================================================
echo ""
echo "--- SCENARIO 7: Stale Cache Flush ---"
echo "[INJECT] Flushing all Redis keys in staging..."
kubectl exec -n "$NAMESPACE" -it \
  "$(kubectl get pod -n "$NAMESPACE" -l app=redis -o jsonpath='{.items[0].metadata.name}')" \
  -- redis-cli FLUSHALL 2>/dev/null || echo "[WARN] Could not exec into Redis pod."

sleep 5
check_health "After Cache Flush"
echo "[EXPECT] App continues normally, rehydrating cache from DB on next requests."

# =============================================================================
# SCENARIO 8: Bad Deployment Rollback
# =============================================================================
echo ""
echo "--- SCENARIO 8: Automatic Rollback from Bad Deployment ---"
echo "[NOTE] Simulate a bad image by deploying a broken tag..."
kubectl set image deployment/lifelink-backend \
  backend-api=nginx:invalid-image-tag -n "$NAMESPACE" 2>/dev/null || echo "[INFO] Skipping — test manually."

sleep 20
echo "[INJECT] Checking rollout status for crash loop detection..."
kubectl rollout status deployment/lifelink-backend -n "$NAMESPACE" --timeout=60s 2>&1 || true

echo "[RESTORE] Rolling back to last known good revision..."
kubectl rollout undo deployment/lifelink-backend -n "$NAMESPACE"
kubectl rollout status deployment/lifelink-backend -n "$NAMESPACE" --timeout=120s

check_health "After Rollback"
echo "[EXPECT] Previous stable release restored automatically within 2 minutes."

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "========================================================"
echo " Chaos Engineering Scenarios Completed"
echo "========================================================"
echo ""
echo " Scenario Results:"
echo "  [1] Pod termination:       HPA + Ingress re-routing expected"
echo "  [2] Redis outage:          Graceful degradation expected"
echo "  [3] RabbitMQ outage:       Non-blocking enqueue expected"
echo "  [4] Rolling restart:       Zero downtime expected"
echo "  [5] DB failover:           30s reconnect pool expected"
echo "  [6] PITR restore runbook:  RTO < 30m | RPO ~ 0"
echo "  [7] Cache flush:           Cache rehydration expected"
echo "  [8] Bad deployment rollback: Auto-undo expected"
echo ""
echo " IMPORTANT: Review pod logs via: kubectl logs -n $NAMESPACE -l app=lifelink-backend --tail=200"
echo " IMPORTANT: Review inventory integrity: SELECT COUNT(*) FROM blood_inventory WHERE units < 0"
echo "========================================================"
