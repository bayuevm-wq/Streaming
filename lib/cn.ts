import { extendTailwindMerge } from "tailwind-merge";

// Token kustom dari app/globals.css (@theme). Harus didaftarkan agar tailwind-merge tahu `text-heading` adalah ukuran huruf
// (bertabrakan dengan `text-small`, bukan dengan `text-ink`), `text-ink` adalah warna, `font-display` adalah keluarga font,
// dan `bg-raised` adalah warna latar. lib/cn.test.ts memastikan daftar ini sinkron dengan globals.css.
const COLORS = [
  "ground", "surface", "raised", "hairline", "control", "ink", "muted", "accent", "accent-hover", "on-accent",
  "success", "success-surface", "warning", "warning-surface", "error", "error-surface", "scrim",
];
const TEXT_SIZES = ["hero", "display", "heading", "title", "numeral", "numeral-sm", "lead", "body", "small", "caption"];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: COLORS,
      text: TEXT_SIZES,
      font: ["display", "body"],
      shadow: ["float"],
    },
  },
});

export type ClassValue = string | false | null | undefined;

/** Menggabungkan nama kelas dan menyelesaikan tabrakan (yang terakhir menang): cn("w-full", "size-10") => "size-10". */
export function cn(...parts: ClassValue[]): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
