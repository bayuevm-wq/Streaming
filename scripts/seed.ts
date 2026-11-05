// Seed katalog publik (F9). Dijalankan lokal atau CI dengan service role; tidak pernah lewat klien.
//
//   node --env-file=.env.local scripts/seed.ts                 # isi katalog dari scripts/seed/catalog.json
//   node scripts/seed.ts --dry-run                              # hanya validasi (tanpa jaringan, tanpa kunci)
//   node scripts/seed.ts --readme --dry-run                     # perbarui tabel sumber/lisensi di README.md
//   Opsi: --catalog <berkas> --relaxed (tanpa syarat jumlah/cover, untuk uji) --yes (izinkan target non-lokal)
//         --force-upload (unggah ulang meski ukuran sama)
//
// Idempoten: artis dicocokkan lewat name_key, album lewat (artis, judul), lagu lewat seed_key.
// Berkas storage dilewati bila sudah ada dengan ukuran sama.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseBuffer } from "music-metadata";
import {
  RECOMMENDED_KBPS,
  catalogProblems,
  checkCatalogAudio,
  checkCatalogImage,
  type Catalog,
  type CatalogSong,
} from "./seed/rules.ts";

type Args = { catalog: string; dryRun: boolean; relaxed: boolean; yes: boolean; forceUpload: boolean; readme: boolean };
function parseArgs(argv: string[]): Args {
  const a: Args = { catalog: "scripts/seed/catalog.json", dryRun: false, relaxed: false, yes: false, forceUpload: false, readme: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--catalog") a.catalog = argv[++i] ?? a.catalog;
    else if (v === "--dry-run") a.dryRun = true;
    else if (v === "--relaxed") a.relaxed = true;
    else if (v === "--yes") a.yes = true;
    else if (v === "--force-upload") a.forceUpload = true;
    else if (v === "--readme") a.readme = true;
    else throw new Error(`opsi tidak dikenal: ${v}`);
  }
  return a;
}

function die(lines: string[]): never {
  for (const l of lines) console.error(`GAGAL  ${l}`);
  process.exit(1);
}

function resolveInside(base: string, rel: string): string {
  const abs = path.resolve(base, rel);
  if (abs !== base && !abs.startsWith(base + path.sep)) die([`jalur "${rel}" keluar dari folder katalog`]);
  return abs;
}

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Prepared = { duration: number; size: number; ext: string; contentType: string; abs: string };

async function validate(catalog: Catalog, base: string, relaxed: boolean) {
  const problems = catalogProblems(catalog, relaxed);
  const warnings: string[] = [];
  const audio = new Map<string, Prepared>();
  const images = new Map<string, { ext: string; contentType: string; abs: string }>();

  const image = (rel: string | undefined, label: string) => {
    if (!rel) return;
    const abs = resolveInside(base, rel);
    if (!fs.existsSync(abs)) return void problems.push(`${label}: berkas ${rel} tidak ditemukan`);
    const r = checkCatalogImage(new Uint8Array(fs.readFileSync(abs)), abs);
    if (!r.ok) return void problems.push(`${label} (${rel}): ${r.reason}`);
    images.set(rel, { ext: r.ext, contentType: r.contentType, abs });
  };
  catalog.artists.forEach((a) => image(a.image, `artis "${a.name}"`));
  catalog.albums.forEach((a) => image(a.cover, `album "${a.title}"`));
  catalog.songs.forEach((s) => image(s.cover, `lagu "${s.title}"`));

  for (const s of catalog.songs) {
    const label = `lagu "${s.title}" (${s.file})`;
    const abs = resolveInside(base, s.file);
    if (!fs.existsSync(abs)) {
      problems.push(`${label}: berkas tidak ditemukan`);
      continue;
    }
    const bytes = new Uint8Array(fs.readFileSync(abs));
    const r = checkCatalogAudio(bytes, abs);
    if (!r.ok) {
      problems.push(`${label}: ${r.reason}`);
      continue;
    }
    let duration = r.durationSec;
    let bitrate = r.bitrateKbps;
    if (r.ext === "m4a") {
      try {
        const md = await parseBuffer(bytes, { mimeType: "audio/mp4" });
        duration = md.format.duration ? Math.max(1, Math.round(md.format.duration)) : null;
        bitrate = md.format.bitrate ? Math.round(md.format.bitrate / 1000) : null;
      } catch (e) {
        problems.push(`${label}: M4A tidak dapat dibaca (${(e as Error).message})`);
        continue;
      }
      if (!duration) {
        problems.push(`${label}: durasi M4A tidak dapat ditentukan`);
        continue;
      }
      if (bitrate && (bitrate < RECOMMENDED_KBPS.min || bitrate > RECOMMENDED_KBPS.max)) {
        r.warnings.push(`bitrate ${bitrate} kbps di luar anjuran ${RECOMMENDED_KBPS.min}-${RECOMMENDED_KBPS.max} kbps`);
      }
    }
    if (!duration || duration < 1 || duration > 7200) {
      problems.push(`${label}: durasi ${duration} detik di luar 1-7200`);
      continue;
    }
    r.warnings.forEach((w) => warnings.push(`${label}: ${w}`));
    audio.set(s.key, { duration, size: bytes.length, ext: r.ext, contentType: r.contentType, abs });
  }
  return { problems, warnings, audio, images };
}

function updateReadme(catalog: Catalog) {
  const file = "README.md";
  const start = "<!-- seed-sources:start -->";
  const end = "<!-- seed-sources:end -->";
  const text = fs.readFileSync(file, "utf8");
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i < 0 || j < i) die([`penanda ${start} ... ${end} tidak ada di ${file}`]);
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const rows = catalog.songs.map((s) => `| ${esc(s.title)} | ${esc(s.artist)} | ${esc(s.source)} | ${esc(s.license)} |`);
  const table = ["| Lagu | Artis | Sumber | Lisensi |", "|---|---|---|---|", ...rows].join("\n");
  fs.writeFileSync(file, `${text.slice(0, i + start.length)}\n${table}\n${text.slice(j)}`);
  console.log(`README.md diperbarui: ${rows.length} lagu`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogPath = path.resolve(args.catalog);
  if (!fs.existsSync(catalogPath)) die([`katalog tidak ditemukan: ${args.catalog}`]);
  const base = path.dirname(catalogPath);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as Catalog;
  for (const k of ["artists", "albums", "songs"] as const) {
    if (!Array.isArray(catalog[k])) die([`katalog: "${k}" harus berupa array`]);
  }

  const { problems, warnings, audio, images } = await validate(catalog, base, args.relaxed);
  warnings.forEach((w) => console.warn(`PERINGATAN  ${w}`));
  if (problems.length) die(problems);
  console.log(`OK  ${catalog.songs.length} lagu, ${catalog.albums.length} album, ${catalog.artists.length} artis lolos validasi`);

  if (args.readme) updateReadme(catalog);
  if (args.dryRun) return;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) die(["SUPABASE_URL (atau NEXT_PUBLIC_SUPABASE_URL) dan SUPABASE_SERVICE_ROLE_KEY harus diatur"]);
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost"].includes(host) && !args.yes) {
    die([`target ${host} bukan lokal; jalankan lagi dengan --yes bila memang ingin mengisi proyek itu`]);
  }
  console.log(`Target: ${host}`);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const stats = { artists: 0, albums: 0, songs: 0, songsUpdated: 0, uploaded: 0, skipped: 0 };

  async function upload(bucket: string, objectPath: string, abs: string, contentType: string): Promise<string> {
    const bytes = fs.readFileSync(abs);
    const dir = path.posix.dirname(objectPath);
    const name = path.posix.basename(objectPath);
    if (!args.forceUpload) {
      const { data } = await db.storage.from(bucket).list(dir, { search: name, limit: 5 });
      const found = data?.find((o) => o.name === name);
      if (found && Number((found.metadata as { size?: number } | null)?.size) === bytes.length) {
        stats.skipped++;
        return objectPath;
      }
    }
    const { error } = await db.storage.from(bucket).upload(objectPath, bytes, { contentType, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`unggah ${bucket}/${objectPath}: ${error.message}`);
    stats.uploaded++;
    return objectPath;
  }
  const coverPath = async (rel: string | undefined, dest: string): Promise<string | null> => {
    if (!rel) return null;
    const img = images.get(rel)!;
    return upload("covers", `${dest}.${img.ext}`, img.abs, img.contentType);
  };

  const artistId = new Map<string, string>();
  for (const a of catalog.artists) {
    const nameKey = a.name.trim().toLowerCase();
    const image = await coverPath(a.image, `artists/${slug(a.name)}`);
    const { data: found, error } = await db.from("artists").select("id,image_path").eq("name_key", nameKey).maybeSingle();
    if (error) throw error;
    if (found) {
      if (image && found.image_path !== image) await db.from("artists").update({ image_path: image }).eq("id", found.id);
      artistId.set(nameKey, found.id);
    } else {
      const ins = await db.from("artists").insert({ name: a.name.trim(), image_path: image }).select("id").single();
      if (ins.error) throw ins.error;
      artistId.set(nameKey, ins.data.id);
      stats.artists++;
    }
  }

  const albumId = new Map<string, string>();
  for (const al of catalog.albums) {
    const aId = artistId.get(al.artist.trim().toLowerCase())!;
    const titleKey = al.title.trim().toLowerCase();
    const cover = await coverPath(al.cover, `albums/${slug(al.artist)}-${slug(al.title)}`);
    const { data: found, error } = await db.from("albums").select("id,cover_path,year").eq("artist_id", aId).eq("title_key", titleKey).maybeSingle();
    if (error) throw error;
    if (found) {
      const patch: Record<string, unknown> = {};
      if (cover && found.cover_path !== cover) patch.cover_path = cover;
      if (al.year && found.year !== al.year) patch.year = al.year;
      if (Object.keys(patch).length) await db.from("albums").update(patch).eq("id", found.id);
      albumId.set(`${al.artist.trim().toLowerCase()}\u0000${titleKey}`, found.id);
    } else {
      const ins = await db.from("albums").insert({ artist_id: aId, title: al.title.trim(), cover_path: cover, year: al.year ?? null }).select("id").single();
      if (ins.error) throw ins.error;
      albumId.set(`${al.artist.trim().toLowerCase()}\u0000${titleKey}`, ins.data.id);
      stats.albums++;
    }
  }

  for (const s of catalog.songs as CatalogSong[]) {
    const a = audio.get(s.key)!;
    const audioPath = await upload("audio", `seed/${s.key}.${a.ext}`, a.abs, a.contentType);
    const cover = await coverPath(s.cover, `songs/${s.key}`);
    const row = {
      visibility: "public",
      status: "ready",
      seed_key: s.key,
      title: s.title.trim(),
      artist_id: artistId.get(s.artist.trim().toLowerCase())!,
      album_id: s.album ? albumId.get(`${s.artist.trim().toLowerCase()}\u0000${s.album.trim().toLowerCase()}`)! : null,
      track_no: s.trackNo ?? null,
      audio_path: audioPath,
      cover_path: cover,
      duration_sec: a.duration,
      size_bytes: a.size,
    };
    const { data: existing, error: selErr } = await db.from("songs").select("id").eq("seed_key", s.key).maybeSingle();
    if (selErr) throw selErr;
    const { error } = await db.from("songs").upsert(row, { onConflict: "seed_key" });
    if (error) throw new Error(`lagu "${s.title}": ${error.message}`);
    if (existing) stats.songsUpdated++;
    else stats.songs++;
  }

  console.log(
    `SELESAI  baru: ${stats.artists} artis, ${stats.albums} album, ${stats.songs} lagu | lagu diperbarui: ${stats.songsUpdated} | ` +
      `berkas diunggah: ${stats.uploaded}, dilewati (ukuran sama): ${stats.skipped}`,
  );
}

main().catch((e) => {
  console.error(`GAGAL  ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
