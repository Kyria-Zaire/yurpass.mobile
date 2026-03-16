---
description: Yurpass — Règles Cybersécurité (CRITIQUE)
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
---

# 🛡️ YURPASS — RÈGLES CYBERSÉCURITÉ

## ⚠️ CONTEXTE LÉGAL ET HUMAIN
Yurpass organise des soirées privées avec des personnes physiques.
Le SAM assure la **sécurité physique** des participants.
Les hôtes sont **légalement responsables** de leurs événements.
Une faille de sécurité peut avoir des conséquences **pénales réelles**.

**Ce fichier est non-négociable. Chaque règle est là pour une raison.**

---

## 🔒 AUTHENTIFICATION — OWASP A07

### Better Auth — Configuration minimale requise
```typescript
// ✅ Configuration Better Auth sécurisée
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,      // Min 32 chars, random
  session: {
    expiresIn: 60 * 15,                // 15 min access token
    updateAge: 60 * 60 * 24,           // Refresh si < 24h
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,    // OBLIGATOIRE
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  rateLimit: {
    window: 60,                        // 60 secondes
    max: 5,                            // 5 tentatives max
    storage: 'redis',                  // Persistant
  },
})
```

### Règles mot de passe
- Minimum **12 caractères**
- Doit contenir : majuscule + minuscule + chiffre + symbole
- Vérification contre liste de mots de passe compromis (HaveIBeenPwned API)
- **Jamais** stocké en clair — bcrypt rounds 12 minimum

### 2FA — Obligatoire pour rôles sensibles
- `host` → 2FA TOTP obligatoire dès création premier événement
- `admin` → 2FA TOTP obligatoire à l'inscription
- `sam` → 2FA TOTP obligatoire (gère la sécurité physique)
- `guest` / `model` → 2FA optionnel mais encouragé

---

## 🌐 SÉCURITÉ API — OWASP A01, A03, A05

### Headers obligatoires (Hono middleware)
```typescript
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", 'res.cloudinary.com'],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
}))
```

### CORS — Whitelist stricte
```typescript
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://yurpass.com',
      'https://app.yurpass.com',
      // Dev uniquement en NODE_ENV=development
      ...(env.NODE_ENV === 'development' ? ['http://localhost:8081'] : []),
    ]
    return allowed.includes(origin ?? '') ? origin : null
  },
  credentials: true,
}))
```

### Rate Limiting par route
```typescript
// Auth routes → très strict
authRoutes: { windowMs: 15min, max: 5 }

// API routes générales → modéré
apiRoutes: { windowMs: 1min, max: 60 }

// Upload routes → très strict
uploadRoutes: { windowMs: 1h, max: 10 }

// Code accès scan → ultra strict
scanRoutes: { windowMs: 1min, max: 3 }
```

---

## 💉 INJECTION & VALIDATION — OWASP A03

### Règle absolue : Zod sur TOUT
```typescript
// ✅ CHAQUE input validé avec Zod — sans exception
const createEventSchema = z.object({
  title: z.string().min(3).max(100).trim(),
  description: z.string().max(2000).trim().optional(),
  date: z.string().datetime(),
  maxGuests: z.number().int().min(2).max(500),
  themeId: z.string().nanoid(),
  isPrivate: z.boolean().default(true),
  location: z.object({
    city: z.string().max(100),
    venueCode: z.string().max(50).optional(), // Pas d'adresse exacte publique
  }),
})

// ❌ JAMAIS accepter des données non validées
app.post('/events', (c) => {
  const body = await c.req.json() // ← INTERDIT sans validation
})
```

### NoSQL Injection — MongoDB
```typescript
// ✅ Toujours sanitiser les inputs MongoDB
import mongoSanitize from 'express-mongo-sanitize'

// ❌ JAMAIS construire des queries avec des strings utilisateur
// Utiliser les opérateurs Mongoose typés uniquement
```

---

## 📁 UPLOAD FICHIERS — OWASP A04

```typescript
// ✅ Validation stricte des uploads
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const validateUpload = (file: File): void => {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new AppError('Type de fichier non autorisé', 400, 'INVALID_MIME')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError('Fichier trop volumineux', 400, 'FILE_TOO_LARGE')
  }
  // Vérifier le magic bytes — pas juste l'extension
  // Scanner avec ClamAV en production
}
```

---

## 🔑 CODES D'ACCÈS — SYSTÈME CRITIQUE

```typescript
// Génération
const code = nanoid(12) // Cryptographiquement sécurisé

// Stockage — hashé en base (jamais en clair)
const hashedCode = await bcrypt.hash(code, 10)

// Règles d'invalidation STRICTES
const accessCodeRules = {
  validFrom: subHours(event.startDate, 2),   // Valide 2h avant
  validUntil: event.endDate,                  // Invalide après
  maxUses: 1,                                 // Usage UNIQUE
  invalidatedAfterScan: true,                 // Immédiatement
}

// Log audit OBLIGATOIRE à chaque scan
await AuditLog.create({
  action: 'ACCESS_CODE_SCAN',
  userId: scanner.id,
  eventId: event.id,
  timestamp: new Date(),
  deviceInfo: c.req.header('user-agent'),
  ipAddress: c.req.header('x-forwarded-for'),
  result: 'SUCCESS' | 'INVALID' | 'EXPIRED' | 'ALREADY_USED',
})
```

---

## 📊 AUDIT LOGGING — TRAÇABILITÉ COMPLÈTE

### Actions loggées obligatoirement
```typescript
enum AuditAction {
  // Auth
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  USER_2FA_ENABLED = 'USER_2FA_ENABLED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  // Rôles
  ROLE_GRANTED = 'ROLE_GRANTED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  // Événements
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_CANCELLED = 'EVENT_CANCELLED',
  EVENT_GUEST_ADDED = 'EVENT_GUEST_ADDED',
  EVENT_GUEST_REMOVED = 'EVENT_GUEST_REMOVED',
  // Accès
  ACCESS_CODE_SCAN = 'ACCESS_CODE_SCAN',
  ACCESS_CODE_REFUSED = 'ACCESS_CODE_REFUSED',
  // Modération
  USER_REPORTED = 'USER_REPORTED',
  USER_BANNED = 'USER_BANNED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  CONTENT_MODERATED = 'CONTENT_MODERATED',
  // SAM
  SAM_MISSION_STARTED = 'SAM_MISSION_STARTED',
  SAM_MISSION_COMPLETED = 'SAM_MISSION_COMPLETED',
}
```

---

## 🔐 DONNÉES SENSIBLES — RGPD + PROTECTION

### Ce qui n'est JAMAIS logué
- Mots de passe (même hashés)
- Tokens d'accès
- Données bancaires
- Numéros de téléphone
- Localisation précise des événements (sauf pour les invités validés)
- Photos d'identité

### Chiffrement au repos
- Données sensibles users : Atlas Encryption at Rest (AES-256)
- Tokens : Expo SecureStore côté mobile (Keychain iOS / Keystore Android)
- Codes d'accès : hashés avec bcrypt avant stockage

### Droits RGPD
```typescript
// Soft delete obligatoire
user.deletedAt = new Date()
// Anonymisation des données 30 jours après suppression
// Export des données sur demande (endpoint dédié)
```

---

## 🚨 INCIDENT RESPONSE

### En cas de suspicion de compromission
1. **Invalider immédiatement** tous les refresh tokens de l'utilisateur concerné
2. **Logger** l'incident avec maximum de contexte
3. **Notifier** l'équipe (webhook Discord/Slack admin)
4. **Bloquer** l'IP suspecte
5. **Auditer** les dernières actions de l'utilisateur

```typescript
export async function revokeAllSessions(userId: string, reason: string) {
  await Session.updateMany({ userId }, { invalidated: true })
  await AuditLog.create({ action: 'SESSIONS_REVOKED', userId, reason })
  await notifyAdmins(`🚨 Sessions révoquées: ${userId} — ${reason}`)
}
```
