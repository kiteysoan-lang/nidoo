# Nidoo – marketplace mamans & bébés (RDC)

React + Vite + Tailwind + Supabase, installable en PWA, catalogue consultable hors-ligne.

## Installation
1. Créez un projet Supabase. SQL Editor : exécutez `supabase/schema.sql`, `002_server_logic.sql` PUIS `003_fix_role_protection.sql` (promotion admin).
2. `cp .env.example .env` (URL + clé anon), puis `npm install && npm run dev`.
3. Créez un compte, puis promouvez-le admin (dernière ligne commentée de `schema.sql`).

## Paiements (Edge Functions)
```
npm i -g supabase && supabase login && supabase link --project-ref <ref>
supabase secrets set PAYMENT_MODE=sandbox SITE_URL=https://votre-domaine.com
supabase functions deploy create-payment
supabase functions deploy payment-webhook --no-verify-jwt
```
- `sandbox` : confirme immédiatement (tests). Production : `PAYMENT_MODE=flutterwave`, `FLW_SECRET_KEY`, `FLW_WEBHOOK_HASH`, et URL du webhook `https://<ref>.functions.supabase.co/payment-webhook` dans le dashboard Flutterwave.
- Vérifiez dans Flutterwave les moyens réellement activés pour la RDC (table `OPTIONS` dans `create-payment`), ou adaptez la fonction à CinetPay / Pawapay.

## Règles gérées côté serveur
Prix, frais de livraison et stock recalculés par `place_order` · remise en stock à l'annulation · expiration quotidienne des essais (pg_cron) · blocage du catalogue par RLS · tarifs modifiables par l'admin · aucune écriture client sur `payments`.

## Déploiement
`npm run build` → `dist/` sur Vercel (`vercel.json`) ou Netlify/Cloudflare (`public/_redirects`).
