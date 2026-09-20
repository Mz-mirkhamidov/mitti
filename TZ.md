# Mitti — Texnik topshiriq (1-bosqich)

**Versiya:** 1.0 · 2026-09-20
**Muddat:** 2 hafta
**Bu hujjat eskilarini almashtiradi:** avvalgi `TZ.md` (20 bo'lim) va `TZ-AUTH.md` (18 bo'lim) **bekor qilingan**. Ularda Telegram Mini App, Better Auth va offline-first PWA bor edi — hech biri bu versiyaga kirmaydi.

---

## 1. Loyiha konteksti

Mitti — O'zbekistondagi nodavlat va oilaviy bog'chalar uchun kunlik yo'qlama tizimi.

Bog'chalarda davlatning majburiy elektron yo'qlama tizimi bor, lekin u ishonchsiz: qotib qoladi, Face-ID rasmni noto'g'ri sanaydi, natijada haqiqatda kelgan bola uchun ham subsidiya yo'qoladi. Rahbarda buni isbotlaydigan mustaqil yozuv yo'q.

Mitti davlat bazasiga **ulanmaydi va uni almashtirmaydi**. U bog'chaning o'z, parallel, o'zgartirib bo'lmaydigan yozuvini yuritadi.

### Mahsulot yadrosi

Tarbiyachi bolaning rasmini oladi va "keldi" deb belgilaydi (~10 soniya). Shu bitta harakatdan:

| Natija | Kimga | Qanday |
|---|---|---|
| "Farzandingiz keldi" + surat | Ota-onaga | Telegram, shaxsiy chat |
| Kunlik porsiya soni + menyu | Oshxonaga | Telegram |
| O'zgartirib bo'lmaydigan dalil jurnali | Rahbarga | Veb |
| Excel hisobot (davomat + ovqat) | Rahbarga | Veb |

---

## 2. Muvaffaqiyat mezoni

1-bosqich tugagan hisoblanadi, agar **real bog'chada**:

- tarbiyachi 16 bolalik guruhni **3 daqiqadan kam** vaqtda belgilay olsa
- ota-onalarga suratlar yetib borsa
- oshxonaga porsiya soni avtomatik ketsa
- rahbar oy oxirida Excel fayl ola olsa

Chiroyli interfeys, animatsiya, qo'shimcha funksiya — mezon emas.

---

## 3. Texnologiyalar

| Qatlam | Tanlov |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| Stil | Tailwind CSS |
| BD + Auth + Fayl | Supabase |
| Hosting | Vercel |
| Bot | Telegram Bot API, to'g'ridan-to'g'ri `fetch` |
| Eksport | `xlsx` |
| Vaqt zonasi | `date-fns-tz` |

Boshqa kutubxona qo'shishdan oldin so'rang.

### Papka tuzilishi

```
src/
  app/
    login/page.tsx
    yoqlama/page.tsx              # tarbiyachi
    rahbar/page.tsx               # bugun + oylik jadval
    rahbar/menyu/page.tsx
    rahbar/bolalar/page.tsx
    rahbar/sozlamalar/page.tsx
    api/
      attendance/mark/route.ts
      attendance/photo/route.ts
      attendance/finish/route.ts
      export/route.ts
      telegram/webhook/route.ts
      cron/kitchen/route.ts
      cron/weekly/route.ts
  lib/
    supabase/client.ts            # anon
    supabase/server.ts            # SSR sessiya
    supabase/admin.ts             # service-role, FAQAT shu yerda
    telegram.ts
    day.ts                        # Asia/Tashkent sanalari
    image.ts                      # klientda siqish
supabase/migrations/0001_init.sql
```

---

## 4. Rollar

| Rol | Kim | Ekranlari |
|---|---|---|
| `owner` | Bog'cha rahbari | Barcha `/rahbar/*` + `/yoqlama` |
| `teacher` | Tarbiyachi | Faqat `/yoqlama` |
| — | Ota-ona | Ekran yo'q. Faqat Telegram xabari |
| — | Oshpaz | Ekran yo'q. Faqat Telegram xabari |

Ro'yxatdan o'tish (self-signup) **yo'q**. Akkauntlarni rahbar yoki Muzaffar yaratadi.

---

## 5. Autentifikatsiya

> Bu bo'limni diqqat bilan o'qing. Oldingi urinish aynan shu yerda ikki marta buzilgan.

### Qaror

**Supabase Auth, email + parol.** Foydalanuvchi telefon raqamini kiritadi, biz uni ichki email'ga aylantiramiz.

```ts
// +998 90 123 45 67  ->  998901234567@mitti.local
const email = phone.replace(/\D/g, "") + "@mitti.local";
await supabase.auth.signInWithPassword({ email, password });
```

- Foydalanuvchi email'ni hech qachon ko'rmaydi va yozmaydi
- Supabase sozlamalarida **"Confirm email" o'chiriladi**
- SMS provayder kerak emas, xarajat yo'q
- Sessiya cookie'da, uzoq muddatli. Tarbiyachi har kuni parol termaydi

### Qat'iy taqiqlangan

- Telegram Mini App va `initData` tekshiruvi
- HMAC imzolash
- Better Auth yoki boshqa o'z auth tizimi
- Qurilmaga bog'langan PIN
- Magic link / bir martalik login havolasi

### Akkaunt yaratish

`/rahbar/sozlamalar` sahifasida rahbar tarbiyachi qo'shadi: ism, telefon, parol.
Server tomonda `supabase.auth.admin.createUser({ email, password, email_confirm: true })`,
so'ngra `profiles` jadvaliga yozuv. Bu yagona joy `admin.ts` ishlatiladi.

### Qabul mezoni

- Telefon va parol bilan kirish ishlaydi
- Sahifani yangilaganda sessiya saqlanadi
- Brauzerni yopib, ertasi kuni ochganda ham sessiya saqlanadi
- `teacher` roli `/rahbar` ga kira olmaydi (server tomonda tekshiriladi, faqat UI'da emas)

---

## 6. Ma'lumotlar modeli

To'liq sxema: `supabase/migrations/0001_init.sql`. Qisqacha:

- `kindergartens` — ijarachi (tenant)
- `profiles` — foydalanuvchi, `auth.users` ga bog'langan, roli bor
- `groups` — guruhlar, tarbiyachi biriktiriladi
- `children` — bolalar, ota-onaning Telegram chat id'si shu yerda
- `attendance` — kunlik yozuv, `unique (child_id, day)`
- `attendance_audit` — har bir o'zgartirish izi (trigger avtomatik yozadi)
- `menus` — kunlik menyu
- `settings` — ovqat normasi, oshxona chat id'si
- `kitchen_reports` — oshxona xabari ikki marta ketmasligi uchun

### RLS

**Har bir jadvalda RLS yoqilgan.** Barcha siyosatlar `current_kg_id()` orqali ijarachiga bog'langan.
Yangi jadval qo'shsangiz, RLS'siz qoldirmang — bu ko'p ijarachili tizimlarda eng ko'p uchraydigan xavfsizlik xatosi.

Suratlar `attendance-photos` bucket'ida, yo'l: `<kindergarten_id>/<YYYY-MM-DD>/<child_id>.jpg`.
**O'chirish siyosati ataylab yo'q** — dalil jurnali o'chirilmasligi kerak.

---

## 7. Ekranlar

### 7.1 `/login`

Telefon, parol, bitta tugma. Boshqa hech narsa.

Kirgandan keyin: `owner` → `/rahbar`, `teacher` → `/yoqlama`.

### 7.2 `/yoqlama` — tarbiyachi ekrani

**Bu mahsulotdagi eng muhim ekran.** Menyu yo'q, tab yo'q, navigatsiya yo'q.

Tuzilishi (yuqoridan pastga):

1. Guruh nomi va sana
2. Hisoblagich: `6 / 16 keldi` + progress chiziq
3. **Kutilmoqda** — bolalar uchlik setkada, katta tugmalar (min 88px balandlik), bosh harfli avatar
4. **Keldi** — qator ro'yxat, vaqt va belgi bilan
5. **Kelmadi** — faqat yakunlangandan keyin, har qatorda sabab chiplari: Kasal / Ta'til / Sababsiz
6. Pastda: `Kelmaganlarni yakunlash (N)`

**Xatti-harakat:**

- Bolani bosish → qurilma kamerasi ochiladi:
  ```html
  <input type="file" accept="image/*" capture="environment" />
  ```
  O'z kamera interfeysimizni qurmang.
- Rasm tanlangan zahoti bola **darhol** "Keldi" ro'yxatiga o'tadi. Tarmoqni kutmaydi.
- Pastda 5 soniya davomida: `Ozoda belgilandi · Bekor qilish`
- **Tasdiq oynasi yo'q.** `confirm()` yoki modal ishlatmang.
- Kamera oynasida ikkinchi variant: `Rasmsiz belgilash` → `photo_path` bo'sh qoladi
- `Yakunlash` → qolganlar `absent` bo'ladi, oshxona xabari yuboriladi (agar hali yuborilmagan bo'lsa)

**Qabul mezoni:**
- 16 bola 3 daqiqadan kam vaqtda belgilanadi
- Aviarejimda belgilash ishlaydi, tarmoq qaytganda surat yuklanadi
- Bekor qilish yozuvni to'liq o'chiradi (audit yozuvi qoladi)

### 7.3 `/rahbar` — bugun + dalil jadvali

1. **Bugun:** umumiy `41 / 58`, guruhlar bo'yicha qatorlar
2. **Oylik jadval:** bolalar qatorda, kunlar ustunda, `✓` / `–`. Gorizontal skroll, birinchi ustun yopishqoq
3. **Katakni bosish** → dalil paneli: surat, vaqt, `O'zgartirilmagan` yoki `N marta tuzatilgan` belgisi
4. **Ovqat subsidiyasi hisobi** (8-bo'lim)
5. Pastda: `Excel'ga chiqarish`

Tuzatish mumkin, lekin har bir tuzatish `attendance_audit` ga tushadi va panelda ko'rinadi.

**Kirmaydi:** grafiklar, dashboard, analitika, taqqoslash diagrammalari.

### 7.4 `/rahbar/menyu`

Kunlik menyu: nonushta, tushlik, kechki — uchta erkin matn maydoni.
Haftaning kunlari bo'yicha ko'chirish tugmasi (`O'tgan haftadan nusxa olish`).

**Biz ovqat normalarini tekshirmaymiz va norma da'vo qilmaymiz.** Rahbar nima yozsa, shu saqlanadi.

### 7.5 `/rahbar/bolalar`

Bolalar CRUD: ism, guruh, faol/nofaol. Har bir bola qatorida ota-onani ulash holati:
- `Ulanmagan` → `Havola yaratish` tugmasi → `https://t.me/<bot>?start=<code>` havolasi nusxa olinadi
- `Ulangan` → ulangan sana

### 7.6 `/rahbar/sozlamalar`

- Bog'cha nomi
- Ovqat normasi (so'm/kun/bola)
- Oshxona Telegram chat id
- Tarbiyachilar ro'yxati va qo'shish

---

## 8. Ovqat va porsiya hisobi

Ovqat **alohida modul emas** — u yo'qlamadan hosil bo'ladigan ko'rinish. Tarbiyachi ovqat haqida hech narsa kiritmaydi.

### Porsiya soni

```
portions(day) = count(attendance where day = D and status = 'present')
```

Guruhlar bo'yicha ham shu.

### Oshxona xabari

Ikki holatda yuboriladi, qaysi biri birinchi kelsa:

1. Tarbiyachi(lar) `Yakunlash` bosganda
2. `settings.portion_report_time` (odatda 08:30) da cron orqali

`kitchen_reports` jadvalidagi `kind = 'main'` yozuvi takrorlanishni oldini oladi.

09:00 dan keyin kelgan bola bo'lsa — `kind = 'correction'` xabari ketadi:
`+2 porsiya (kech kelgan)`.

### Subsidiya hisobi (rahbar panelida)

```
kun_bola        = count(attendance where month = M and status = 'present')
kutilgan_summa  = kun_bola × settings.meal_norm_per_day
```

Rahbar "davlatdan kelgan summa" ni qo'lda kiritadi, farq ko'rsatiladi.

> **Biz davlat to'lov tizimiga ulanmaymiz.** "Kelgan summa" — rahbar kiritadigan raqam.
> Bu ochiq aytiladi, interfeysda ham yozilgan bo'lishi kerak.

---

## 9. Telegram bot

Bitta bot: `@mittikids_bot`. Webhook: `POST /api/telegram/webhook`.

Webhook'ni `TELEGRAM_WEBHOOK_SECRET` bilan himoyalang (`X-Telegram-Bot-Api-Secret-Token` sarlavhasi).

### 9.1 Ota-onani ulash

1. Rahbar bola uchun `parent_link_code` yaratadi (tasodifiy 10 belgi)
2. Havola: `https://t.me/mittikids_bot?start=<code>`
3. Ota-ona bosadi → bot `/start <code>` oladi
4. Bot `children` dan kodni topadi, `parent_chat_id` ni yozadi, `parent_linked_at` qo'yadi
5. Bot rozilik xabarini yuboradi:

```
Assalomu alaykum! Siz {bola ismi}ning ota-onasi sifatida ulandingiz.

Har kuni farzandingiz bog'chaga kelganda sizga xabar va surat yuboramiz.
Surat faqat sizga boradi — guruhga emas.
```

Kod bir marta ishlaydi: ulangandan keyin `parent_link_code` `null` qilinadi.

### 9.2 Kelish xabari

Surat yuklangandan keyin yuboriladi (yoki 60 soniya ichida surat kelmasa — matn bilan).

```
☀️ {ism} bog'chaga keldi
{guruh} · {vaqt}
```

`sendPhoto` bilan. `parent_notified_at` belgilanadi — ikki marta yubormaslik uchun.

### 9.3 Ovqat xabari (ota-onaga)

13:05 da, faqat o'sha kuni `present` bo'lgan bolalarning ota-onalariga:

```
🍲 {ism} tushlik qildi
{menus.lunch}
```

Menyu kiritilmagan bo'lsa — xabar yuborilmaydi.

### 9.4 Oshxona xabari

```
🍲 Bugun {N} porsiya
{guruh}: {n} · {guruh}: {n}

Nonushta: {breakfast}
```

### 9.5 Juma jamlanmasi

Juma 17:00 da:

```
Bu hafta {ism} {X} kundan {Y} kun keldi. Rahmat!
```

### Qat'iy qoidalar

- Surat **hech qachon** guruhga yuborilmaydi — faqat `parent_chat_id` shaxsiy chatiga
- Kuniga ikkitadan ortiq xabar yuborilmaydi (keldi + tushlik)
- Xabarlarda tugma, inline keyboard, havola yo'q
- Telegram xatosi (`403 blocked`) — yozib qo'yiladi, qayta urinilmaydi

---

## 10. Surat yuklash oqimi

Bu MVP'dagi yagona murakkab qism. Ketma-ketlik:

1. **Klient:** `<input capture>` dan fayl olinadi
2. **Klient:** canvas orqali siqiladi — eng katta tomoni 1024px, JPEG sifat 0.7 (`lib/image.ts`)
3. **Klient:** `POST /api/attendance/mark` → `attendance` yozuvi yaratiladi (`status='present'`, `arrived_at=now()`), UI darhol yangilanadi
4. **Klient:** Supabase Storage'ga to'g'ridan-to'g'ri yuklanadi
5. **Klient:** `POST /api/attendance/photo` → `photo_path` va `photo_uploaded_at` yoziladi
6. **Server:** ota-onaga Telegram xabari yuboriladi, `parent_notified_at` qo'yiladi

### Xatolik holati

- 4-qadam muvaffaqiyatsiz bo'lsa: `localStorage` dagi navbatga qo'yiladi, 5 / 15 / 60 soniyada qayta urinish
- Uch marta muvaffaqiyatsiz bo'lsa: qatorda kichik `Qayta yuborish` tugmasi chiqadi
- **Yo'qlama yozuvi baribir saqlanib qoladi.** Surat — qo'shimcha, shart emas

Bu **offline-first emas**. Service worker, IndexedDB, background sync yozmang.

---

## 11. Vaqt zonasi

Bog'cha Asia/Tashkent'da (UTC+5). Vercel serverlari UTC'da.

`lib/day.ts`:

```ts
import { formatInTimeZone } from "date-fns-tz";
export const TZ = "Asia/Tashkent";
export const today = () => formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
export const dayOf = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd");
```

`attendance.day` ni **har doim** shu yordamchi orqali hisoblang.
`new Date().toISOString().slice(0,10)` ishlatmang — kech soatlarda noto'g'ri kun beradi.

---

## 12. Xavfsizlik va maxfiylik

- Bolalar suratlari — maxfiy ma'lumot. Bucket `public = false`, faqat imzolangan havola (signed URL, 60 daqiqa)
- Surat faqat o'sha bolaning ota-onasiga yuboriladi
- Service-role kalit faqat server tomonda, faqat `lib/supabase/admin.ts` da
- `NEXT_PUBLIC_` prefiksli o'zgaruvchiga hech qachon maxfiy kalit qo'ymang
- RLS har bir jadvalda yoqilgan bo'lishi shart

---

## 13. Muhit o'zgaruvchilari

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=mittikids_bot
TELEGRAM_WEBHOOK_SECRET=
CRON_SECRET=
```

---

## 14. Cron

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/kitchen", "schedule": "30 3 * * *" },
    { "path": "/api/cron/weekly",  "schedule": "0 12 * * 5" }
  ]
}
```

Vaqtlar **UTC**da: 03:30 UTC = 08:30 Toshkent, 12:00 UTC = 17:00 Toshkent.

> Vercel rejasidagi cron chegarasini tekshiring. Agar yetmasa — `cron-job.org` dan
> `CRON_SECRET` bilan chaqiring. Oshxona xabari baribir `Yakunlash` tugmasidan ham ketadi,
> shuning uchun cron kritik bog'liqlik emas.

---

## 15. Qurish tartibi

Ketma-ket bajaring. Har qadamning qabul mezoni bor.

| # | Qadam | Qabul mezoni |
|---|---|---|
| 1 | Next.js loyiha, Tailwind, Supabase ulanishi | Bo'sh sahifa Vercel'da ochiladi |
| 2 | `0001_init.sql` ni qo'llash | Jadvallar bor, RLS yoqilgan |
| 3 | Auth: `/login`, sessiya, rol bo'yicha yo'naltirish | Telefon+parol bilan kiriladi, sessiya saqlanadi |
| 4 | Seed: 1 bog'cha, 1 rahbar, 1 tarbiyachi, 1 guruh, 16 bola | `/rahbar/bolalar` da ro'yxat ko'rinadi |
| 5 | `/yoqlama` — rasmsiz, faqat belgilash | 16 bola belgilanadi, BD'ga tushadi |
| 6 | Kamera + surat yuklash + navbat | Surat Storage'da, `photo_path` yozilgan |
| 7 | Telegram: webhook, `/start <code>`, ota-onani ulash | Test akkaunt ulanadi va rozilik xabarini oladi |
| 8 | Kelish xabari (surat bilan) | Test akkauntga surat keladi |
| 9 | `/rahbar` — bugun, oylik jadval, dalil paneli | Katak bosilganda surat va vaqt chiqadi |
| 10 | Menyu, oshxona xabari, subsidiya hisobi, Excel eksport | Fayl yuklanadi, raqamlar to'g'ri |

**5-qadamdan keyin to'xtang va real telefonda sinab ko'ring.** Agar u yerda noqulay bo'lsa, davom etishdan oldin tuzating — keyingi hamma narsa shu ekran ustiga quriladi.

---

## 16. Kirmaydi

Bularni qurishga urinmang:

- Telegram Mini App, `initData`, HMAC
- Better Auth yoki boshqa o'z auth tizimi
- Offline-first PWA, service worker, background sync
- Qurilmaga bog'langan PIN
- Ota-ona yoki oshpaz uchun veb-interfeys
- Dashboard, grafiklar, analitika
- To'lovlar, qarz, eslatma, xarajat, maosh, buxgalteriya
- Davlat bazasiga integratsiya urinishlari
- Ko'p til (faqat o'zbekcha)
- Dark mode
- Test yozish (1-bosqichda qo'lda sinaladi)

---

## 17. Ma'lum tuzoqlar

1. **Auth.** Oldingi ikki urinish Telegram Mini App `initData` da buzilgan. Bu yo'l yopiq.
2. **Vaqt zonasi.** `attendance.day` UTC'dan hisoblansa, kechqurun qilingan tuzatish keyingi kunga tushadi.
3. **RLS.** Jadval qo'shib, RLS'ni unutish — barcha bog'chalar ma'lumotini ochib qo'yadi.
4. **Serverless.** Telegram yuborishni `await` qiling yoki `waitUntil` ishlating; aks holda javob qaytgach funksiya to'xtaydi va xabar ketmaydi.
5. **Surat hajmi.** Siqilmagan surat 4–8 MB. Siqishni klientda qiling, serverda emas.
6. **`unique (child_id, day)`.** Ikki marta bosilganda xato bermasligi uchun `upsert` ishlating.
7. **Supabase "Confirm email".** O'chirilmasa, yaratilgan akkaunt kira olmaydi.
8. **Ota-ona bloklagan bot.** `403` xatosini ushlang, aks holda butun yuborish sikli to'xtaydi.

---

## 18. 2-bosqich (bu TZ'ga kirmaydi)

MVP real bog'chada ishga tushgandan keyin, shu tartibda:

1. To'lov holati va qarz (`payments` jadvali)
2. Avtomatik qarz eslatmasi — o'sha botdan, oyiga bir marta, muloyim matn
3. Subsidiya va to'lov solishtiruvi
4. Xarajat va oshxona byudjeti — eng oxirgi element

Sabab: to'lov eslatmasi faqat ota-ona allaqachon qadrlaydigan kanaldan ketishi kerak.
Birinchi kuniyoq pul so'ragan bot bloklanadi.
