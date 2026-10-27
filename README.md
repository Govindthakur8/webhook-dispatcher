# Distributed Webhook Dispatcher

A Node.js and PostgreSQL-based webhook dispatcher that accepts webhook events, queues them for asynchronous delivery, retries failed deliveries with exponential backoff, and applies per-destination rate limiting.

## Features

- REST API for submitting webhook events.
- Asynchronous delivery using a background worker.
- PostgreSQL-backed job queue.
- Retry handling for HTTP 5xx, HTTP 429, and network/timeout errors.
- Exponential retry backoff: 2, 4, and 8 seconds.
- Delivery-attempt logging with HTTP status and error details.
- Per-destination rate limiting.
- Health-check endpoint.
- Request validation and structured API responses.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- `pg` for database access
- `node-pg-migrate` for database migrations

## Prerequisites

- Node.js
- PostgreSQL
- npm

## Setup

Clone the repository:

```bash
git clone https://github.com/Govindthakur8/webhook-dispatcher.git
cd webhook-dispatcher
npm install
```

Create a `.env` file in the project root using `.env.example` as a reference. Configure the PostgreSQL connection details and the required environment variables.

Run database migrations:

```bash
npm run db:migrate
```

## Run Locally

Start the API:

```bash
npm run dev
```

Start the background worker in a separate terminal:

```bash
npm run worker
```

The API runs on port `3000` by default.

## API Endpoints

### Health Check

```http
GET /health
```

Example:

```bash
curl http://localhost:3000/health
```

### Dispatch a Webhook

```http
POST /api/webhooks/dispatch
Content-Type: application/json
```

Request body:

```json
{
  "destinationUrl": "https://example.com/webhook",
  "eventId": "evt_001",
  "payload": {
    "event": "user.signup",
    "userId": "usr_123"
  }
}
```

Example using curl:

```bash
curl -X POST http://localhost:3000/api/webhooks/dispatch \
  -H "Content-Type: application/json" \
  -d '{"destinationUrl":"https://example.com/webhook","eventId":"evt_001","payload":{"event":"user.signup","userId":"usr_123"}}'
```

Successful response: HTTP `202 Accepted`

```json
{
  "status": "queued",
  "jobId": "generated-job-uuid"
}
```

The API responds after queuing the job. The background worker performs the downstream HTTP request separately.

## Retry Behavior

Failed deliveries are retried with exponential backoff for retryable failures, including HTTP 5xx, HTTP 429, and network or timeout errors.

The configured delays are 2, 4, and 8 seconds, with up to three retries after the initial attempt.

## Rate Limiting

The worker enforces a per-destination-host rate limit of 10 requests per 60-second window.

## Tests

Run the automated test suite:

```bash
npm test
```

## Project Structure

```text
src/
  app.js
  server.js
  database/
  middleware/
  modules/
  utils/
  workers/
scripts/
tests/
```

## Architecture

1. The client submits a webhook event to the dispatch API.
2. The API validates the request and persists the job in PostgreSQL.
3. The API returns HTTP 202 with the generated job ID.
4. A separate background worker claims queued jobs and sends HTTP POST requests to their destinations.
5. The worker records delivery attempts and schedules retries when applicable.
6. A per-destination rate limiter controls delivery frequency.

## Environment Variables

See `.env.example` for the required configuration. Do not commit `.env` or real credentials.

## Deployment

Deploy the API and background worker as separate processes/services using the same PostgreSQL database. Configure the required environment variables on the hosting platform and run database migrations before starting the services.
