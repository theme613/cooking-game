import { ensureSchema, pool } from '../lib/db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    await ensureSchema();
    const { rows } = await pool.query(
        `SELECT nickname, picture, total_earnings FROM users
         WHERE nickname IS NOT NULL
         ORDER BY total_earnings DESC, created_at
         LIMIT 10`
    );
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=15');
    res.status(200).json(rows.map(r => ({
        nickname: r.nickname,
        picture: r.picture,
        totalEarnings: r.total_earnings
    })));
}
