import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const dashboardDuration = new Trend('dashboard_duration');

const BASE_URL = __ENV.SUPABASE_URL || 'https://uowjtrzmszuaiokqxgir.supabase.co';
const SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY || '';

export const options = {
  scenarios: {
    dashboard_load: {
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
  const res = http.post(
    `${BASE_URL}/functions/v1/dashboard-data`,
    JSON.stringify({}),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      tags: { name: 'dashboard-data' },
    }
  );

  check(res, {
    'dashboard returns 200 or 401': (r) => r.status === 200 || r.status === 401,
    'dashboard responds under 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(res.status >= 500);
  dashboardDuration.add(res.timings.duration);
  sleep(Math.random() * 2 + 1);
}
