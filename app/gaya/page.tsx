import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FieldDemo, MediaDemo, MobileDemo, OverlayDemo, PlayerDemo } from "@/components/gaya/interactive-demos";
import { SAMPLE_SONGS, SampleCover } from "@/components/gaya/sample";
import { Button } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import { EmptyState } from "@/components/ui/empty-state";
import { ICONS, IconHeart, IconMusic, IconPlus } from "@/components/ui/icons";
import { SearchHeader } from "@/components/ui/search-header";
import { Sidebar } from "@/components/ui/sidebar";
import { SkeletonGroup, SongCardSkeleton, SongRowSkeleton } from "@/components/ui/skeleton";
import { InlineStatus, StatusMessage } from "@/components/ui/status";
import { Time } from "@/components/ui/time";
import { contrastRatio, formatRatio, hueGap, parseColorTokens } from "@/lib/design/contrast";

export const metadata: Metadata = { title: "Gaya — Streaming", robots: { index: false, follow: false } };

const SWATCHES: { group: string; items: [token: string, use: string][] }[] = [
  { group: "Permukaan", items: [["ground", "Latar halaman"], ["surface", "Panel, baris aktif, player bar"], ["raised", "Hover, placeholder sampul"]] },
  { group: "Garis", items: [["hairline", "Pemisah dekoratif"], ["control", "Batas kontrol (≥ 3:1)"]] },
  { group: "Teks", items: [["ink", "Teks utama"], ["muted", "Teks pendukung"]] },
  { group: "Aksen kobalt", items: [["accent", "Tombol utama, fokus, lagu aktif"], ["accent-hover", "Hover tombol utama"], ["on-accent", "Teks di atas aksen"]] },
  { group: "Status", items: [["success", "Berhasil"], ["warning", "Perhatian"], ["error", "Gagal"], ["success-surface", "Latar status berhasil"], ["warning-surface", "Latar status perhatian"], ["error-surface", "Latar status gagal"]] },
];

const TYPE_SCALE = [
  ["hero", "text-hero", "56 / 1,02", "Display italic", "Streaming", "font-display font-medium italic"],
  ["display", "text-display", "40 / 1,08", "Display", "Malam di Jakarta", "font-display font-medium"],
  ["heading", "text-heading", "28 / 1,15", "Display", "Playlist perjalanan", "font-display font-medium"],
  ["title", "text-title", "20 / 1,25", "Display", "Surat untuk Kemarin", "font-display font-medium"],
  ["numeral", "text-numeral", "30 / 1", "Display italic", "12", "font-display italic"],
  ["numeral-sm", "text-numeral-sm", "20 / 1", "Display italic (≤ 640px)", "12", "font-display italic"],
  ["lead", "text-lead", "18 / 1,5", "Teks", "Dengarkan tanpa terputus saat pindah halaman.", "font-body"],
  ["body", "text-body", "16 / 1,55", "Teks", "Buat playlist dan simpan lagu yang kamu sukai.", "font-body"],
  ["small", "text-small", "14 / 1,5", "Teks", "Laras Mendung · Lampu Kota", "font-body"],
  ["caption", "text-caption", "13 / 1,4", "Teks", "1:24 / 3:42", "font-body"],
] as const;

const SPACING = [1, 2, 3, 4, 6, 8, 12, 16] as const;

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid gap-6 border-t border-hairline pt-10">
      <div className="grid max-w-prose gap-2">
        <h2 id={`${id}-h`} className="font-display text-display font-medium italic">
          {title}
        </h2>
        {intro ? <p className="text-body text-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function GayaPage() {
  const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
  const tok = parseColorTokens(css);
  const hex = (k: string) => tok[k] ?? "#000000";
  const onSwatch = (k: string) => (contrastRatio(hex(k), hex("ink")) >= contrastRatio(hex(k), hex("ground")) ? "var(--color-ink)" : "var(--color-ground)");

  const KEY_PAIRS: [string, string, string, number][] = [
    ["Teks utama", "ink", "ground", 4.5],
    ["Teks redup", "muted", "surface", 4.5],
    ["Aksen sebagai teks", "accent", "surface", 4.5],
    ["Teks pada tombol utama", "on-accent", "accent", 4.5],
    ["Judul status berhasil", "success", "success-surface", 4.5],
    ["Judul status perhatian", "warning", "warning-surface", 4.5],
    ["Judul status gagal", "error", "error-surface", 4.5],
    ["Batas kontrol di atas raised", "control", "raised", 3],
    ["Cincin fokus di atas surface", "accent", "surface", 3],
  ];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-12 sm:px-8">
      <header className="grid gap-4">
        <p className="text-small text-muted">Design system · arah C</p>
        <h1 className="font-display text-hero font-medium italic tracking-tight">Tinta Cetak</h1>
        <p className="max-w-prose text-lead text-muted">
          Semua token dan komponen dasar Streaming. Halaman ini membaca token langsung dari <code className="font-body">app/globals.css</code>, jadi
          angka dan warna di sini selalu sama dengan yang dipakai aplikasi. Dokumentasi lengkap: <code className="font-body">docs/design-system.md</code>.
        </p>
        <nav aria-label="Daftar isi" className="flex flex-wrap gap-2 pt-2">
          {[["warna", "Warna"], ["huruf", "Huruf"], ["spasi", "Spasi dan radius"], ["gerak", "Gerak"], ["ikon", "Ikon"], ["tombol", "Tombol"], ["input", "Input"], ["status", "Status"], ["media", "Kartu dan baris"], ["pemutar", "Pemutar"], ["ponsel", "Ponsel"], ["navigasi", "Sidebar dan pencarian"], ["overlay", "Dialog dan toast"], ["kosong", "Kosong dan skeleton"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="border border-control px-3 py-1.5 text-small hover:bg-raised">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="warna" title="Warna" intro="Mode gelap satu-satunya tampilan. Aksen kobalt dipakai hemat: tombol utama, fokus, lagu aktif, dan progres. Status punya warna sendiri yang jauh dari kobalt.">
        {SWATCHES.map((g) => (
          <div key={g.group} className="grid gap-3">
            <h3 className="text-small font-semibold text-muted">{g.group}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
              {g.items.map(([k, use]) => (
                <div key={k} className="flex min-h-24 flex-col justify-end border border-hairline p-3 text-small" style={{ background: `var(--color-${k})`, color: onSwatch(k) }}>
                  <b className="font-semibold">{k}</b>
                  <span>{hex(k).toUpperCase()}</span>
                  <span className="opacity-90">{use}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="grid gap-3">
          <h3 className="text-small font-semibold text-muted">Kontras terukur (WCAG 2.x; seluruh pasangan diuji CI lewat npm run test:contrast)</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-small">
              <thead>
                <tr className="border-b border-control text-left text-muted">
                  <th className="py-2 pr-4 font-semibold">Peran</th>
                  <th className="py-2 pr-4 font-semibold">Pasangan</th>
                  <th className="py-2 pr-4 text-right font-semibold">Rasio</th>
                  <th className="py-2 font-semibold">Minimum</th>
                </tr>
              </thead>
              <tbody>
                {KEY_PAIRS.map(([role, fg, bg, min]) => {
                  const r = contrastRatio(hex(fg), hex(bg));
                  return (
                    <tr key={role} className="border-b border-hairline">
                      <td className="py-2 pr-4">{role}</td>
                      <td className="py-2 pr-4 text-muted">
                        {fg} / {bg}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatRatio(r)}:1</td>
                      <td className="py-2">{r >= min ? `lulus ≥ ${min}:1` : `GAGAL < ${min}:1`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-small text-muted">
            Selisih rona status dengan kobalt: berhasil {hueGap(hex("success"), hex("accent")).toFixed(0)}°, perhatian {hueGap(hex("warning"), hex("accent")).toFixed(0)}°, gagal{" "}
            {hueGap(hex("error"), hex("accent")).toFixed(0)}° (minimum 60°).
          </p>
        </div>
      </Section>

      <Section id="huruf" title="Huruf" intro="Newsreader (serif editorial) untuk judul dan nama lagu; Schibsted Grotesk untuk teks dan kontrol. Keduanya dimuat lewat next/font, display swap, subset latin.">
        <div className="grid gap-5">
          {TYPE_SCALE.map(([name, cls, size, role, sample, fam]) => (
            <div key={name} className="grid gap-1 border-b border-hairline pb-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-baseline sm:gap-6">
              <p className="text-small text-muted">
                <b className="font-semibold text-ink">{name}</b> · {size}
                <br />
                {role}
              </p>
              <p className={`${cls} ${fam} truncate`}>{sample}</p>
            </div>
          ))}
        </div>
        <p className="max-w-prose text-small text-muted">
          Waktu memakai angka tabular (lebar sama, kolom rata) dengan titik dua proporsional (komponen Time): <Time seconds={42} /> · <Time seconds={84} /> ·{" "}
          <Time seconds={222} /> · <Time seconds={600} /> · <Time seconds={3725} />. Tanpa itu titik dua melebar jadi 8,9px dan terbaca &ldquo;3 : 42&rdquo;.
        </p>
      </Section>

      <Section id="spasi" title="Spasi dan radius" intro="Kelipatan 4px. Radius selalu 0: kartu, sampul, tombol, input, dialog, semuanya bersudut tajam. Utilitas rounded-* dan shadow-* bawaan Tailwind dihapus; satu-satunya bayangan adalah shadow-float untuk yang melayang (toast, dialog).">
        <div className="grid gap-2">
          {SPACING.map((n) => (
            <div key={n} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-4 text-small">
              <span className="text-muted tabular-nums">
                {n} · {n * 4}px
              </span>
              <span className="block h-3 bg-accent" style={{ width: `calc(var(--spacing) * ${n})` }} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="grid size-24 place-items-center border border-control bg-surface text-small">0px</div>
          <div className="grid size-24 place-items-center bg-raised text-small shadow-float">float</div>
        </div>
      </Section>

      <Section id="gerak" title="Gerak" intro="Pendek dan fungsional. Semua animasi dan transisi mati otomatis pada pengaturan ‘kurangi gerakan’ (aturan global di globals.css).">
        <dl className="grid gap-2 text-small sm:grid-cols-3">
          {[["--duration-fast", "120ms", "hover dan tekan"], ["--duration-base", "200ms", "munculnya tombol putar"], ["--duration-slow", "360ms", "dialog dan perubahan besar"]].map(([n, v, u]) => (
            <div key={n} className="border border-hairline p-3">
              <dt className="font-semibold">{n}</dt>
              <dd className="text-muted">
                {v} · {u}
              </dd>
            </div>
          ))}
        </dl>
        <p className="flex items-center gap-3 text-small text-accent">
          <span className="eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Indikator lagu aktif (diam bila dijeda atau bila pengguna meminta kurangi gerakan)
        </p>
      </Section>

      <Section id="ikon" title="Ikon" intro="Garis 1,8px berujung persegi, mengikuti ukuran teks (1em). Ikon dekoratif disembunyikan dari pembaca layar; tombol hanya-ikon wajib punya aria-label. Ikon status berbeda bentuk: lingkaran, segitiga, segi delapan.">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
          {Object.entries(ICONS).map(([name, Icon]) => (
            <li key={name} className="grid justify-items-center gap-2 border border-hairline p-4 text-small text-muted">
              <Icon className="text-heading text-ink" />
              {name}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="tombol" title="Tombol" intro="Sudut tajam. Utama (kobalt) maksimal satu per tampilan. Hanya-ikon wajib aria-label, dan itu dipaksa oleh tipe.">
        <div className="grid gap-5">
          {(["primary", "secondary", "ghost", "danger"] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-small text-muted">{v}</span>
              <Button variant={v} size="sm">Kecil</Button>
              <Button variant={v}>Sedang</Button>
              <Button variant={v} size="lg">Besar</Button>
              <Button variant={v} disabled>Nonaktif</Button>
              <Button variant={v} loading>Memuat</Button>
              <Button variant={v} iconOnly aria-label="Tambah playlist">
                <IconPlus />
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section id="input" title="Input" intro="Label selalu tampak (bukan placeholder). Batas kontrol 3:1. Galat memakai ikon + teks dan terhubung lewat aria-describedby.">
        <FieldDemo />
      </Section>

      <Section id="status" title="Status" intro="Sukses, peringatan, dan galat selalu ikon + judul + teks; warna hanya penguat. Berbeda dari kobalt supaya tak tertukar dengan ‘sedang diputar’ atau tombol utama.">
        <div className="grid max-w-xl gap-4">
          <StatusMessage kind="success">Lagu ditambahkan ke library pribadi. Terhapus otomatis dalam 24 jam.</StatusMessage>
          <StatusMessage kind="warning">Penyimpanan pribadi hampir penuh. Upload ditutup sementara bila penuh.</StatusMessage>
          <StatusMessage kind="error">File bukan MP3 yang valid. Pilih file .mp3 lain.</StatusMessage>
          <InlineStatus kind="error">Batas 3 lagu tercapai. Hapus satu lagu untuk mengunggah lagi.</InlineStatus>
        </div>
      </Section>

      <Section id="media" title="Kartu lagu, kartu album/artis, dan baris lagu" intro="Sampul 1:1 bersudut tajam. Lagu aktif ditandai garis aksen, teks aksen, dan label (bukan warna saja). Tombol putar adalah button sungguhan.">
        <MediaDemo />
      </Section>

      <Section id="pemutar" title="Player bar, slider progres, dan slider volume" intro="Slider memakai input range asli: bisa digeser dengan panah, fokus terlihat, dan pembaca layar mendengar nilai dalam teks (‘1:24 dari 3:42’).">
        <PlayerDemo />
      </Section>

      <Section id="ponsel" title="Ponsel: mini-player, pemutar penuh, navigasi bawah" intro="Untuk layar 760px ke bawah. Sidebar dan player bar digantikan MiniPlayer (satu baris) + BottomNav (empat tujuan). Mengetuk mini-player membuka pemutar penuh dengan sampul besar, slider posisi, dan antrean.">
        <MobileDemo />
      </Section>

      <Section id="navigasi" title="Sidebar dan header pencarian">
        <div className="grid overflow-hidden border border-hairline lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Sidebar current="/library" playlists={[{ id: "p1", name: "Perjalanan malam" }, { id: "p2", name: "Hujan sore" }]} />
          <div className="min-w-0">
            <SearchHeader actions={<Button variant="ghost" size="sm">Keluar</Button>} />
            <div className="grid gap-3 p-6">
              <h3 className="font-display text-heading font-medium italic">Library</h3>
              <p className="text-small text-muted">Area konten. Item aktif di sidebar memakai garis kiri, teks aksen, dan aria-current.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="overlay" title="Dialog dan toast" intro="Dialog memakai elemen dialog asli (fokus terkunci, Esc menutup). Toast galat memakai role alert; yang lain role status.">
        <OverlayDemo />
      </Section>

      <Section id="kosong" title="Keadaan kosong dan skeleton">
        <div className="grid gap-8 lg:grid-cols-2">
          <EmptyState
            icon={<IconHeart />}
            title="Belum ada lagu yang kamu sukai"
            description="Tekan ikon hati pada lagu mana pun untuk menyimpannya di sini."
            action={<Button variant="secondary">Jelajahi beranda</Button>}
          />
          <EmptyState
            icon={<IconMusic />}
            title="Library pribadi kosong"
            description="Unggah MP3 (maks 10 MB, 3 lagu). Lagu terhapus otomatis setelah 24 jam."
            action={<Button>Unggah lagu</Button>}
          />
        </div>
        <SkeletonGroup>
          <div className="grid gap-8">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-5">
              <SongCardSkeleton />
              <SongCardSkeleton />
              <SongCardSkeleton />
            </div>
            <div className="border-t border-hairline">
              <SongRowSkeleton />
              <SongRowSkeleton />
            </div>
          </div>
        </SkeletonGroup>
      </Section>

      <footer className="border-t border-hairline pt-6 text-small text-muted">
        <div className="flex items-center gap-3">
          <Cover className="size-10">
            <SampleCover n={SAMPLE_SONGS[1].cover} />
          </Cover>
          Sampul dan lagu di halaman ini fiktif dan hanya untuk contoh.
        </div>
      </footer>
    </div>
  );
}
