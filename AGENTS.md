<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mitti — agent uchun qoidalar

Bu fayl har bir sessiyada o'qiladi. To'liq spetsifikatsiya: `TZ.md`.

## Loyiha nima

Mitti — O'zbekistondagi nodavlat va oilaviy bog'chalar uchun kunlik yo'qlama tizimi.
Tarbiyachi bolaning rasmini oladi va "keldi" deb belgilaydi. Shu bitta harakatdan to'rtta natija chiqadi:

1. Ota-onaga Telegram orqali xabar va surat
2. Oshxonaga kunlik porsiya soni
3. Rahbarga o'zgartirib bo'lmaydigan dalil jurnali
4. Oy oxirida Excel hisobot (davomat + ovqat)

Mahsulot davlat bazasiga **ulanmaydi**. U mustaqil, parallel yozuv.

## Eng muhim qoida

Har bir yangi g'oya, funksiya yoki "yaxshi bo'lardi" degan taklif avval shu savoldan o'tadi:

> **Bu tarbiyachiga yangi ish qo'shadimi?**

Agar ha bo'lsa — u 1-bosqichga kirmaydi. Istisno yo'q.

Sabab: tarbiyachi ertalab tik turadi, qo'li band, bolalar 07:30–09:00 oralig'ida bittalab kiradi.
Unga qo'shilgan har bir bosish mahsulotning tashlab ketilishi ehtimolini oshiradi.

## Texnologiyalar

- Next.js (App Router, TypeScript) — bu repo'da o'rnatilgan versiya 16.3.5, TZ 15 deb yozgan bo'lsa ham shu bilan davom etiladi
- Tailwind CSS
- Supabase: Postgres + Auth + Storage
- Vercel (hosting + cron)
- Telegram Bot API — to'g'ridan-to'g'ri `fetch` orqali, kutubxonasiz

Yangi kutubxona qo'shishdan oldin so'rang. Istisno: `xlsx` (eksport uchun) va `date-fns-tz`.

## Konventsiyalar

- Kod, o'zgaruvchi, jadval va ustun nomlari — **inglizcha**
- Foydalanuvchi ko'radigan barcha matn — **o'zbekcha** (lotin yozuvi)
- Server tomonda Supabase service-role kalitidan faqat `src/lib/supabase/admin.ts` ichida foydalaniladi
- Klient tomonda faqat `anon` kalit
- Sana `date` tipida saqlanadi va **Asia/Tashkent** bo'yicha hisoblanadi — `src/lib/day.ts` dagi yordamchidan foydalaning, `new Date().toISOString().slice(0,10)` ishlatmang
- Har bir jadvalda `kindergarten_id` bor va RLS yoqilgan. RLS'siz jadval qo'shmang

## Qat'iy kirmaydi (1-bosqich)

Bularni qurishga urinmang, hatto qulay ko'rinsa ham:

- Telegram Mini App, `initData`, HMAC tekshiruvi — **oldingi urinish aynan shu yerda buzilgan**
- Better Auth yoki boshqa o'z auth tizimi
- Offline-first PWA, service worker
- Qurilmaga bog'langan PIN
- Ota-ona uchun veb-interfeys (ota-ona faqat Telegram xabarini oladi)
- Oshpaz uchun interfeys (u ham faqat Telegram xabarini oladi)
- Dashboard, grafiklar, analitika
- To'lovlar, qarz, xarajat, maosh, buxgalteriya (bular 2-bosqich)

## Qurish tartibi

`TZ.md` ning "15. Qurish tartibi" bo'limidagi 10 qadamni ketma-ket bajaring.
Har bir qadamning qabul mezoni bor — keyingisiga o'tishdan oldin uni tekshiring.

## Muvaffaqiyat mezoni

Real bog'chada bitta tarbiyachi bitta guruhni ertalab 3 daqiqadan kamroq vaqtda belgilay olsa
va ota-onalarga suratlar yetib borsa — 1-bosqich tugagan.
