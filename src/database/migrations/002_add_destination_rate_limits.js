export async function up(pgm) {
  pgm.createTable('destination_rate_limits', {
    destination_host: {
      type: 'text',
      primaryKey: true,
      notNull: true,
    },
    window_started_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    request_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
  });

  pgm.addConstraint(
    'destination_rate_limits',
    'destination_rate_limits_count_check',
    { check: 'request_count >= 0' },
  );
}

export async function down(pgm) {
  pgm.dropTable('destination_rate_limits');
}
