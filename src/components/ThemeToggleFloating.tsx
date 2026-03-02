import { Icon } from "./ui";
import { useTheme } from "../theme/ThemeProvider";

export default function ThemeToggleFloating() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed bottom-5 right-5 z-[120] inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white active:translate-y-0 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900"
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-amber-300">
        <Icon
          name={isDark ? "iconify:solar:sun-bold-duotone" : "iconify:solar:moon-stars-bold-duotone"}
          className="h-4 w-4"
        />
      </span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

