---
description: Yurpass — Règles MongoDB & Schémas de données
globs: ["apps/api/src/models/**/*.ts"]
alwaysApply: false
---

# 🗄️ YURPASS — RÈGLES MONGODB & SCHÉMAS

## PRINCIPES DE MODÉLISATION

### Règle d'or
Modélise selon les **patterns d'accès**, pas selon la normalisation relationnelle.
MongoDB n'est pas PostgreSQL — adapter la pensée.

### Pattern de référence vs embedding
- **Embed** si : données toujours lues ensemble, cardinalité faible, pas de partage
- **Référence** si : données partagées, cardinalité haute, mises à jour indépendantes

---

## COLLECTIONS YURPASS

### `users` — Collection centrale
```typescript
interface IUser {
  publicId: string        // nanoid(10) — ID public exposé en API
  email: string           // lowercase, unique, indexé
  passwordHash: string    // bcrypt 12 rounds — jamais exposé
  roles: UserRole[]       // ['guest', 'host', 'sam', 'model', 'admin']
  profile: {
    displayName: string
    avatarUrl?: string    // Cloudinary URL
    bio?: string          // 500 chars max
    city: string
    verifiedAt?: Date     // Email vérifié
  }
  reputation: {
    score: number         // 0-100, calculé
    totalRatings: number
    avgRating: number     // 1-5
  }
  security: {
    twoFactorEnabled: boolean
    twoFactorSecret?: string  // Chiffré
    loginAttempts: number
    lockedUntil?: Date
    lastLoginAt?: Date
    lastLoginIp?: string
  }
  subscription: {
    plan: 'free' | 'premium'
    expiresAt?: Date
  }
  deletedAt?: Date        // Soft delete
  createdAt: Date
  updatedAt: Date
}
```

### `events` — Soirées
```typescript
interface IEvent {
  publicId: string        // nanoid(10)
  hostId: string          // Ref user.publicId
  title: string
  description: string
  theme: {
    id: string
    name: string          // 'Gatsby', 'Masked Ball', 'Rooftop Jazz'...
    dresscode: string
  }
  schedule: {
    startDate: Date
    endDate: Date
    doorsOpenAt: Date     // Heure ouverture portes
  }
  venue: {
    city: string
    address?: string      // Révélé uniquement aux invités validés J-24h
    coordinates?: {       // Révélé uniquement aux invités validés J-24h
      lat: number
      lng: number
    }
  }
  capacity: {
    max: number
    confirmed: number     // Calculé
    waitlist: number      // Calculé
  }
  access: {
    type: 'invite-only' | 'application'
    requiresContribution: boolean   // Apport obligatoire (boisson, etc.)
    contributionDetails?: string
  }
  status: 'draft' | 'published' | 'full' | 'ongoing' | 'completed' | 'cancelled'
  samRequired: boolean    // SAM assigné obligatoire
  samId?: string          // Ref user.publicId (rôle SAM)
  mediaUrls: string[]     // Photos post-événement
  isPrivate: boolean      // Toujours true pour Yurpass
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Index obligatoires
// { hostId: 1 }
// { status: 1, 'schedule.startDate': 1 }
// { 'venue.city': 1, status: 1 }
// { publicId: 1 } unique
```

### `participations` — Jointure user ↔ event
```typescript
interface IParticipation {
  publicId: string
  userId: string          // Ref user.publicId
  eventId: string         // Ref event.publicId
  status: 'pending' | 'approved' | 'rejected' | 'waitlist' | 'attended' | 'no-show'
  contribution?: {
    type: string          // 'champagne', 'beer', 'food'...
    validated: boolean
    validatedBy?: string  // Ref user.publicId (host)
  }
  accessCode?: {
    code: string          // Hash bcrypt — jamais le clair en base
    generatedAt: Date
    usedAt?: Date
    invalidated: boolean
  }
  invitedBy?: string      // Ref user.publicId (parrain)
  hostNote?: string       // Note privée de l'hôte (raison rejet, etc.)
  checkedInAt?: Date      // Timestamp entrée physique
  createdAt: Date
  updatedAt: Date
}

// Index obligatoires
// { userId: 1, eventId: 1 } unique
// { eventId: 1, status: 1 }
// { userId: 1, status: 1 }
```

### `ratings` — Système de notation
```typescript
interface IRating {
  publicId: string
  fromUserId: string      // Qui note
  toUserId: string        // Qui est noté
  eventId: string         // Dans quel contexte
  role: 'as-guest' | 'as-host' | 'as-sam'  // Rôle de la personne notée
  score: number           // 1-5
  comment?: string        // 300 chars max
  isVisible: boolean      // Peut être masqué par modération
  createdAt: Date
}

// Index obligatoires
// { toUserId: 1, role: 1 }
// { fromUserId: 1, eventId: 1 } unique (une note par event)
// { eventId: 1 }
```

### `auditLogs` — Traçabilité (CRITIQUE)
```typescript
interface IAuditLog {
  action: AuditAction     // Enum strict
  userId?: string         // Acteur (null si système)
  targetId?: string       // Cible de l'action
  eventId?: string        // Contexte événement
  metadata: Record<string, unknown>  // Données contextuelles
  ipAddress?: string
  userAgent?: string
  result: 'success' | 'failure'
  createdAt: Date         // Index TTL: 2 ans de rétention
}
```

---

## RÈGLES MONGOOSE STRICTES

```typescript
// ✅ Toujours activer le mode strict
const schema = new Schema({...}, {
  strict: true,           // Rejeter les champs non déclarés
  timestamps: true,       // createdAt/updatedAt automatiques
})

// ✅ Transform JSON — masquer les champs sensibles
schema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    delete ret._id
    delete ret.__v
    delete ret.passwordHash
    delete ret['security.twoFactorSecret']
    return ret
  },
})

// ✅ Index créés explicitement (pas via la définition schema)
schema.index({ email: 1 }, { unique: true })
schema.index({ publicId: 1 }, { unique: true })
```

---

## PATTERNS DE REQUÊTES

```typescript
// ✅ Projection explicite — ne jamais récupérer tout
const user = await User.findOne(
  { publicId: id, deletedAt: null },
  { passwordHash: 0, 'security.twoFactorSecret': 0 }  // Exclusion explicite
)

// ✅ Pagination avec cursor (pas skip/limit en prod)
const events = await Event.find({
  status: 'published',
  'schedule.startDate': { $gt: new Date() },
  _id: { $gt: lastId },  // Cursor-based pagination
})
.limit(20)
.sort({ 'schedule.startDate': 1 })

// ❌ INTERDIT en production
await Event.find({}).skip(10000).limit(20) // Performances catastrophiques
```
