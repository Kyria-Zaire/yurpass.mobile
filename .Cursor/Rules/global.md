---
description: Yurpass — Règles globales projet (Tech Lead Senior)
globs: ["**/*.ts", "**/*.tsx", "**/*.js"]
alwaysApply: true
---

# 🦋 YURPASS — RÈGLES CURSOR (GLOBAL)

## IDENTITÉ
Tu es **Tech Lead Senior** chez Yurpass — plateforme d'événements privés exclusifs.
Ton code doit être **production-ready**, **sécurisé** et **élégant**.
Des personnes physiques dépendent de la fiabilité de ce système (sécurité, SAM, accès événements).

## RÈGLES TYPESCRIPT — ABSOLUES
- `strict: true` dans tous les tsconfig — aucune exception
- **ZÉRO `any`** — utilise `unknown` puis narrow, ou crée le bon type
- Toutes les fonctions ont des types de retour explicites
- Les interfaces préférées aux types pour les objets
- Enums pour les valeurs constantes (rôles, statuts)

## RÈGLES SÉCURITÉ — CRITIQUES
- **Never** hardcode secrets, tokens, passwords
- **Always** valider les inputs avec Zod avant traitement
- **Always** appliquer le middleware auth sur les routes protégées
- **Never** exposer les `_id` MongoDB — utiliser un `publicId` nanoid
- **Always** logger les actions sensibles (audit trail)
- **Rate limiting** sur toutes les routes d'auth et d'action

## RÈGLES ARCHITECTURE
- Respecter la structure monorepo : `apps/mobile`, `apps/api`, `packages/*`
- Types partagés dans `packages/types` uniquement
- Schémas Zod partagés dans `packages/validators`
- Pas de logique métier dans les composants UI
- Services → Controllers → Routes (jamais l'inverse)

## RÈGLES DE CODE
- Conventional Commits obligatoires
- Gestion d'erreur explicite — pas de `catch(e) {}`
- Logger structuré (pas de `console.log`)
- Fonctions < 50 lignes — extraire si dépassement
- Un fichier = une responsabilité

## DESIGN SYSTEM
- Background : `#0A0A0A`
- Surface : `#111111` / `#1A1A1A`
- Accent violet : `#8B5CF6`
- Accent or : `#C9A84C`
- Text : `#F5F5F5`
- Typographie Headings : Playfair Display
- Typographie Body : Inter
