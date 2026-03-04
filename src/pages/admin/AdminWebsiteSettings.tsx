import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sileo } from "sileo";
import { API_BASE, adminFetch } from "../../lib/adminApi";
import { Button, Card, DropdownSelect, Icon, Input, Modal, Switch } from "../../components/ui";

type SeoSettings = {
  metaTitle: string;
  metaDescription: string;
  faviconUrl?: string | null;
  ogImageUrl?: string | null;
  twitterCard: "summary" | "summary_large_image";
  robotsNoIndex: boolean;
};

type LandingContentSettings = {
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  productEyebrow: string;
  productTitle: string;
  productSubtitle: string;
  howEyebrow: string;
  howTitle: string;
  howSubtitle: string;
  faqEyebrow: string;
  faqTitle: string;
  faqSubtitle: string;
  ctaBadge: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPrimaryCta: string;
  ctaSecondaryCta: string;
};

type WebsiteSettings = {
  id: string;
  siteName: string;
  siteDescription: string;
  logoUrl?: string | null;
  maintenanceMode: boolean;
  maintenanceMessage?: string | null;
  seo: SeoSettings;
  landingContent: LandingContentSettings;
  createdAt?: string;
  updatedAt?: string;
};

type WebsiteBanner = {
  id: string;
  imageUrl: string;
  title?: string | null;
  subtitle?: string | null;
  linkUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type WebsiteResponse = {
  ok?: boolean;
  settings?: WebsiteSettings;
  banners?: WebsiteBanner[];
};

type BannerForm = {
  id?: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
  startAt: string;
  endAt: string;
};

const DEFAULT_SEO_SETTINGS: SeoSettings = {
  metaTitle: "",
  metaDescription: "",
  faviconUrl: "",
  ogImageUrl: "",
  twitterCard: "summary_large_image",
  robotsNoIndex: false,
};

const DEFAULT_LANDING_CONTENT: LandingContentSettings = {
  heroBadge: "Layanan aktif",
  heroTitle: "Terima OTP SMS",
  heroHighlight: "dengan nomor virtual",
  heroDescription:
    "Pilih negara dan layanan, beli nomor, lalu terima kode verifikasi secara instan. Cocok untuk messenger, media sosial, marketplace, dan lainnya.",
  heroPrimaryCta: "Mulai Sekarang",
  heroSecondaryCta: "Cara kerja",
  productEyebrow: "Produk",
  productTitle: "Kenapa memilih nomor virtual kami",
  productSubtitle:
    "Dibuat untuk alur verifikasi di platform populer - sederhana, cepat, dan ramah privasi.",
  howEyebrow: "Cara kerja",
  howTitle: "Lima langkah mudah untuk menerima OTP",
  howSubtitle: "Alur sederhana untuk kebutuhan verifikasi harian.",
  faqEyebrow: "FAQ",
  faqTitle: "Pertanyaan yang sering ditanyakan",
  faqSubtitle: "Jawaban singkat untuk pertanyaan paling umum tentang layanan kami.",
  ctaBadge: "Siap mulai?",
  ctaTitle: "Mulai terima OTP SMS hari ini",
  ctaSubtitle:
    "Bergabung dengan ribuan pengguna yang mempercayai platform kami untuk verifikasi SMS yang cepat, andal, dan aman.",
  ctaPrimaryCta: "Buat akun gratis",
  ctaSecondaryCta: "Pelajari lebih lanjut",
};

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function resolveMediaUrl(url?: string | null) {
  const value = String(url ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return `${API_BASE}${value.startsWith("/") ? "" : "/"}${value}`;
}

function formatTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function toDateTimeLocalValue(iso?: string | null) {
  const text = String(iso ?? "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/* ─── Drag & Drop Upload Zone ─── */
function DropZone({
  value,
  uploading,
  onFile,
  onUrlChange,
  label,
  height,
}: {
  value: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onUrlChange: (url: string) => void;
  label?: string;
  height?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        onFile(file);
      } else {
        sileo.warning({ title: "File harus berupa gambar", position: "top-center" });
      }
    },
    [onFile]
  );

  const resolved = resolveMediaUrl(value);

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </label>
      )}

      {/* Drop area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cx(
          "relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300",
          height || "h-40",
          isDragOver
            ? "border-emerald-400 bg-emerald-50/50 scale-[1.01]"
            : resolved
              ? "border-slate-200/60 bg-slate-50/30 hover:border-slate-300"
              : "border-slate-200 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/30"
        )}
      >
        {uploading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
              <p className="text-[11px] font-bold text-slate-500">Uploading...</p>
            </div>
          </div>
        )}

        {resolved ? (
          <div className="relative h-full w-full group">
            <img
              src={resolved}
              alt="Preview"
              className="h-full w-full object-cover rounded-[10px]"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-all duration-300 group-hover:bg-slate-900/40 rounded-[10px]">
              <div className="flex flex-col items-center gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 shadow-lg">
                  <Icon name="iconify:solar:camera-bold-duotone" className="h-5 w-5 text-slate-700" />
                </div>
                <span className="text-[11px] font-bold text-white">Ganti gambar</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
            <div
              className={cx(
                "flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300",
                isDragOver
                  ? "border-emerald-300 bg-emerald-100 scale-110"
                  : "border-slate-200 bg-white"
              )}
            >
              <Icon
                name="iconify:solar:cloud-upload-bold-duotone"
                className={cx(
                  "h-6 w-6 transition-colors",
                  isDragOver ? "text-emerald-600" : "text-slate-400"
                )}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-600">
                {isDragOver ? "Lepas untuk upload" : "Drag & drop gambar di sini"}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                atau <span className="font-bold text-emerald-600">klik untuk pilih file</span>
              </p>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Manual URL input */}
      <div className="relative group">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-emerald-500">
          <Icon name="iconify:solar:link-bold-duotone" className="h-3.5 w-3.5" />
        </span>
        <input
          value={value}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="Atau masukkan URL gambar..."
          className="w-full h-9 rounded-lg border border-slate-200/80 bg-slate-50/50 pl-9 pr-3 text-[11px] text-slate-700 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
        />
      </div>
    </div>
  );
}

export default function AdminWebsiteSettings() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [settings, setSettings] = useState<WebsiteSettings>({
    id: "singleton",
    siteName: "OTP Seller",
    siteDescription: "Platform pembelian nomor OTP virtual",
    logoUrl: "",
    maintenanceMode: false,
    maintenanceMessage: "",
    seo: DEFAULT_SEO_SETTINGS,
    landingContent: DEFAULT_LANDING_CONTENT,
  });

  const [banners, setBanners] = useState<WebsiteBanner[]>([]);
  const [creatingBanner, setCreatingBanner] = useState(false);
  const [newBannerUploading, setNewBannerUploading] = useState(false);
  const [updatingBannerId, setUpdatingBannerId] = useState<string | null>(null);
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);

  /* Banner modal state */
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerModalMode, setBannerModalMode] = useState<"create" | "edit">("create");
  const [bannerModalSaving, setBannerModalSaving] = useState(false);
  const [bannerModalUploading, setBannerModalUploading] = useState(false);
  const [bannerForm, setBannerForm] = useState<BannerForm>({
    imageUrl: "",
    title: "",
    subtitle: "",
    linkUrl: "",
    sortOrder: 0,
    isActive: true,
    startAt: "",
    endAt: "",
  });

  /* Delete banner modal */
  const [deleteBannerModal, setDeleteBannerModal] = useState<{
    open: boolean;
    banner: WebsiteBanner | null;
  }>({ open: false, banner: null });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/admin/settings/website", { method: "GET" });
      const data = (await res.json()) as WebsiteResponse;
      if (data.settings) {
        const seoSource: Record<string, unknown> = isObject(data.settings.seo)
          ? data.settings.seo
          : {};
        const landingSource: Record<string, unknown> = isObject(data.settings.landingContent)
          ? data.settings.landingContent
          : {};

        setSettings({
          ...data.settings,
          logoUrl: String(data.settings.logoUrl ?? ""),
          maintenanceMessage: String(data.settings.maintenanceMessage ?? ""),
          seo: {
            metaTitle: String(seoSource.metaTitle ?? DEFAULT_SEO_SETTINGS.metaTitle),
            metaDescription: String(
              seoSource.metaDescription ?? DEFAULT_SEO_SETTINGS.metaDescription
            ),
            faviconUrl: String(seoSource.faviconUrl ?? DEFAULT_SEO_SETTINGS.faviconUrl),
            ogImageUrl: String(seoSource.ogImageUrl ?? DEFAULT_SEO_SETTINGS.ogImageUrl),
            twitterCard:
              String(seoSource.twitterCard ?? DEFAULT_SEO_SETTINGS.twitterCard) === "summary"
                ? "summary"
                : "summary_large_image",
            robotsNoIndex: Boolean(seoSource.robotsNoIndex ?? DEFAULT_SEO_SETTINGS.robotsNoIndex),
          },
          landingContent: {
            heroBadge: String(landingSource.heroBadge ?? DEFAULT_LANDING_CONTENT.heroBadge),
            heroTitle: String(landingSource.heroTitle ?? DEFAULT_LANDING_CONTENT.heroTitle),
            heroHighlight: String(
              landingSource.heroHighlight ?? DEFAULT_LANDING_CONTENT.heroHighlight
            ),
            heroDescription: String(
              landingSource.heroDescription ?? DEFAULT_LANDING_CONTENT.heroDescription
            ),
            heroPrimaryCta: String(
              landingSource.heroPrimaryCta ?? DEFAULT_LANDING_CONTENT.heroPrimaryCta
            ),
            heroSecondaryCta: String(
              landingSource.heroSecondaryCta ?? DEFAULT_LANDING_CONTENT.heroSecondaryCta
            ),
            productEyebrow: String(
              landingSource.productEyebrow ?? DEFAULT_LANDING_CONTENT.productEyebrow
            ),
            productTitle: String(
              landingSource.productTitle ?? DEFAULT_LANDING_CONTENT.productTitle
            ),
            productSubtitle: String(
              landingSource.productSubtitle ?? DEFAULT_LANDING_CONTENT.productSubtitle
            ),
            howEyebrow: String(landingSource.howEyebrow ?? DEFAULT_LANDING_CONTENT.howEyebrow),
            howTitle: String(landingSource.howTitle ?? DEFAULT_LANDING_CONTENT.howTitle),
            howSubtitle: String(landingSource.howSubtitle ?? DEFAULT_LANDING_CONTENT.howSubtitle),
            faqEyebrow: String(landingSource.faqEyebrow ?? DEFAULT_LANDING_CONTENT.faqEyebrow),
            faqTitle: String(landingSource.faqTitle ?? DEFAULT_LANDING_CONTENT.faqTitle),
            faqSubtitle: String(landingSource.faqSubtitle ?? DEFAULT_LANDING_CONTENT.faqSubtitle),
            ctaBadge: String(landingSource.ctaBadge ?? DEFAULT_LANDING_CONTENT.ctaBadge),
            ctaTitle: String(landingSource.ctaTitle ?? DEFAULT_LANDING_CONTENT.ctaTitle),
            ctaSubtitle: String(landingSource.ctaSubtitle ?? DEFAULT_LANDING_CONTENT.ctaSubtitle),
            ctaPrimaryCta: String(
              landingSource.ctaPrimaryCta ?? DEFAULT_LANDING_CONTENT.ctaPrimaryCta
            ),
            ctaSecondaryCta: String(
              landingSource.ctaSecondaryCta ?? DEFAULT_LANDING_CONTENT.ctaSecondaryCta
            ),
          },
        });
      }
      setBanners(Array.isArray(data.banners) ? data.banners : []);
    } catch (e: any) {
      sileo.error({
        title: "Gagal memuat website setting",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadImage = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    const res = await adminFetch("/admin/settings/website/upload-image", {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as { ok?: boolean; file?: { url?: string; path?: string } };
    return String(data?.file?.path ?? data?.file?.url ?? "").trim();
  }, []);

  const saveWebsiteSettings = useCallback(async () => {
    const siteName = settings.siteName.trim();
    const siteDescription = settings.siteDescription.trim();
    const logoUrl = String(settings.logoUrl ?? "").trim();
    const maintenanceMessage = String(settings.maintenanceMessage ?? "").trim();
    const seo = {
      metaTitle: String(settings.seo.metaTitle ?? "").trim(),
      metaDescription: String(settings.seo.metaDescription ?? "").trim(),
      faviconUrl: String(settings.seo.faviconUrl ?? "").trim() || null,
      ogImageUrl: String(settings.seo.ogImageUrl ?? "").trim() || null,
      twitterCard:
        String(settings.seo.twitterCard ?? "summary_large_image") === "summary"
          ? "summary"
          : "summary_large_image",
      robotsNoIndex: Boolean(settings.seo.robotsNoIndex),
    };
    const landingContent = {
      heroBadge: String(settings.landingContent.heroBadge ?? "").trim(),
      heroTitle: String(settings.landingContent.heroTitle ?? "").trim(),
      heroHighlight: String(settings.landingContent.heroHighlight ?? "").trim(),
      heroDescription: String(settings.landingContent.heroDescription ?? "").trim(),
      heroPrimaryCta: String(settings.landingContent.heroPrimaryCta ?? "").trim(),
      heroSecondaryCta: String(settings.landingContent.heroSecondaryCta ?? "").trim(),
      productEyebrow: String(settings.landingContent.productEyebrow ?? "").trim(),
      productTitle: String(settings.landingContent.productTitle ?? "").trim(),
      productSubtitle: String(settings.landingContent.productSubtitle ?? "").trim(),
      howEyebrow: String(settings.landingContent.howEyebrow ?? "").trim(),
      howTitle: String(settings.landingContent.howTitle ?? "").trim(),
      howSubtitle: String(settings.landingContent.howSubtitle ?? "").trim(),
      faqEyebrow: String(settings.landingContent.faqEyebrow ?? "").trim(),
      faqTitle: String(settings.landingContent.faqTitle ?? "").trim(),
      faqSubtitle: String(settings.landingContent.faqSubtitle ?? "").trim(),
      ctaBadge: String(settings.landingContent.ctaBadge ?? "").trim(),
      ctaTitle: String(settings.landingContent.ctaTitle ?? "").trim(),
      ctaSubtitle: String(settings.landingContent.ctaSubtitle ?? "").trim(),
      ctaPrimaryCta: String(settings.landingContent.ctaPrimaryCta ?? "").trim(),
      ctaSecondaryCta: String(settings.landingContent.ctaSecondaryCta ?? "").trim(),
    };

    if (!siteName) {
      sileo.warning({ title: "Nama website wajib diisi", position: "top-center" });
      return;
    }
    if (!siteDescription) {
      sileo.warning({ title: "Deskripsi website wajib diisi", position: "top-center" });
      return;
    }

    try {
      setSavingSettings(true);
      await adminFetch("/admin/settings/website", {
        method: "PUT",
        body: JSON.stringify({
          siteName,
          siteDescription,
          logoUrl: logoUrl || null,
          maintenanceMode: settings.maintenanceMode,
          maintenanceMessage: maintenanceMessage || null,
          seo,
          landingContent,
        }),
      });
      sileo.success({ title: "Website setting tersimpan", position: "top-center" });
      await load();
    } catch (e: any) {
      sileo.error({
        title: "Gagal menyimpan setting website",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setSavingSettings(false);
    }
  }, [load, settings]);

  /* ─── Banner modal handlers ─── */
  const openCreateBannerModal = useCallback(() => {
    setBannerModalMode("create");
    setBannerForm({
      imageUrl: "",
      title: "",
      subtitle: "",
      linkUrl: "",
      sortOrder: banners.length,
      isActive: true,
      startAt: "",
      endAt: "",
    });
    setBannerModalOpen(true);
  }, [banners.length]);

  const openEditBannerModal = useCallback((banner: WebsiteBanner) => {
    setBannerModalMode("edit");
    setBannerForm({
      id: banner.id,
      imageUrl: banner.imageUrl,
      title: String(banner.title ?? ""),
      subtitle: String(banner.subtitle ?? ""),
      linkUrl: String(banner.linkUrl ?? ""),
      sortOrder: banner.sortOrder,
      isActive: banner.isActive,
      startAt: toDateTimeLocalValue(banner.startAt),
      endAt: toDateTimeLocalValue(banner.endAt),
    });
    setBannerModalOpen(true);
  }, []);

  const closeBannerModal = useCallback(() => {
    if (bannerModalSaving || bannerModalUploading) return;
    setBannerModalOpen(false);
  }, [bannerModalSaving, bannerModalUploading]);

  const submitBannerModal = useCallback(async () => {
    const imageUrl = bannerForm.imageUrl.trim();
    if (!imageUrl) {
      sileo.warning({ title: "Gambar banner wajib diisi", position: "top-center" });
      return;
    }

    try {
      setBannerModalSaving(true);

      const body = {
        imageUrl,
        title: bannerForm.title.trim() || null,
        subtitle: bannerForm.subtitle.trim() || null,
        linkUrl: bannerForm.linkUrl.trim() || null,
        sortOrder: Number.isFinite(bannerForm.sortOrder) ? bannerForm.sortOrder : 0,
        isActive: bannerForm.isActive,
        startAt: bannerForm.startAt.trim() || null,
        endAt: bannerForm.endAt.trim() || null,
      };

      if (bannerModalMode === "create") {
        await adminFetch("/admin/settings/website/banners", {
          method: "POST",
          body: JSON.stringify(body),
        });
        sileo.success({ title: "Banner berhasil ditambahkan", position: "top-center" });
      } else {
        if (!bannerForm.id) throw new Error("Missing banner id");
        await adminFetch(`/admin/settings/website/banners/${bannerForm.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        sileo.success({ title: "Banner berhasil diperbarui", position: "top-center" });
      }

      setBannerModalOpen(false);
      await load();
    } catch (e: any) {
      sileo.error({
        title: bannerModalMode === "create" ? "Gagal menambahkan banner" : "Gagal update banner",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setBannerModalSaving(false);
    }
  }, [bannerForm, bannerModalMode, load]);

  const openDeleteBannerModal = useCallback((banner: WebsiteBanner) => {
    setDeleteBannerModal({ open: true, banner });
  }, []);

  const closeDeleteBannerModal = useCallback(() => {
    if (deletingBannerId) return;
    setDeleteBannerModal({ open: false, banner: null });
  }, [deletingBannerId]);

  const confirmDeleteBanner = useCallback(async () => {
    const banner = deleteBannerModal.banner;
    if (!banner) return;
    try {
      setDeletingBannerId(banner.id);
      await adminFetch(`/admin/settings/website/banners/${banner.id}`, { method: "DELETE" });
      sileo.success({ title: "Banner dihapus", position: "top-center" });
      setDeleteBannerModal({ open: false, banner: null });
      setBanners((prev) => prev.filter((x) => x.id !== banner.id));
    } catch (e: any) {
      sileo.error({
        title: "Gagal menghapus banner",
        description: e?.message || "Unknown error",
        position: "top-center",
      });
    } finally {
      setDeletingBannerId(null);
    }
  }, [deleteBannerModal.banner]);

  const handleBannerModalUpload = useCallback(
    async (file: File) => {
      try {
        setBannerModalUploading(true);
        const url = await uploadImage(file);
        if (!url) throw new Error("URL gambar tidak valid");
        setBannerForm((prev) => ({ ...prev, imageUrl: url }));
        sileo.success({ title: "Gambar berhasil diupload", position: "top-center" });
      } catch (err: any) {
        sileo.error({
          title: "Gagal upload gambar",
          description: err?.message || "Unknown error",
          position: "top-center",
        });
      } finally {
        setBannerModalUploading(false);
      }
    },
    [uploadImage]
  );

  const handleLogoUpload = useCallback(
    async (file: File) => {
      try {
        setLogoUploading(true);
        const url = await uploadImage(file);
        if (!url) throw new Error("URL gambar tidak valid");
        setSettings((prev) => ({ ...prev, logoUrl: url }));
        sileo.success({ title: "Logo berhasil diupload", position: "top-center" });
      } catch (err: any) {
        sileo.error({
          title: "Gagal upload logo",
          description: err?.message || "Unknown error",
          position: "top-center",
        });
      } finally {
        setLogoUploading(false);
      }
    },
    [uploadImage]
  );

  const handleSeoImageUpload = useCallback(
    async (file: File, key: "faviconUrl" | "ogImageUrl") => {
      try {
        setSavingSettings(true);
        const url = await uploadImage(file);
        if (!url) throw new Error("URL gambar tidak valid");
        setSettings((prev) => ({
          ...prev,
          seo: {
            ...prev.seo,
            [key]: url,
          },
        }));
        sileo.success({
          title: key === "faviconUrl" ? "Favicon berhasil diupload" : "OG image berhasil diupload",
          position: "top-center",
        });
      } catch (err: any) {
        sileo.error({
          title: "Gagal upload gambar SEO",
          description: err?.message || "Unknown error",
          position: "top-center",
        });
      } finally {
        setSavingSettings(false);
      }
    },
    [uploadImage],
  );

  const moveBannerOrder = useCallback(
    async (banner: WebsiteBanner, direction: "up" | "down") => {
      const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((x) => x.id === banner.id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;

      const target = sorted[swapIdx];
      try {
        await Promise.all([
          adminFetch(`/admin/settings/website/banners/${banner.id}`, {
            method: "PUT",
            body: JSON.stringify({
              imageUrl: banner.imageUrl,
              title: banner.title ?? null,
              subtitle: banner.subtitle ?? null,
              linkUrl: banner.linkUrl ?? null,
              sortOrder: target.sortOrder,
              isActive: banner.isActive,
              startAt: banner.startAt ? toDateTimeLocalValue(banner.startAt) : null,
              endAt: banner.endAt ? toDateTimeLocalValue(banner.endAt) : null,
            }),
          }),
          adminFetch(`/admin/settings/website/banners/${target.id}`, {
            method: "PUT",
            body: JSON.stringify({
              imageUrl: target.imageUrl,
              title: target.title ?? null,
              subtitle: target.subtitle ?? null,
              linkUrl: target.linkUrl ?? null,
              sortOrder: banner.sortOrder,
              isActive: target.isActive,
              startAt: target.startAt ? toDateTimeLocalValue(target.startAt) : null,
              endAt: target.endAt ? toDateTimeLocalValue(target.endAt) : null,
            }),
          }),
        ]);
        await load();
      } catch (e: any) {
        sileo.error({
          title: "Gagal ubah urutan banner",
          description: e?.message || "Unknown error",
          position: "top-center",
        });
      }
    },
    [banners, load],
  );

  const bannerCountLabel = useMemo(() => `${banners.length} banner`, [banners.length]);
  const activeBannerCount = useMemo(() => banners.filter((b) => b.isActive).length, [banners]);

  return (
    <>
      {/* ════════ BANNER CREATE/EDIT MODAL ════════ */}
      <Modal
        open={bannerModalOpen}
        title={bannerModalMode === "create" ? "Tambah Banner Baru" : "Edit Banner"}
        onClose={closeBannerModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeBannerModal} disabled={bannerModalSaving}>
              Batal
            </Button>
            <Button isLoading={bannerModalSaving} onClick={submitBannerModal}>
              {bannerModalMode === "create" ? "Tambah Banner" : "Simpan Perubahan"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <DropZone
            label="Gambar Banner"
            value={bannerForm.imageUrl}
            uploading={bannerModalUploading}
            onFile={handleBannerModalUpload}
            onUrlChange={(url) => setBannerForm((prev) => ({ ...prev, imageUrl: url }))}
            height="h-48"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Judul"
              placeholder="Opsional"
              value={bannerForm.title}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
              leftIcon="iconify:solar:text-bold-duotone"
            />
            <Input
              label="Subjudul"
              placeholder="Opsional"
              value={bannerForm.subtitle}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, subtitle: e.target.value }))}
              leftIcon="iconify:solar:text-italic-bold-duotone"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Link URL"
              placeholder="https://..."
              value={bannerForm.linkUrl}
              onChange={(e) => setBannerForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
              leftIcon="iconify:solar:link-bold-duotone"
            />
            <Input
              label="Urutan"
              type="number"
              min={0}
              value={String(bannerForm.sortOrder)}
              onChange={(e) =>
                setBannerForm((prev) => ({
                  ...prev,
                  sortOrder: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0,
                }))
              }
              leftIcon="iconify:solar:sort-vertical-bold-duotone"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Mulai Tayang
              </label>
              <input
                type="datetime-local"
                value={bannerForm.startAt}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, startAt: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 text-[13px] text-slate-900 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Berakhir Tayang
              </label>
              <input
                type="datetime-local"
                value={bannerForm.endAt}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, endAt: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 text-[13px] text-slate-900 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-3.5">
            <Switch
              checked={bannerForm.isActive}
              onCheckedChange={(next) => setBannerForm((prev) => ({ ...prev, isActive: next }))}
              label={bannerForm.isActive ? "Banner aktif — ditampilkan di dashboard" : "Banner nonaktif — disembunyikan"}
            />
          </div>
        </div>
      </Modal>

      {/* ════════ DELETE BANNER MODAL ════════ */}
      <Modal
        open={deleteBannerModal.open}
        title="Hapus Banner"
        onClose={closeDeleteBannerModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeDeleteBannerModal} disabled={!!deletingBannerId}>
              Batal
            </Button>
            <Button variant="danger" isLoading={!!deletingBannerId} onClick={confirmDeleteBanner}>
              Hapus Permanen
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200/60 shadow-inner">
            <Icon name="warning" className="h-8 w-8 text-rose-500" />
          </div>

          {deleteBannerModal.banner && (
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-600">Banner berikut akan dihapus permanen:</p>
              <div className="mx-auto max-w-[280px] overflow-hidden rounded-xl border border-slate-200/60 shadow-sm">
                <img
                  src={resolveMediaUrl(deleteBannerModal.banner.imageUrl)}
                  alt="Banner preview"
                  className="h-24 w-full object-cover"
                />
                {deleteBannerModal.banner.title && (
                  <div className="px-3 py-2 text-xs font-bold text-slate-700">
                    {deleteBannerModal.banner.title}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Icon name="warning" className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Gambar banner akan dihapus dari slider.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <div className="space-y-6">
        {/* ════════ STATS ════════ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Status",
              value: loading
                ? null
                : settings.maintenanceMode
                  ? "Maintenance"
                  : "Online",
              icon: "solar:server-bold-duotone",
              color: settings.maintenanceMode ? "from-amber-500 to-orange-600" : "from-emerald-500 to-green-600",
              bgLight: settings.maintenanceMode ? "bg-amber-50" : "bg-emerald-50",
              textColor: settings.maintenanceMode ? "text-amber-600" : "text-emerald-600",
            },
            {
              label: "Total Banner",
              value: loading ? null : String(banners.length),
              icon: "solar:gallery-bold-duotone",
              color: "from-blue-500 to-indigo-600",
              bgLight: "bg-blue-50",
              textColor: "text-blue-600",
            },
            {
              label: "Banner Aktif",
              value: loading ? null : String(activeBannerCount),
              icon: "solar:check-circle-bold-duotone",
              color: "from-violet-500 to-purple-600",
              bgLight: "bg-violet-50",
              textColor: "text-violet-600",
            },
            {
              label: "Terakhir Update",
              value: loading ? null : formatTime(settings.updatedAt),
              icon: "solar:clock-circle-bold-duotone",
              color: "from-slate-500 to-slate-600",
              bgLight: "bg-slate-100",
              textColor: "text-slate-500",
              isSmall: true,
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="!p-0 overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="relative p-4">
                <div
                  className={cx(
                    "absolute top-0 right-0 h-20 w-20 opacity-[0.04] rounded-bl-[40px] bg-gradient-to-br",
                    stat.color
                  )}
                />
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      {stat.label}
                    </p>
                    <p className={cx("font-bold text-slate-800", (stat as any).isSmall ? "text-xs" : "text-lg")}>
                      {loading ? (
                        <span className="inline-block h-6 w-20 animate-pulse rounded-lg bg-slate-100" />
                      ) : (
                        stat.value
                      )}
                    </p>
                  </div>
                  <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stat.bgLight)}>
                    <Icon name={`iconify:${stat.icon}`} className={cx("h-5 w-5", stat.textColor)} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ════════ BRANDING & MAINTENANCE ════════ */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                  <Icon name="iconify:solar:settings-bold-duotone" className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Branding & Maintenance</h2>
                  <p className="text-[11px] text-slate-400">
                    Atur nama, logo, deskripsi, dan mode maintenance
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
              
                <Button
                  size="sm"
                  isLoading={savingSettings}
                  onClick={saveWebsiteSettings}
                  leftIcon="check"
                  className="!h-8 !text-[11px] !font-bold"
                >
                  Simpan
                </Button>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="h-3 w-20 rounded-md bg-slate-200/70" />
                    <div className="h-11 w-full rounded-xl bg-slate-100/80" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 rounded-md bg-slate-200/70" />
                    <div className="h-32 w-full rounded-xl bg-slate-100/80" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-28 rounded-md bg-slate-200/70" />
                  <div className="h-20 w-full rounded-xl bg-slate-100/80" />
                </div>
                <div className="h-16 w-full rounded-xl bg-slate-100/80" />
              </div>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  {/* Left: Name + Description */}
                  <div className="space-y-4">
                    <Input
                      label="Nama Website"
                      placeholder="Contoh: Fastbit OTP"
                      value={settings.siteName}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, siteName: e.target.value }))
                      }
                      leftIcon="iconify:solar:text-bold-duotone"
                    />

                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Deskripsi Website
                      </label>
                      <textarea
                        rows={4}
                        value={settings.siteDescription}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, siteDescription: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm resize-none"
                        placeholder="Deskripsi singkat website"
                      />
                    </div>
                  </div>

                  {/* Right: Logo */}
                  <div>
                    <DropZone
                      label="Logo Website"
                      value={String(settings.logoUrl ?? "")}
                      uploading={logoUploading}
                      onFile={handleLogoUpload}
                      onUrlChange={(url) => setSettings((prev) => ({ ...prev, logoUrl: url }))}
                      height="h-36"
                    />
                  </div>
                </div>

                {/* Maintenance */}
                <div
                  className={cx(
                    "rounded-xl border p-4 transition-all duration-300",
                    settings.maintenanceMode
                      ? "border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-orange-50/50"
                      : "border-slate-200/60 bg-slate-50/80"
                  )}
                >
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(next) =>
                      setSettings((prev) => ({ ...prev, maintenanceMode: next }))
                    }
                    label={
                      settings.maintenanceMode
                        ? "⚠️ Maintenance aktif — website dalam mode maintenance"
                        : "✅ Website online — semua layanan berjalan normal"
                    }
                  />
                  {settings.maintenanceMode && (
                    <div className="mt-4">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-amber-600/70">
                        Pesan Maintenance
                      </label>
                      <textarea
                        rows={3}
                        value={String(settings.maintenanceMessage ?? "")}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            maintenanceMessage: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-amber-200/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-amber-400 outline-none transition-all duration-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 resize-none"
                        placeholder="Contoh: Maintenance sampai 23:00 WIB."
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ════════ SEO & META ════════ */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                  <Icon name="iconify:solar:code-square-bold-duotone" className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">SEO & Meta</h2>
                  <p className="text-[11px] text-slate-400">
                    Atur title, description, favicon, OG image, dan robots.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                isLoading={savingSettings}
                onClick={saveWebsiteSettings}
                leftIcon="check"
                className="!h-8 !text-[11px] !font-bold"
              >
                Simpan SEO
              </Button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <Input
                  label="Meta Title"
                  placeholder="Contoh: OTP Murah - Nomor Virtual OTP"
                  value={settings.seo.metaTitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      seo: { ...prev.seo, metaTitle: e.target.value },
                    }))
                  }
                  leftIcon="iconify:solar:text-bold-duotone"
                />

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Meta Description
                  </label>
                  <textarea
                    rows={4}
                    value={settings.seo.metaDescription}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, metaDescription: e.target.value },
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm resize-none"
                    placeholder="Deskripsi SEO untuk mesin pencari."
                  />
                </div>

                <DropdownSelect
                  value={settings.seo.twitterCard}
                  onChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      seo: {
                        ...prev.seo,
                        twitterCard: value === "summary" ? "summary" : "summary_large_image",
                      },
                    }))
                  }
                  options={[
                    {
                      value: "summary_large_image",
                      label: "summary_large_image",
                      description: "Gambar besar saat link dibagikan",
                    },
                    {
                      value: "summary",
                      label: "summary",
                      description: "Kartu ringkas dengan gambar kecil",
                    },
                  ]}
                  placeholder="Pilih Twitter card"
                  leftIcon="iconify:solar:widget-5-bold-duotone"
                />

                <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-3.5">
                  <Switch
                    checked={settings.seo.robotsNoIndex}
                    onCheckedChange={(next) =>
                      setSettings((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, robotsNoIndex: next },
                      }))
                    }
                    label={
                      settings.seo.robotsNoIndex
                        ? "No Index aktif - halaman tidak diindeks mesin pencari"
                        : "Index aktif - halaman boleh diindeks mesin pencari"
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <DropZone
                  label="Favicon"
                  value={String(settings.seo.faviconUrl ?? "")}
                  uploading={savingSettings}
                  onFile={(file) => handleSeoImageUpload(file, "faviconUrl")}
                  onUrlChange={(url) =>
                    setSettings((prev) => ({
                      ...prev,
                      seo: { ...prev.seo, faviconUrl: url },
                    }))
                  }
                  height="h-28"
                />
                <DropZone
                  label="Open Graph Image"
                  value={String(settings.seo.ogImageUrl ?? "")}
                  uploading={savingSettings}
                  onFile={(file) => handleSeoImageUpload(file, "ogImageUrl")}
                  onUrlChange={(url) =>
                    setSettings((prev) => ({
                      ...prev,
                      seo: { ...prev.seo, ogImageUrl: url },
                    }))
                  }
                  height="h-32"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ════════ LANDING CMS ════════ */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
                  <Icon name="iconify:solar:document-text-bold-duotone" className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Landing CMS</h2>
                  <p className="text-[11px] text-slate-400">
                    Edit teks hero, section title, dan CTA landing page.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                isLoading={savingSettings}
                onClick={saveWebsiteSettings}
                leftIcon="check"
                className="!h-8 !text-[11px] !font-bold"
              >
                Simpan Konten
              </Button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Hero Badge"
                value={settings.landingContent.heroBadge}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, heroBadge: e.target.value },
                  }))
                }
              />
              <Input
                label="Hero Judul"
                value={settings.landingContent.heroTitle}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, heroTitle: e.target.value },
                  }))
                }
              />
              <Input
                label="Hero Highlight"
                value={settings.landingContent.heroHighlight}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, heroHighlight: e.target.value },
                  }))
                }
              />
              <Input
                label="Hero Tombol Utama"
                value={settings.landingContent.heroPrimaryCta}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, heroPrimaryCta: e.target.value },
                  }))
                }
              />
              <Input
                label="Hero Tombol Sekunder"
                value={settings.landingContent.heroSecondaryCta}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, heroSecondaryCta: e.target.value },
                  }))
                }
              />
              <Input
                label="Product Eyebrow"
                value={settings.landingContent.productEyebrow}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, productEyebrow: e.target.value },
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Hero Description
              </label>
              <textarea
                rows={3}
                value={settings.landingContent.heroDescription}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, heroDescription: e.target.value },
                  }))
                }
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm resize-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Product Title"
                value={settings.landingContent.productTitle}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, productTitle: e.target.value },
                  }))
                }
              />
              <Input
                label="How Eyebrow"
                value={settings.landingContent.howEyebrow}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, howEyebrow: e.target.value },
                  }))
                }
              />
              <Input
                label="How Title"
                value={settings.landingContent.howTitle}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, howTitle: e.target.value },
                  }))
                }
              />
              <Input
                label="FAQ Eyebrow"
                value={settings.landingContent.faqEyebrow}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, faqEyebrow: e.target.value },
                  }))
                }
              />
              <Input
                label="FAQ Title"
                value={settings.landingContent.faqTitle}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, faqTitle: e.target.value },
                  }))
                }
              />
              <Input
                label="CTA Badge"
                value={settings.landingContent.ctaBadge}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, ctaBadge: e.target.value },
                  }))
                }
              />
              <Input
                label="CTA Title"
                value={settings.landingContent.ctaTitle}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, ctaTitle: e.target.value },
                  }))
                }
              />
              <Input
                label="CTA Tombol Utama"
                value={settings.landingContent.ctaPrimaryCta}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, ctaPrimaryCta: e.target.value },
                  }))
                }
              />
              <Input
                label="CTA Tombol Sekunder"
                value={settings.landingContent.ctaSecondaryCta}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    landingContent: { ...prev.landingContent, ctaSecondaryCta: e.target.value },
                  }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Product Subtitle
                </label>
                <textarea
                  rows={3}
                  value={settings.landingContent.productSubtitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      landingContent: { ...prev.landingContent, productSubtitle: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm resize-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  How Subtitle
                </label>
                <textarea
                  rows={3}
                  value={settings.landingContent.howSubtitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      landingContent: { ...prev.landingContent, howSubtitle: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm resize-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  FAQ Subtitle
                </label>
                <textarea
                  rows={3}
                  value={settings.landingContent.faqSubtitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      landingContent: { ...prev.landingContent, faqSubtitle: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm resize-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  CTA Subtitle
                </label>
                <textarea
                  rows={3}
                  value={settings.landingContent.ctaSubtitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      landingContent: { ...prev.landingContent, ctaSubtitle: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:shadow-sm resize-none"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ════════ BANNER SLIDER ════════ */}
        <Card className="!p-0 overflow-hidden border-0 shadow-sm">
          <div className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Icon name="iconify:solar:gallery-bold-duotone" className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Banner Slider</h2>
                  <p className="text-[11px] text-slate-400">
                    {loading
                      ? "Memuat..."
                      : `${bannerCountLabel} • ${activeBannerCount} aktif`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={openCreateBannerModal}
                leftIcon="iconify:solar:add-circle-bold-duotone"
                className="!h-8 !text-[11px] !font-bold"
              >
                Tambah Banner
              </Button>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden"
                  >
                    <div className="h-36 w-full bg-slate-200/70" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3.5 w-2/3 rounded-md bg-slate-200/70" />
                      <div className="h-3 w-1/2 rounded-md bg-slate-200/70" />
                      <div className="flex justify-between mt-3">
                        <div className="h-6 w-16 rounded-full bg-slate-200/70" />
                        <div className="flex gap-1.5">
                          <div className="h-8 w-8 rounded-lg bg-slate-200/70" />
                          <div className="h-8 w-8 rounded-lg bg-slate-200/70" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : banners.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-inner">
                  <Icon name="iconify:solar:gallery-bold-duotone" className="h-7 w-7 text-slate-300" />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">Belum ada banner</p>
                <p className="mt-1 text-xs text-slate-400 max-w-[200px] leading-relaxed">
                  Tambahkan banner untuk ditampilkan di slider dashboard user
                </p>
                <Button
                  size="sm"
                  onClick={openCreateBannerModal}
                  leftIcon="iconify:solar:add-circle-bold-duotone"
                  className="mt-4 !h-8 !text-[11px] !font-bold"
                >
                  Tambah Banner Pertama
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {banners.map((item, idx) => (
                  <div
                    key={item.id}
                    className={cx(
                      "group rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50",
                      item.isActive
                        ? "border-slate-200/60 bg-white"
                        : "border-slate-200/40 bg-slate-50/50 opacity-70"
                    )}
                  >
                    {/* Image */}
                    <div className="relative h-40 w-full overflow-hidden">
                      <img
                        src={resolveMediaUrl(item.imageUrl)}
                        alt={item.title || "Banner"}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                      {/* Status badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <span
                          className={cx(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 backdrop-blur-sm",
                            item.isActive
                              ? "bg-emerald-50/90 text-emerald-700 ring-emerald-200/60"
                              : "bg-slate-50/90 text-slate-500 ring-slate-200/60"
                          )}
                        >
                          <span
                            className={cx(
                              "h-1.5 w-1.5 rounded-full",
                              item.isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                            )}
                          />
                          {item.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>

                      {/* Sort order */}
                      <div className="absolute top-2.5 right-2.5">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-slate-900/60 backdrop-blur-sm text-[10px] font-bold text-white">
                          #{item.sortOrder}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3.5">
                      <h3 className="text-xs font-bold text-slate-800 truncate">
                        {item.title || (
                          <span className="text-slate-400 italic">Tanpa judul</span>
                        )}
                      </h3>
                      {item.subtitle && (
                        <p className="mt-0.5 text-[10px] text-slate-500 truncate">{item.subtitle}</p>
                      )}
                      {item.linkUrl && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 truncate">
                          <Icon name="iconify:solar:link-bold-duotone" className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.linkUrl}</span>
                        </div>
                      )}
                      {(item.startAt || item.endAt) && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 truncate">
                          <Icon
                            name="iconify:solar:calendar-bold-duotone"
                            className="h-3 w-3 shrink-0"
                          />
                          <span className="truncate">
                            {item.startAt ? formatTime(item.startAt) : "Sekarang"} -{" "}
                            {item.endAt ? formatTime(item.endAt) : "Tanpa batas"}
                          </span>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[9px] text-slate-400">
                          {formatTime(item.updatedAt)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => moveBannerOrder(item, "up")}
                            className="!h-7 !w-7 !p-0"
                            title="Naikkan urutan"
                            disabled={idx === 0}
                          >
                            <Icon
                              name="iconify:solar:alt-arrow-up-bold-duotone"
                              className="h-3 w-3"
                            />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => moveBannerOrder(item, "down")}
                            className="!h-7 !w-7 !p-0"
                            title="Turunkan urutan"
                            disabled={idx === banners.length - 1}
                          >
                            <Icon
                              name="iconify:solar:alt-arrow-down-bold-duotone"
                              className="h-3 w-3"
                            />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditBannerModal(item)}
                            className="!h-7 !w-7 !p-0"
                            title="Edit banner"
                          >
                            <Icon name="iconify:solar:pen-bold-duotone" className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openDeleteBannerModal(item)}
                            className="!h-7 !w-7 !p-0"
                            title="Hapus banner"
                          >
                            <Icon
                              name="iconify:solar:trash-bin-trash-bold-duotone"
                              className="h-3 w-3"
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
