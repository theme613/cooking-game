import { randomUUID } from 'crypto';
import { ensureSchema, pool } from '../../lib/db.js';
import { getSessionSub } from '../../lib/session.js';
import { DISH_PRICES } from '../../lib/rules.js';
import { TICKET_STATUS, STALE_MS } from '../../lib/tickets.js';

export default async function handler(req, res) {
    const sub = await getSessionSub(req);
    if (!sub) return res.status(401).json({ error: 'not signed in' });

    await ensureSchema();

    if (req.method === 'POST') {
        const { dishId } = req.body || {};
        if (!Object.hasOwn(DISH_PRICES, dishId)) return res.status(400).json({ error: 'bad dishId' });

        const { rows: user } = await pool.query('SELECT nickname FROM users WHERE id = $1', [sub]);
        if (!user[0]?.nickname) return res.status(403).json({ error: 'nickname required' });

        const id = randomUUID();
        await pool.query(
            `INSERT INTO tickets (id, customer_id, dish_id, status) VALUES ($1, $2, $3, $4)`,
            [id, sub, dishId, TICKET_STATUS.OPEN]
        );
        return res.status(201).json({ id, dishId, status: TICKET_STATUS.OPEN });
    }

    if (req.method === 'GET') {
        const staleBefore = new Date(Date.now() - STALE_MS);
        await pool.query(
            `UPDATE tickets
             SET status = $2, waiter_id = NULL, claimed_at = NULL, updated_at = now()
             WHERE status = $1 AND updated_at < $3`,
            [TICKET_STATUS.TAKEN_WAITER, TICKET_STATUS.OPEN, staleBefore]
        );
        await pool.query(
            `UPDATE tickets
             SET status = $2, chef_id = NULL, claimed_at = NULL, updated_at = now()
             WHERE status = $1 AND updated_at < $3`,
            [TICKET_STATUS.COOKING, TICKET_STATUS.READY_FOR_COOK, staleBefore]
        );

        const { rows } = await pool.query(
            `SELECT t.id, t.dish_id, t.status, t.stars, t.customer_id, t.waiter_id, t.chef_id, u.nickname AS customer_name
             FROM tickets t JOIN users u ON u.id = t.customer_id
             WHERE (t.status = $1 AND t.customer_id <> $2)
                OR (t.status = $3 AND t.chef_id IS NULL AND t.customer_id <> $2)
                OR (t.customer_id = $2 AND t.status <> 'paid')
                OR t.waiter_id = $2
                OR t.chef_id = $2
             ORDER BY t.created_at
             LIMIT 50`,
            [TICKET_STATUS.OPEN, sub, TICKET_STATUS.READY_FOR_COOK]
        );
        return res.status(200).json(rows.map(r => ({
            id: r.id,
            dishId: r.dish_id,
            status: r.status,
            stars: r.stars,
            customerName: r.customer_name,
            isMine: r.customer_id === sub,
            isMyWaiterTicket: r.waiter_id === sub,
            isMyChefTicket: r.chef_id === sub
        })));
    }

    return res.status(405).end();
}
