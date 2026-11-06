import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-control text-ink hover:bg-raised",
  ghost: "text-ink hover:bg-raised",
  danger: "border border-error text-error hover:bg-error-surface",
};
const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-small gap-2",
  md: "h-10 px-4 text-body gap-2",
  lg: "h-12 px-6 text-lead gap-3",
};
const ICON_SIZE: Record<ButtonSize, string> = { sm: "size-8", md: "size-10", lg: "size-12" };

/** Kelas tombol, dipakai Button dan ButtonLink agar tampilannya identik. Transisi hanya warna latar/batas/teks (bukan outline). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  iconOnly = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-[background-color,border-color,color] duration-(--duration-fast) disabled:opacity-50",
    VARIANT[variant],
    iconOnly ? ICON_SIZE[size] : SIZE[size],
    className,
  );
}

type Common = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Saat true: tombol nonaktif, `aria-busy`, dan indikator gerak muncul. Label tetap ada. */
  loading?: boolean;
};
type WithLabel = Common & { iconOnly?: false; children: ReactNode; "aria-label"?: string };
/** Tombol hanya-ikon WAJIB punya aria-label (dipaksa tipe). */
type IconOnly = Common & { iconOnly: true; children: ReactNode; "aria-label": string };

/** Sudut tajam; fokus keyboard lewat aturan global (outline kobalt, offset 3px). */
export function Button(props: WithLabel | IconOnly) {
  const { variant = "primary", size = "md", loading, iconOnly, className, children, disabled, type = "button", ...rest } = props;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, iconOnly, className })}
      {...rest}
    >
      {loading && (
        <span className="eq" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      {children}
    </button>
  );
}
