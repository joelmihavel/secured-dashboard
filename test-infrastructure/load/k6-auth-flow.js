import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.SUPABASE_URL || 'https://uowjtrzmszuaiokqxgir.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';

export const options = {
  scenarios: {
    auth_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 500 },
        { duration: '3m', target: 2000 },
        { duration: '5m', target: 5000 },
        { duration: '3m', target: 5000 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  const phone = `+91999990${String(__VU).padStart(4, '0')}`;

  const res = http.post(
    `${BASE_URL}/functions/v1/auth-otp`,
    JSON.stringify({ phone, action: 'send' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      tags: { name: 'auth-otp-send' },
    }
  );

  check(res, {
    'OTP send returns 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  errorRate.add(res.status >= 500);
  sleep(Math.random() * 2 + 1);
}
