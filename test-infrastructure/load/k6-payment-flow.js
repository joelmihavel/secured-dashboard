import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const paymentDuration = new Trend('payment_duration');

const BASE_URL = __ENV.SUPABASE_URL || 'https://uowjtrzmszuaiokqxgir.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY || '';

export const options = {
  scenarios: {
    ramp_to_5k: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 5000 },
        { duration: '5m', target: 5000 },  // sustain
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
};

export default function () {
  // Step 1: Initiate payment
  const initiateRes = http.post(
    `${BASE_URL}/functions/v1/initiate-payment`,
    JSON.stringify({
      amount: Math.floor(Math.random() * 50000) + 5000,
      payment_method: 'upi',
      upi_vpa: `loadtest${__VU}@ybl`,
    }),
    { headers, tags: { name: 'initiate-payment' } }
  );

  check(initiateRes, {
    'initiate status is 200': (r) => r.status === 200,
    'initiate has transaction_id': (r) => {
      try { return JSON.parse(r.body).transaction_id !== undefined; }
      catch { return false; }
    },
  });

  errorRate.add(initiateRes.status !== 200);
  paymentDuration.add(initiateRes.timings.duration);

  sleep(Math.random() * 2 + 1);

  // Step 2: Check payment status
  const statusRes = http.post(
    `${BASE_URL}/functions/v1/check-payment-status`,
    JSON.stringify({ transaction_id: 'load-test-txn' }),
    { headers, tags: { name: 'check-payment-status' } }
  );

  check(statusRes, {
    'status check returns 200 or 400': (r) => r.status === 200 || r.status === 400,
  });

  sleep(Math.random() * 1);
}
