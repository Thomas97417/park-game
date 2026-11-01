# Parkside — Park Game

Un city builder de parking en français, réalisé avec React 19, TanStack Start, Convex et Tailwind CSS v4. Aménagez les abords d’un commerce, accueillez les clients et encaissez le stationnement à la sortie.

## Jouer

La route `/` ouvre directement le jeu, sans compte obligatoire. Chaque nouveau contrat commence sur un terrain vide de 46 × 32 cases. Seuls le commerce, son accès piéton et la voirie publique sont conservés. Construisez vos accès et vos places, puis cliquez sur **Ouvrir**. Aucun entretien ni pénalité ne s’applique avant l’ouverture.

- **Construire** : une seule barre inférieure regroupe les outils, les indicateurs et la simulation. Routes par glisser, places orientables, passages piétons, barrières de paiement, entrées, ronds-points, arbres, lampadaires, bancs et massifs. Une route remplace automatiquement les décors qui occupent son tracé.
- **Circuler** : chaque voiture suit un itinéraire réel sur le réseau, réserve une place accessible, attend la fin des courses, puis paie une seule fois à une barrière de sortie. Des piétons rejoignent le magasin.
- **Gérer** : ajustez le tarif, surveillez les recettes, l’entretien et la satisfaction. Un découvert ou une satisfaction inférieure à 35 % pendant 45 secondes de simulation entraîne la perte du contrat.
- **Progresser** : remplissez les quatre objectifs et validez le contrat pour toucher la prime et débloquer un commerce plus grand : épicerie, supermarché, centre commercial.
- **Sauvegarder** : sauvegarde locale toutes les 8 secondes et à la sortie de l’onglet ; synchronisation Convex pour les comptes connectés. Export JSON depuis les préférences. La simulation se suspend quand l’onglet est masqué et pendant les dialogues.

Cliquez sur un élément posé (ou faites un clic droit pendant la construction) pour le sélectionner, puis utilisez les boutons **Pivoter** et **Supprimer** de la barre inférieure. Supprimer une entrée, une barrière ou un passage piéton conserve la route. Les éléments utilisés par un client sont protégés.

Raccourcis : `1` à `0` pour les outils, `R` pour pivoter l’outil ou la sélection, `Suppr` pour supprimer la sélection, `V` pour sélectionner/déplacer la carte, `G` pour la grille, `B` pour démolir, `Ctrl/⌘ Z` pour annuler et `Espace` pour mettre en pause. La carte permet aussi de sélectionner une case avec les flèches et de construire avec `Entrée`.

La carte, les véhicules et les bâtiments sont dessinés en SVG, sans ressources externes. L’interface est composée avec Tailwind ; quelques classes CSS partagées gèrent les boutons, les dialogues et la réduction des animations.

Le moteur indépendant de React est dans `apps/web/src/game/engine.ts`. Les sauvegardes sont validées par un schéma partagé dans `packages/backend/convex/lib/parkingState.ts` et stockées par utilisateur via `packages/backend/convex/parking.ts`.

Le boilerplate inclut l’authentification Better Auth, la vérification d’email et la réinitialisation du mot de passe via Resend, ainsi que les connexions Google et GitHub. L’interface utilise Tailwind CSS et shadcn/ui ; le monorepo utilise Bun et Turborepo.

## Prérequis

- Bun : le projet déclare la version `1.3.0` dans `package.json`.
- Un compte Convex pour créer le backend de Park Game.
- Un compte Resend et une adresse d’expédition configurée pour tester l’inscription par email.
- OpenSSL pour générer le secret d’authentification avec la commande ci-dessous.

## Installation et premier démarrage

Exécuter les commandes à la racine du dépôt, sauf indication contraire.

### 1. Installer les dépendances et initialiser Convex

```bash
bun install
bun run dev:setup
```

Suivre les instructions pour se connecter à Convex et créer un **nouveau projet pour Park Game**. Le fichier `packages/backend/.env.local` contient ensuite la configuration du déploiement utilisé par la CLI Convex, notamment `CONVEX_DEPLOYMENT`.

### 2. Configurer les URL du frontend

Créer `apps/web/.env` :

```dotenv
VITE_CONVEX_URL=https://ton-deploiement.convex.cloud
VITE_CONVEX_SITE_URL=https://ton-deploiement.convex.site
```

Remplacer `ton-deploiement` par le nom du déploiement de développement créé à l’étape précédente. Les URL sont disponibles dans Convex :

- `VITE_CONVEX_URL` termine en `.cloud` et permet de communiquer avec le backend.
- `VITE_CONVEX_SITE_URL` termine en `.site` et permet d’appeler ses routes HTTP, notamment celles de l’authentification.

Si Convex génère une variable nommée `CONVEX_URL` dans le fichier du backend, utiliser sa valeur pour `VITE_CONVEX_URL` dans le frontend.

### 3. Configurer l’authentification sur Convex

**Les variables ajoutées dans un fichier `.env` local ne sont pas automatiquement transférées au déploiement Convex.** Les fonctions du backend lisent les variables configurées sur ce déploiement, via la CLI ou le dashboard Convex.

Depuis le dossier backend :

```bash
cd packages/backend
bunx --bun convex env set SITE_URL http://localhost:3002
bunx --bun convex env set BETTER_AUTH_URL http://localhost:3002
bunx --bun convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
cd ../..
```

`SITE_URL` définit l’origine autorisée de l’application. `BETTER_AUTH_URL` définit son URL de base pour l’authentification. Ces valeurs correspondent ici au serveur de développement local ; utiliser l’URL publique de l’application sur un déploiement de production.

Générer `BETTER_AUTH_SECRET` une seule fois lors de la configuration initiale et conserver cette valeur lors des démarrages suivants.

Les exemples utilisent `bunx --bun` pour exécuter la CLI avec Bun.

### 4. Configurer les emails sur Convex

La vérification d’email est activée dans ce boilerplate. **Resend doit être configuré pour terminer une inscription par email**, ainsi que pour réinitialiser un mot de passe.

Dans les paramètres du déploiement Convex de développement, ajouter :

| Variable         | Valeur à renseigner                                                               |
| ---------------- | --------------------------------------------------------------------------------- |
| `RESEND_API_KEY` | La clé API du compte Resend utilisé par Park Game                                  |
| `EMAIL_FROM`     | L’expéditeur configuré dans Resend, par exemple `Park Game <bonjour@ton-domaine.fr>` |

Ces variables peuvent aussi être définies avec `bunx --bun convex env set NOM_VARIABLE 'valeur'`, depuis `packages/backend`.

### 5. Lancer l’application

Depuis la racine du dépôt :

```bash
bun run dev
```

Cette commande lance le frontend et le backend Convex en mode développement. Ouvrir **[http://localhost:3002](http://localhost:3002)**. Le port est fixe : si `3002` est occupé, Vite s’arrête pour éviter un décalage avec les URL d’authentification.

Pour les démarrages suivants, `bun run dev` suffit si la configuration est déjà en place. Après une modification de `apps/web/.env`, redémarrer le serveur frontend.

## Où configurer les variables ?

| Emplacement                     | Usage                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/backend/.env.local`   | Configuration locale de la CLI, notamment le déploiement ciblé par `CONVEX_DEPLOYMENT`  |
| `apps/web/.env`                 | Variables du frontend : URL Convex                                                     |
| Variables du déploiement Convex | Configuration des fonctions backend : authentification, Resend et OAuth               |

Ne pas copier tout le fichier du backend dans celui du frontend. Ajouter uniquement les variables nécessaires à chaque emplacement. Les variables préfixées par `VITE_` sont accessibles au navigateur : elles ne doivent pas contenir de secrets. Les fichiers `.env` locaux sont ignorés par Git.

## Services complémentaires

Ces services sont nécessaires pour utiliser les fonctionnalités correspondantes.

### Connexion Google et GitHub

Créer les applications OAuth auprès des fournisseurs concernés, puis ajouter leurs identifiants dans les **variables du déploiement Convex** :

| Fournisseur | Variables                                  |
| ----------- | ------------------------------------------ |
| Google      | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub      | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |

Configurer également les URL de retour OAuth chez chaque fournisseur en fonction de l’URL de l’application.

## Dépannage

### « A provided trusted origin is invalid »

Vérifier que `SITE_URL` est définie **sur le déploiement Convex utilisé par l’application**, et pas seulement dans un fichier local :

```bash
cd packages/backend
bunx --bun convex env get SITE_URL
bunx --bun convex env set SITE_URL http://localhost:3002
cd ../..
```

Rafraîchir ensuite l’application à l’adresse `http://localhost:3002`.

### « Object is missing the required field from » lors de l’inscription

L’expéditeur transmis à l’action d’envoi provient de `EMAIL_FROM`. Vérifier que cette variable est renseignée sur Convex, ainsi que `RESEND_API_KEY`. Le champ `from` doit rester obligatoire.

Une fois la configuration corrigée, utiliser la page `/verify-email` pour demander un nouvel email de vérification si le compte a déjà été créé.

### « Could not find a declaration file for module react/jsx-runtime »

Le backend utilise du JSX pour les emails. Il déclare donc `@types/react` dans ses dépendances de développement. Relancer `bun install` à la racine si ces types ne sont pas installés.

Pour vérifier uniquement le TypeScript du backend, depuis la racine :

```bash
bunx --bun tsc --project packages/backend/convex/tsconfig.json --noEmit
```

## Structure du projet

```text
park-game/
├── apps/web/             # Frontend React + TanStack Start
├── packages/backend/    # Fonctions, authentification et schéma Convex
├── packages/config/     # Configuration TypeScript partagée
└── packages/env/        # Validation des variables du frontend
```

## Commandes utiles

À exécuter depuis la racine du dépôt :

| Commande             | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `bun install`        | Installer les dépendances du monorepo                        |
| `bun run dev:setup`  | Configurer le projet Convex lors de la première installation |
| `bun run dev`        | Lancer le frontend et le backend en développement            |
| `bun run dev:web`    | Lancer uniquement le frontend                                |
| `bun run dev:server` | Lancer uniquement le backend Convex en développement         |
| `bun run build`      | Construire l’application pour la production                  |

### Vérifier le jeu

```bash
bun test tests/parking-engine.test.ts
bunx --bun tsc --project apps/web/tsconfig.json --noEmit
bunx --bun tsc --project packages/backend/convex/tsconfig.json --noEmit
bunx --bun tsc --project packages/env/tsconfig.json --noEmit
bun run build
```

Les tests couvrent les connexions routières, l’orientation des places, les coûts et remboursements, le paiement unique aux sorties, la perte des contrats, leur progression et l’intégrité des sauvegardes. Le dernier contrat est également testé avec 50 places construites depuis le terrain vide et une simulation complète de clientèle. Les sauvegardes de la première version sont agrandies automatiquement en préservant le parking et la progression.

## Documentation

- [Convex et Better Auth avec TanStack Start](https://labs.convex.dev/better-auth/framework-guides/tanstack-start)
- [Variables d’environnement Convex](https://docs.convex.dev/production/environment-variables)
