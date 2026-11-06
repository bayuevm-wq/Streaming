import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  /** Satu tindakan jelas berikutnya (Button), mis. "Unggah lagu". */
  action?: ReactNode;
  className?: string;
};

/** Keadaan kosong: bingkai tetap ada (tidak runtuh), menjelaskan apa yang akan muncul dan cara mengisinya. */
export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("grid justify-items-start gap-3 border border-dashed border-control p-8", className)}>
      <div className="text-display text-muted" aria-hidden="true">
        {icon}
      </div>
      <h2 className="font-display text-heading font-medium italic">{title}</h2>
      <p className="max-w-prose text-body text-muted">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
