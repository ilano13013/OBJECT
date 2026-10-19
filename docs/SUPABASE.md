# Brancher Supabase (Phase C)

Tant que Supabase n’est pas branché, OBJECT. fonctionne en **mode local** :
les showrooms sont enregistrés dans le navigateur. Dès que les deux variables
ci-dessous sont présentes au moment du build, le site passe automatiquement en
**mode cloud** : comptes, base de données, fichiers dans le cloud, liens publics
accessibles partout, statistiques.

Tout le schéma a déjà été testé sur PostgreSQL + Auth + Storage (voir
« Tests » en bas de page). Il ne reste qu’à le créer dans votre projet.

## 1. Créer le projet

1. Aller sur <https://supabase.com/dashboard> → **New project**.
   Si le site ne charge pas : essayer un autre navigateur ou la navigation
   privée, désactiver un bloqueur de publicité, ou vérifier
   <https://status.supabase.com>.
2. Région : **West EU (Paris)** ou **Central EU (Frankfurt)**.
3. Noter le mot de passe de la base (il ne sert pas au site).

## 2. Créer le schéma

1. Dashboard → **SQL Editor** → **New query**.
2. Copier tout le contenu de
   `supabase/migrations/20261016000100_init.sql`, coller, **Run**.
   Le script crée les tables, les règles de sécurité (RLS), les fonctions
   serveur et le bucket de fichiers `showroom-assets` (privé).

Alternative en ligne de commande : `npx supabase link --project-ref <ref>`
puis `npx supabase db push`.

## 3. Réglages d’authentification

Dashboard → **Authentication** :

- **URL Configuration** → *Site URL* : l’adresse du site (ex.
  `https://object-studio.vercel.app`).
  *Redirect URLs* : ajouter `https://<votre-domaine>/auth/callback` et
  `https://<votre-domaine>/auth/reset` (et l’URL de prévisualisation Vercel si
  besoin, ex. `https://*-votre-equipe.vercel.app/**`).
- **Providers → Email** : activé. Laisser *Confirm email* activé.
- **Passwords** : longueur minimale **10** (le site demande déjà 10).
- (Recommandé avant le lancement) **SMTP** personnalisé pour envoyer les e-mails
  depuis votre domaine ; l’envoi par défaut de Supabase est limité.

## 4. Variables d’environnement

Dashboard → **Project Settings → API** :

| Variable (Vercel → Settings → Environment Variables) | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | *Project URL* |
| `VITE_SUPABASE_ANON_KEY` | clé **anon / public** |

La clé *anon* est faite pour être publique : la base décide de ce qu’elle
peut lire grâce aux règles RLS. **Ne jamais** mettre la clé `service_role`
dans une variable `VITE_…` : elle ne servira qu’aux fonctions serveur de
paiement (Phase D).

Redéployer après avoir ajouté les variables.

## 5. Publier avant les paiements

La publication est contrôlée par le serveur : il faut un achat *One
Showroom*, un abonnement *Studio*, ou un **emplacement offert**. Tant que
Stripe n’est pas branché (Phase D), on peut offrir des emplacements depuis le
SQL Editor :

```sql
update public.workspaces
set bonus_publish_slots = 1
where owner_id = (select id from auth.users where email = 'vous@exemple.com');
```

## Ce que garantit le schéma

- Chaque marchand ne voit que **son** espace : brouillons, fichiers,
  statistiques, facturation (RLS sur toutes les tables privées).
- Le navigateur ne peut **pas** modifier : le statut de publication, la
  version publiée, les quotas, les commandes, les abonnements, les
  statistiques. Ces changements passent uniquement par des fonctions serveur.
- Les visiteurs lisent seulement la **version publiée** d’un showroom, via
  `get_published_showroom()`. Aucune table n’est lisible publiquement.
- Les fichiers d’un showroom ne sont lisibles publiquement que s’ils sont
  utilisés par la version publiée. Dépublier rend les fichiers privés.
- Fichiers : types (JPG, PNG, WebP, GLB, glTF) et tailles (15 Mo / 50 Mo)
  contrôlés par le bucket **et** par la base ; chemins imposés
  `espace/showroom/fichier`.
- Statistiques sans cookie ni adresse IP : un identifiant aléatoire par
  session de navigateur ; rechargements dédoublonnés.

## Tests

- `supabase/tests/10_security.sql` : 50+ vérifications (isolation entre deux
  marchands, colonnes protégées, quotas, version publiée, fichiers, statistiques).
  Lancer : `PGHOST=… PGPORT=… PGUSER=postgres supabase/tests/run.sh`.
- `e2e-cloud/` : parcours complets dans un vrai navigateur contre une pile
  compatible Supabase (Auth + PostgREST + Storage), voir
  `supabase/local-stack/start.sh`.

## Connexion Google, Apple et GitHub

L’écran `/login` propose « Continue with Google / Apple / GitHub » et l’e-mail +
mot de passe. Aucun compte de test n’existe : chaque compte est créé par son
propriétaire. Un bouton dont le fournisseur n’est pas activé affiche « Sign-in
with … isn’t switched on for this site yet » (lu depuis `/auth/v1/settings`).

Dans Supabase → **Authentication → URL Configuration** :
- *Site URL* : `https://<votre-domaine>`
- *Redirect URLs* : `https://<votre-domaine>/auth/callback`

URL de retour à déclarer chez chaque fournisseur :
`https://<projet>.supabase.co/auth/v1/callback`

| Fournisseur | Où créer l’application | À coller dans Supabase → Authentication → Sign In / Providers |
|---|---|---|
| Google | Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (type Web) ; écran de consentement en *External* | Client ID + Client secret |
| GitHub | GitHub → Settings → Developer settings → *OAuth Apps* → New | Client ID + Client secret |
| Apple | developer.apple.com (compte payant) → Identifiers : un *Services ID* avec *Sign in with Apple*, domaine + URL de retour ; une clé *Sign in with Apple* (.p8) | Services ID, Team ID, Key ID et clé → secret généré par Supabase (à renouveler tous les 6 mois) |

Le flux utilisé est OAuth avec PKCE ; la session est échangée sur
`/auth/callback`, puis l’utilisateur revient où il allait (`next`, chemin du
site uniquement). Un compte créé par Google/Apple/GitHub reçoit son espace de
travail comme un compte e-mail (déclencheur `handle_new_user`).

Pile locale : `GITHUB_CLIENT_ID=… GITHUB_SECRET=… supabase/local-stack/start.sh`
active GitHub (tests : `e2e-cloud/auth.spec.ts`).
