import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 200,
  iterations: 200,
  thresholds: {
    checks: ['rate>0.99'],
    http_req_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  const response = http.get(`${BASE_URL}/auth/health`);
  check(response, {
    'status is 200 or 429': (res) => res.status === 200 || res.status === 429,
    '429 has clear message': (res) => res.status !== 429 || res.body.includes('Too many requests'),
  });
}
