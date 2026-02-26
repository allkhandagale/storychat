// Authentication middleware

import { verifyJWT, type Env, createCORSResponse } from '../index';

export type AuthContext = {
  userId: string;
  isAdmin: boolean;
  sessionId: string;
};

export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthContext | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    
    if (!payload.userId) {
      return null;
    }

    // Verify session is valid in KV
    const sessionKey = `session:${payload.sessionId}`;
    const sessionData = await env.SESSIONS.get(sessionKey);
    
    if (!sessionData) {
      return null; // Session expired or revoked
    }

    return {
      userId: payload.userId,
      isAdmin: payload.isAdmin === true,
      sessionId: payload.sessionId
    };
  } catch (error) {
    return null;
  }
}

export async function requireAuth(
  request: Request,
  env: Env
): Promise<{ auth: AuthContext; response?: Response }> {
  const auth = await authenticateRequest(request, env);
  
  if (!auth) {
    return {
      auth: null as any,
      response: createCORSResponse({ error: 'Unauthorized' }, 401, env.CORS_ORIGIN)
    };
  }
  
  return { auth };
}

export async function requireAdmin(
  request: Request,
  env: Env
): Promise<{ auth: AuthContext; response?: Response }> {
  const auth = await authenticateRequest(request, env);
  
  if (!auth) {
    return {
      auth: null as any,
      response: createCORSResponse({ error: 'Unauthorized' }, 401, env.CORS_ORIGIN)
    };
  }
  
  if (!auth.isAdmin) {
    return {
      auth: null as any,
      response: createCORSResponse({ error: 'Admin access required' }, 403, env.CORS_ORIGIN)
    };
  }
  
  return { auth };
}
