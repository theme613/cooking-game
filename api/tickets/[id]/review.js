import { ensureSchema, pool } from '../../../lib/db.js';
import { getSessionSub } from '../../../lib/session.js';
import { TICKET_STATUS } from '../../../lib/tickets.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const sub = await getSessionSub(req);
    if (!sub) return res.status(401).json({ error: 'not signed in' });

    const { id } = req.query;
    if (typeof id !== 'string' || !UUID_RE.test(id)) return res.status(400).json({ error: 'bad id' });

    const { stars } = req.body || {};
    if (!Number.isInteger(stars) || stars < 0 || stars > 5) return res.status(400).json({ error: 'bad stars' });

    await ensureSchema();

    const { rowCount } = await pool.query(
        `UPDATE tickets
         SET status = $2, stars = $3, updated_at = now()
         WHERE id = $1 AND status = $4 AND chef_id = $5`,
        [id, TICKET_STATUS.SERVED, stars, TICKET_STATUS.COOKING, sub]
    );
    if (rowCount === 0) return res.status(409).json({ error: 'cannot review' });
    return res.status(200).json({ ok: true, status: TICKET_STATUS.SERVED });
}
