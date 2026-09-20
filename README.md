# Mitti

Bog'chalar uchun kunlik yo'qlama tizimi. To'liq spetsifikatsiya: [`TZ.md`](./TZ.md), agent uchun qisqa qoidalar: [`AGENTS.md`](./AGENTS.md).

## O'rnatish

```bash
pnpm install
cp .env.example .env.local   # va qiymatlarni to'ldiring
```

Kerakli o'zgaruvchilar (`.env.local`):

| O'zgaruvchi | Qayerdan olinadi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase loyihasi → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (**maxfiy**, faqat serverda) |
| `TELEGRAM_BOT_TOKEN` | BotFather |
| `TELEGRAM_BOT_USERNAME` | BotFather bergan nom, `@`siz |
| `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` | o'zingiz tasodifiy yarating (`openssl rand -hex 24`) |

## Ma'lumotlar bazasi

Migratsiyalar `supabase/migrations/` da, tartib bilan qo'llanadi:

1. `0001_init.sql` — asosiy sxema, RLS, storage siyosatlari
2. `0002_subsidy.sql` — "davlatdan kelgan summa"ni saqlash (TZ §8)
3. `0003_kindergarten_write.sql` — rahbarga bog'cha nomini o'zgartirish ruxsati

Supabase SQL Editor orqali yoki `supabase db push` bilan qo'llang.

## Boshlang'ich ma'lumot

```bash
pnpm seed
```

1 bog'cha + 1 rahbar (`+998901234567` / `sinov1234`) + 1 tarbiyachi
(`+998901234568` / `sinov1234`) + 1 guruh + 16 bola yaratadi.
`SUPABASE_SERVICE_ROLE_KEY` kerak.

## Telegram bot

Webhook o'rnatish (bot tokeni va o'zingizning domeningiz bilan):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<domen>/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

## Ishga tushirish

```bash
pnpm dev      # http://localhost:3000
pnpm build    # production tekshiruv
```

## Cron

`vercel.json`da uchta vazifa bor (barchasi Asia/Tashkent bo'yicha):

- 08:30 — oshxona porsiya hisoboti
- 13:05 — ota-onalarga tushlik xabari
- Juma 17:00 — haftalik jamlanma

Vercel'ning o'z cron mexanizmi `CRON_SECRET` bilan avtomatik ishlaydi.
Agar tarif yetmasa, [cron-job.org](https://cron-job.org) dan
`Authorization: Bearer <CRON_SECRET>` sarlavhasi bilan chaqiring.
