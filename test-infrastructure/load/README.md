# Load Testing (k6)

## Prerequisites
- Install k6: `brew install k6`
- Set environment variables

## Usage
```bash
# Payment flow (ramp to 5K users)
k6 run --env SUPABASE_URL=https://zqlowjveyqiagnbmfwsb.supabase.co \
       --env SUPABASE_SERVICE_KEY=<key> \
       test-infrastructure/load/k6-payment-flow.js

# Auth flow
k6 run --env SUPABASE_URL=... --env SUPABASE_ANON_KEY=<key> \
       test-infrastructure/load/k6-auth-flow.js

# Dashboard
k6 run --env SUPABASE_URL=... --env SUPABASE_SERVICE_KEY=<key> \
       test-infrastructure/load/k6-dashboard.js
```

## Thresholds
- p95 response time < 2 seconds
- Error rate < 1%
- No 503 errors under 5K concurrent users
