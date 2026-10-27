export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE public.delivery_attempts
      ALTER COLUMN id DROP IDENTITY IF EXISTS;

    CREATE SEQUENCE IF NOT EXISTS public.delivery_attempts_id_seq;

    ALTER TABLE public.delivery_attempts
      ALTER COLUMN id
      SET DEFAULT nextval('public.delivery_attempts_id_seq'::regclass);

    ALTER SEQUENCE public.delivery_attempts_id_seq
      OWNED BY public.delivery_attempts.id;

    SELECT setval(
      'public.delivery_attempts_id_seq',
      COALESCE((SELECT MAX(id) FROM public.delivery_attempts), 0) + 1,
      false
    );
  `);
}

export async function down(pgm) {
  pgm.sql(`
    ALTER TABLE public.delivery_attempts
      ALTER COLUMN id DROP DEFAULT;

    DROP SEQUENCE IF EXISTS public.delivery_attempts_id_seq;
  `);
}