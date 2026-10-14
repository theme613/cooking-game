import { ensureSchema, pool } from '../../lib/db.js';
import { getSessionSub } from '../../lib/session.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    const sub = await getSessionSub(req);
    if (!sub) return res.status(401).json({ error: 'not signed in' });

    await ensureSchema();
    const { rows } = await pool.query(
        `SELECT u.nickname, u.picture, u.total_earnings,
                (SELECT COUNT(*) + 1 FROM users o
                  WHERE o.nickname IS NOT NULL AND o.total_earnings > u.total_earnings) AS rank
         FROM users u WHERE u.id = $1`,
        [sub]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'not signed in' });

    const u = rows[0];
    res.status(200).json({
        nickname: u.nickname,
        picture: u.picture,
        totalEarnings: u.total_earnings,
        rank: u.nickname ? Number(u.rank) : null,
        needsNickname: u.nickname === null
    });
}
