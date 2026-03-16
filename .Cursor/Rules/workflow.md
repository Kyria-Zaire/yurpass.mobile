---
description: Yurpass — Règles Git, CI/CD & Workflow
globs: ["**/*"]
alwaysApply: false
---

# 🔄 YURPASS — RÈGLES GIT & WORKFLOW

## BRANCHES

```
main          → Production uniquement — protégée, merge via PR
develop       → Intégration — base de travail quotidien
feature/*     → Nouvelles fonctionnalités
fix/*         → Corrections de bugs
security/*    → Patches de sécurité (priorité maximale)
hotfix/*      → Corrections urgentes production
```

### Règles de protection `main`
- Merge uniquement via Pull Request
- Minimum 1 review requise
- CI doit passer (tests + lint + build)
- No force push — jamais

---

## CONVENTIONAL COMMITS — OBLIGATOIRE

```
<type>(<scope>): <description courte>

[body optionnel]

[footer optionnel]
```

### Types autorisés
```
feat      → Nouvelle fonctionnalité
fix       → Correction de bug
security  → Patch de sécurité (priorité review)
refactor  → Refactoring sans changement de comportement
perf      → Amélioration de performance
test      → Ajout ou modification de tests
docs      → Documentation uniquement
chore     → Maintenance (deps, config)
ci        → CI/CD
```

### Scopes Yurpass
```
auth, events, users, sam, ratings, media,
notifications, payments, admin, mobile, api, db
```

### Exemples corrects
```
feat(events): ajout système codes accès avec TTL automatique
fix(auth): correction rotation refresh token après 2FA
security(api): renforcement rate limiting sur routes auth
feat(sam): ajout tracking mission SAM en temps réel
refactor(users): extraction logique réputation dans service dédié
```

---

## .gitignore — FICHIERS CRITIQUES À EXCLURE

```gitignore
# Environnement — JAMAIS committé
.env
.env.local
.env.*.local
.env.production

# Dépendances
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.expo/
.next/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
.idea/
*.swp

# Logs
*.log
logs/

# Tests
coverage/

# Clés & certificats
*.pem
*.key
*.cert
*.p12
*.keystore

# Turbo cache
.turbo/
```

---

## CI/CD — GITHUB ACTIONS

### Pipeline sur chaque PR
```yaml
# .github/workflows/ci.yml
steps:
  - TypeScript check (tsc --noEmit)
  - ESLint + Prettier
  - Tests unitaires (Jest)
  - Tests d'intégration (API)
  - Audit sécurité deps (npm audit)
  - Build check (mobile + api)
```

### Pipeline production (merge main)
```yaml
steps:
  - Tout le CI
  - Build Docker image
  - Push registry
  - Deploy staging → smoke tests → deploy prod
  - Notification équipe
```

---

## VARIABLES D'ENVIRONNEMENT

### Structure `.env.example` (committé)
```env
# App
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=yurpass

# Redis
REDIS_URL=redis://localhost:6379

# Auth
BETTER_AUTH_SECRET=<min-32-chars-random-string>
BETTER_AUTH_URL=http://localhost:3000

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Resend (emails)
RESEND_API_KEY=

# Mobile
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Gestion des secrets
- **Développement** : `.env.local` (jamais committé)
- **CI/CD** : GitHub Secrets
- **Production** : Variables d'environnement plateforme (Railway/Render)
- **Rotation** : Secrets rotatifs tous les 90 jours
