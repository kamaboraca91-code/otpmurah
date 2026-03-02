export function getCookie(name: string) {
  const v = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  if (!v) return null;
  return decodeURIComponent(v.split("=").slice(1).join("="));
}