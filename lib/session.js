import { SignJWT, jwtVerify } from 'jose';

const COOKIE = 'session';
const MAX_AGE_S = 60 * 60 * 24 * 30;

function key() {
    return new TextEncoder().encode(process.env.SESSION_SECRET);
}

export async function createSessionCookie(sub) {
    const token = await new SignJWT({ sub })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${MAX_AGE_S}s`)
        .sign(key());
    return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_S}`;
}

export function clearSessionCookie() {
    return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function getSessionSub(req) {
    const raw = req.headers.cookie || '';
    const match = raw.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`));
    if (!match) return null;
    try {
        const { payload } = await jwtVerify(match.slice(COOKIE.length + 1), key(), { algorithms: ['HS256'] });
        return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
        return null;
    }
}
