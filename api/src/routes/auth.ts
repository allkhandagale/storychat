/**
 * Auth Routes - Hono Router
 * Endpoints: POST /api/auth/login, POST /api/auth/register
 */
import { Hono } from 'hono';
import { generateId, hashPassword, verifyPassword } from '../lib/crypto';
import type { Env } from '../index';

// Extend Hono context type
type AuthContext = {
  Bindings: Env;
};

const auth = new Hono<AuthContext>();

// JWT signing helper
async function signJWT(payload: object, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${header}.${body}`);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${header}.${body}.${sig}`;
}

// POST /api/auth/login - Email/Password login
auth.post('/login', async (c) => {
  const db = c.env.DB;
  const JWT_SECRET = c.env.JWT_SECRET;

  try {
    const body = await c.req.json<{ email: string; password: string }>();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    // Find user
    const user = await db
      .prepare(
        'SELECT id, email, password_hash, is_admin, display_name FROM users WHERE email = ? AND auth_provider = "email"'
      )
      .bind(email)
      .first<{
        id: string;
        email: string;
        password_hash: string;
        is_admin: number;
        display_name: string;
      }>();

    if (!user || !user.password_hash) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Create session
    const sessionId = generateId();
    const token = await signJWT(
      {
        userId: user.id,
        email: user.email,
        isAdmin: user.is_admin === 1,
        sessionId,
      },
      JWT_SECRET
    );

    // Store session in KV
    await c.env.SESSIONS.put(
      `session:${sessionId}`,
      JSON.stringify({ userId: user.id, createdAt: Date.now() }),
      { expirationTtl: 86400 } // 24 hours
    );

    // Update last login
    await db
      .prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?')
      .bind(user.id)
      .run();

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.email.split('@')[0],
        isAdmin: user.is_admin === 1,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Login failed' }, 500);
  }
});

// POST /api/auth/register - Create email/password account
auth.post('/register', async (c) => {
  const db = c.env.DB;
  const JWT_SECRET = c.env.JWT_SECRET;

  try {
    const body = await c.req.json<{
      email: string;
      password: string;
      displayName?: string;
    }>();
    const { email, password, displayName } = body;

    if (!email || !password || password.length < 6) {
      return c.json(
        { error: 'Valid email and password (6+ chars) required' },
        400
      );
    }

    // Check if email exists
    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();
    if (existing) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    await db
      .prepare(
        `INSERT INTO users (id, email, display_name, auth_provider, password_hash, subscription_tier, created_at)
         VALUES (?, ?, ?, 'email', ?, 'free', datetime('now'))`
      )
      .bind(userId, email, displayName || email.split('@')[0], passwordHash)
      .run();

    // Give welcome credits (50 starting)
    await db
      .prepare(
        `INSERT INTO credit_transactions (transaction_id, user_id, transaction_type, credits_amount, balance_after, idempotency_key, reason, created_at)
         VALUES (?, ?, 'BONUS', 50, 50, ?, 'Welcome bonus', datetime('now'))`
      )
      .bind(`tx_${Date.now()}`, userId, `welcome_${userId}`)
      .run();

    // Create session
    const sessionId = generateId();
    const token = await signJWT(
      {
        userId,
        email,
        isAdmin: false,
        sessionId,
      },
      JWT_SECRET
    );

    await c.env.SESSIONS.put(
      `session:${sessionId}`,
      JSON.stringify({ userId, createdAt: Date.now() }),
      { expirationTtl: 86400 }
    );

    return c.json({
      token,
      user: {
        id: userId,
        email,
        displayName: displayName || email.split('@')[0],
        isAdmin: false,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Registration failed' }, 500);
  }
});

export default auth;
export { auth };
