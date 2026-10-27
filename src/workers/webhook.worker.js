import "dotenv/config";
import { pool } from "../database/pool.js";

const POLL_INTERVAL_MS = 1000;
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;
const STALE_JOB_SECONDS = 60;

let isStopping = false;
let isPolling = false;

async function claimNextJob() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(`
      SELECT id, destination_url, destination_host,
             payload, attempt_count, max_attempts
      FROM webhook_jobs
      WHERE status IN ('QUEUED', 'RETRYING')
        AND next_attempt_at <= NOW()
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (result.rowCount === 0) {
      await client.query("COMMIT");
      return null;
    }

    const job = result.rows[0];

    await client.query(
      `INSERT INTO destination_rate_limits
         (destination_host, window_started_at, request_count)
       VALUES ($1, NOW(), 0)
       ON CONFLICT (destination_host) DO NOTHING`,
      [job.destination_host],
    );

    const limitResult = await client.query(
      `SELECT window_started_at, request_count
       FROM destination_rate_limits
       WHERE destination_host = $1
       FOR UPDATE`,
      [job.destination_host],
    );

    let windowStart = new Date(limitResult.rows[0].window_started_at);
    let requestCount = Number(limitResult.rows[0].request_count);

    if (Date.now() - windowStart.getTime() >= RATE_WINDOW_SECONDS * 1000) {
      windowStart = new Date();

      await client.query(
        `UPDATE destination_rate_limits
         SET window_started_at = NOW(), request_count = 0
         WHERE destination_host = $1`,
        [job.destination_host],
      );

      requestCount = 0;
    }

    if (requestCount >= RATE_LIMIT) {
      const nextAttemptAt = new Date(
        windowStart.getTime() + RATE_WINDOW_SECONDS * 1000,
      );

      await client.query(
        `UPDATE webhook_jobs
         SET next_attempt_at = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [nextAttemptAt, job.id],
      );

      await client.query("COMMIT");
      return null;
    }

    await client.query(
      `UPDATE destination_rate_limits
       SET request_count = request_count + 1
       WHERE destination_host = $1`,
      [job.destination_host],
    );

    const attemptNumber = Number(job.attempt_count) + 1;

    await client.query(
      `UPDATE webhook_jobs
       SET status = 'PROCESSING',
           attempt_count = $1,
           locked_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [attemptNumber, job.id],
    );

    const attemptResult = await client.query(
      `INSERT INTO delivery_attempts
         (job_id, attempt_number, status)
       VALUES ($1, $2, 'RETRYING')
       RETURNING id`,
      [job.id, attemptNumber],
    );

    await client.query("COMMIT");

    return {
      ...job,
      attempt_count: attemptNumber,
      attempt_id: attemptResult.rows[0].id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function finalizeAttempt(job, attemptStatus, httpStatus, errorMessage) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE delivery_attempts
       SET status = $1,
           http_status = $2,
           error_message = $3,
           completed_at = NOW()
       WHERE id = $4`,
      [attemptStatus, httpStatus, errorMessage, job.attempt_id],
    );

    await client.query(
      `UPDATE webhook_jobs
       SET status = $1,
           next_attempt_at = CASE
             WHEN $5 = TRUE
             THEN NOW() + ($2 * INTERVAL '1 second')
             ELSE next_attempt_at
           END,
           locked_at = NULL,
           last_error = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [
        attemptStatus,
        2 ** job.attempt_count,
        errorMessage,
        job.id,
        attemptStatus === "RETRYING",
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function recoverStaleJobs() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const staleJobs = await client.query(
      `SELECT id, attempt_count, max_attempts
       FROM webhook_jobs
       WHERE status = 'PROCESSING'
         AND locked_at < NOW() - ($1 * INTERVAL '1 second')
       FOR UPDATE SKIP LOCKED`,
      [STALE_JOB_SECONDS],
    );

    for (const job of staleJobs.rows) {
      const finalStatus =
        Number(job.attempt_count) <= Number(job.max_attempts)
          ? "RETRYING"
          : "FAILED";

      await client.query(
        `UPDATE delivery_attempts
         SET status = 'FAILED',
             error_message = 'Worker lease expired',
             completed_at = NOW()
         WHERE job_id = $1
           AND attempt_number = $2
           AND completed_at IS NULL`,
        [job.id, job.attempt_count],
      );

      await client.query(
        `UPDATE webhook_jobs
         SET status = $1,
             next_attempt_at = NOW(),
             locked_at = NULL,
             last_error = 'Worker lease expired',
             updated_at = NOW()
         WHERE id = $2`,
        [finalStatus, job.id],
      );
    }

    await client.query("COMMIT");

    if (staleJobs.rowCount > 0) {
      console.log(`Recovered ${staleJobs.rowCount} stale job(s).`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deliverJob(job) {
  let responseStatus = null;
  let errorMessage = null;

  try {
    console.log(`Delivering job ${job.id} to ${job.destination_url}`);

    const response = await fetch(job.destination_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.payload),
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
    });

    responseStatus = response.status;

    if (response.ok) {
      await finalizeAttempt(job, "SUCCESS", responseStatus, null);
      console.log(`Job ${job.id} delivered on attempt ${job.attempt_count}.`);
      return;
    }

    errorMessage = `Destination returned HTTP ${responseStatus}`;
  } catch (error) {
    errorMessage = error.message;
  }

  const shouldRetry =
    job.attempt_count <= Number(job.max_attempts) &&
    (
      responseStatus === null ||
      responseStatus === 429 ||
      responseStatus >= 500
    );

  const finalStatus = shouldRetry ? "RETRYING" : "FAILED";

  await finalizeAttempt(job, finalStatus, responseStatus, errorMessage);

  console.log(
    `Job ${job.id}: attempt ${job.attempt_count}, ` +
    `HTTP ${responseStatus ?? "network/timeout error"}, ${finalStatus}.`,
  );
}

async function poll() {
  if (isPolling || isStopping) return;

  isPolling = true;

  try {
    const job = await claimNextJob();

    if (job) {
      await deliverJob(job);
    }
  } catch (error) {
    console.error("Worker iteration failed:", error);
  } finally {
    isPolling = false;
  }
}

function handleShutdown(signal) {
  console.log(`${signal} received. Worker will stop after current operation.`);
  isStopping = true;
}

process.once("SIGINT", () => handleShutdown("SIGINT"));
process.once("SIGTERM", () => handleShutdown("SIGTERM"));

async function main() {
  console.log("Webhook worker started.");

  try {
    await recoverStaleJobs();

    while (!isStopping) {
      await poll();

      if (!isStopping) {
        await new Promise((resolve) =>
          setTimeout(resolve, POLL_INTERVAL_MS),
        );
      }
    }
  } finally {
    await pool.end();
    console.log("Webhook worker stopped.");
  }
}

main().catch((error) => {
  console.error("Webhook worker failed:", error);
  process.exitCode = 1;
});
