import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../../src/app.js';
import { pool } from '../../src/database/pool.js';

async function startTestServer() {
  const server = app.listen(0);
  await once(server, 'listening');

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

test('valid dispatch persists a job and returns HTTP 202', async (t) => {
  const { server, baseUrl } = await startTestServer();

  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const eventId = `evt_test_${Date.now()}`;

  const response = await fetch(`${baseUrl}/api/webhooks/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://example.com/webhook',
      eventId,
      payload: {
        event: 'user.signup',
        userId: 'usr_test_001',
      },
    }),
  });

  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.status, 'queued');
  assert.ok(body.jobId);

  const result = await pool.query(
    `SELECT id, event_id, status
     FROM webhook_jobs
     WHERE id = $1`,
    [body.jobId],
  );

  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0].event_id, eventId);
  assert.equal(result.rows[0].status, 'QUEUED');

  await pool.query(
    'DELETE FROM webhook_jobs WHERE id = $1',
    [body.jobId],
  );
});
