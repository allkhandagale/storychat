/**
 * StoryChat API - Cloudflare Worker
 * Routes: Auth, Stories, Chapters, Credits, Admin
 */

import { authRoutes } from './routes/auth';
import { storyRoutes } from './routes/stories';
import { chapterRoutes } from './routes/chapters';
import { creditRoutes } from './routes/credits';
import { adminRoutes } from './routes/admin';
import { createCORSResponse, handleOptions } from './middleware/cors';
import { checkRateLimit } from './middleware/ratelimit';

// API Response helpers
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

export type Context = {
  env: Env;
  userId?: string;
  isAdmin?: boolean;
  sessionId?: string;
};

// Main router
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(env.CORS_ORIGIN);
    }

    // Check global rate limiting (all routes)
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `global:${clientIp}`;
    
    if (path.startsWith('/api/')) {
      const rateCheck = await checkRateLimit(env.RATELIMIT, rateLimitKey, 100, 60); // 100 req/min global
      if (!rateCheck.allowed) {
        return createCORSResponse(
          { error: 'Rate limit exceeded' },
          429,
          env.CORS_ORIGIN
        );
      }
    }

    // Route handlers
    try {
      // Health check
      if (path === '/health') {
        return createCORSResponse({ status: 'ok', env: env.ENVIRONMENT }, 200, env.CORS_ORIGIN);
      }

      // API routes
      if (path.startsWith('/api/auth')) {
        return authRoutes(request, env, path, method);
      }

      if (path.startsWith('/api/stories')) {
        return storyRoutes(request, env, path, method);
      }

      if (path.startsWith('/api/chapters')) {
        return chapterRoutes(request, env, path, method);
      }

      if (path.startsWith('/api/credits')) {
        return creditRoutes(request, env, path, method);
      }

      if (path.startsWith('/api/admin')) {
        return adminRoutes(request, env, path, method);
      }

      // 404 fallback
      return createCORSResponse({ error: 'Not found' }, 404, env.CORS_ORIGIN);

    } catch (error) {
      console.error('[API] Unhandled error:', error);
      return createCORSResponse(
        { error: 'Internal server error' },
        500,
        env.CORS_ORIGIN
      );
    }
  }
};

// Helper to parse JSON body
export async function parseBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

// JWT helpers (for development/simplicity)
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
