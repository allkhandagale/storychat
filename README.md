# StoryChat 💬

A chat-based fiction reading app that transforms traditional storytelling into immersive chat experiences. Built on Cloudflare's serverless stack (Workers + D1 + KV + R2).

## Features

- 📖 **4 Genre-Based Stories**: Thriller, Romance, Sci-Fi, Drama
- 💰 **Credit-Based Unlock System**: 10 credits per chapter, 100 credits = $1
- 🎭 **Character Conversations**: Stories unfold as chat messages
- ⚡ **Auto-Advance**: Configurable message reveal timing
- 🔔 **Push Notifications**: Web Push API ready
- 📊 **Analytics**: Full event tracking per Jarvis-Growth spec

## Tech Stack

| Layer | Technology |
|-------|------------------|
| API | Cloudflare Workers + TypeScript |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| Storage | Cloudflare R2 |
| Frontend | Next.js 14 + Tailwind CSS |
| Deployment | GitHub Actions |

## Quick Start

```bash
# Install dependencies
cd api && npm install
cd ../web && npm install

# Local development
wrangler dev  # API
cd web && npm run dev  # Frontend

# Deploy
wrangler deploy  # Worker
npm run build && wrangler pages deploy dist  # Frontend
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/google` | Google OAuth |
| GET | `/api/stories` | List stories |
| GET | `/api/stories/:id` | Story details |
| GET | `/api/chapters/:id/messages` | Get messages (auth req) |
| POST | `/api/credits/unlock` | Unlock chapter |
| GET | `/api/credits/balance` | Get credit balance |
| POST | `/api/admin/credits/add` | Admin grant credits |
| GET | `/api/admin/analytics` | Admin dashboard |

## Environment Variables

```
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx
D1_DATABASE_ID=xxx
KV_SESSIONS_ID=xxx
KV_RATELIMIT_ID=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
JWT_SECRET=xxx
```

## Demo Data

- **Story 1**: "The Last Message" (Thriller)
- **Story 2**: "Love, Maybe" (Romance)
- **Story 3**: "Starship Omega" (Sci-Fi)
- **Story 4**: "Midnight Confessions" (Drama)

Each story has 4 chapters × 8 messages.

**Demo Users:**
- `user@demo.com` / `demo123` - 50 credits
- `admin@demo.com` / `admin123` - 200 credits + admin access

## Architecture

```
┌─────────────────┐     HTTPS     ┌─────────────────┐
│   Next.js App   │──────────────▶│Cloudflare Worker│
│   (Pages)       │◀──────────────│   (API)         │
└─────────────────┘               └────────┬────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
              ┌─────────┐          ┌───────────┐          ┌──────────┐
              │   D1    │          │    KV     │          │    R2    │
              │(SQLite)│          │(Sessions) │          │ (Media)  │
              └─────────┘          └───────────┘          └──────────┘
```

## Rate Limiting

- **Global**: 100 requests/min per IP
- **Credit Ops**: 10 operations/min per user
- **Admin**: 30 operations/min per admin

## Credit System

Transactions stored in `credit_transactions` table:
- `PURCHASE` - Buying credits
- `CONSUMPTION` - Unlocking chapters
- `ADMIN_ADD` - Admin grants
- `BONUS` - Welcome bonus
- `REFUND` - Refunds

Atomic deduction prevents double-spend via idempotency keys.

## License

MIT © 2026 StoryChat
