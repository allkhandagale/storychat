// StoryChat API Client

import type {
  User,
  Story,
  Chapter,
  ChapterWithMessages,
  CreditBalance,
  UnlockResult,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://storychat-api.workers.dev';

// Helper to get auth token
function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('storychat_token');
  }
  return null;
}

// API Request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle errors
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  googleLogin: (code: string) =>
    apiRequest<{ token: string; user: User; newUser?: boolean }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  register: (email: string, password: string, displayName?: string) =>
    apiRequest<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
};

// Stories API
export const storiesAPI = {
  list: () =>
    apiRequest<{ stories: Story[]; count: number }>('/api/stories'),

  get: (id: string) =>
    apiRequest<{ story: {
      id: string;
      title: string;
      genre: string;
      synopsis: string;
      coverImage: string | null;
      totalReads: number;
      characters: Character[];
      chapters: Chapter[];
    } }>(`/api/stories/${id}`),
};

// Chapters API
export const chaptersAPI = {
  getMessages: (id: string) =>
    apiRequest<{ chapter: ChapterWithMessages }>(`/api/chapters/${id}/messages`),

  complete: (id: string) =>
    apiRequest<{ success: boolean }>(`/api/chapters/${id}/complete`, {
      method: 'POST',
    }),
};

// Credits API
export const creditsAPI = {
  getBalance: () =>
    apiRequest<CreditBalance>('/api/credits/balance'),

  unlock: (chapterId: string) =>
    apiRequest<UnlockResult>('/api/credits/unlock', {
      method: 'POST',
      body: JSON.stringify({ chapterId, idempotencyKey: `unlock_${Date.now()}` }),
    }),
};

// Export complete API object
export const api = {
  auth: authAPI,
  stories: storiesAPI,
  chapters: chaptersAPI,
  credits: creditsAPI,
};
