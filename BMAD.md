# 🦋 YURPASS — MÉTHODE BMAD
## Breakthrough Method for Agile AI Development
> Version: 1.0.0
> Adapté pour : Vibe Coding avec Claude Code + Cursor
> Projet : Yurpass — Plateforme événementielle privée premium

---

## 📌 QU'EST-CE QUE BMAD ?

BMAD est une **méthode de développement agile adaptée au vibe coding avec l'IA**.
Elle structure la collaboration humain ↔ IA pour produire un code **senior, cohérent et sécurisé** sans partir dans tous les sens.

**BMAD = B**reakdown → **M**ap → **A**ct → **D**ebrief

Chaque fonctionnalité passe par ces 4 étapes avant qu'une seule ligne de code soit écrite.

---

## 🧠 PHILOSOPHIE BMAD YURPASS

```
1. ON PENSE AVANT DE CODER
   Jamais de prompt "code moi un truc" sans contexte.
   Chaque session IA commence par le contexte + la règle + l'objectif.

2. L'IA EST UN SENIOR DEV, PAS UN STAGIAIRE
   Les fichiers .claude/ et .cursor/rules/ cadrent le comportement.
   On ne répète pas les règles à chaque fois — elles sont chargées automatiquement.

3. UN TICKET = UNE SESSION
   Une fonctionnalité = une conversation IA dédiée.
   Pas de mélange de sujets dans la même session.

4. ON VALIDE AVANT DE CONTINUER
   Chaque étape BMAD est validée par un humain avant de passer à la suivante.
   L'IA ne décide pas seule de changer de direction.

5. LA SÉCURITÉ N'EST PAS OPTIONNELLE
   Tout code généré est relu avec le prisme sécurité avant merge.
   Les règles security.md s'appliquent sans exception.
```

---

## 📋 LES 4 ÉTAPES BMAD

---

### B — BREAKDOWN (Décomposition)

**Objectif** : Décomposer la fonctionnalité en tâches atomiques avant de coder.

**Template Breakdown :**
```markdown
## BREAKDOWN — [Nom de la fonctionnalité]

### Contexte
Quelle partie du PRD cette fonctionnalité couvre-t-elle ?
Référence : [US-XXX] ou [RB-XXX]

### Tâches atomiques
- [ ] T1 : [Tâche précise et mesurable]
- [ ] T2 : [Tâche précise et mesurable]
- [ ] T3 : ...

### Dépendances
- Nécessite que [X] soit déjà implémenté
- Bloqué par [Y] si non terminé

### Risques identifiés
- Risque sécurité : [description]
- Risque technique : [description]

### Définition of Done (DoD)
- [ ] TypeScript strict — zéro erreur
- [ ] Zod validation sur tous les inputs
- [ ] Tests unitaires sur logique métier
- [ ] Audit log si action sensible
- [ ] Code reviewé par un humain
- [ ] Pas de console.log, pas de any
```

---

### M — MAP (Cartographie)

**Objectif** : Mapper chaque tâche sur les fichiers/modules concernés avant de coder.

**Template Map :**
```markdown
## MAP — [Nom de la fonctionnalité]

### Fichiers à créer
| Fichier | Localisation | Description |
|---------|-------------|-------------|
| event.model.ts | apps/api/src/models/ | Schéma Mongoose événement |
| event.service.ts | apps/api/src/services/ | Logique métier |
| event.controller.ts | apps/api/src/controllers/ | Traitement requêtes |
| events.routes.ts | apps/api/src/routes/ | Définition routes Hono |
| event.validator.ts | packages/validators/src/ | Schémas Zod partagés |

### Fichiers à modifier
| Fichier | Modification |
|---------|-------------|
| apps/mobile/app/(app)/(host)/_layout.tsx | Ajouter route création événement |
| packages/types/src/index.ts | Ajouter types Event |

### Types partagés à créer
| Type | Description |
|------|-------------|
| IEvent | Interface TypeScript événement complet |
| CreateEventInput | Type input création (depuis Zod) |
| EventStatus | Enum statuts événement |

### Index MongoDB à créer
| Collection | Index | Raison |
|-----------|-------|--------|
| events | { hostId: 1 } | Filtrer par hôte |
| events | { status: 1, startDate: 1 } | Feed événements |
```

---

### A — ACT (Action / Coding)

**Objectif** : Coder en sessions IA structurées, une tâche à la fois.

#### Template de prompt BMAD pour Claude Code / Cursor

```markdown
## CONTEXTE
Je travaille sur Yurpass — plateforme mobile événementielle privée premium.
Stack : React Native Expo + Hono + MongoDB Atlas + Better Auth + TypeScript strict.
Consulte CLAUDE.md et les rules .cursor/ pour les conventions.

## TÂCHE ACTUELLE
[Description précise de la tâche atomique]
Référence PRD : [US-XXX]
Fichiers concernés : [liste des fichiers du MAP]

## CE QUI EXISTE DÉJÀ
[Décrire le code existant pertinent ou coller les extraits]

## ATTENDU
[Décrire précisément le résultat attendu]

## CONTRAINTES
- TypeScript strict (no any)
- Zod validation sur tous les inputs
- [Contrainte sécurité spécifique si applicable]
- [Règle métier RB-XXX si applicable]

## FORMAT DE RÉPONSE
1. Plan d'implémentation (bullet points)
2. Code complet des fichiers concernés
3. Tests unitaires si logique métier complexe
4. Points d'attention sécurité
```

#### Règles de session IA

```
✅ Une session = une tâche atomique du MAP
✅ Toujours commencer par "lis les fichiers existants avant de coder"
✅ Valider le plan avant de générer le code
✅ Relire le code généré avant de l'accepter
✅ Committer après chaque tâche validée (Conventional Commits)

❌ Ne jamais demander "code moi toute la fonctionnalité"
❌ Ne jamais accepter du code sans le lire
❌ Ne jamais skipper la validation du plan
❌ Ne jamais mélanger deux fonctionnalités dans une session
❌ Ne jamais committer sans avoir testé
```

---

### D — DEBRIEF (Revue)

**Objectif** : Valider la fonctionnalité complète avant de la merger.

**Template Debrief :**
```markdown
## DEBRIEF — [Nom de la fonctionnalité]
Date : [date]
Développeur : [nom]
Branch : feature/[nom]

### Checklist technique
- [ ] Tous les fichiers du MAP créés/modifiés
- [ ] TypeScript strict — tsc --noEmit passe sans erreur
- [ ] ESLint passe sans warning
- [ ] Tests unitaires passent
- [ ] Build mobile passe (expo export)
- [ ] Build API passe

### Checklist sécurité
- [ ] Zod validation sur tous les inputs API
- [ ] Middleware auth sur toutes les routes protégées
- [ ] Pas de données sensibles dans les logs
- [ ] Audit log ajouté si action sensible
- [ ] Pas de _id MongoDB exposé directement
- [ ] Rate limiting vérifié

### Checklist design
- [ ] Tokens de couleur Yurpass respectés (#0A0A0A, #8B5CF6, etc.)
- [ ] Animations Reanimated si interaction utilisateur
- [ ] Responsive (mobile first)
- [ ] États de chargement gérés (skeleton / loading)
- [ ] États d'erreur gérés (message utilisateur clair)

### Régression
- [ ] Les fonctionnalités existantes ne sont pas cassées
- [ ] Tests d'intégration passent

### Notes
[Observations, décisions prises, dette technique identifiée]

### Décision
- [ ] ✅ APPROVED — Prêt pour merge sur develop
- [ ] 🔄 CHANGES REQUESTED — [description des changements]
- [ ] ❌ REJECTED — [raison du rejet]
```

---

## 🗂️ BACKLOG YURPASS — TICKETS BMAD

### Format d'un ticket

```markdown
---
ID: YP-XXX
Titre: [Titre court]
Épic: [Nom de l'épic]
Priorité: P0 / P1 / P2
Statut: TODO / IN PROGRESS / REVIEW / DONE
Référence PRD: US-XXX / RB-XXX
Estimé: [S / M / L / XL]
Assigné: [Claude Code / Cursor / Humain]
---

### Description
[Description claire de la fonctionnalité]

### Critères d'acceptation
- [ ] Critère 1
- [ ] Critère 2

### Notes techniques
[Informations techniques utiles pour l'IA]
```

---

### 📌 BACKLOG PHASE 0 — Fondations

```markdown
---
ID: YP-001
Titre: Setup monorepo Turborepo
Priorité: P0 | Statut: TODO
Estimé: M
---
Initialiser le monorepo avec Turborepo.
Structure : apps/mobile, apps/api, packages/types, packages/validators, packages/ui
Critères :
- [ ] turbo.json configuré
- [ ] Workspaces yarn/pnpm configurés
- [ ] TypeScript partagé entre packages
- [ ] Build pipeline fonctionnel

---
ID: YP-002
Titre: Setup Docker Compose développement
Priorité: P0 | Statut: TODO
Estimé: S
---
Docker Compose pour le dev local.
Services : api (Node.js), redis (BullMQ), nginx (reverse proxy)
MongoDB Atlas (pas de container Mongo — Atlas uniquement)
Critères :
- [ ] docker-compose.yml fonctionnel
- [ ] Hot reload API en dev
- [ ] Variables d'environnement via .env.local

---
ID: YP-003
Titre: Connexion MongoDB Atlas + modèles de base
Priorité: P0 | Statut: TODO
Estimé: M
---
Configurer MongoDB Atlas et créer les modèles Mongoose fondamentaux.
Modèles : User, Event, Participation, AuditLog
Critères :
- [ ] Connexion Atlas avec retry logic
- [ ] Mongoose strict mode activé
- [ ] Index créés explicitement
- [ ] Soft delete sur User et Event
- [ ] Transform JSON (masquer _id, passwordHash)

---
ID: YP-004
Titre: GitHub Actions CI/CD
Priorité: P0 | Statut: TODO
Estimé: M
---
Pipeline CI sur chaque PR.
Critères :
- [ ] TypeScript check (tsc --noEmit)
- [ ] ESLint
- [ ] Tests Jest
- [ ] Build check
- [ ] npm audit (sécurité deps)
```

---

### 📌 BACKLOG PHASE 1 — MVP Core

```markdown
---
ID: YP-010
Titre: Authentification complète (Better Auth)
Priorité: P0 | Statut: TODO
Estimé: XL
---
Système auth complet avec Better Auth.
Critères :
- [ ] Inscription email + vérification
- [ ] Connexion + sessions JWT
- [ ] 2FA TOTP (obligatoire HOST/SAM/ADMIN)
- [ ] Refresh token rotation
- [ ] Rate limiting 5 tentatives
- [ ] Blocage compte après échecs
- [ ] Middleware rôles (requireRole)
- [ ] RGPD : suppression + export compte

---
ID: YP-011
Titre: Profil utilisateur multi-rôles
Priorité: P0 | Statut: TODO
Estimé: L
---
Création et édition du profil utilisateur.
Critères :
- [ ] Champs : nom affiché, ville, bio, photo
- [ ] Upload photo via Cloudinary
- [ ] Sélection rôle(s) initial(aux)
- [ ] Score réputation affiché (calculé)
- [ ] Profil public vs privé

---
ID: YP-020
Titre: Création événement (HOST)
Priorité: P0 | Statut: TODO
Estimé: XL
---
Formulaire complet de création de soirée.
Critères :
- [ ] Champs : titre, thème, date, capacité, dress code
- [ ] Adresse complète (non publique)
- [ ] Type d'accès : invitation / candidature
- [ ] Option apport obligatoire
- [ ] 2FA requis avant création
- [ ] Assignation SAM si > 20 invités (RB-005)
- [ ] Validation Zod complète

---
ID: YP-021
Titre: Gestion liste invités (HOST)
Priorité: P0 | Statut: TODO
Estimé: L
---
Interface de gestion des invités par l'hôte.
Critères :
- [ ] Inviter par username ou email
- [ ] Valider / rejeter avec message
- [ ] Liste d'attente automatique si complet
- [ ] Vue temps réel (Socket.io)
- [ ] Statuts : pending / approved / rejected / waitlist / attended

---
ID: YP-022
Titre: Codes d'accès + scan QR
Priorité: P0 | Statut: TODO
Estimé: L
---
Génération et validation des codes d'accès.
Critères :
- [ ] Génération nanoid(12) hashé bcrypt
- [ ] QR code généré côté mobile
- [ ] Scan via Expo Camera
- [ ] Usage unique — invalidé après scan (RB-002)
- [ ] TTL : valide 2h avant → fin événement (RB-003)
- [ ] Audit log sur chaque scan
- [ ] Screenshot prevention sur l'écran code

---
ID: YP-023
Titre: Révélation adresse automatique J-24h
Priorité: P0 | Statut: TODO
Estimé: M
---
Système de révélation progressive de l'adresse.
Critères :
- [ ] CRON job vérifiant toutes les heures
- [ ] Révélation uniquement aux statut "confirmed" (RB-004)
- [ ] Notification push au moment de la révélation
- [ ] Hôte peut révéler manuellement avant
- [ ] Adresse jamais visible aux non-confirmés

---
ID: YP-030
Titre: Notifications push
Priorité: P1 | Statut: TODO
Estimé: M
---
Système de notifications push via Expo.
Critères :
- [ ] Invitation reçue
- [ ] Candidature acceptée/refusée
- [ ] Révélation adresse J-24h
- [ ] Rappel J-1 événement
- [ ] Mission SAM assignée
- [ ] Notation disponible (J+1)
```

---

### 📌 BACKLOG PHASE 2 — Communauté

```markdown
---
ID: YP-040
Titre: Système de notation bidirectionnel
Priorité: P1 | Statut: TODO
Estimé: L
---
Notation guest ↔ host après chaque événement.
Critères :
- [ ] Disponible J+1 après fin événement
- [ ] Fenêtre 7 jours (RB-014)
- [ ] Note 1-5 + commentaire 300 chars
- [ ] Guest note l'hôte + l'événement
- [ ] Hôte note chaque invité
- [ ] Score réputation recalculé automatiquement

---
ID: YP-050
Titre: Missions SAM complètes
Priorité: P1 | Statut: TODO
Estimé: XL
---
Module SAM complet avec traçabilité.
Critères :
- [ ] Dashboard missions SAM
- [ ] Confirmation disponibilité 48h avant
- [ ] Activation mission (timestamp)
- [ ] Log trajets (invité + destination + heure)
- [ ] Confirmation arrivée
- [ ] Signalement incident (niveaux : info / warning / urgent)
- [ ] Clôture mission + rapport
- [ ] Audit log complet

---
ID: YP-060
Titre: Back-office ADMIN
Priorité: P1 | Statut: TODO
Estimé: XL
---
Panel d'administration Yurpass.
Critères :
- [ ] Dashboard : MAU, événements, incidents
- [ ] Gestion utilisateurs (ban, suspension, rôles)
- [ ] Modération photos et commentaires
- [ ] Certification SAM (validation manuelle)
- [ ] Consultation audit logs
- [ ] Alertes temps réel
```

---

## 🔄 WORKFLOW QUOTIDIEN BMAD

### Session de développement type

```
1. BRIEF (5 min)
   → Choisir le ticket à traiter dans le backlog
   → Vérifier les dépendances (ticket bloquant ?)
   → Faire le BREAKDOWN si pas encore fait

2. MAP (10 min)
   → Lister les fichiers à créer/modifier
   → Identifier les types partagés
   → Identifier les index MongoDB si applicable

3. CODE (30-90 min)
   → Session Claude Code ou Cursor
   → Un prompt BMAD par tâche atomique
   → Committer après chaque tâche validée

4. DEBRIEF (15 min)
   → Checklist technique + sécurité + design
   → Créer la PR sur GitHub
   → Mettre à jour le statut du ticket

5. REVIEW (variable)
   → Revue humaine du code
   → Merge sur develop si approved
```

---

## 📐 CONVENTIONS DE NOMMAGE TICKETS

```
YP-001 à YP-099   Phase 0 — Fondations
YP-100 à YP-199   Phase 1 — MVP Core
YP-200 à YP-299   Phase 2 — Communauté
YP-300 à YP-399   Phase 3 — Monétisation
YP-400 à YP-499   Phase 4 — Scale
YP-900 à YP-999   Bugs & Hotfixes
YP-SEC-XXX        Tickets sécurité (traitement prioritaire)
```

---

## ⚡ PROMPTS BMAD PRÊTS À L'EMPLOI

### Prompt : Nouveau modèle Mongoose
```
Contexte Yurpass (stack : Hono + Mongoose + TypeScript strict).
Consulte CLAUDE.md et database.md pour les conventions.

Crée le modèle Mongoose pour [NOM_COLLECTION] avec :
- publicId nanoid(10) comme identifiant public
- Soft delete (deletedAt)
- Transform JSON (masquer _id, __v, champs sensibles)
- Index explicites sur : [CHAMPS]
- Timestamps automatiques

Interface TypeScript associée dans packages/types/src/[nom].ts
Schéma Zod de création dans packages/validators/src/[nom].ts
```

### Prompt : Nouvelle route Hono
```
Contexte Yurpass (stack : Hono + Better Auth + Zod + TypeScript strict).
Consulte CLAUDE.md, backend.md et security.md.

Crée la route [METHODE] [PATH] pour [DESCRIPTION].
Référence PRD : [US-XXX]

La route doit :
- Avoir le middleware authMiddleware en premier
- Avoir requireRole(['[ROLES]']) si route protégée
- Valider l'input avec zValidator et le schéma Zod [SCHEMA]
- Appeler [SERVICE].method() pour la logique métier
- Retourner { success: true, data: ... } ou handleApiError
- Logger l'action si action sensible (AuditAction.[ACTION])

Crée aussi le service [NOM]Service avec la logique métier isolée.
```

### Prompt : Nouveau screen Expo
```
Contexte Yurpass (stack : Expo Router + NativeWind + Reanimated 3 + TypeScript strict).
Consulte CLAUDE.md et mobile.md pour les conventions.

Crée le screen [NOM] à l'emplacement apps/mobile/app/[PATH].tsx

Design system Yurpass :
- Background : #0A0A0A
- Cards : #111111 avec border #2A2A2A
- Accent : #8B5CF6
- Text : #F5F5F5
- Animations : FadeInDown.springify() sur les éléments

Le screen doit :
- Être typé TypeScript strict
- Utiliser NativeWind pour le styling (pas de StyleSheet)
- Avoir une animation d'entrée sur les éléments principaux
- Gérer les états : loading (skeleton) / error / data
- Utiliser useQuery (TanStack) pour les données
```

### Prompt : Audit de sécurité
```
Contexte Yurpass. Consulte security.md et CLAUDE.md.

Fais un audit de sécurité complet du fichier [FICHIER].
Vérifie :
1. Validation des inputs (Zod présent ?)
2. Middleware auth présent sur les routes protégées ?
3. Pas de données sensibles dans les logs ?
4. Pas de _id MongoDB exposé directement ?
5. Rate limiting si route auth ou action sensible ?
6. Audit log si action sensible ?
7. Gestion d'erreur explicite (pas de catch vide) ?
8. Pas de any TypeScript ?

Rapport format : [OK] / [⚠️ WARNING] / [🔴 CRITICAL] par point.
```

---

## 📝 GLOSSAIRE YURPASS

```
GUEST       Invité participant à une soirée
HOST        Hôte organisateur — responsable légal de son événement
SAM         Safe Accompagnateur Mobile — sécurité physique fin de soirée
MODEL       Ambassadeur/Influenceur — missions rémunérées
ADMIN       Équipe Yurpass — accès back-office complet
Code accès  nanoid(12) unique par invité, QR + alphanumérique
Apport      Contribution physique d'un invité (bouteille, nourriture...)
Thème       Identité visuelle + dress code d'une soirée
Réputation  Score calculé sur 12 mois de notations reçues
Mission SAM Assignation d'un SAM à un événement > 20 personnes
RB          Règle Métier (Business Rule) — non négociable
US          User Story — fonctionnalité du point de vue utilisateur
P0          Priorité critique — bloque le MVP
P1          Priorité haute — MVP complet
P2          Priorité standard — version suivante
DoD         Definition of Done — critères de validation
```

---

*BMAD Yurpass — Méthode interne équipe technique.*
*Respecter ce document = coder comme un senior.*
*Le vibe coding sans méthode = dette technique assurée.*
