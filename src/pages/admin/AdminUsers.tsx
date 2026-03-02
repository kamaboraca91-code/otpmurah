import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { adminFetch } from "../../lib/adminApi";
import { Button, Card, Icon, Input, Modal } from "../../components/ui";

const PAGE_SIZE = 20;

type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  balance: number;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  topupCount: number;
  totalSpent: number;
  totalTopup: number;
  lastOrderAt?: string | null;
  lastTopupAt?: string | null;
};

type UsersResponse = {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  items: UserRow[];
};

type UserForm = {
  id?: string;
  email: string;
  name: string;
  password: string;
  balance: string;
};

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function formatMoney(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(x);
}

function formatTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d lalu`;
  return "";
}

function toBalanceInt(input: string) {
  const n = Number(String(input ?? "").replace(/[^\d-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function userInitials(name?: string | null, email?: string) {
  const n = String(name ?? "").trim();
  if (n) {
    const parts = n.split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  }
  return String(email ?? "").slice(0, 2).toUpperCase();
}

export default function AdminUsers() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [tablePageLoading, setTablePageLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formSaving, setFormSaving] = useState(false);
  const [form, setForm] = useState<UserForm>({
    email: "",
    name: "",
    password: "",
    balance: "0",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (query.trim()) params.set("q", query.trim());

      const res = await adminFetch(`/admin/monitor/users?${params.toString()}`, { method: "GET" });
      const data = (await res.json()) as UsersResponse;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data?.pagination?.totalPages ?? 1)));
      setTotalItems(Number(data?.pagination?.totalItems ?? 0));
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat admin users",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!tablePageLoading || loading) return;
    const timer = window.setTimeout(() => setTablePageLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [loading, tablePageLoading]);

  const goToPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, nextPage));
      if (clamped === page) return;
      setTablePageLoading(true);
      setPage(clamped);
    },
    [page, totalPages]
  );

  const tableLoading = loading || tablePageLoading;

  const pageInfo = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalItems);
    return { start, end };
  }, [page, totalItems]);

  const stats = useMemo(() => {
    const totalBalance = items.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    const totalSpent = items.reduce((s, i) => s + (Number(i.totalSpent) || 0), 0);
    const totalTopup = items.reduce((s, i) => s + (Number(i.totalTopup) || 0), 0);
    return { totalBalance, totalSpent, totalTopup };
  }, [items]);

  const openCreateModal = useCallback(() => {
    setFormMode("create");
    setFormOpen(true);
    setForm({ email: "", name: "", password: "", balance: "0" });
  }, []);

  const openEditModal = useCallback((item: UserRow) => {
    setFormMode("edit");
    setFormOpen(true);
    setForm({
      id: item.id,
      email: item.email,
      name: item.name ?? "",
      password: "",
      balance: String(item.balance ?? 0),
    });
  }, []);

  const closeFormModal = useCallback(() => {
    if (formSaving) return;
    setFormOpen(false);
  }, [formSaving]);

  const submitForm = useCallback(async () => {
    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();
    const password = form.password;
    const balance = toBalanceInt(form.balance);

    if (!email || !email.includes("@")) {
      sileo.warning({
        title: "Email tidak valid",
        description: "Mohon isi email user dengan benar.",
        position: "top-center",
      });
      return;
    }

    if (formMode === "create" && !password) {
      sileo.warning({
        title: "Password wajib",
        description: "Password harus diisi saat tambah user.",
        position: "top-center",
      });
      return;
    }

    try {
      setFormSaving(true);

      if (formMode === "create") {
        await adminFetch("/admin/monitor/users", {
          method: "POST",
          body: JSON.stringify({ email, name, password, balance }),
        });
        sileo.success({
          title: "User ditambahkan",
          description: "Data user baru berhasil dibuat.",
          position: "top-center",
        });
      } else {
        if (!form.id) throw new Error("Missing user id");
        const body: Record<string, unknown> = { email, name, balance };
        if (password.trim()) body.password = password;
        await adminFetch(`/admin/monitor/users/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        sileo.success({
          title: "User diperbarui",
          description: "Perubahan data user berhasil disimpan.",
          position: "top-center",
        });
      }

      setFormOpen(false);
      await load();
    } catch (e: any) {
      sileo.error({
        title: formMode === "create" ? "Gagal tambah user" : "Gagal update user",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setFormSaving(false);
    }
  }, [form, formMode, load]);

  const openDeleteModal = useCallback((item: UserRow) => {
    setDeleteTarget(item);
    setDeleteOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeleteTarget(null);
  }, [deleteLoading]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await adminFetch(`/admin/monitor/users/${deleteTarget.id}`, { method: "DELETE" });
      sileo.success({
        title: "User dihapus",
        description: `${deleteTarget.email} berhasil dihapus.`,
        position: "top-center",
      });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      sileo.error({
        title: "Gagal hapus user",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, load]);

  const copyText = useCallback(async (text: string) => {
    const t = String(text ?? "").trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      sileo.success({ title: "Disalin", description: t, position: "top-center" });
    } catch {
      sileo.error({
        title: "Gagal copy",
        description: "Browser menolak akses clipboard.",
        position: "top-center",
      });
    }
  }, []);

  return (
    <>
      {/* ════════ CREATE/EDIT MODAL ════════ */}
      <Modal
        open={formOpen}
        title={formMode === "create" ? "Tambah User" : "Edit User"}
        onClose={closeFormModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeFormModal} disabled={formSaving}>
              Batal
            </Button>
            <Button isLoading={formSaving} onClick={submitForm}>
              {formMode === "create" ? "Tambah" : "Simpan"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formMode === "edit" && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50/80 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-lg shadow-emerald-500/20">
                {userInitials(form.name, form.email)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{form.name || form.email}</p>
                <p className="text-[10px] text-slate-400 truncate">Editing user profile</p>
              </div>
            </div>
          )}

          <Input
            label="Email"
            placeholder="user@mail.com"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            leftIcon="iconify:solar:letter-bold-duotone"
          />
          <Input
            label="Nama"
            placeholder="Nama user"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            leftIcon="iconify:solar:user-bold-duotone"
          />
          <Input
            label={formMode === "create" ? "Password" : "Password Baru (opsional)"}
            placeholder={formMode === "create" ? "Wajib diisi" : "Kosongkan jika tidak diubah"}
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            leftIcon="iconify:solar:lock-password-bold-duotone"
            hint="Minimal 10 karakter, huruf besar/kecil, angka, simbol"
          />
          <Input
            label="Saldo"
            placeholder="0"
            value={form.balance}
            onChange={(e) => setForm((prev) => ({ ...prev, balance: e.target.value }))}
            leftIcon="iconify:solar:wallet-money-bold-duotone"
            hint="Nilai saldo dalam rupiah"
          />
        </div>
      </Modal>

      {/* ════════ DELETE MODAL ════════ */}
      <Modal
        open={deleteOpen}
        title="Hapus User"
        onClose={closeDeleteModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeDeleteModal} disabled={deleteLoading}>
              Batal
            </Button>
            <Button variant="danger" isLoading={deleteLoading} onClick={confirmDelete}>
              Hapus Permanen
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200/60 shadow-inner">
            <Icon name="warning" className="h-8 w-8 text-rose-500" />
          </div>

          <div className="text-center space-y-1.5">
            <p className="text-sm text-slate-600">User berikut akan dihapus permanen:</p>
            {deleteTarget && (
              <div className="inline-flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200/60 px-4 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white">
                  {userInitials(deleteTarget.name, deleteTarget.email)}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800">{deleteTarget.name || "-"}</p>
                  <p className="text-[10px] text-slate-500">{deleteTarget.email}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Icon name="warning" className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Semua data terkait user (session, order, topup, mutasi) akan ikut terhapus.
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <div className="space-y-6">
        {/* ════════ STATS CARDS ════════ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total Users",
              value: loading ? null : String(totalItems),
              icon: "solar:users-group-rounded-bold-duotone",
              color: "from-blue-500 to-indigo-600",
              bgLight: "bg-blue-50",
              textColor: "text-blue-600",
            },
            {
              label: "Total Saldo",
              value: loading ? null : formatMoney(stats.totalBalance),
              icon: "solar:wallet-bold-duotone",
              color: "from-emerald-500 to-green-600",
              bgLight: "bg-emerald-50",
              textColor: "text-emerald-600",
            },
            {
              label: "Total Spent",
              value: loading ? null : formatMoney(stats.totalSpent),
              icon: "solar:cart-large-minimalistic-bold-duotone",
              color: "from-rose-500 to-red-600",
              bgLight: "bg-rose-50",
              textColor: "text-rose-600",
            },
            {
              label: "Total Topup",
              value: loading ? null : formatMoney(stats.totalTopup),
              icon: "solar:card-recive-bold-duotone",
              color: "from-violet-500 to-purple-600",
              bgLight: "bg-violet-50",
              textColor: "text-violet-600",
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="!p-0 overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="relative p-4">
                <div
                  className={cx(
                    "absolute top-0 right-0 h-20 w-20 opacity-[0.04] rounded-bl-[40px]",
                    "bg-gradient-to-br",
                    stat.color
                  )}
                />
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      {stat.label}
                    </p>
                    <p className="text-lg font-bold text-slate-800">
                      {loading ? (
                        <span className="inline-block h-6 w-20 animate-pulse rounded-lg bg-slate-100" />
                      ) : (
                        stat.value
                      )}
                    </p>
                  </div>
                  <div
                    className={cx(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      stat.bgLight
                    )}
                  >
                    <Icon name={`iconify:${stat.icon}`} className={cx("h-5 w-5", stat.textColor)} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ════════ MAIN TABLE ════════ */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex gap-3 flex-row justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon
                    name="iconify:solar:users-group-rounded-bold-duotone"
                    className="h-4.5 w-4.5 text-white"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Manajemen User</h2>
                  <p className="text-[11px] text-slate-400">
                    {loading ? "Memuat data..." : `${totalItems} user terdaftar`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={openCreateModal}
                  leftIcon="iconify:solar:add-circle-bold-duotone"
                  className="!h-8 !text-[11px] !font-bold"
                >
                  Tambah User
                </Button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="border-b border-slate-100/80 px-5 py-3">
            <div className="relative group max-w-md">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                <Icon name="search" className="h-4 w-4 mb-[3px]" />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, email user..."
                className="w-full h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-10 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <Icon name="iconify:solar:close-circle-bold" className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100/80 bg-slate-50/40">
                  {[
                    "User",
                    "Saldo",
                    "Orders",
                    "Topup",
                    "Total Spent",
                    "Total Topup",
                    "Aktivitas",
                    "Aksi",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400/80"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tableLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-slate-200/70" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-24 rounded-md bg-slate-200/70" />
                            <div className="h-2.5 w-32 rounded-md bg-slate-200/70" />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-6 w-24 rounded-lg bg-slate-100/80" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-3.5 w-10 rounded-md bg-slate-100/80" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-3.5 w-10 rounded-md bg-slate-100/80" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-3.5 w-20 rounded-md bg-slate-100/80" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-3.5 w-20 rounded-md bg-slate-100/80" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="h-3 w-28 rounded-md bg-slate-100/80" />
                          <div className="h-2.5 w-20 rounded-md bg-slate-100/80" />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <div className="h-8 w-16 rounded-lg bg-slate-100/80" />
                          <div className="h-8 w-16 rounded-lg bg-slate-100/80" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : !items.length ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                          <Icon
                            name="iconify:solar:users-group-rounded-bold-duotone"
                            className="h-7 w-7 text-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-500">Tidak ada data user</p>
                          <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                            Belum ada user yang cocok dengan pencarian
                          </p>
                        </div>
                        {query && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setQuery("")}
                            className="!h-8 mt-1 gap-1.5 !text-[11px]"
                          >
                            <Icon name="iconify:solar:close-circle-bold" className="h-3.5 w-3.5" />
                            Reset Pencarian
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="group align-top transition-all duration-200 hover:bg-blue-50/20"
                    >
                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white shadow-sm">
                            {userInitials(item.name, item.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {item.name || "-"}
                            </p>
                            <button
                              onClick={() => copyText(item.email)}
                              className="group/email inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              {item.email}
                              <Icon
                                name="iconify:solar:copy-linear"
                                className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/email:opacity-100"
                              />
                            </button>
                            <p className="mt-0.5 text-[9px] text-slate-400">
                              Join {formatTime(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Saldo */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-lg bg-emerald-50/80 px-2 py-1 text-xs font-bold text-emerald-700">
                          {formatMoney(item.balance)}
                        </span>
                      </td>

                      {/* Orders */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold text-slate-700">{item.orderCount}</span>
                      </td>

                      {/* Topup */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold text-slate-700">{item.topupCount}</span>
                      </td>

                      {/* Total Spent */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-lg bg-rose-50/80 px-2 py-1 text-xs font-bold text-rose-700">
                          {formatMoney(item.totalSpent)}
                        </span>
                      </td>

                      {/* Total Topup */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-lg bg-violet-50/80 px-2 py-1 text-xs font-bold text-violet-700">
                          {formatMoney(item.totalTopup)}
                        </span>
                      </td>

                      {/* Aktivitas */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Icon
                              name="iconify:solar:cart-large-minimalistic-bold-duotone"
                              className="h-3 w-3 text-slate-400"
                            />
                            <span>{formatTime(item.lastOrderAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Icon
                              name="iconify:solar:card-recive-bold-duotone"
                              className="h-3 w-3 text-slate-400"
                            />
                            <span>{formatTime(item.lastTopupAt)}</span>
                          </div>
                          {relativeTime(item.lastOrderAt || item.lastTopupAt) && (
                            <p className="text-[9px] text-slate-400">
                              {relativeTime(item.lastOrderAt || item.lastTopupAt)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(item)}
                            className="!h-8 !w-8 !p-0"
                            title="Edit user"
                          >
                            <Icon
                              name="iconify:solar:pen-bold-duotone"
                              className="h-3.5 w-3.5"
                            />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openDeleteModal(item)}
                            className="!h-8 !w-8 !p-0"
                            title="Hapus user"
                          >
                            <Icon
                              name="iconify:solar:trash-bin-trash-bold-duotone"
                              className="h-3.5 w-3.5"
                            />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && items.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100/80 bg-slate-50/30 px-5 py-3.5 sm:flex-row items-center sm:justify-between">
              <p className="text-[11px] text-slate-400">
                Menampilkan{" "}
                <span className="font-bold text-slate-600">
                  {pageInfo.start}–{pageInfo.end}
                </span>{" "}
                dari <span className="font-bold text-slate-600">{totalItems}</span> data
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tableLoading || page <= 1}
                  onClick={() => goToPage(1)}
                  className="!h-8 !w-8 !p-0 !text-[11px]"
                  title="Halaman pertama"
                >
                  <Icon name="iconify:solar:alt-arrow-left-bold" className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tableLoading || page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="!h-8 !text-[11px] !font-semibold gap-1"
                >
                  <Icon name="iconify:solar:arrow-left-linear" className="h-3 w-3" />
                  Prev
                </Button>

                <div className="flex items-center gap-0.5 mx-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 5) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - page) <= 1) return true;
                      return false;
                    })
                    .reduce<(number | "dots")[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("dots");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "dots" ? (
                        <span
                          key={`dots-${i}`}
                          className="px-1 text-[10px] text-slate-300 select-none"
                        >
                          •••
                        </span>
                      ) : (
                        <button
                          key={p}
                          disabled={tableLoading}
                          onClick={() => goToPage(p)}
                          className={cx(
                            "flex h-8 min-w-[32px] items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
                            page === p
                              ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tableLoading || page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="!h-8 !text-[11px] !font-semibold gap-1"
                >
                  Next
                  <Icon name="iconify:solar:arrow-right-linear" className="h-3 w-3" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tableLoading || page >= totalPages}
                  onClick={() => goToPage(totalPages)}
                  className="!h-8 !w-8 !p-0 !text-[11px]"
                  title="Halaman terakhir"
                >
                  <Icon name="iconify:solar:alt-arrow-right-bold" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
