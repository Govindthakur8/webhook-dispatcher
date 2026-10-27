import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import app from "../../src/app.js";

async function startTestServer() {
  const server = app.listen(0);
  await once(server, "listening");

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

test("GET /health returns HTTP 200 and service status", async (t) => {
  const { server, baseUrl } = await startTestServer();

  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "webhook-dispatcher",
  });
});

test("unknown routes return HTTP 404", async (t) => {
  const { server, baseUrl } = await startTestServer();

  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const response = await fetch(`${baseUrl}/does-not-exist`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: null,
    isSuccess: false,
    statusCode: 404,
    message: "Route not found: GET /does-not-exist",
  });
});
