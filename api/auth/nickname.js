import { ensureSchema, pool } from '../../lib/db.js';
import { getSessionSub } from '../../lib/session.js';

const NICKNAME_RE = /^[A-Za-z0-9 _]{3,16}$/;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const sub = await getSessionSub(req);
    if (!sub) return res.status(401).json({ error: 'not signed in' });

    const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname.trim() : '';
    if (!NICKNAME_RE.test(nickname)) {
        return res.status(400).json({ error: 'nickname must be 3-16 letters, digits, spaces or _' });
    }

    await ensureSchema();
    const { rowCount } = await pool.query(
        `UPDATE users SET nickname = $2 WHERE id = $1 AND nickname IS NULL`,
        [sub, nickname]
    );
    if (rowCount === 0) return res.status(409).json({ error: 'nickname already set' });

    res.status(200).json({ ok: true, nickname });
}
