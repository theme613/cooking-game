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

    const { role } = req.body || {};
    if (role !== 'waiter' && role !== 'chef') return res.status(400).json({ error: 'bad role' });

    await ensureSchema();

    if (role === 'waiter') {
        const { rowCount } = await pool.query(
            `UPDATE tickets
             SET status = $2, waiter_id = $3, claimed_at = now(), updated_at = now()
             WHERE id = $1 AND status = $4 AND waiter_id IS NULL AND customer_id <> $3`,
            [id, TICKET_STATUS.TAKEN_WAITER, sub, TICKET_STATUS.OPEN]
        );
        if (rowCount === 0) return res.status(409).json({ error: 'ticket unavailable' });
        return res.status(200).json({ ok: true, status: TICKET_STATUS.TAKEN_WAITER });
    }

    const { rowCount } = await pool.query(
        `UPDATE tickets
         SET status = $2, chef_id = $3, claimed_at = now(), updated_at = now()
         WHERE id = $1 AND status = $4 AND chef_id IS NULL AND customer_id <> $3 AND waiter_id <> $3`,
        [id, TICKET_STATUS.COOKING, sub, TICKET_STATUS.READY_FOR_COOK]
    );
    if (rowCount === 0) return res.status(409).json({ error: 'ticket unavailable' });
    return res.status(200).json({ ok: true, status: TICKET_STATUS.COOKING });
}
