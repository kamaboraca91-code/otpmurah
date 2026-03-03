import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Icon as IconifyIcon } from "@iconify/react";
import { createPortal } from "react-dom";
/**
 * Minimal className merge helper (tanpa deps)
 */
function cx(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Simple icon set (inline SVG) biar gak perlu lucide/heroicons.
 * Kamu bisa tambah icon lain kapan saja.
 */
type IconName =
  | "arrowRight"
  | "check"
  | "sparkles"
  | "shield"
  | "bolt"
  | "search"
  | "eye"
  | "eyeOff"
  | "info"
  | "warning"
  | "email"
  | "x"
  | `iconify:${string}`; // ✅ tambahan

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = "inline-block shrink-0";

  // 🔥 ICONIFY SUPPORT
  if (typeof name === "string" && name.startsWith("iconify:")) {
    const iconName = name.replace("iconify:", "");
    return (
      <IconifyIcon
        icon={iconName}
        className={cx(common, className)}
      />
    );
  }

  switch (name) {
    case "arrowRight":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 12h12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "check":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 6L9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "sparkles":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2l1.3 4.2L18 8l-4.7 1.8L12 14l-1.3-4.2L6 8l4.7-1.8L12 2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M4 14l.7 2.2L7 17l-2.3.8L4 20l-.7-2.2L1 17l2.3-.8L4 14z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M20 14l.7 2.2L23 17l-2.3.8L20 20l-.7-2.2L17 17l2.3-.8L20 14z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M9 12l2 2 4-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "bolt":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "search":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M21 21l-4.3-4.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "eye":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case "eyeOff":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 3l18 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10.6 10.6a3 3 0 0 0 4.2 4.2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M9.5 5.3A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 4.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6.1 6.1C3.2 8.3 2 12 2 12s3.5 7 10 7c1 0 2-.2 3-.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "info":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 10v7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 7h.01"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      );
    case "warning":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2l10 18H2L12 2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M12 9v5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 17h.01"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      );
    case "x":
      return (
        <svg
          className={cx(common, className)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

/**
 * BUTTON
 */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    leftIcon?: IconName;
    rightIcon?: IconName;
    isLoading?: boolean;
  }
>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    leftIcon,
    rightIcon,
    isLoading,
    disabled,
    type = "button",
    children,
    ...props
  },
  ref
) {
  const base =
    "inline-flex items-center justify-center gap-1 cursor-pointer rounded-xl font-semibold " +
    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 " +
    "disabled:opacity-60 disabled:pointer-events-none";

  const sizes: Record<ButtonSize, string> = {
    sm: "h-10 px-3 text-[13px] sm:h-9 sm:text-sm",
    md: "h-11 px-4 text-[13px] sm:h-10 sm:text-sm",
    lg: "h-12 px-5 text-[14px] sm:h-11 sm:text-base",
  };

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-teal-600 text-white border border-emerald-600 " +
      "hover:bg-emerald-700 hover:border-emerald-700 active:bg-teal-600",
    secondary:
      "bg-white text-slate-900 border border-slate-200 " +
      "hover:bg-slate-50 active:bg-slate-100 " +
      "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 dark:active:bg-slate-800/90",
    ghost:
      "bg-transparent text-slate-900 border border-transparent " +
      "hover:bg-slate-100 active:bg-slate-200 " +
      "dark:text-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-700",
    danger:
      "bg-rose-600 text-white border border-rose-600 " +
      "hover:bg-rose-700 hover:border-rose-700",
  };

  const iconCls = "w-4 h-4";
  const loadingSpinnerCls =
    variant === "primary" || variant === "danger"
      ? "border-white/60 border-t-white"
      : "border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-100";

  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, sizes[size], variants[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span
          className={cx("h-4 w-4 animate-spin rounded-full border-2", loadingSpinnerCls)}
          aria-hidden="true"
        />
      ) : leftIcon ? (
        <Icon name={leftIcon} className={iconCls} />
      ) : null}
      <span>{children}</span>
      {rightIcon && !isLoading ? <Icon name={rightIcon} className={iconCls} /> : null}
    </button>
  );
});

/**
 * INPUT (TextField)
 */
export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    hint?: string;
    error?: string;
    leftIcon?: IconName;
    rightSlot?: React.ReactNode;
  }
>(function Input({ className, label, hint, error, leftIcon, rightSlot, ...props }, ref) {
  const base =
    "w-full h-11 rounded-xl bg-white border px-4 text-[13px] text-slate-900 sm:h-10 sm:text-sm " +
    "placeholder:text-slate-400 outline-none transition " +
    "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 " +
    "dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

  const border = error
    ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/70 dark:focus:border-rose-400 dark:focus:ring-rose-500/30"
    : "border-slate-200 dark:border-slate-700";

  return (
    <label className="block">
      {label ? <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</span> : null}
      <div className={cx("relative", leftIcon ? "pl-0" : "")}>
        {leftIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
            <Icon name={leftIcon} className="h-5 w-5" />
          </span>
        ) : null}

        <input
          ref={ref}
          className={cx(
            base,
            border,
            leftIcon ? "pl-10" : "",
            rightSlot ? "pr-12" : "",
            className
          )}
          {...props}
        />

        {rightSlot ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</span>
        ) : null}
      </div>

      {error ? (
        <span className="mt-2 block text-xs font-medium text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
});

/**
 * PasswordInput (dengan toggle eye)
 */
export function PasswordInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    label?: string;
    hint?: string;
    error?: string;
    leftIcon?: IconName; // ✅ tambah
  }
) {
  const [show, setShow] = useState(false);

  const { leftIcon, ...rest } = props;

  return (
    <Input
      {...rest}
      leftIcon={leftIcon ?? ("mdi:lock-outline" as IconName)} // ✅ default iconify lock (opsional)
      type={show ? "text" : "password"}
      rightSlot={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg cursor-pointer bg-white text-slate-600 sm:h-9 sm:w-9 dark:bg-slate-900 dark:text-slate-300"
          aria-label={show ? "Hide password" : "Show password"}
        >
          <Icon name={show ? "eyeOff" : "eye"} className="h-5 w-5" />
        </button>
      }
    />
  );
}

type DropdownSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih opsi",
  leftIcon,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownSelectOption[];
  placeholder?: string;
  leftIcon?: IconName;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current || rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      {leftIcon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-slate-500">
          <Icon name={leftIcon} className="h-4 w-4" />
        </span>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cx(
          "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white pr-3 text-left text-[13px] text-slate-900 outline-none transition sm:h-10 sm:text-xs",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
          "focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:border-slate-300 active:scale-[0.998] cursor-pointer dark:hover:border-slate-600",
          leftIcon ? "pl-9" : "pl-3"
        )}
      >
        <span className={cx("truncate", !selected && "text-slate-400 dark:text-slate-500")}>
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="iconify:grommet-icons:down"
          className={cx("h-4 w-4 text-slate-400 transition-transform dark:text-slate-500", open && "rotate-180")}
        />
      </button>

      <div
        className={cx(
          "absolute left-0 right-0 top-full z-50 mt-1.5 origin-top overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 transition-all duration-150",
          "dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        )}
      >
        <div className="max-h-64 overflow-y-auto p-1">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-center cursor-pointer justify-between rounded-lg px-2.5 py-2 text-left transition",
                  active
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{opt.label}</span>
                  {opt.description ? (
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {opt.description}
                    </span>
                  ) : null}
                </span>
                {active ? <Icon name="check" className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * BADGE / CHIP
 */
export function Badge({
  children,
  tone = "emerald",
  className,
}: {
  children: React.ReactNode;
  tone?: "emerald" | "slate" | "amber" | "rose";
  className?: string;
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold sm:text-xs",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * CARD
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "ui-card rounded-2xl border border-slate-200 bg-white dark:border-slate-700/80 dark:bg-slate-900/85",
        "p-4 sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</div> : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-700 dark:text-slate-300">{children}</div>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex items-center justify-between gap-3">{children}</div>;
}

/**
 * ALERT
 */
export function Alert({
  title,
  description,
  tone = "info",
  onClose,
}: {
  title: string;
  description?: string;
  tone?: "info" | "success" | "warning";
  onClose?: () => void;
}) {
  const cfg = useMemo(() => {
    if (tone === "success")
      return {
        wrap: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200",
        icon: "check" as IconName,
        iconWrap: "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300",
      };
    if (tone === "warning")
      return {
        wrap: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-200",
        icon: "warning" as IconName,
        iconWrap: "border-amber-200 bg-white text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300",
      };
    return {
      wrap: "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100",
      icon: "info" as IconName,
      iconWrap: "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    };
  }, [tone]);

  return (
    <div className={cx("rounded-2xl border p-4", cfg.wrap)}>
      <div className="flex items-start gap-3">
        <span className={cx("mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border", cfg.iconWrap)}>
          <Icon name={cfg.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          {description ? <div className="mt-1 text-sm opacity-90">{description}</div> : null}
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/70 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * MODAL (simple)
 */
const MODAL_EXIT_DURATION_MS = 220;

export function useModalPresence(open: boolean, exitDurationMs = MODAL_EXIT_DURATION_MS) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    if (typeof window === "undefined") {
      setMounted(false);
      return;
    }

    const timer = window.setTimeout(() => setMounted(false), exitDurationMs);
    return () => window.clearTimeout(timer);
  }, [open, exitDurationMs]);

  return { mounted, isClosing: mounted && !open };
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const { mounted, isClosing } = useModalPresence(open, MODAL_EXIT_DURATION_MS);

  useEffect(() => {
    if (!mounted) return;

    const previousOverflow = document.body.style.overflow;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onEsc);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onEsc);
    };
  }, [mounted, open, onClose]);

  if (!mounted) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={cx("fixed inset-0 z-[1000]", isClosing && "pointer-events-none")}>
      <button
        type="button"
        className={cx(
          "absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] dark:bg-black/70",
          isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter",
        )}
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cx(
            "ui-modal-surface w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40",
            isClosing ? "modal-panel-exit" : "modal-panel-enter",
          )}
        >
          <div className="ui-modal-header flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <div className="min-w-0">
              <div className="ui-modal-title truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Close modal"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-5 pt-4 text-sm text-slate-700 dark:text-slate-300">{children}</div>
          {footer ? (
            <div className="ui-modal-footer flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 dark:border-slate-700 dark:bg-slate-900/70">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * SWITCH / TOGGLE
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-3 select-none">
      <button
        type="button"
        onClick={() => onCheckedChange(!checked)}
        className={cx(
          "relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full border transition",
          checked
            ? "border-emerald-300 bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40"
            : "border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
        )}
        aria-pressed={checked}
      >
        <span
          className={cx(
            "inline-block h-5 w-5 rounded-full bg-white border border-black/10 transition dark:border-slate-600 dark:bg-slate-100",
            checked ? "translate-x-5" : "translate-x-1"
          )}
        />
      </button>
      {label ? <span className="text-sm text-slate-800 dark:text-slate-200">{label}</span> : null}
    </label>
  );
}

/**
 * CTA Card (contoh card yang “SaaS banget” + icon)
 */
export function FeatureCard({
  icon,
  title,
  description,
  bullets,
}: {
  icon: IconName;
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <Card className="hover:border-emerald-200 transition dark:hover:border-emerald-700/60">
      <CardHeader
        icon={icon}
        title={title}
        subtitle={description}
        right={<Badge tone="emerald">Enterprise</Badge>}
      />
      {bullets?.length ? (
        <CardContent>
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                <span className="text-slate-700 dark:text-slate-300">{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}

/**
 * Contoh pemakaian cepat
 * (boleh hapus kalau gak perlu)
 */
export function UIShowcase() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button leftIcon="sparkles">Primary</Button>
        <Button variant="secondary" rightIcon="arrowRight">
          Secondary
        </Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger" isLoading>
          Processing
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Email" placeholder="you@company.com" leftIcon="search" hint="Kami tidak spam." />
        <PasswordInput label="Password" placeholder="••••••••" />
      </div>

      <Alert
        tone="success"
        title="Berhasil tersimpan"
        description="Konfigurasi OTP kamu sudah di-update."
        onClose={() => { }}
      />

      <div className="flex items-center gap-4">
        <Switch checked={enabled} onCheckedChange={setEnabled} label="Enable rate limit" />
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open modal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          icon="shield"
          title="Secure by default"
          description="Proteksi OTP & audit trail."
          bullets={["IP allowlist", "Role-based access", "Signed callbacks"]}
        />
        <FeatureCard
          icon="bolt"
          title="Fast delivery"
          description="Optimized routing & retries."
          bullets={["Smart fallback", "Adaptive rate", "Delivery insights"]}
        />
        <FeatureCard
          icon="sparkles"
          title="Modern DX"
          description="API & dashboard yang enak."
          bullets={["Token scoped", "Webhooks", "Usage analytics"]}
        />
      </div>

      <Modal
        open={open}
        title="Confirm action"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button leftIcon="check" onClick={() => setOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        Ini contoh modal dengan style border, rounded besar, dan clean enterprise look.
      </Modal>
    </div>
  );
}
