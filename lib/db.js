import pg from 'pg';

const connectionString = process.env.POSTGRES_URL?.replace(/(\/[^/?&]+)[?&].*$/, '$1');

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5
});

let schemaReady = null;

export function ensureSchema() {
    if (!schemaReady) {
        schemaReady = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    nickname TEXT,
                    picture TEXT,
                    total_earnings INT NOT NULL DEFAULT 0,
                    streak INT NOT NULL DEFAULT 0,
                    last_order_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS users_rank_idx
                ON users (total_earnings DESC, created_at)
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS orders (
                    order_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id),
                    dish_id TEXT NOT NULL,
                    stars SMALLINT NOT NULL,
                    base_pay INT NOT NULL,
                    bonus INT NOT NULL,
                    tip INT NOT NULL,
                    total INT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            `);
        })().catch(err => {
            schemaReady = null;
            throw err;
        });
    }
    return schemaReady;
}

export { pool };
