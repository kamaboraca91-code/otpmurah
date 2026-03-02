import { Link } from "react-router-dom";
import { Button, Icon } from "../components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-2xl items-center">
        <div className="w-full rounded-3xl border border-zinc-200/80 bg-white/90 p-8 text-center shadow-xl shadow-emerald-500/[0.04] sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Icon name="iconify:solar:danger-triangle-bold-duotone" className="h-8 w-8" />
          </div>

          <p className="text-5xl font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-2">404 Error</p>
          <h1 className="mt-2 text-1xl font-bold text-slate-900 sm:text-2xl">Halaman Tidak Ditemukan</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Link yang kamu buka tidak valid, sudah berubah, atau sudah tidak tersedia.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/">
              <Button size="sm" className="w-full sm:w-auto" leftIcon="iconify:solar:home-2-bold-duotone">
                Ke Beranda
              </Button>
            </Link>
            <Link to="/login">
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                leftIcon="iconify:solar:login-3-bold-duotone"
              >
                Ke Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
