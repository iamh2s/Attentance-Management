import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Search,
  Inbox,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { STATUS_META } from "@/lib/utils";
import type { MarkStatus } from "@/lib/types";

// ── Toasts ───────────────────────────────────────────────────

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface ToastApi {
  toast: (kind: ToastKind, title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_STYLE: Record<ToastKind, { icon: ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 size={17} className="text-emerald-600" />, bar: "bg-emerald-500" },
  error: { icon: <XCircle size={17} className="text-rose-600" />, bar: "bg-rose-500" },
  info: { icon: <Info size={17} className="text-navy-600" />, bar: "bg-navy-500" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, title, body }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-pop"
          >
            <span className={cn("absolute left-0 top-0 h-full w-1", TOAST_STYLE[t.kind].bar)} />
            <span className="mt-0.5 shrink-0">{TOAST_STYLE[t.kind].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy-950">{t.title}</p>
              {t.body && <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-500">{t.body}</p>}
            </div>
            <button
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="shrink-0 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Button ───────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "dark";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

const BTN: Record<ButtonVariant, string> = {
  primary:
    "bg-navy-800 text-white shadow-sm hover:bg-navy-700 focus-visible:ring-navy-500/40 disabled:bg-navy-300",
  secondary:
    "border border-slate-300 bg-white text-navy-900 shadow-sm hover:border-navy-400 hover:text-navy-700 focus-visible:ring-navy-500/30",
  ghost: "text-navy-800 hover:bg-navy-100/70 focus-visible:ring-navy-500/30",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-500 focus-visible:ring-rose-500/40 disabled:bg-rose-300",
  soft: "bg-navy-100 text-navy-900 hover:bg-navy-200/80 focus-visible:ring-navy-500/30",
  dark: "bg-navy-950 text-white hover:bg-navy-900 focus-visible:ring-navy-500/40",
};

const BTN_SIZE = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9.5 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[0.925rem] gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center rounded-lg font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-4 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80",
        BTN[variant],
        BTN_SIZE[size],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ── Inputs ───────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cn("input", className)} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select className={cn("input cursor-pointer appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        className="input pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
      />
    </div>
  );
}

// ── Badge / status ───────────────────────────────────────────

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "navy" | "green" | "red" | "amber" | "outline";
  className?: string;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 ring-slate-500/15",
    navy: "bg-navy-100 text-navy-800 ring-navy-600/15",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/25",
    outline: "bg-white text-navy-800 ring-slate-300",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: MarkStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold ring-1 ring-inset",
        meta.badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

// ── Avatar ───────────────────────────────────────────────────

const AVATAR_HUES = [222, 210, 198, 234, 246, 258, 186, 170];

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const cleaned = name.replace(/\(.*?\)/g, "").trim();
  const parts = cleaned.split(/\s+/);
  const init = ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) hash = (hash * 31 + cleaned.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length];
  const sz = size === "sm" ? "h-8 w-8 text-[0.65rem]" : size === "lg" ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", sz, className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 38%), hsl(${hue + 18} 50% 26%))` }}
      aria-hidden
    >
      {init}
    </span>
  );
}

// ── Stat card ────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  accent: string;
  className?: string;
}) {
  return (
    <div className={cn("card flex items-center gap-4 p-5", className)}>
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ background: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-slate-500">{label}</p>
        <p className="tnums mt-0.5 text-2xl font-extrabold leading-none text-navy-950">{value}</p>
        {sub && <div className="mt-1 truncate text-xs font-medium text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 116,
  stroke = 10,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8eef6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#255184" />
            <stop offset="100%" stopColor="#0e9f6e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnums text-2xl font-extrabold text-navy-950">{v.toFixed(1)}%</span>
        {label && <span className="text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">{label}</span>}
      </div>
    </div>
  );
}

// ── Loader / empty ───────────────────────────────────────────

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 size={26} className="animate-spin text-navy-500" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-400">
        {icon ?? <Inbox size={22} />}
      </span>
      <p className="mt-1 text-sm font-bold text-navy-900">{title}</p>
      {body && <p className="max-w-sm text-xs leading-relaxed text-slate-500">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">
        Showing <span className="font-bold text-navy-900">{from.toLocaleString()}</span>–
        <span className="font-bold text-navy-900">{to.toLocaleString()}</span> of{" "}
        <span className="font-bold text-navy-900">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-navy-800 transition-colors hover:border-navy-400 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="px-2 text-xs font-bold text-navy-900">
          {page} / {pages}
        </span>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-navy-800 transition-colors hover:border-navy-400 disabled:opacity-40"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal>
      <div className="fadein absolute inset-0 bg-navy-950/45 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className={cn(
          "rise relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[0.95rem] font-bold text-navy-950">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            danger ? "bg-rose-50 text-rose-600" : "bg-navy-100 text-navy-700"
          )}
        >
          <AlertTriangle size={17} />
        </span>
        <div className="text-sm leading-relaxed text-slate-600">{body}</div>
      </div>
    </Modal>
  );
}
