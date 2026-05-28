import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('health endpoint', () => {
  it('reports service health', async () => {
    const app = await buildApp({ databasePool: null });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports database health as unavailable when DATABASE_URL is not configured', async () => {
    const app = await buildApp({ databasePool: null });
    const response = await app.inject({ method: 'GET', url: '/health/db' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      configured: false,
      ok: false,
      error: 'DATABASE_URL is not configured'
    });
  });
});
