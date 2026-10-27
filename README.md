# Distributed Webhook Dispatcher

A Node.js and PostgreSQL-based webhook dispatcher that accepts webhook events, queues them for asynchronous delivery, retries failed deliveries with exponential backoff, and applies per-destination rate limiting.

**Live Deployment:** https://webhook-dispatcher-9yjm.onrender.com

## Features

- REST API for submitting webhook events.
- Asynchronous webhook delivery using a background worker.
- PostgreSQL-backed job queue.
- Automatic retries for HTTP 5xx, HTTP 429, network, and timeout errors.
- Exponential retry backoff with delays of 2, 4, and 8 seconds.
- Delivery-attempt logging with HTTP status and error details.
- Per-destination-host rate limiting.
- Health-check endpoint.
- Request validation and structured API responses.
- Database schema management using migrations.
- Postman collection for API testing.

## Tech Stack

- **Runtime:** Node.js
- **Backend:** Express.js
- **Database:** PostgreSQL
- **Database Client:** `pg`
- **Migrations:** `node-pg-migrate`
- **Testing:** Node.js built-in test runner
- **Deployment:** Render

## Prerequisites

- Node.js and npm
- PostgreSQL
- Git

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Govindthakur8/webhook-dispatcher.git
cd webhook-dispatcher
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root using `.env.example` as a reference.

Configure the required PostgreSQL connection details and application settings according to the environment configuration supported by the project.

Do not commit `.env` files, database passwords, or other secrets to GitHub.

### 4. Run Database Migrations

Make sure PostgreSQL is running and the configured database exists.

```bash
npm run db:migrate
```

This applies pending database migrations.

## Running Locally

Start the API server:

```bash
npm run dev
```

Start the background worker in a separate terminal:

```bash
npm run worker
```

The API uses port `3000` by default, unless overridden by the application configuration.

The API and worker must use the same PostgreSQL database.

## Live Deployment

The application is deployed on Render.

**Base URL:** https://webhook-dispatcher-9yjm.onrender.com

The deployed service runs database migrations before starting the application. The API and background worker run within the deployed service.

### Health Check

**Endpoint:** `GET /health`

```bash
curl --location 'https://webhook-dispatcher-9yjm.onrender.com/health'
```

Example response:

```json
{
  "status": "ok",
  "service": "webhook-dispatcher"
}
```

## API Documentation

### 1. Health Check

**Method:** `GET`

**Path:** `/health`

Checks whether the API is responding.

Local URL:

```text
http://localhost:3000/health
```

Live URL:

```text
https://webhook-dispatcher-9yjm.onrender.com/health
```

### 2. Dispatch a Webhook

**Method:** `POST`

**Path:** `/api/webhooks/dispatch`

**Content-Type:** `application/json`

#### Request Body

```json
{
  "destinationUrl": "https://httpbin.org/post",
  "eventId": "evt_001",
  "payload": {
    "event": "user.signup",
    "userId": "usr_123"
  }
}
```

| Field | Description |
|---|---|
| `destinationUrl` | URL of the destination that will receive the webhook |
| `eventId` | Identifier for the webhook event |
| `payload` | JSON data to send to the destination |

#### cURL Example — Live API

```bash
curl --location 'https://webhook-dispatcher-9yjm.onrender.com/api/webhooks/dispatch' \
  --header 'Content-Type: application/json' \
  --data '{
    "destinationUrl": "https://httpbin.org/post",
    "eventId": "evt_postman_001",
    "payload": {
      "message": "Testing webhook delivery",
      "source": "postman"
    }
  }'
```

#### cURL Example — Local API

```bash
curl --location 'http://localhost:3000/api/webhooks/dispatch' \
  --header 'Content-Type: application/json' \
  --data '{
    "destinationUrl": "https://httpbin.org/post",
    "eventId": "evt_local_001",
    "payload": {
      "message": "Testing local webhook delivery"
    }
  }'
```

#### Successful Response

The API returns HTTP `202 Accepted` when the webhook job has been accepted and queued.

```json
{
  "status": "queued",
  "jobId": "generated-job-uuid"
}
```

The `jobId` identifies the queued job. A `202 Accepted` response does not itself guarantee successful downstream delivery; check the application logs and delivery-attempt records for the final result.

## Postman Collection

The repository includes the Postman collection:

[`Dispatcher module assignment.postman_collection.json`](./Dispatcher%20module%20assignment.postman_collection.json)

### Import and Run

1. Clone or download this repository.
2. Open Postman.
3. Click **Import**.
4. Select the `Dispatcher module assignment.postman_collection.json` file from the project root.
5. Open the imported dispatch request.
6. Set the request URL to the live or local endpoint.
7. Send a valid JSON request body.
8. Verify the queued response and check application logs for the delivery result.

For the live deployment, use:

```text
POST https://webhook-dispatcher-9yjm.onrender.com/api/webhooks/dispatch
```

For local testing, use:

```text
POST http://localhost:3000/api/webhooks/dispatch
```

## Retry Behavior

The dispatcher retries eligible failed deliveries, including:

- HTTP 5xx responses.
- HTTP 429 responses.
- Network errors.
- Timeout errors.

The configured exponential backoff delays are:

| Retry | Delay |
|---|---:|
| First retry | 2 seconds |
| Second retry | 4 seconds |
| Third retry | 8 seconds |

The configured policy allows up to three retries after the initial attempt, for up to four delivery attempts in total.

## Rate Limiting

The worker enforces a per-destination-host rate limit of 10 requests per 60-second window.

This helps control the delivery frequency to individual destination hosts.

## Background Worker

The background worker processes queued webhook jobs asynchronously.

Its responsibilities include:

1. Claiming queued jobs.
2. Sending HTTP POST requests to destination URLs.
3. Recording delivery attempts.
4. Capturing HTTP status codes and error details.
5. Scheduling retries for eligible failures.
6. Marking successfully delivered jobs.

The worker operates against the PostgreSQL-backed queue, allowing job state and delivery-attempt information to persist in the database.

## Database Migrations

Database schema changes are managed through `node-pg-migrate`.

Run pending migrations with:

```bash
npm run db:migrate
```

Migrations are also executed during the deployed service's startup process.

## Tests

Run the automated test suite:

```bash
npm test
```

The test suite uses Node.js's built-in test runner.

The local test suite has passed all five tests covering PostgreSQL connectivity, health checks, unknown routes, successful dispatch requests, and empty-request validation.

## Project Structure

```text
webhook-dispatcher/
├── scripts/
│   └── migrate.js
├── src/
│   ├── app.js
│   ├── start.js
│   ├── server.js
│   ├── database/
│   │   └── migrations/
│   ├── middleware/
│   ├── modules/
│   │   └── webhooks/
│   ├── utils/
│   └── workers/
│       └── webhook.worker.js
├── tests/
│   └── integration/
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── Dispatcher module assignment.postman_collection.json
└── README.md
```

## Architecture

1. A client submits a webhook event to the dispatch API.
2. The API validates the incoming request.
3. The job is persisted in PostgreSQL.
4. The API returns HTTP `202 Accepted` with a job ID.
5. The background worker claims the queued job.
6. The worker sends the webhook payload to the destination URL.
7. Delivery attempts and their outcomes are recorded.
8. Eligible failures are retried using exponential backoff.
9. The worker applies per-destination-host rate limiting.

```text
Client
  |
  v
Express REST API
  |
  v
Request Validation
  |
  v
PostgreSQL Job Queue
  |
  v
Background Worker
  |
  v
Destination Webhook
  |
  v
Delivery Attempt Logging
       |
       v
Retry on Eligible Failure
```

## Environment Variables and Security

Use `.env.example` to identify the environment variables required by the application.

- Configure database credentials through environment variables.
- Keep real secrets out of source control.
- Configure the production database separately from the local development database.
- Ensure the deployed service has the correct database connection settings.

## Deployment Verification

The deployed application has been verified with the following successful checks:

- Health endpoint returned HTTP 200.
- Dispatch API accepted and queued a webhook job.
- PostgreSQL-backed background worker processed the job.
- The destination `https://httpbin.org/post` received a webhook successfully.
- The worker logged successful delivery on attempt 1.

These checks verify the successful dispatch and delivery path. Retry and other failure scenarios should be tested separately.
