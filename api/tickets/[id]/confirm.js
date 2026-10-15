import { ensureSchema, pool } from '../../../lib/db.js';
import { getSessionSub } from '../../../lib/session.js';
import { TICKET_STATUS, splitPayout } from '../../../lib/tickets.js';
import { payoutFor } from '../../../lib/rules.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const sub = await getSessionSub(req);
    if (!sub) return res.status(401).json({ error: 'not signed in' });

    const { id } = req.query;
    if (typeof id !== 'string' || !UUID_RE.test(id)) return res.status(400).json({ error: 'bad id' });

    await ensureSchema();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `UPDATE tickets
             SET status = $2, updated_at = now()
             WHERE id = $1 AND status = $3 AND customer_id = $4
             RETURNING dish_id, stars, waiter_id, chef_id`,
            [id, TICKET_STATUS.PAID, TICKET_STATUS.SERVED, sub]
        );
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'cannot confirm' });
        }
        const ticket = rows[0];

        const { rows: chefRows } = await client.query(
            `SELECT streak FROM users WHERE id = $1 FOR UPDATE`,
            [ticket.chef_id]
        );
        const chefStreak = chefRows[0]?.streak ?? 0;
        const pay = payoutFor({ dishId: ticket.dish_id, stars: ticket.stars, streak: chefStreak });
        const split = splitPayout(pay.total);

        await client.query(
            `UPDATE users SET total_earnings = total_earnings + $2, streak = $3 WHERE id = $1`,
            [ticket.chef_id, split.chef, pay.streak]
        );
        await client.query(
            `UPDATE users SET total_earnings = total_earnings + $2 WHERE id = $1`,
            [ticket.waiter_id, split.waiter]
        );

        await client.query('COMMIT');
        return res.status(200).json({ ok: true, status: TICKET_STATUS.PAID, total: pay.total, waiterPay: split.waiter, chefPay: split.chef });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}
