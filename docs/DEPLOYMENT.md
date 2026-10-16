# Deployment

Phase A is a static single-page app: any static host works. Vercel is the
target because Phase D needs serverless functions.

## Vercel (recommended)

1. Go to **vercel.com → Add New → Project → Import** `ilano13013/OBJECT`.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`,
   output `dist`. No environment variables are needed for Phase A.
3. Deploy. Every branch push gets its own preview URL; `master` becomes
   production. Open the URL on an iPhone.

`vercel.json` rewrites client routes (`/demo/aura`, `/create`, …) to
`index.html` so deep links and refreshes work.

## Cloudflare Pages (alternative)

Build command `npm run build`, output directory `dist`. Add a
`public/_redirects` file containing `/* /index.html 200` for SPA routing.

## Later phases

Set the variables listed in `.env.example` in the Vercel project settings.
Keys without the `VITE_` prefix are server-only and must never be exposed to
the browser. Use Stripe **test** keys until launch is explicitly authorised.
