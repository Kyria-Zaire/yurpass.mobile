# 🦋 YURPASS — PRODUCT REQUIREMENTS DOCUMENT (PRD)
> Version: 1.0.0
> Statut: Living Document — mis à jour à chaque sprint
> Owner: Équipe Fondateurs Yurpass
> Stack: React Native (Expo) + Hono + MongoDB Atlas + Better Auth

---

## 📌 TABLE DES MATIÈRES

1. [Vision Produit](#1-vision-produit)
2. [Contexte & Problème](#2-contexte--problème)
3. [Utilisateurs & Rôles](#3-utilisateurs--rôles)
4. [Fonctionnalités par Rôle](#4-fonctionnalités-par-rôle)
5. [User Stories](#5-user-stories)
6. [Règles Métier Critiques](#6-règles-métier-critiques)
7. [Architecture Technique](#7-architecture-technique)
8. [Design System](#8-design-system)
9. [Sécurité & Conformité](#9-sécurité--conformité)
10. [Métriques de Succès](#10-métriques-de-succès)
11. [Roadmap Fonctionnelle](#11-roadmap-fonctionnelle)
12. [Hors Scope](#12-hors-scope)

---

## 1. VISION PRODUIT

### Mission
> *"Yurpass réinvente l'accès aux soirées privées — sélectives, thématisées, sécurisées. Chaque invitation est un privilège."*

### Proposition de valeur
Yurpass est une **plateforme mobile communautaire** dédiée aux soirées privées participatives haut de gamme. Elle connecte des hôtes organisateurs, des invités sélectionnés, et des SAM (accompagnateurs de fin de soirée) dans un écosystème fermé, sécurisé et élégant.

### Ce que Yurpass N'est PAS
- ❌ Une billetterie grand public (pas Eventbrite, pas Fever)
- ❌ Une application de rencontre
- ❌ Une plateforme ouverte à tous
- ❌ Un réseau social classique

### Ce que Yurpass EST
- ✅ Un club privé digital avec accès sur invitation/candidature
- ✅ Une plateforme de confiance où chaque membre est vérifié
- ✅ Un outil de gestion complet pour les hôtes organisateurs
- ✅ Un système de sécurité physique via le rôle SAM
- ✅ Une communauté sélective basée sur la réputation

---

## 2. CONTEXTE & PROBLÈME

### Problèmes identifiés
| Problème | Impact | Solution Yurpass |
|----------|--------|-----------------|
| Les soirées privées manquent d'outils de gestion | Hôtes débordés, invités mal gérés | Dashboard hôte complet |
| Aucune sécurité physique organisée | Risques pour les participants | Rôle SAM intégré et traçable |
| Pas de système de réputation entre participants | Comportements imprévisibles | Notation bidirectionnelle |
| Les invitations sont non sécurisées (screenshots) | Crashings, imposteurs | Code d'accès unique + QR |
| Adresse révélée trop tôt = problèmes de sécurité | Intrusions, repérage | Révélation J-24h aux invités validés |

### Marché cible
- Marché français événementiel privé : **+12 milliards €**
- 65% des 20-35 ans préfèrent les événements privés
- 1 utilisateur sur 3 prêt à payer plus pour une expérience premium

---

## 3. UTILISATEURS & RÔLES

### Vue d'ensemble des rôles

```
┌─────────────────────────────────────────────────────────┐
│                    YURPASS ECOSYSTEM                     │
│                                                          │
│  👤 GUEST      🏠 HOST       🛡️ SAM      🌟 MODEL        │
│  Participe     Organise      Sécurise    Influence       │
│                    │                                      │
│              👑 ADMIN                                    │
│           (Équipe Yurpass)                               │
└─────────────────────────────────────────────────────────┘
```

### Détail des rôles

#### 👤 GUEST (Invité)
**Qui** : Jeunes actifs 20-55 ans, urbains, en quête d'expériences exclusives
**Motivations** : Plaisir, reconnaissance sociale, connexions privilégiées
**Accès** : Sur invitation hôte ou candidature validée uniquement

#### 🏠 HOST (Hôte)
**Qui** : Organisateurs passionnés, entrepreneurs, profils influents
**Motivations** : Créer des événements mémorables, construire une communauté
**Responsabilités légales** :
- Responsable de tous ses invités pendant l'événement
- Responsable de la conformité légale de la soirée
- Responsable du respect du règlement Yurpass
- Doit assigner un SAM pour tout événement > 20 personnes

#### 🛡️ SAM (Safe Accompagnateur de fin de soirée Mobile)
**Qui** : Profils de confiance, formés, vérifiés par Yurpass
**Responsabilités** :
- Assurer le raccompagnement sécurisé des invités
- Signaler les comportements dangereux
- Traçabilité complète de chaque mission
- 2FA obligatoire — identité vérifiée par Yurpass

#### 🌟 MODEL (Ambassadeur/Influenceur)
**Qui** : Créateurs de contenu, modèles, entrepreneurs visibles
**Motivations** : Missions rémunérées, codes promo, visibilité
**Accès** : Événements rémunérés + codes promo personnalisés

#### 👑 ADMIN (Équipe Yurpass)
**Qui** : Membres fondateurs + modérateurs Yurpass
**Accès** : Back-office complet, modération, statistiques globales

### Règle multi-rôles
Un utilisateur peut cumuler plusieurs rôles. Exemples valides :
- `host` + `model` → Hôte qui est aussi ambassadeur
- `guest` + `sam` → Invité qui est aussi SAM certifié
- `host` + `sam` → Ne peut pas être son propre SAM (conflit d'intérêt)

---

## 4. FONCTIONNALITÉS PAR RÔLE

### 👤 GUEST — Fonctionnalités

| Priorité | Fonctionnalité | Description |
|----------|---------------|-------------|
| P0 | Inscription & profil | Création compte, vérification email, photo profil |
| P0 | Feed événements | Voir les soirées disponibles (invitations reçues) |
| P0 | Répondre à une invitation | Accepter/décliner avec message optionnel |
| P0 | Code d'accès | Recevoir et présenter son QR/code à l'entrée |
| P1 | Candidature événement | Postuler à une soirée ouverte aux candidatures |
| P1 | Profil public | Réputation, photos partagées, événements passés |
| P1 | Notation hôte | Noter l'hôte et l'événement après participation |
| P1 | SAM request | Demander un SAM pour son raccompagnement |
| P2 | Abonnement Premium | Accès prioritaire, badge premium, filtres exclusifs |
| P2 | Historique | Voir ses soirées passées |

### 🏠 HOST — Fonctionnalités

| Priorité | Fonctionnalité | Description |
|----------|---------------|-------------|
| P0 | Création événement | Formulaire complet : titre, thème, date, lieu, dress code |
| P0 | Gestion liste invités | Inviter, valider, rejeter, liste d'attente |
| P0 | Génération codes accès | Code unique par invité, QR scan à l'entrée |
| P0 | Dashboard événement | Vue temps réel : confirmés, présents, absents |
| P0 | Assignation SAM | Obligatoire si > 20 invités |
| P1 | Révélation adresse | Automatique J-24h aux invités confirmés seulement |
| P1 | Messagerie invités | Communication groupée ou individuelle |
| P1 | Gestion contributions | Valider les apports (boisson, nourriture, etc.) |
| P1 | Notation invités | Noter les invités après événement |
| P1 | Statistiques | Taux de présence, satisfaction, fidélité |
| P2 | Modèles d'événements | Réutiliser une soirée passée comme template |
| P2 | Liste noire privée | Bloquer un invité de ses futurs événements |

### 🛡️ SAM — Fonctionnalités

| Priorité | Fonctionnalité | Description |
|----------|---------------|-------------|
| P0 | Dashboard missions | Voir les missions assignées + détails |
| P0 | Activation mission | Démarrer/terminer une mission avec timestamp |
| P0 | Tracking raccompagnement | Logger chaque trajet (personne + destination + heure) |
| P0 | Signalement incident | Déclarer un incident avec niveau d'urgence |
| P1 | Historique missions | Toutes les missions avec métriques |
| P1 | Notation événement | Évaluer les conditions de travail |
| P2 | Revenus SAM | Suivi des rémunérations missions |

### 🌟 MODEL — Fonctionnalités

| Priorité | Fonctionnalité | Description |
|----------|---------------|-------------|
| P0 | Profil modèle | Portfolio, stats, tarifs |
| P1 | Missions disponibles | Voir les soirées cherchant des modèles |
| P1 | Codes promo | Générer et partager ses codes personnalisés |
| P1 | Statistiques influence | Trafic généré, conversions |
| P2 | Revenus | Suivi des rémunérations |

### 👑 ADMIN — Fonctionnalités

| Priorité | Fonctionnalité | Description |
|----------|---------------|-------------|
| P0 | Dashboard global | Utilisateurs actifs, événements, incidents |
| P0 | Modération utilisateurs | Ban, suspension, modification rôles |
| P0 | Modération contenu | Photos, commentaires, signalements |
| P0 | Gestion SAM | Certification, désactivation |
| P1 | Audit logs | Toutes les actions sensibles traçées |
| P1 | Statistiques business | CA, croissance, rétention |
| P2 | Configuration globale | Paramètres plateforme, thèmes disponibles |

---

## 5. USER STORIES

### Épic 1 — Authentification & Onboarding

```
US-001 | En tant que nouvel utilisateur
        | Je veux créer un compte avec mon email
        | Afin d'accéder à la plateforme Yurpass
        | Critères d'acceptation :
        | - Email de vérification envoyé immédiatement
        | - Compte inactif jusqu'à vérification email
        | - Choix du rôle initial (guest par défaut)
        | - Profil minimal obligatoire (nom, ville, photo)

US-002 | En tant qu'utilisateur inscrit
        | Je veux me connecter avec email + mot de passe
        | Afin d'accéder à mon dashboard
        | Critères d'acceptation :
        | - Blocage après 5 tentatives échouées
        | - 2FA obligatoire pour host/sam/admin
        | - Session persistante 30 jours (refresh token)

US-003 | En tant qu'hôte
        | Je veux activer le 2FA sur mon compte
        | Afin de sécuriser ma responsabilité d'organisateur
        | Critères d'acceptation :
        | - TOTP via app authenticator (Google/Authy)
        | - Codes de secours générés (8 codes)
        | - Impossible de créer un événement sans 2FA activé
```

### Épic 2 — Gestion Événements (HOST)

```
US-010 | En tant qu'hôte
        | Je veux créer une soirée thématisée
        | Afin d'inviter ma communauté sélectionnée
        | Critères d'acceptation :
        | - Champs : titre, thème, date, capacité max, dress code
        | - Adresse complète (non révélée publiquement)
        | - Type d'accès : invitation directe OU candidature
        | - Option : apport obligatoire (boisson, etc.)
        | - SAM assigné obligatoire si capacité > 20

US-011 | En tant qu'hôte
        | Je veux gérer ma liste d'invités
        | Afin de contrôler qui participe à ma soirée
        | Critères d'acceptation :
        | - Inviter par username Yurpass ou email
        | - Valider/rejeter les candidatures avec message
        | - Gérer une liste d'attente
        | - Voir le statut de chaque invité en temps réel

US-012 | En tant qu'hôte
        | Je veux que l'adresse soit révélée automatiquement
        | Afin de préserver la confidentialité jusqu'au dernier moment
        | Critères d'acceptation :
        | - Révélation automatique J-24h avant événement
        | - Uniquement aux invités au statut "confirmed"
        | - Notification push envoyée au moment de la révélation
        | - Hôte peut révéler manuellement avant si souhaité

US-013 | En tant qu'hôte
        | Je veux scanner les codes d'accès à l'entrée
        | Afin de valider la présence de chaque invité
        | Critères d'acceptation :
        | - Scan QR via caméra du téléphone
        | - Ou saisie manuelle du code à 12 caractères
        | - Code invalidé immédiatement après premier scan
        | - Alerte si code invalide / déjà utilisé / expiré
        | - Log de chaque entrée avec timestamp
```

### Épic 3 — Accès Invité (GUEST)

```
US-020 | En tant qu'invité
        | Je veux recevoir mon invitation et code d'accès
        | Afin de pouvoir entrer à la soirée
        | Critères d'acceptation :
        | - Notification push + email à la validation
        | - Code d'accès affiché dans l'app (QR + alphanumérique)
        | - Code valide uniquement 2h avant → fin soirée
        | - Adresse révélée automatiquement J-24h

US-021 | En tant qu'invité
        | Je veux noter la soirée après ma participation
        | Afin de contribuer au système de réputation
        | Critères d'acceptation :
        | - Notation disponible dès le lendemain de la soirée
        | - Fenêtre de notation : 7 jours après événement
        | - Note 1-5 étoiles + commentaire optionnel (300 chars)
        | - Notation de l'hôte ET de l'ambiance générale
```

### Épic 4 — Mission SAM

```
US-030 | En tant que SAM
        | Je veux voir mes missions assignées
        | Afin de me préparer et confirmer ma disponibilité
        | Critères d'acceptation :
        | - Liste missions avec : événement, date, lieu, nb invités
        | - Confirmation de disponibilité requise 48h avant
        | - Coordonnées hôte visibles après confirmation

US-031 | En tant que SAM
        | Je veux logger chaque raccompagnement
        | Afin d'assurer la traçabilité et la sécurité
        | Critères d'acceptation :
        | - Démarrer mission : timestamp automatique
        | - Par trajet : nom invité + destination + heure départ
        | - Confirmer arrivée à destination
        | - Clôturer mission : rapport final
        | - Signalement incident : niveau urgence + description
```

---

## 6. RÈGLES MÉTIER CRITIQUES

### 🔴 Règles Absolues (violation = refus système)

```
RB-001  Un invité ne peut PAS accéder à un événement sans code valide
RB-002  Un code d'accès est à usage unique — invalidé dès le premier scan
RB-003  Un code d'accès expire à la fin de l'événement
RB-004  L'adresse d'un événement ne peut PAS être vue par un invité non confirmé
RB-005  Un hôte DOIT assigner un SAM si capacité > 20 invités
RB-006  Un hôte NE PEUT PAS être son propre SAM
RB-007  Le rôle HOST requiert 2FA activé — impossible de créer sans
RB-008  Le rôle SAM requiert vérification manuelle par l'équipe Yurpass
RB-009  Un utilisateur banni ne peut PAS créer de compte avec le même email
RB-010  Les données d'un compte supprimé sont anonymisées après 30 jours
```

### 🟡 Règles Métier Standard

```
RB-011  Un invité peut annuler jusqu'à 2h avant l'événement
RB-012  Un hôte peut annuler un événement jusqu'à 24h avant
RB-013  La notation n'est disponible que 24h après la fin de l'événement
RB-014  La fenêtre de notation est de 7 jours maximum
RB-015  Le score de réputation est la moyenne pondérée des 12 derniers mois
RB-016  Un hôte peut rejeter une candidature sans justification
RB-017  Un invité peut être sur liste noire privée d'un hôte (sans notification)
RB-018  Les photos d'un événement sont postées uniquement par l'hôte
RB-019  Un modèle reçoit sa rémunération après validation de présence par l'hôte
RB-020  Capacité maximum par événement : 500 personnes
```

---

## 7. ARCHITECTURE TECHNIQUE

### Stack décidée (non négociable)

```
MOBILE          React Native + Expo SDK 51+
                Expo Router (file-based)
                NativeWind (styling)
                Reanimated 3 (animations)
                Zustand (state)
                TanStack Query (data fetching)
                React Hook Form + Zod (forms)
                Expo SecureStore (tokens)
                Expo Camera (QR scan)
                Expo Notifications (push)

BACKEND         Node.js 22 LTS + Hono
                TypeScript strict
                Better Auth (auth + sessions + rôles)
                Mongoose (ODM)
                Zod (validation)
                BullMQ + Redis (queues)
                Socket.io (temps réel)
                Resend (emails)
                Cloudinary (médias)
                nanoid (codes uniques)

DATABASE        MongoDB Atlas (M10+ production)
                MongoDB Compass (monitoring)
                Atlas Search (full-text)

INFRA           Docker + Docker Compose (dev)
                Turborepo (monorepo)
                Railway / Render (prod)
                Cloudflare (CDN + protection)
                GitHub Actions (CI/CD)
```

### Collections MongoDB

```
users           Profils + auth + réputation + sécurité
events          Soirées + venue + capacité + thème
participations  Jointure user↔event + statut + code accès
ratings         Notations bidirectionnelles
auditLogs       Traçabilité complète (2 ans rétention)
notifications   Historique notifications
subscriptions   Abonnements premium
samMissions     Missions SAM + trajets + incidents
```

---

## 8. DESIGN SYSTEM

### Identité visuelle

```
Univers         Luxe contemporain, club privé, élégance urbaine
Ton             Sélectif, confidentiel, premium, humain

Couleurs
  Background    #0A0A0A   Noir profond
  Surface       #111111   Cards principales
  Elevated      #1A1A1A   Cards secondaires
  Accent        #8B5CF6   Violet premium (CTA, highlights)
  Gold          #C9A84C   Or discret (badges, prestige)
  Text          #F5F5F5   Texte principal
  TextMuted     #6B6B6B   Texte secondaire
  Border        #2A2A2A   Bordures subtiles
  Error         #EF4444   Erreurs
  Success       #10B981   Succès

Typographie
  Headings      Playfair Display  → Prestige, éditorial
  Body          Inter             → Lisibilité, modernité
  Accent        Cormorant Garamond→ Élégance, raffinement

Effets
  Glassmorphism sur cards événements
  Blur backgrounds (expo-blur)
  Gradients subtils noir → violet
  Animations d'entrée (FadeInDown springify)
  Haptic feedback sur actions importantes
```

### Composants clés

```
EventCard       Card soirée avec glassmorphism + thème
InvitationCard  Invitation avec sceau à la cire (animé)
AccessCodeView  QR code + code alphanumérique (screenshot bloqué)
UserBadge       Avatar + rôle + score réputation
SAMTracker      Interface mission temps réel
RatingStars     Notation animée
```

---

## 9. SÉCURITÉ & CONFORMITÉ

### Principes fondamentaux
- **Zero Trust** : Chaque requête vérifiée, aucune confiance implicite
- **Privacy by Design** : Données minimales, révélation progressive
- **Audit complet** : Toute action sensible tracée et horodatée

### Points critiques
```
Auth            Better Auth — JWT 15min + Refresh 30j
2FA             Obligatoire HOST / SAM / ADMIN
Rate Limiting   5 tentatives auth, puis blocage
Codes accès     nanoid(12) hashé bcrypt, usage unique, TTL
Adresses        Révélées J-24h aux invités confirmés seulement
Photos          Modération avant publication
RGPD            Soft delete + anonymisation 30j + export
Audit           2 ans de rétention des logs
```

### Conformité légale
- RGPD : consentement explicite, droit à l'oubli, portabilité
- Responsabilité hôte : CGU signées lors de la prise de rôle HOST
- SAM : vérification identité manuelle par l'équipe Yurpass
- Mineurs : vérification âge à l'inscription (18+ obligatoire)

---

## 10. MÉTRIQUES DE SUCCÈS

### KPIs Produit (à mesurer dès MVP)

| Métrique | Définition | Objectif 2025 | Objectif 2026 |
|----------|-----------|---------------|---------------|
| MAU | Utilisateurs actifs/mois | 200 | 800 |
| Events/mois | Événements créés | 2 | 6 |
| Taux confirmation | Invités confirmés / invités | >70% | >80% |
| Taux présence | Présents / confirmés | >80% | >85% |
| NPS | Satisfaction globale | >50 | >65 |
| Score réputation moyen | Moyenne notations | >4.0/5 | >4.2/5 |
| SAM activation | % événements avec SAM | 100% (>20p) | 100% |
| Rétention M1 | Reviennent après 1 mois | >40% | >55% |

### KPIs Sécurité (monitoring continu)

```
0               Incidents physiques liés à un événement
0               Fuites de données utilisateurs
<0.1%           Taux de codes d'accès détournés
100%            Couverture audit log actions sensibles
<500ms          Temps de réponse API P95
99.9%           Uptime plateforme
```

---

## 11. ROADMAP FONCTIONNELLE

### Phase 0 — Fondations (Semaines 1-2)
```
[ ] Monorepo setup (Turborepo + Docker)
[ ] CI/CD GitHub Actions
[ ] MongoDB Atlas configuré
[ ] Better Auth implémenté (inscription + connexion)
[ ] Structure de base mobile (Expo Router + NativeWind)
[ ] Design system tokens
```

### Phase 1 — MVP Core (Semaines 3-8)
```
[ ] Authentification complète (email, 2FA, rôles)
[ ] Profils utilisateurs (tous rôles)
[ ] Création événement (HOST)
[ ] Gestion invités (HOST)
[ ] Invitation + réponse (GUEST)
[ ] Codes d'accès (génération + scan QR)
[ ] Révélation adresse automatique J-24h
[ ] Notifications push
```

### Phase 2 — Communauté (Semaines 9-14)
```
[ ] Système de notation bidirectionnel
[ ] Score de réputation calculé
[ ] Photos post-événement
[ ] Missions SAM complètes
[ ] Messagerie hôte → invités
[ ] Dashboard statistiques HOST
[ ] Back-office ADMIN basique
```

### Phase 3 — Monétisation (Semaines 15-20)
```
[ ] Abonnements Premium (Stripe)
[ ] Rôle MODEL + missions rémunérées
[ ] Codes promo personnalisés
[ ] Partenariats marques (back-office)
[ ] Analytics avancées
```

### Phase 4 — Scale (2026+)
```
[ ] Expansion multi-villes
[ ] Offre B2B (marque blanche hôtes premium)
[ ] API partenaires
[ ] Programme fidélité
```

---

## 12. HORS SCOPE (MVP)

```
❌ Paiement en ligne des billets (Phase 3)
❌ Chat en temps réel entre membres
❌ Stories / contenu éphémère
❌ Géolocalisation temps réel des invités
❌ Intégration réseaux sociaux externes
❌ Application web (mobile uniquement pour MVP)
❌ Support multi-langues (français uniquement pour MVP)
❌ Programme de parrainage automatisé
❌ Marketplace fournisseurs (traiteurs, DJ, etc.)
```

---

*Document maintenu par l'équipe fondatrice Yurpass.*
*Toute modification majeure doit être validée par le CTO et le CEO.*
*Dernière mise à jour : 2025 — Version 1.0.0*
