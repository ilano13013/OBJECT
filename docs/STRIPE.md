# Brancher Stripe (Phase D) — mode test

Le paiement n’est **jamais** validé par le navigateur. Le parcours :

1. Le site appelle `/api/billing/checkout` (fonction serveur, utilisateur
   vérifié auprès de Supabase) qui crée une session **Stripe Checkout**.
2. Le marchand paie sur la page Stripe.
3. Stripe appelle `/api/stripe/webhook`. La **signature** est vérifiée avec
   `STRIPE_WEBHOOK_SECRET`, l’événement est enregistré une seule fois
   (rejeux ignorés), puis la commande ou l’abonnement est mis à jour en base.
4. Seulement alors la publication est débloquée (contrôle du quota côté
   serveur, voir `publish_showroom` dans la base).

Le retour sur `?checkout=success` ne débloque rien : la page attend que le
serveur ait reçu la confirmation de Stripe.

## 1. Produits et prix (mode test)

Dashboard Stripe → bouton **Test mode** activé → **Product catalog** :

| Produit | Prix | Variable |
|---|---|---|
| One Showroom | 49,00 € — **paiement unique** | `STRIPE_PRICE_ONE` = `price_…` |
| Studio | 29,00 € — **récurrent, mensuel** | `STRIPE_PRICE_STUDIO` = `price_…` |

Si vous êtes assujetti à la TVA, configurez **Stripe Tax** ou des prix TTC
avant le lancement réel.

## 2. Clés

**Developers → API keys** (en mode test) : copier la *Secret key*
`sk_test_…` → `STRIPE_SECRET_KEY`.

Le serveur **refuse les clés live** (`sk_live_…`) tant que
`ALLOW_LIVE_PAYMENTS=true` n’est pas défini. À ne faire qu’une fois le
lancement commercial autorisé.

## 3. Webhook

**Developers → Webhooks → Add endpoint** :

- URL : `https://<votre-domaine>/api/stripe/webhook`
- Événements :
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `charge.refunded`
- Copier le *Signing secret* `whsec_…` → `STRIPE_WEBHOOK_SECRET`.

En local : `stripe listen --forward-to localhost:5173/api/stripe/webhook`
(Stripe CLI) affiche un `whsec_…` à utiliser.

## 4. Portail client

**Settings → Billing → Customer portal** : activer *Invoices*, *Payment
methods*, *Cancel subscriptions* (**à la fin de la période**). Le bouton
« Invoices, card and cancellation » de la page Compte y mène.

## 5. Variables Vercel (serveur uniquement)

| Variable | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `STRIPE_PRICE_ONE` | `price_…` |
| `STRIPE_PRICE_STUDIO` | `price_…` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → *service_role* |
| `SUPABASE_URL` | même valeur que `VITE_SUPABASE_URL` |
| `APP_URL` | `https://<votre-domaine>` |

Aucune de ces variables ne commence par `VITE_` : elles ne sont jamais
envoyées au navigateur. Appliquer aussi la migration
`supabase/migrations/20261018000100_billing.sql` (SQL Editor).

## Règles appliquées

- **One Showroom** : un paiement débloque **ce** showroom, sans limite de
  durée. Un seul achat payé par showroom. Remboursement total → le showroom
  est dépublié.
- **Studio** : quota de showrooms publiés (5 par défaut, réglable par espace
  dans `workspaces.studio_quota`). Paiement en échec → période de grâce
  (`past_due`) pendant les relances Stripe ; ensuite (`unpaid`) ou à la fin
  d’un abonnement annulé (`canceled`), les showrooms au-delà des droits
  restants sont dépubliés. **Les brouillons ne sont jamais supprimés.**
- Les achats One Showroom restent en ligne même si Studio s’arrête.

## Tester sans vraie carte

Carte `4242 4242 4242 4242`, date future, CVC quelconque. Paiement refusé :
`4000 0000 0000 0002`. Authentification 3-D Secure : `4000 0027 6000 3184`.
