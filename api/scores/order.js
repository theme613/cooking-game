import { ensureSchema, pool } from '../../lib/db.js';
import { getSessionSub } from '../../lib/session.js';
import { DISH_PRICES, ORDER_COOLDOWN_MS, payoutFor } from '../../lib/rules.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const sub = await getSessionSub(req);
    if (!sub) return res.status(401).json({ error: 'not signed in' });

    const { orderId, dishId, stars } = req.body || {};
    if (typeof orderId !== 'string' || orderId.length < 1 || orderId.length > 64) {
        return res.status(400).json({ error: 'bad orderId' });
    }
    if (!Object.hasOwn(DISH_PRICES, dishId)) return res.status(400).json({ error: 'bad dishId' });
    if (!Number.isInteger(stars) || stars < 0 || stars > 5) {
        return res.status(400).json({ error: 'bad stars' });
    }

    await ensureSchema();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: userRows } = await client.query(
            `SELECT streak, total_earnings, last_order_at, nickname FROM users WHERE id = $1 FOR UPDATE`,
            [sub]
        );
        if (userRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({ error: 'not signed in' });
        }
        const user = userRows[0];

        const { rows: existing } = await client.query(
            `SELECT total, base_pay, bonus, tip FROM orders WHERE order_id = $1 AND user_id = $2`,
            [orderId, sub]
        );
        if (existing.length > 0) {
            await client.query('ROLLBACK');
            return res.status(200).json({
                total: existing[0].total,
                base: existing[0].base_pay,
                bonus: existing[0].bonus,
                tip: existing[0].tip,
                duplicate: true
            });
        }

        const lastAt = user.last_order_at ? new Date(user.last_order_at).getTime() : 0;
        if (Date.now() - lastAt < ORDER_COOLDOWN_MS) {
            await client.query('ROLLBACK');
            return res.status(429).json({ error: 'too soon' });
        }

        const pay = payoutFor({ dishId, stars, streak: user.streak });

        await client.query(
            `INSERT INTO orders (order_id, user_id, dish_id, stars, base_pay, bonus, tip, total)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [orderId, sub, dishId, stars, pay.base, pay.bonus, pay.tip, pay.total]
        );
        const { rows: updated } = await client.query(
            `UPDATE users
             SET total_earnings = total_earnings + $2, streak = $3, last_order_at = now()
             WHERE id = $1
             RETURNING total_earnings`,
            [sub, pay.total, pay.streak]
        );
        const totalEarnings = updated[0].total_earnings;
        const { rows: rankRows } = await client.query(
            `SELECT COUNT(*) + 1 AS rank FROM users
             WHERE nickname IS NOT NULL AND total_earnings > $1`,
            [totalEarnings]
        );

        await client.query('COMMIT');
        res.status(200).json({
            total: pay.total,
            base: pay.base,
            bonus: pay.bonus,
            tip: pay.tip,
            streak: pay.streak,
            totalEarnings,
            rank: user.nickname ? Number(rankRows[0].rank) : null
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}
