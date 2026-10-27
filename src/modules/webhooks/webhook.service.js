
import { pool } from '../../database/pool.js';

export async function createWebhookJob({
  destinationUrl,
  eventId,
  payload,
}) {
  const destination = new URL(destinationUrl);

  const result = await pool.query(
    `INSERT INTO webhook_jobs (
       event_id,
       destination_url,
       destination_host,
       payload,
       status
     )
     VALUES ($1, $2, $3, $4, 'QUEUED')
     RETURNING id, status`,
    [
      eventId.trim(),
      destinationUrl,
      destination.hostname.toLowerCase(),
      JSON.stringify(payload),
    ],
  );

  return result.rows[0];
}
