# Deploy Gratis (Render + Neon)

Panduan ini untuk stack project ini:
- Frontend: Vite (static site)
- Backend: Express + Prisma
- Database: PostgreSQL (disarankan Neon free)

## 1) Siapkan database PostgreSQL gratis
1. Buat project di Neon (atau PostgreSQL cloud lain).
2. Ambil connection string `DATABASE_URL`.
3. Pastikan format URL mengarah ke database production.

## 2) Deploy backend di Render
1. Push project ke GitHub.
2. Di Render, klik `New +` -> `Blueprint`.
3. Pilih repo ini (Render akan membaca `render.yaml`).
4. Isi semua env yang `sync: false` untuk service `otp-murah-api`.

Minimal wajib:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ADMIN_ACCESS_SECRET`
- `JWT_ADMIN_REFRESH_SECRET`
- `CORS_ORIGINS`
- `FRONTEND_BASE_URL`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_EXPECTED_HOST`

Untuk cookie cross-domain:
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none`

## 3) Deploy frontend di Render
1. Service `otp-murah-web` akan ikut dibuat dari `render.yaml`.
2. Set env frontend:
- `VITE_API_BASE=https://<url-backend-render>`
- `VITE_TURNSTILE_SITE_KEY=<site-key-turnstile>`

## 4) Setelah deploy
1. Buka backend URL: `https://<backend>/health` harus return `{ ok: true }`.
2. Login user/admin dari frontend.
3. Cek endpoint upload banner/news dan tampilan image.

## Catatan penting
- Folder `backend/uploads` di hosting gratis biasanya non-persistent. File upload bisa hilang saat restart/redeploy.
- Untuk production, pindahkan upload ke object storage (Cloudinary, S3/R2, dsb).
- Jika SMTP diblokir di provider hosting, ganti kirim email ke provider berbasis HTTP API (mis. Resend/Brevo API).
