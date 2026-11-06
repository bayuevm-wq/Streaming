"use client";

import { Toast, ToastRegion } from "@/components/ui/toast";
import { usePlayer } from "@/lib/player/store";
import { useToasts } from "@/lib/ui/toasts";

/**
 * Semua notifikasi aplikasi dalam satu wilayah: notifikasi pemutar (mis. lagu rusak dilewati) dan toast umum (suka,
 * playlist). Galat tidak ditutup otomatis; pengguna menutupnya (aturan design system).
 */
export function AppNotices() {
  const notice = usePlayer((s) => s.notice);
  const dismissPlayer = usePlayer((s) => s.dismissNotice);
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <ToastRegion>
      {notice ? (
        <Toast key={`pemutar-${notice.id}`} kind={notice.kind} onDismiss={dismissPlayer}>
          {notice.message}
        </Toast>
      ) : null}
      {items.map((t) => (
        <Toast key={t.id} kind={t.kind} onDismiss={() => dismiss(t.id)}>
          {t.message}
        </Toast>
      ))}
    </ToastRegion>
  );
}
