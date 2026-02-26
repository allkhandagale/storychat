// Auth routes: Login, Google OAuth, email/password

import type { Env } from '../index';
import { createCORSResponse, parseBody, signJWT } from '../index';
import { generateId, hashPassword, verifyPassword } from '../lib/crypto';

// Google OAuth exchange
async function exchangeGoogleCode(code: string, clientId: string, clientSecret: string): Promise<{ email: string; sub: string; name?: string } | null> {
  try {
    // In production, this would call Google's token endpoint
    // For MVP we'll simulate or use a proxy
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: 'https://storychat.pages.dev/auth/callback'
      })
    });

    if (!response.ok) {
      console.log('Google token exchange failed, using mock for development');
      return null;
    }

    const tokenData = await response.json();
    
    // Get user info from Google
    const userInfo = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    const user = await userInfo.json();
    return {
      email: user.email,
      sub: user.sub,
      name: user.name
    };
  } catch (error) {
    console.error('Google OAuth error:', error);
    return null;
  }
}

export async function authRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const db = env.DB;

  // POST /api/auth/login - Email/Password login
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const body = await parseBody<{ email: string; password: string }>(request);
      const { email, password } = body;

      if (!email || !password) {
        return createCORSResponse({ error: 'Email and password required' }, 400, env.CORS_ORIGIN);
      }

      // Find user
      const user = await db.prepare(
        'SELECT id, email, password_hash, is_admin, display_name FROM users WHERE email = ? AND auth_provider = "email"'
      ).bind(email).first<{ id: string; email: string; password_hash: string; is_admin: number; display_name: string }>();

      if (!user || !user.password_hash) {
        return createCORSResponse({ error: 'Invalid credentials' }, 401, env.CORS_ORIGIN);
      }

      // Verify password
      const passwordValid = await verifyPassword(password, user.password_hash);
      if (!passwordValid) {
        return createCORSResponse({ error: 'Invalid credentials' }, 401, env.CORS_ORIGIN);
      }

      // Create session
      const sessionId = generateId();
      const token = await signJWT({
        userId: user.id,
        email: user.email,
        isAdmin: user.is_admin === 1,
        sessionId
      }, env.JWT_SECRET);

      // Store session in KV
      await env.SESSIONS.put(
        `session:${sessionId}`,
        JSON.stringify({ userId: user.id, createdAt: Date.now() }),
        { expirationTtl: 86400 } // 24 hours
      );

      // Update last login
      await db.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();

      return createCORSResponse({
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name || user.email.split('@')[0],
          isAdmin: user.is_admin === 1
        }
      }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Login failed' }, 500, env.CORS_ORIGIN);
    }
  }

  // POST /api/auth/google - Google OAuth login
  if (path === '/api/auth/google' && method === 'POST') {
    try {
      const body = await parseBody<{ code: string }>(request);
      const { code } = body;

      if (!code) {
        return createCORSResponse({ error: 'OAuth code required' }, 400, env.CORS_ORIGIN);
      }

      // Exchange code for Google user info
      const googleUser = await exchangeGoogleCode(code, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);

      // For development: mock Google user if OAuth fails
      let email = googleUser?.email;
      let googleId = googleUser?.sub;
      let displayName = googleUser?.name;

      // Development fallback
      if (!email) {
        email = `user_${Date.now()}@storychat.dev`;
        googleId = `google_${Date.now()}`;
        displayName = 'StoryChat User';
      }

      // Check if user exists
      let user = await db.prepare(
        'SELECT id, email, is_admin, display_name FROM users WHERE auth_provider_id = ? AND auth_provider = "google"'
      ).bind(googleId).first<{ id: string; email: string; is_admin: number; display_name: string }>();

      if (!user) {
        // Create new user
        const userId = generateId();
        await db.prepare(`
          INSERT INTO users (id, email, display_name, auth_provider, auth_provider_id, subscription_tier, created_at)
          VALUES (?, ?, ?, 'google', ?, 'free', datetime('now'))
        `).bind(userId, email, displayName || email.split('@')[0], googleId).run();

        // Give welcome credits (50 starting per PRD)
        await db.prepare(`
          INSERT INTO credit_transactions (transaction_id, user_id, transaction_type, credits_amount, balance_after, idempotency_key, reason, created_at)
          VALUES (?, ?, 'BONUS', 50, 50, ?, 'Welcome bonus', datetime('now'))
        `).bind(`tx_${Date.now()}`, userId, `welcome_${userId}`).run();

        user = { id: userId, email, is_admin: 0, display_name: displayName };
      }

      // Create session
      const sessionId = generateId();
      const token = await signJWT({
        userId: user.id,
        email: user.email,
        isAdmin: user.is_admin === 1,
        sessionId
      }, env.JWT_SECRET);

      await env.SESSIONS.put(
        `session:${sessionId}`,
        JSON.stringify({ userId: user.id, createdAt: Date.now() }),
        { expirationTtl: 86400 }
      );

      // Update last login
      await db.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();

      return createCORSResponse({
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name || user.email.split('@')[0],
          isAdmin: user.is_admin === 1
        },
        newUser: !googleUser // true if we created user this session
      }, 200, env.CORS_ORIGIN);
    } catch (error) {
      return createCORSResponse({ error: error.message || 'Google login failed' }, 500, env.CORS_ORIGIN);
    }
  }

  // POST /api/auth/register - Create email/password account
  if (path === '/api/auth/register' && method === 'POST') {
    try {
      const body = await parseBody<{ email: string; password: string; displayName?: string }>(request);
      const { email, password, displayName } = body;

      if (!email || !password || password.length < 6) {
        return createCORSResponse({ error: 'Valid email and password (6+ chars) required' }, 400, env.CORS_ORIGIN);
      }

      // Check if email exists
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) {
        return createCORSResponse({ error: 'Email already registered' }, 409, env.CORS_ORIGIN);
      }

      // Create user
      const userId = generateId();
      const passwordHash = await hashPassword(password);

      await db.prepare(`
        INSERT INTO users (id, email, display_name, auth_provider, password_hash, subscription_tier, created_at)
        VALUES (?, ?, ?, 'email', ?,