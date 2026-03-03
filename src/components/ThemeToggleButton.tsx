import { useTheme } from "../theme/ThemeProvider";
import { Icon } from "./ui";

function cx(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

type ThemeToggleButtonProps = {
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export default function ThemeToggleButton({
  className,
  showLabel = false,
  size = "sm",
}: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 text-slate-700  backdrop-blur transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-900",
        isSmall ? "h-9 px-2.5" : "h-10 px-3",
        className
      )}
    >
      <span
        className={cx(
          "inline-flex items-center justify-center rounded-lg  text-slate-700 dark:text-amber-300",
          isSmall ? "h-6 w-6" : "h-7 w-7"
        )}
      >
        <Icon
          name={isDark ? "iconify:solar:sun-bold-duotone" : "iconify:solar:moon-stars-bold-duotone"}
          className={isSmall ? "h-3.5 w-3.5" : "h-5 w-5"}
        />
      </span>

      {showLabel && (
        <span className="text-xs font-semibold leading-none">{isDark ? "Light" : "Dark"}</span>
      )}
    </button>
  );
}
