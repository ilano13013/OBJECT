# Génération 3D par IA (Tripo) — Photo → 3D

Un abonné Studio photographie son produit, génère un vrai modèle 3D (GLB
texturé, matériaux PBR) avec Tripo, le vérifie en 3D, le garde dans sa
bibliothèque et le place dans n’importe lequel de ses showrooms.

## Parcours

`/studio/library` → photos (face obligatoire ; gauche, dos, droite facultatifs)
→ « Generate a 3D model with AI » → progression réelle (sondage de la tâche
Tripo) → aperçu 3D (rotation, zoom) → garder / régénérer / supprimer →
« Add to showroom » (ou, dans l’éditeur, *Media → True 3D → Choose from your
library*).

Le modèle est **copié** dans le dossier du showroom avec une ligne `assets`
identique à un import manuel de .glb : publication, duplication, suppression
et lecture publique fonctionnent exactement comme pour un modèle importé.
L’import manuel existant n’a pas changé.

## Règles d’accès et de quota (appliquées côté serveur)

| Situation | Génération |
|---|---|
| Compte gratuit | refusée |
| Achat One Showroom (49 €) seul | refusée |
| Abonnement Studio `active`, période payée en cours | autorisée, 5 / période |
| `trialing`, `past_due`, `canceled`, `unpaid`, période échue | refusée |

- Une génération = une requête envoyée à Tripo, quel que soit le nombre de
  photos (1 photo → `image_to_model`, plusieurs → `multiview_to_model`).
- Une régénération est une nouvelle génération (1 crédit).
- La période = la période d’abonnement Stripe en cours
  (`subscriptions.current_period_end`). Le renouvellement confirmé par le
  webhook Stripe change la période → compteur remis à 5. Pas de report.
- Échec technique (Tripo injoignable, crédits Tripo d’OBJECT épuisés, limite
  de débit, tâche échouée/annulée/expirée, modèle introuvable, délai > 1 h) →
  la réservation est **libérée**, le quota n’est pas consommé.
- Résultat refusé par Tripo pour son contenu (`banned`) ou résultat réussi mais
  non apprécié → **compte**.
- Les modèles déjà générés restent dans la bibliothèque si l’abonnement s’arrête.

Ordre dans `POST /api/ai/generate` (`server/ai.ts`) :

1. jeton Supabase vérifié → utilisateur → espace de travail ;
2. `reserve_ai_generation()` (SQL, rôle service uniquement) verrouille la
   ligne de l’espace (`FOR UPDATE`), vérifie abonnement actif + période en
   cours, compte réservées + consommées, refuse au-delà du quota, refuse si
   une génération est déjà en cours, et réserve **une** génération ;
   la même `request_id` rejouée (double clic, retry réseau) renvoie la même
   réservation ;
3. **seulement ensuite** : envoi des photos et création de la tâche Tripo ;
4. `POST /api/ai/status` sonde Tripo ; au succès, télécharge le GLB (contrôle
   de l’en-tête glTF, 50 Mo max), le range dans `showroom-assets/<espace>/library/`,
   crée la ligne `library_models`, confirme ; en cas d’échec technique,
   `release_ai_generation()`.

Le quota est lié au compte et à l’abonnement en base, jamais au navigateur :
rechargement, autre appareil ou requêtes simultanées ne permettent pas de
dépasser 5. Une génération en cours se retrouve en revenant sur la page.

Le navigateur ne peut ni réserver, ni libérer, ni écrire une génération, ni
ajouter un modèle à la bibliothèque (droits SQL révoqués, tests dans
`supabase/tests/30_ai_quota.sql`).

## Mise en service

1. Créer une clé sur https://platform.tripo3d.ai (API Keys) et créditer le compte.
2. Vercel → Environment Variables (serveur, **sans** préfixe `VITE_`) :
   `TRIPO_API_KEY=tsk_…` (+ `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` déjà présents).
3. Appliquer la migration `supabase/migrations/20261019000100_ai_generation.sql`.
4. Les fonctions `api/ai/*` ont `maxDuration: 60` (`vercel.json`).
5. **Test réel obligatoire** : avec un compte abonné en mode test Stripe,
   générer un modèle à partir d’une vraie photo et vérifier le GLB.

Sans `TRIPO_API_KEY`, `/api/ai/*` répond 503 « AI generation is not
configured » et aucun quota n’est consommé.

## API Tripo utilisée

API de tâches documentée (`https://api.tripo3d.ai/v2/openapi`) :
`POST /upload` (multipart → `image_token`), `POST /task`
(`type: image_to_model | multiview_to_model`, `model_version: v3.1-20260211`
= H3.1, `texture: true`, `pbr: true`, `texture_quality: detailed` ; multivue =
4 emplacements dans l’ordre face, gauche, dos, droite, face obligatoire),
`GET /task/{id}` (`status`, `progress`, `output.pbr_model`).
Codes d’erreur : 2010 crédits insuffisants, 1007 / 2000 / HTTP 429 limite de
débit / de tâches simultanées.

`TRIPO_API_BASE` et `TRIPO_MODEL_VERSION` sont configurables si Tripo fait
évoluer son API (une API v3 à points d’accès dédiés existe ; elle n’a pas pu
être vérifiée depuis l’environnement de développement).

Sources : https://platform.tripo3d.ai/docs/generation ·
https://docs.tripo3d.ai/model-generation/image-to-model-v3-0-v3-1.html ·
https://docs.tripo3d.ai/model-generation/multiview-to-model-v3-0-v3-1.html ·
https://docs.tripo3d.ai/get-started/errors-and-error-handling.html ·
https://developers.tripo3d.ai/en/models/v3-1 ·
https://developers.tripo3d.ai/en/docs/rate-limits

## Tests

- `supabase/tests/30_ai_quota.sql` : gratuit, 49 € seul, abonné, 4 → 5e, 5
  bloqué, renouvellement, expiré / annulé / past_due / essai, échec libéré,
  régénération, idempotence, réservation périmée, droits navigateur.
- `server/tripo.test.ts` : forme des requêtes, codes d’erreur, contrôle GLB.
- `server/ai.integration.test.ts` (`AI_IT=1`) et `e2e-cloud/ai.spec.ts`
  (bureau + iPhone 13) : contre la pile Supabase locale et un **double de
  test** de Tripo (`scripts/tripo-mock.mjs`) qui renvoie toujours le même cube.
  Ce double ne génère rien et ne doit jamais être branché sur un site déployé.
