import { useCallback, useEffect, useMemo, useState } from "react";
import ReactQuill from "react-quill-new";
import { sileo } from "sileo";
import { adminFetch } from "../../lib/adminApi";
import { Button, Card, DropdownSelect, Icon, Input, Modal, Switch } from "../../components/ui";

const PAGE_SIZE = 12;
const EMPTY_NEWS_CONTENT = "<p><br></p>";

const NEWS_EDITOR_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["blockquote", "code-block", "link"],
    ["clean"],
  ],
};

const NEWS_EDITOR_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "list",
  "bullet",
  "align",
  "blockquote",
  "code-block",
  "link",
];

type NewsItem = {
  id: string;
  title: string;
  summary: string;
  content: string;
  tag?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type NewsResponse = {
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  items?: NewsItem[];
};

type NewsForm = {
  id?: string;
  title: string;
  summary: string;
  content: string;
  tag: string;
  isPublished: boolean;
};

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
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

function htmlToPlainText(value: string) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AdminNews() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [tablePageLoading, setTablePageLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formSaving, setFormSaving] = useState(false);
  const [form, setForm] = useState<NewsForm>({
    title: "",
    summary: "",
    content: EMPTY_NEWS_CONTENT,
    tag: "",
    isPublished: false,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());

      const res = await adminFetch(`/admin/monitor/news?${params.toString()}`, {
        method: "GET",
      });
      const data = (await res.json()) as NewsResponse;

      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data?.pagination?.totalPages ?? 1)));
      setTotalItems(Number(data?.pagination?.totalItems ?? 0));
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat news/info",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

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
    const published = items.filter((i) => i.isPublished).length;
    const draft = items.filter((i) => !i.isPublished).length;
    const withTag = items.filter((i) => i.tag).length;
    return { published, draft, withTag };
  }, [items]);

  const openCreateModal = useCallback(() => {
    setFormMode("create");
    setFormOpen(true);
    setForm({
      title: "",
      summary: "",
      content: EMPTY_NEWS_CONTENT,
      tag: "",
      isPublished: false,
    });
  }, []);

  const openEditModal = useCallback((item: NewsItem) => {
    setFormMode("edit");
    setFormOpen(true);
    setForm({
      id: item.id,
      title: item.title,
      summary: item.summary,
      content: item.content,
      tag: String(item.tag ?? ""),
      isPublished: Boolean(item.isPublished),
    });
  }, []);

  const closeFormModal = useCallback(() => {
    if (formSaving) return;
    setFormOpen(false);
  }, [formSaving]);

  const submitForm = useCallback(async () => {
    const title = form.title.trim();
    const summary = form.summary.trim();
    const content = form.content.trim();
    const contentPlainText = htmlToPlainText(content);
    const tag = form.tag.trim();

    if (!title) {
      sileo.warning({ title: "Judul wajib diisi", position: "top-center" });
      return;
    }
    if (!summary) {
      sileo.warning({ title: "Ringkasan wajib diisi", position: "top-center" });
      return;
    }
    if (!contentPlainText) {
      sileo.warning({ title: "Konten wajib diisi", position: "top-center" });
      return;
    }

    try {
      setFormSaving(true);

      const payload = {
        title,
        summary,
        content,
        tag,
        isPublished: form.isPublished,
      };

      if (formMode === "create") {
        await adminFetch("/admin/monitor/news", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        sileo.success({
          title: "News berhasil dibuat",
          position: "top-center",
        });
      } else {
        if (!form.id) throw new Error("Missing news id");
        await adminFetch(`/admin/monitor/news/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        sileo.success({
          title: "News berhasil diperbarui",
          position: "top-center",
        });
      }

      setFormOpen(false);
      await load();
    } catch (e: any) {
      sileo.error({
        title: formMode === "create" ? "Gagal membuat news" : "Gagal update news",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setFormSaving(false);
    }
  }, [form, formMode, load]);

  const openDeleteModal = useCallback((item: NewsItem) => {
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
      await adminFetch(`/admin/monitor/news/${deleteTarget.id}`, {
        method: "DELETE",
      });
      sileo.success({
        title: "News dihapus",
        description: `Item "${deleteTarget.title}" berhasil dihapus.`,
        position: "top-center",
      });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      sileo.error({
        title: "Gagal menghapus news",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, load]);

  return (
    <>
      {/* ════════ CREATE/EDIT MODAL ════════ */}
      <Modal
        open={formOpen}
        title={formMode === "create" ? "Tambah News/Info" : "Edit News/Info"}
        onClose={closeFormModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeFormModal} disabled={formSaving}>
              Batal
            </Button>
            <Button isLoading={formSaving} onClick={submitForm}>
              {formMode === "create" ? "Simpan" : "Update"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formMode === "edit" && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50/80 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                <Icon name="iconify:solar:document-text-bold-duotone" className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{form.title || "Untitled"}</p>
                <p className="text-[10px] text-slate-400 truncate">Editing news/info</p>
              </div>
            </div>
          )}

          <Input
            label="Judul"
            placeholder="Contoh: Promo weekend..."
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            leftIcon="iconify:solar:text-bold-duotone"
          />

          <Input
            label="Tag/Kategori"
            placeholder="Contoh: Promo, Update, Maintenance"
            value={form.tag}
            onChange={(e) => setForm((prev) => ({ ...prev, tag: e.target.value }))}
            leftIcon="iconify:solar:tag-bold-duotone"
          />

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">Ringkasan</label>
            <textarea
              rows={3}
              value={form.summary}
              onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Ringkasan singkat untuk card dashboard user"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">Konten Lengkap</label>
            <div className="admin-news-editor overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <ReactQuill
                theme="snow"
                value={form.content}
                onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
                modules={NEWS_EDITOR_MODULES}
                formats={NEWS_EDITOR_FORMATS}
                placeholder="Isi detail info/news"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Mendukung heading, warna teks, list, alignment, link, dan format teks.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Switch
              checked={form.isPublished}
              onCheckedChange={(next) => setForm((prev) => ({ ...prev, isPublished: next }))}
              label={form.isPublished ? "Publish sekarang" : "Simpan sebagai draft"}
            />
          </div>
        </div>
      </Modal>

      {/* ════════ DELETE MODAL ════════ */}
      <Modal
        open={deleteOpen}
        title="Hapus News/Info"
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
            <p className="text-sm text-slate-600">Item berikut akan dihapus permanen:</p>
            {deleteTarget && (
              <div className="inline-flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200/60 px-4 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                  <Icon name="iconify:solar:document-text-bold-duotone" className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800">{deleteTarget.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {deleteTarget.isPublished ? "Published" : "Draft"} · {deleteTarget.tag || "No tag"}
                  </p>
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
                Item ini akan dihapus secara permanen dan tidak dapat dikembalikan.
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
              label: "Total Artikel",
              value: loading ? null : String(totalItems),
              icon: "solar:documents-bold-duotone",
              color: "from-blue-500 to-indigo-600",
              bgLight: "bg-blue-50",
              textColor: "text-blue-600",
            },
            {
              label: "Published",
              value: loading ? null : String(stats.published),
              icon: "solar:check-circle-bold-duotone",
              color: "from-emerald-500 to-green-600",
              bgLight: "bg-emerald-50",
              textColor: "text-emerald-600",
            },
            {
              label: "Draft",
              value: loading ? null : String(stats.draft),
              icon: "solar:document-bold-duotone",
              color: "from-amber-500 to-orange-600",
              bgLight: "bg-amber-50",
              textColor: "text-amber-600",
            },
            {
              label: "Dengan Tag",
              value: loading ? null : String(stats.withTag),
              icon: "solar:tag-bold-duotone",
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
                        <span className="inline-block h-6 w-12 animate-pulse rounded-lg bg-slate-100" />
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
                    name="iconify:solar:document-text-bold-duotone"
                    className="h-4.5 w-4.5 text-white"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Manajemen News/Info</h2>
                  <p className="text-[11px] text-slate-400">
                    {loading ? "Memuat data..." : `${totalItems} artikel tersedia`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={load}
                  isLoading={loading}
                  leftIcon="iconify:solar:refresh-bold-duotone"
                  className="!h-8 !text-[11px] !font-bold"
                >
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={openCreateModal}
                  leftIcon="iconify:solar:add-circle-bold-duotone"
                  className="!h-8 !text-[11px] !font-bold"
                >
                  Tambah Info
                </Button>
              </div>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="border-b border-slate-100/80 px-5 py-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative group">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
                  <Icon name="search" className="h-4 w-4 mb-[3px]" />
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari judul, ringkasan, tag..."
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
              <DropdownSelect
                value={statusFilter}
                onChange={setStatusFilter}
                leftIcon="iconify:solar:filter-bold-duotone"
                options={[
                  { value: "ALL", label: "Semua Status" },
                  { value: "PUBLISHED", label: "Published" },
                  { value: "DRAFT", label: "Draft" },
                ]}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100/80 bg-slate-50/40">
                  {["Judul", "Tag", "Status", "Publish At", "Updated", "Aksi"].map((h) => (
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
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-slate-200/70" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-40 rounded-md bg-slate-200/70" />
                            <div className="h-2.5 w-56 rounded-md bg-slate-200/70" />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-100/80" /></td>
                      <td className="px-5 py-4"><div className="h-6 w-20 rounded-full bg-slate-100/80" /></td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="h-3 w-28 rounded-md bg-slate-100/80" />
                          <div className="h-2.5 w-16 rounded-md bg-slate-100/80" />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="h-3 w-28 rounded-md bg-slate-100/80" />
                          <div className="h-2.5 w-16 rounded-md bg-slate-100/80" />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1.5">
                          <div className="h-8 w-8 rounded-lg bg-slate-100/80" />
                          <div className="h-8 w-8 rounded-lg bg-slate-100/80" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : !items.length ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                          <Icon
                            name="iconify:solar:document-text-bold-duotone"
                            className="h-7 w-7 text-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-500">Belum ada news/info</p>
                          <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                            Klik "Tambah Info" untuk membuat artikel pertama
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
                      {/* Judul */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className={cx(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm",
                            item.isPublished
                              ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                              : "bg-gradient-to-br from-slate-400 to-slate-500"
                          )}>
                            <Icon name="iconify:solar:document-text-bold-duotone" className="h-4 w-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate max-w-[280px]">
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400 line-clamp-2 max-w-[280px] leading-relaxed">
                              {item.summary}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tag */}
                      <td className="px-5 py-4">
                        {item.tag ? (
                          <span className="inline-flex items-center rounded-lg bg-violet-50/80 px-2 py-1 text-[10px] font-bold text-violet-700">
                            {item.tag}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {item.isPublished ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50/80 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Publish At */}
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Icon name="iconify:solar:calendar-bold-duotone" className="h-3 w-3 text-slate-400" />
                            <span>{formatTime(item.publishedAt)}</span>
                          </div>
                          {relativeTime(item.publishedAt) && (
                            <p className="text-[9px] text-slate-400 pl-[18px]">
                              {relativeTime(item.publishedAt)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Updated */}
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Icon name="iconify:solar:clock-circle-bold-duotone" className="h-3 w-3 text-slate-400" />
                            <span>{formatTime(item.updatedAt)}</span>
                          </div>
                          {relativeTime(item.updatedAt) && (
                            <p className="text-[9px] text-slate-400 pl-[18px]">
                              {relativeTime(item.updatedAt)}
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
                            title="Edit"
                          >
                            <Icon name="iconify:solar:pen-bold-duotone" className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openDeleteModal(item)}
                            className="!h-8 !w-8 !p-0"
                            title="Hapus"
                          >
                            <Icon name="iconify:solar:trash-bin-trash-bold-duotone" className="h-3.5 w-3.5" />
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
              <div className="flex items-center gap-2">
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
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
