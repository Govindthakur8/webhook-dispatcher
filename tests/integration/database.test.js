
import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/database/pool.js';

test('PostgreSQL connection works', async () => {
  try {
    const result = await pool.query(`
      SELECT current_database() AS database_name,
             current_timestamp AS checked_at
    `);

    assert.equal(result.rows[0].database_name, 'webhook_dispatcher');
    assert.ok(result.rows[0].checked_at);
  } finally {
    await pool.end();
  }
});
