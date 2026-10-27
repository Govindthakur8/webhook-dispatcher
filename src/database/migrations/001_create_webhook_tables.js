
export const shorthands = undefined;

export async function up(pgm) {
  pgm.createTable('webhook_jobs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
    event_id: {
      type: 'text',
      notNull: true,
    },
    destination_url: {
      type: 'text',
      notNull: true,
    },
    destination_host: {
      type: 'text',
      notNull: true,
    },
    payload: {
      type: 'jsonb',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'QUEUED',
    },
    attempt_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    max_attempts: {
      type: 'integer',
      notNull: true,
      default: 3,
    },
    next_attempt_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    locked_at: {
      type: 'timestamptz',
    },
    last_error: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('webhook_jobs', 'webhook_jobs_status_check', {
    check: "status IN ('QUEUED', 'PROCESSING', 'RETRYING', 'SUCCESS', 'FAILED')",
  });

  pgm.addConstraint('webhook_jobs', 'webhook_jobs_attempt_count_check', {
    check: 'attempt_count >= 0 AND max_attempts >= 0',
  });

  pgm.createIndex('webhook_jobs', ['status', 'next_attempt_at', 'created_at']);
  pgm.createIndex('webhook_jobs', ['destination_host', 'status']);

  pgm.createTable('delivery_attempts', {
    id: {
      type: 'bigint',
      primaryKey: true,
      notNull: true,
      generated: {
        always: true,
        as: 'identity',
      },
    },
    job_id: {
      type: 'uuid',
      notNull: true,
      references: '"webhook_jobs"',
      onDelete: 'cascade',
    },
    attempt_number: {
      type: 'integer',
      notNull: true,
    },
    status: {
      type: 'varchar(30)',
      notNull: true,
    },
    http_status: {
      type: 'integer',
    },
    error_message: {
      type: 'text',
    },
    started_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    completed_at: {
      type: 'timestamptz',
    },
  });

  pgm.addConstraint('delivery_attempts', 'delivery_attempts_number_check', {
    check: 'attempt_number > 0',
  });

  pgm.addConstraint('delivery_attempts', 'delivery_attempts_status_check', {
    check: "status IN ('SUCCESS', 'RETRYING', 'FAILED')",
  });

  pgm.addConstraint('delivery_attempts', 'delivery_attempts_job_attempt_unique', {
    unique: ['job_id', 'attempt_number'],
  });

  pgm.createIndex('delivery_attempts', ['job_id', 'attempt_number']);
}

export async function down(pgm) {
  pgm.dropTable('delivery_attempts');
  pgm.dropTable('webhook_jobs');
}
