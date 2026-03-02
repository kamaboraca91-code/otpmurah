import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useAdminAuth } from "../../auth/AdminAuthProvider";
import {
  getDefaultWebsiteBranding,
  getWebsiteBranding,
  type WebsiteBranding,
} from "../../lib/websiteBranding";

function upsertMetaByName(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let tag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function upsertFavicon(iconHref: string) {
  let icon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!icon) {
    icon = document.createElement("link");
    icon.setAttribute("rel", "icon");
    document.head.appendChild(icon);
  }
  icon.setAttribute("type", "image/png");
  icon.setAttribute("href", iconHref);

  let appleTouch = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (!appleTouch) {
    appleTouch = document.createElement("link");
    appleTouch.setAttribute("rel", "apple-touch-icon");
    document.head.appendChild(appleTouch);
  }
  appleTouch.setAttribute("href", iconHref);
}

function getPageTitle(pathname: string, loggedInUser: boolean) {
  if (pathname === "/" && loggedInUser) return "Dashboard";

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin" || pathname === "/admin/") return "Admin Dashboard";
    if (pathname === "/admin/login") return "Admin Login";
    if (pathname.startsWith("/admin/orders")) return "Admin Orders";
    if (pathname.startsWith("/admin/users")) return "Admin Users";
    if (pathname.startsWith("/admin/news")) return "Admin News";
    if (pathname.startsWith("/admin/website")) return "Website Settings";
    if (pathname.startsWith("/admin/services")) return "Service Settings";
    if (pathname.startsWith("/admin/pricing")) return "Pricing Settings";
    return "Admin Panel";
  }

  if (pathname === "/") return "Beranda";
  if (pathname === "/login") return "Login";
  if (pathname === "/register") return "Register";
  if (pathname === "/forgot-password") return "Lupa Password";
  if (pathname === "/reset-password") return "Reset Password";
  if (pathname === "/numbers") return "Nomor Saya";
  if (pathname === "/orders") return "Beli OTP";
  if (pathname === "/deposit") return "Isi Saldo";
  if (pathname === "/mutasi-saldo") return "Mutasi Saldo";
  if (pathname === "/history") return "Riwayat";
  if (pathname === "/settings") return "Pengaturan Akun";
  if (pathname === "/not-found") return "Halaman Tidak Ditemukan";

  return "";
}

function buildTitle(pathname: string, branding: WebsiteBranding, loggedInUser: boolean) {
  const pageTitle = getPageTitle(pathname, loggedInUser);
  if (!pageTitle) return branding.siteName;
  if (pathname === "/" && !loggedInUser) {
    return `${branding.siteName} | ${branding.siteDescription}`;
  }
  return `${pageTitle} | ${branding.siteName}`;
}

export function SeoManager() {
  const location = useLocation();
  const { user } = useAuth();
  const { admin } = useAdminAuth();
  const [branding, setBranding] = useState<WebsiteBranding>(() => getDefaultWebsiteBranding());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const latest = await getWebsiteBranding();
      if (!mounted) return;
      setBranding(latest);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isPublicLanding = location.pathname === "/" && !user && !admin;
  const robots = isPublicLanding ? "index,follow" : "noindex,nofollow";
  const currentUrl = useMemo(
    () => `${window.location.origin}${location.pathname}`,
    [location.pathname]
  );

  useEffect(() => {
    const title = buildTitle(location.pathname, branding, Boolean(user));
    const description = branding.siteDescription;
    const logoUrl = branding.logoUrl || `${window.location.origin}/vite.svg`;

    document.title = title;

    upsertMetaByName("description", description);
    upsertMetaByName("robots", robots);
    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", title);
    upsertMetaByName("twitter:description", description);
    upsertMetaByName("twitter:image", logoUrl);
    upsertMetaByName("application-name", branding.siteName);

    upsertMetaByProperty("og:type", "website");
    upsertMetaByProperty("og:title", title);
    upsertMetaByProperty("og:description", description);
    upsertMetaByProperty("og:image", logoUrl);
    upsertMetaByProperty("og:url", currentUrl);
    upsertMetaByProperty("og:site_name", branding.siteName);

    upsertCanonical(currentUrl);
    upsertFavicon(logoUrl);
  }, [branding, currentUrl, location.pathname, robots, user]);

  return null;
}
