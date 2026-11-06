// Penanda halaman yang belum dikerjakan. Dihapus per halaman saat fitur aslinya dibangun.
export function Stub({ title, fase, note }: { title: string; fase: number; note?: string }) {
  return (
    <section className="mx-auto max-w-2xl p-8">
      <h1 className="font-display text-display font-medium italic">{title}</h1>
      <p className="mt-2 text-small text-muted">Belum diimplementasikan (Fase {fase}).{note ? ` ${note}` : ""}</p>
    </section>
  );
}
