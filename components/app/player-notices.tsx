"use client";

import { Toast, ToastRegion } from "@/components/ui/toast";
import { usePlayer } from "@/lib/player/store";

/** Menampilkan notifikasi pemutar (mis. lagu rusak dilewati). Galat tidak ditutup otomatis; pengguna menutupnya. */
export function PlayerNotices() {
  const notice = usePlayer((s) => s.notice);
  const dismiss = usePlayer((s) => s.dismissNotice);
  return <ToastRegion>{notice ? <Toast key={notice.id} kind={notice.kind} onDismiss={dismiss}>{notice.message}</Toast> : null}</ToastRegion>;
}
