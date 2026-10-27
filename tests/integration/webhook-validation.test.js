import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../../src/app.js';

async function startTestServer() {
  const server = app.listen(0);
  await once(server, 'listening');

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

test('dispatch rejects an empty request with HTTP 400', async (t) => {
  const { server, baseUrl } = await startTestServer();

  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const response = await fetch(`${baseUrl}/api/webhooks/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: [
      {
        field: 'destinationUrl',
        message: 'Destination URL is required',
      },
      {
        field: 'eventId',
        message: 'Event ID is required',
      },
      {
        field: 'payload',
        message: 'Payload must be a JSON object',
      },
    ],
    isSuccess: false,
    statusCode: 400,
    message: 'Invalid request parameters',
  });
});
