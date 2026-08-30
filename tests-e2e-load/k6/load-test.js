/**
 * Rakthayatra — k6 Load Test
 *
 * Simulates steady concurrent traffic across all major API endpoints.
 *
 * STAGES:
 *   - Ramp to 50 VUs over 1 minute (warm-up)
 *   - Hold 50 VUs for 5 minutes (sustained load)
 *   - Ramp down over 30 seconds
 *
 * THRESHOLDS:
 *   - p95 response time < 800ms for all HTTP requests
 *   - Error rate < 1% (excluding expected 4xx on protected endpoints)
 *
 * USAGE:
 *   k6 run k6/load-test.js
 *   k6 run -e API_URL=https://api.staging.lifelink.org k6/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const API_URL = __ENV.API_URL || 'http://localhost:5000';
const DONOR_EMAIL    = __ENV.DONOR_EMAIL    || 'donor@lifelink.org';
const DONOR_PASSWORD = __ENV.DONOR_PASSWORD || 'Donor@123456';
const PATIENT_EMAIL    = __ENV.PATIENT_EMAIL    || 'patient@lifelink.org';
const PATIENT_PASSWORD = __ENV.PATIENT_PASSWORD || 'Patient@123456';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate    = new Rate('http_error_rate');
const loginLatency = new Trend('login_latency_ms', true);
const searchLatency = new Trend('inventory_search_latency_ms', true);

// ---------------------------------------------------------------------------
// k6 test options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '60s',  target: 50  }, // Ramp-up
    { duration: '5m',   target: 50  }, // Sustained load
    { duration: '30s',  target: 0   }, // Ramp-down
  ],
  thresholds: {
    http_req_duration:          ['p(95)<800'],   // 95th pct < 800ms
    http_error_rate:            ['rate<0.01'],   // Error rate < 1%
    login_latency_ms:           ['p(95)<1000'],
    inventory_search_latency_ms: ['p(95)<600'],
  },
};

// ---------------------------------------------------------------------------
// Authentication helper
// ---------------------------------------------------------------------------
function getToken(email, password) {
  const res = http.post(
    `${API_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  loginLatency.add(res.timings.duration);
  check(res, { 'login 200': (r) => r.status === 200 });
  if (res.status !== 200) return null;
  return res.json('data.accessToken');
}

// ---------------------------------------------------------------------------
// Virtual User scenario
// ---------------------------------------------------------------------------
export default function () {
  // Alternate between donor and patient roles across VUs
  const isDonor = __VU % 2 === 0;
  const token = isDonor
    ? getToken(DONOR_EMAIL, DONOR_PASSWORD)
    : getToken(PATIENT_EMAIL, PATIENT_PASSWORD);

  if (!token) {
    errorRate.add(1);
    sleep(2);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // -------------------------------------------------------------------------
  // Group 1: Health checks
  // -------------------------------------------------------------------------
  group('Health Checks', () => {
    const live  = http.get(`${API_URL}/health/live`);
    const ready = http.get(`${API_URL}/health/ready`);
    check(live,  { 'liveness 200':  (r) => r.status === 200 });
    check(ready, { 'readiness 200': (r) => r.status === 200 });
    errorRate.add(live.status !== 200);
    errorRate.add(ready.status !== 200);
  });

  sleep(0.5);

  // -------------------------------------------------------------------------
  // Group 2: Auth — profile fetch
  // -------------------------------------------------------------------------
  group('Auth — Profile', () => {
    const me = http.get(`${API_URL}/api/auth/me`, { headers });
    check(me, { 'GET /me 200': (r) => r.status === 200 });
    errorRate.add(me.status !== 200);
  });

  sleep(0.5);

  // -------------------------------------------------------------------------
  // Group 3: Inventory search
  // -------------------------------------------------------------------------
  group('Inventory Search', () => {
    const start = Date.now();
    const res = http.get(`${API_URL}/api/inventory?bloodGroup=O_POS&status=AVAILABLE`, { headers });
    searchLatency.add(Date.now() - start);
    check(res, { 'inventory search 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  sleep(0.5);

  // -------------------------------------------------------------------------
  // Group 4: Blood requests list
  // -------------------------------------------------------------------------
  group('Blood Requests — List', () => {
    const res = http.get(`${API_URL}/api/requests`, { headers });
    check(res, { 'GET /requests 200 or 403': (r) => [200, 403].includes(r.status) });
  });

  sleep(0.5);

  // -------------------------------------------------------------------------
  // Group 5: Donation camps listing
  // -------------------------------------------------------------------------
  group('Donation Camps', () => {
    const res = http.get(`${API_URL}/api/camps`, { headers });
    check(res, { 'GET /camps 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  sleep(1);
}
