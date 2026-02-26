/**
 * StoryChat API - Cloudflare Worker with Hono
 * Routes: Auth, Stories, Chapters, Credits, Admin
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import authRoutes from './routes/auth';
import storyRoutes from './routes/stories';
import chapterRoutes from './routes/chapters';
import creditRoutes from './routes/credits';

// API Environment bindings
export type Env = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  RATELIMIT: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
};

// Create main Hono app with type-safe bindings
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use(logger());
app.use(cors({
  origin: (origin, c) => c.env.CORS_ORIGIN || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', env: c.env.ENVIRONMENT });
});

// Mount routers
app.route('/api/auth', authRoutes);
app.route('/api/stories', storyRoutes);
app.route('/api/chapters', chapterRoutes);
app.route('/api/credits', creditRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Global error handler
app.onError((err, c) => {
  console.error('[API] Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Export for Cloudflare Worker
export default app;

// JWT helpers for use in routes
export async function signJWT(payload: object, secret: string): Promise<string> {
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

export async function verifyJWT(token: string, secret: string): Promise<any> {
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) throw new Error('Invalid token');
  const data = new TextEncoder().encode(`${header}.${body}`);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
  if (!valid) throw new Error('Invalid signature');
  return JSON.parse(atob(body));
}

// CORS helper for backward compatibility
export function createCORSResponse(body: object, status: number, corsOrigin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsOrigin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function parseBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}
