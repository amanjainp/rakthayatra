/**
 * Rakthayatra — k6 Stress Test
 *
 * Pushes the API beyond normal operating capacity to identify breaking points.
 *
 * STAGES:
 *   - Rapid ramp to 100 VUs in 30s
 *   - Hold at 100 VUs for 2 minutes (stress level)
 *   - Spike to 300 VUs for 1 minute (peak spike)
 *   - Return to 100 VUs for 2 minutes (recovery observation)
 *   - Ramp down over 30 seconds
 *
 * THRESHOLDS (deliberately lenient for stress):
 *   - p99 < 3 000ms (service must not time out entirely)
 *   - Error rate < 10% under stress (some errors acceptable)
 *
 * USAGE:
 *   k6 run k6/stress-test.js
 *   k6 run -e API_URL=https://api.staging.lifelink.org k6/stress-test.js
 *
 * BUSINESS SAFETY INVARIANTS (verify manually after run):
 *   - No negative inventory in blood_inventory table
 *   - No duplicate reservation of the same blood unit
 *   - No plaintext PII in logs
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const API_URL = __ENV.API_URL || 'http://localhost:5000';
const DONOR_EMAIL    = __ENV.DONOR_EMAIL    || 'donor@lifelink.org';
const DONOR_PASSWORD = __ENV.DONOR_PASSWORD || 'Donor@123456';
const ADMIN_EMAIL    = __ENV.ADMIN_EMAIL    || 'admin@lifelink.org';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Admin@123456';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate        = new Rate('http_error_rate');
const serverErrorCount = new Counter('http_5xx_count');
const peakLatency      = new Trend('peak_response_latency_ms', true);

// ---------------------------------------------------------------------------
// k6 test options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Rapid ramp to stress
    { duration: '2m',  target: 100 }, // Sustain stress
    { duration: '60s', target: 300 }, // Spike burst
    { duration: '2m',  target: 100 }, // Recovery
    { duration: '30s', target: 0   }, // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'],  // Must not time out under stress
    http_error_rate:   ['rate<0.10'],   // < 10% errors acceptable under stress
    http_5xx_count:    ['count<100'],   // Max 100 server errors before alert
  },
};

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
function getToken(email, password) {
  const res = http.post(
    `${API_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status === 429) {
    // Rate limited — back off
    sleep(3);
    return null;
  }
  if (res.status !== 200) return null;
  return res.json('data.accessToken');
}

// ---------------------------------------------------------------------------
// Virtual User scenario
// ---------------------------------------------------------------------------
export default function () {
  const email    = __VU % 5 === 0 ? ADMIN_EMAIL    : DONOR_EMAIL;
  const password = __VU % 5 === 0 ? ADMIN_PASSWORD : DONOR_PASSWORD;
  const token = getToken(email, password);

  if (!token) {
    errorRate.add(1);
    sleep(1);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // -------------------------------------------------------------------------
  // Group 1: Concurrent inventory reads
  // -------------------------------------------------------------------------
  group('Inventory — Concurrent Read', () => {
    const res = http.get(`${API_URL}/api/inventory?bloodGroup=AB_POS`, { headers });
    peakLatency.add(res.timings.duration);
    check(res, { 'inventory read 200': (r) => r.status === 200 });
    if (res.status >= 500) serverErrorCount.add(1);
    errorRate.add(res.status >= 500);
  });

  sleep(0.2);

  // -------------------------------------------------------------------------
  // Group 2: Concurrent blood request creation
  // -------------------------------------------------------------------------
  group('Blood Request — Create Under Load', () => {
    const payload = JSON.stringify({
      bloodGroup: 'O_NEG',
      unitsRequired: 1,
      urgency: 'STANDARD',
      locationName: `Stress Test Hospital ${__VU}`,
      latitude:  12.97 + (__VU * 0.001),
      longitude: 77.59 + (__VU * 0.001),
    });
    const res = http.post(`${API_URL}/api/requests`, payload, { headers });
    peakLatency.add(res.timings.duration);
    check(res, { 'create request 201 or 429': (r) => [201, 429].includes(r.status) });
    if (res.status >= 500) serverErrorCount.add(1);
    errorRate.add(res.status >= 500);
  });

  sleep(0.2);

  // -------------------------------------------------------------------------
  // Group 3: Health readiness probe
  // -------------------------------------------------------------------------
  group('Readiness Probe', () => {
    const res = http.get(`${API_URL}/health/ready`);
    check(res, { 'ready 200': (r) => r.status === 200 });
    // Under spike, readiness may degrade — only count 5xx as errors
    if (res.status >= 500) serverErrorCount.add(1);
  });

  sleep(0.3);

  // -------------------------------------------------------------------------
  // Group 4: Concurrent donor matching query
  // -------------------------------------------------------------------------
  group('Donor Matching — Search Under Load', () => {
    const res = http.get(`${API_URL}/api/inventory?status=AVAILABLE&bloodGroup=B_NEG`, { headers });
    peakLatency.add(res.timings.duration);
    check(res, { 'search 200': (r) => r.status === 200 });
    if (res.status >= 500) serverErrorCount.add(1);
  });

  sleep(0.3);
}

// ---------------------------------------------------------------------------
// Summary handler — prints business safety reminders at end
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  const failedThresholds = Object.entries(data.metrics)
    .filter(([, v]) => v.thresholds && Object.values(v.thresholds).some((t) => !t.ok))
    .map(([k]) => k);

  const summary = {
    title: 'Rakthayatra Stress Test Summary',
    totalRequests: data.metrics.http_reqs?.values?.count ?? 0,
    p95latency: data.metrics.http_req_duration?.values?.['p(95)'] ?? 0,
    p99latency: data.metrics.http_req_duration?.values?.['p(99)'] ?? 0,
    errorRate: (data.metrics.http_error_rate?.values?.rate ?? 0) * 100,
    server5xxCount: data.metrics.http_5xx_count?.values?.count ?? 0,
    failedThresholds,
    businessSafetyChecklist: [
      'Verify: SELECT COUNT(*) FROM blood_inventory WHERE units < 0 → should be 0',
      'Verify: No duplicate reservation_id in blood_inventory',
      'Verify: No PII in application logs (grep for email/name patterns)',
      'Verify: /health/ready returns 200 after ramp-down',
    ],
  };

  console.log('\n' + JSON.stringify(summary, null, 2));

  return {
    'stress-test-summary.json': JSON.stringify(summary, null, 2),
  };
}
