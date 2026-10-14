import { OAuth2Client } from 'google-auth-library';
import { ensureSchema, pool } from '../../lib/db.js';
import { createSessionCookie } from '../../lib/session.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { credential } = req.body || {};
    if (typeof credential !== 'string') return res.status(400).json({ error: 'missing credential' });

    let payload;
    try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        payload = ticket.getPayload();
    } catch {
        return res.status(401).json({ error: 'invalid token' });
    }
    if (!payload.email_verified) return res.status(401).json({ error: 'email not verified' });

    await ensureSchema();
    await pool.query(
        `INSERT INTO users (id, picture) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET picture = EXCLUDED.picture`,
        [payload.sub, payload.picture || null]
    );

    res.setHeader('Set-Cookie', await createSessionCookie(payload.sub));
    res.status(200).json({ ok: true });
}
