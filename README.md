# Yurpass

Private luxury events platform — React Native + Hono + MongoDB.

## Prerequisites

- **Node.js 22 LTS**
- **Docker Desktop** (Windows/macOS)
- **npm** (ships with Node.js)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local` with development values:

```env
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=yurpass-root-dev-2025
MONGO_APP_PASSWORD=yurpass-app-dev-2025
MONGODB_URI=mongodb://yurpass-app:yurpass-app-dev-2025@mongodb:27017/yurpass
REDIS_PASSWORD=yurpass_dev_redis
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=your-dev-secret-minimum-32-characters-long
BETTER_AUTH_URL=http://localhost:3000
```

### 3. Start infrastructure

```bash
docker-compose up -d
```

This starts:
- **MongoDB 7.0** on port 27017 (with app user auto-created)
- **Redis 7** on port 6379

### 4. Verify services

```bash
# Check containers are healthy
docker-compose ps

# Test API health (if running the API)
curl http://localhost:3000/health
```

### 5. Run the API

```bash
npm run dev --workspace=@yurpass/api
```

### 6. Run the mobile app

```bash
cd apps/mobile
npx expo start
```

Scan the QR code with Expo Go on your phone.

## Project Structure

```
yurpass.mobile/
├── apps/
│   ├── api/             # Hono backend
│   └── mobile/          # Expo React Native
├── packages/
│   ├── types/           # Shared TypeScript types
│   └── validators/      # Shared Zod schemas
├── scripts/             # Dev utilities
├── docker-compose.yml   # Local dev infrastructure
└── turbo.json           # Monorepo task runner
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npx turbo run type-check` | TypeScript check across all packages |
| `npx turbo run test` | Run all tests |
| `npx turbo run build` | Build all packages |
| `docker-compose down` | Stop local infrastructure |
| `docker-compose down -v` | Stop and reset all data |
