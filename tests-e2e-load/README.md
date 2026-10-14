# Rakthayatra — E2E & Load Testing

Production-grade automated testing layer for the Rakthayatra (LifeLink) platform.

---

## Contents

```
tests-e2e-load/
├── playwright/
│   ├── helpers.ts         # Shared login, logout, toast helpers
│   ├── donor.spec.ts      # Donor journey: register, OTP, login, eligibility, donations, logout
│   ├── patient.spec.ts    # Patient journey: login, blood request, emergency map, IDOR, logout
│   ├── hospital.spec.ts   # Hospital journey: login, dashboard, request approval, inventory
│   ├── bloodbank.spec.ts  # Blood Bank journey: login, stock register, sweep, camps, fulfill
│   ├── admin.spec.ts      # Admin journey: dashboard, users, requests, inventory, camps
│   └── security.spec.ts   # Security: unauth redirects, XSS, open redirect, IDOR, rate limit
├── k6/
│   ├── load-test.js       # Sustained 50 VU load test with p95 < 800ms threshold
│   └── stress-test.js     # Spike to 300 VU stress test with business safety invariant checklist
├── chaos/
│   └── chaos_run.sh       # 8-scenario chaos/DR validation script (staging only)
├── playwright.config.ts   # Playwright config (Chromium, Firefox, Mobile Safari)
└── package.json
```

---

## Prerequisites

| Tool | Install |
|------|---------|
| Node 20+ | [nodejs.org](https://nodejs.org) |
| k6 | [k6.io/docs/get-started/installation](https://k6.io/docs/get-started/installation/) |
| Playwright browsers | `npx playwright install chromium` |

---

## E2E Tests (Playwright)

Playwright specs run against a live frontend + backend. Start both before running:

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev

# Terminal 3 — run E2E
cd tests-e2e-load
npx playwright test
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Frontend URL |
| `API_URL` | `http://localhost:5000` | Backend API URL |

### Spec Files

| File | Journeys covered |
|------|-----------------|
| `donor.spec.ts` | Registration, OTP, login, eligibility, donations, camps, logout |
| `patient.spec.ts` | Login, blood request, emergency map, unauthorized access, IDOR, logout |
| `hospital.spec.ts` | Login, dashboard, approve requests, inventory, camps, profile, logout |
| `bloodbank.spec.ts` | Login, stock register, inventory listing, sweep, camps, fulfill, logout |
| `admin.spec.ts` | Login, dashboard, user panel, requests, inventory, camps, logout |
| `security.spec.ts` | Unauth redirect, cross-role block, IDOR, XSS, open redirect, rate limit |

### Reports

```bash
npx playwright show-report
```

---

## Load Test (k6)

```bash
# Default (localhost)
k6 run k6/load-test.js

# Against staging
API_URL=https://api.staging.lifelink.org k6 run k6/load-test.js
```

**Thresholds:**
- `p(95) < 800ms` on all HTTP requests
- Error rate `< 1%`

---

## Stress Test (k6)

```bash
k6 run k6/stress-test.js
```

**Stages:** 100 VU sustained → 300 VU spike → recovery

**After the run, verify business safety invariants:**
```sql
-- No negative inventory
SELECT COUNT(*) FROM blood_inventory WHERE units < 0;

-- No duplicate reservations
SELECT reservation_id, COUNT(*) FROM blood_inventory
GROUP BY reservation_id HAVING COUNT(*) > 1;
```

---

## Chaos / DR Validation

```bash
# Requires: kubectl configured against staging namespace
STAGING_NAMESPACE=lifelink-staging \
STAGING_API_URL=https://api.staging.lifelink.org \
bash chaos/chaos_run.sh
```

Scenarios: pod termination, Redis outage, RabbitMQ outage, rolling restart,
DB failover, PITR runbook, cache flush, bad-deploy rollback.
