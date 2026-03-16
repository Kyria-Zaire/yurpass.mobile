---
description: Yurpass — Règles Backend API (Hono + Node.js)
globs: ["apps/api/**/*.ts"]
alwaysApply: false
---

# ⚙️ YURPASS — RÈGLES BACKEND API

## STACK
- Hono (framework HTTP) — pas d'Express
- Better Auth (auth) — pas de custom JWT maison
- Mongoose (ODM) — schémas stricts
- Zod (validation) — sur chaque route
- BullMQ (queues) — pour les tâches async

## STRUCTURE API
```
apps/api/
├── src/
│   ├── routes/          → définition routes Hono
│   ├── controllers/     → logique de traitement
│   ├── services/        → logique métier pure
│   ├── models/          → schémas Mongoose
│   ├── middlewares/     → auth, rate-limit, logger
│   ├── validators/      → schémas Zod locaux
│   ├── lib/             → instances partagées (db, redis, auth)
│   └── utils/           → fonctions utilitaires
└── index.ts
```

## PATTERN ROUTE OBLIGATOIRE
```typescript
// ✅ Structure attendue pour chaque route
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '@/middlewares/auth'
import { requireRole } from '@/middlewares/roles'
import { createEventSchema } from '@yurpass/validators'
import { EventService } from '@/services/event.service'

const events = new Hono()

events.post(
  '/',
  authMiddleware,                          // ← toujours en premier
  requireRole(['host', 'admin']),          // ← vérif rôle
  zValidator('json', createEventSchema),   // ← validation input
  async (c) => {
    try {
      const body = c.req.valid('json')
      const user = c.get('user')
      const event = await EventService.create(body, user.id)
      return c.json({ success: true, data: event }, 201)
    } catch (error) {
      // Gestion d'erreur structurée
      return handleApiError(c, error)
    }
  }
)
```

## MONGOOSE — RÈGLES SCHÉMAS
```typescript
// ✅ Schéma Mongoose correct
const userSchema = new Schema({
  publicId: {
    type: String,
    default: () => nanoid(10),  // Jamais exposer _id directement
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  roles: [{
    type: String,
    enum: ['guest', 'host', 'sam', 'model', 'admin'],
    required: true,
  }],
  deletedAt: Date,  // Soft delete — jamais hard delete
}, {
  timestamps: true,
  // Jamais de __v exposé
  toJSON: {
    transform: (_, ret) => {
      delete ret._id
      delete ret.__v
      delete ret.password
      return ret
    }
  }
})
```

## RÈGLES MONGODB
- **Index obligatoire** sur tous les champs filtrés/triés
- **Soft delete** uniquement — jamais de `deleteOne` sur données utilisateur
- Projection explicite — ne jamais retourner tous les champs par défaut
- Transactions pour les opérations multi-collections critiques
- TTL index pour les codes d'accès et tokens temporaires

## CODES D'ACCÈS ÉVÉNEMENTS
```typescript
// ✅ Génération code accès sécurisé
import { nanoid } from 'nanoid'

const generateAccessCode = (): string => nanoid(12)
// → "V1StGXR8_Z5j" style — cryptographiquement sécurisé

// TTL: valide 2h avant événement → fin événement
// Usage unique: invalidé après premier scan
// Log: chaque scan → { userId, eventId, timestamp, device }
```

## GESTION D'ERREURS API
```typescript
// ✅ Classes d'erreur typées
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string,
  ) { super(message) }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non autorisé') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, 403, 'FORBIDDEN')
  }
}
```

## AUDIT LOGGING — OBLIGATOIRE POUR
- Connexion / déconnexion utilisateur
- Changement de rôle
- Création / annulation d'événement
- Scan de code d'accès (entrée événement)
- Signalement utilisateur
- Ban / suspension compte
- Toute action admin

## VARIABLES D'ENVIRONNEMENT
```typescript
// ✅ Toujours valider avec Zod au démarrage
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  CLOUDINARY_CLOUD_NAME: z.string(),
  RESEND_API_KEY: z.string(),
})

export const env = envSchema.parse(process.env)
// Si une variable manque → crash au démarrage, pas en production
```
