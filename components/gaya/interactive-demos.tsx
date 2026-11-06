"use client";

import { useState } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import { Dialog } from "@/components/ui/dialog";
import { FullPlayer } from "@/components/ui/full-player";
import { MediaCard } from "@/components/ui/media-card";
import { MiniPlayer } from "@/components/ui/mini-player";
import { PlayerBar } from "@/components/ui/player-bar";
import { SongCard } from "@/components/ui/song-card";
import { SongRow } from "@/components/ui/song-row";
import { TextField } from "@/components/ui/text-field";
import { Toast, ToastRegion } from "@/components/ui/toast";
import type { StatusKind } from "@/components/ui/status";
import { SAMPLE_SONGS, SampleCover } from "./sample";

const cover = (n: number, alt = "") => (
  <Cover alt={alt}>
    <SampleCover n={n} />
  </Cover>
);

/** Kartu lagu, kartu album/artis, dan baris lagu dengan state putar/suka yang bisa dicoba. */
export function MediaDemo() {
  const [current, setCurrent] = useState<string | null>("s1");
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({ s3: true });
  const toggle = (id: string) => {
    if (current === id) setPaused((p) => !p);
    else {
      setCurrent(id);
      setPaused(false);
    }
  };
  return (
    <div className="grid gap-10">
      <div>
        <h3 className="mb-4 text-small font-semibold text-muted">Kartu lagu (kiri: aktif; arahkan kursor atau Tab ke kartu lain)</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-5">
          {SAMPLE_SONGS.slice(0, 3).map((s) => (
            <SongCard
              key={s.id}
              title={s.title}
              artist={s.artist}
              cover={cover(s.cover)}
              href={`/album/${s.id}`}
              playing={current === s.id}
              paused={current === s.id && paused}
              onTogglePlay={() => toggle(s.id)}
            />
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-4 text-small font-semibold text-muted">Kartu album dan artis</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-5">
          <MediaCard kind="album" title="Lampu Kota" subtitle="Laras Mendung · 2024" cover={cover(1)} href="/album/lampu-kota" onPlay={() => setCurrent("s1")} />
          <MediaCard kind="album" title="Setengah Sadar" subtitle="Ombak Kecil · 2023" cover={cover(2)} href="/album/setengah-sadar" onPlay={() => setCurrent("s2")} />
          <MediaCard kind="artist" title="Rintik" subtitle="Artis · 14 lagu" cover={cover(3)} href="/artis/rintik" />
        </div>
      </div>
      <div>
        <h3 className="mb-4 text-small font-semibold text-muted">Baris lagu (perkecil jendela hingga 640px untuk melihat nomor mengecil dan album hilang)</h3>
        <div id="baris-lagu" className="border-t border-hairline">
          {SAMPLE_SONGS.map((s, i) => (
            <SongRow
              key={s.id}
              index={i + 1}
              title={s.title}
              artist={s.artist}
              album={s.album}
              durationSec={s.duration}
              cover={cover(s.cover)}
              playing={current === s.id}
              paused={current === s.id && paused}
              liked={Boolean(liked[s.id])}
              onTogglePlay={() => toggle(s.id)}
              onToggleLike={() => setLiked((l) => ({ ...l, [s.id]: !l[s.id] }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Player bar penuh dengan slider posisi (penggaris) dan volume yang bisa digeser dengan panah. */
export function PlayerDemo() {
  const [playing, setPlaying] = useState(true);
  const [pos, setPos] = useState(84);
  const [vol, setVol] = useState(65);
  const [liked, setLiked] = useState(false);
  const song = SAMPLE_SONGS[0];
  return (
    <div id="player-demo" className="grid gap-3">
      <PlayerBar
        track={{ title: song.title, artist: song.artist, cover: cover(song.cover) }}
        playing={playing}
        position={pos}
        duration={song.duration}
        volume={vol}
        liked={liked}
        onTogglePlay={() => setPlaying((p) => !p)}
        onPrev={() => setPos(0)}
        onNext={() => setPos(0)}
        onSeek={setPos}
        onVolume={setVol}
        onToggleLike={() => setLiked((l) => !l)}
        onOpenQueue={() => {}}
      />
      <p className="text-small text-muted">
        Coba keyboard: Tab ke slider posisi lalu tekan panah kiri/kanan (±1 dtk), PageUp/PageDown (loncat), Home/End. Pembaca layar
        mengumumkan &ldquo;{`${Math.floor(pos / 60)}:${String(pos % 60).padStart(2, "0")}`} dari 3:42&rdquo; dan &ldquo;{vol}%&rdquo;.
      </p>
    </div>
  );
}

export function FieldDemo() {
  const [value, setValue] = useState("");
  const invalid = value.trim().length === 0;
  return (
    <div className="grid max-w-md gap-6">
      <TextField label="Nama playlist" hint="1–60 karakter." placeholder="mis. Perjalanan malam" />
      <TextField
        label="Judul lagu"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Kosongkan untuk melihat galat"
        error={invalid ? "Judul wajib diisi." : undefined}
        required
      />
      <TextField label="Artis (dikunci)" value="Laras Mendung" disabled readOnly />
    </div>
  );
}

const TOASTS: { kind: StatusKind; message: string; action?: string }[] = [
  { kind: "success", message: "Ditambahkan ke playlist Perjalanan malam.", action: "Urungkan" },
  { kind: "warning", message: "Penyimpanan hampir penuh. Hapus lagu pribadi yang tak terpakai." },
  { kind: "error", message: "File bukan MP3 yang valid. Pilih file .mp3 lain." },
];

/** Dialog modal dan toast. */
export function OverlayDemo() {
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<number[]>([]);
  const add = (i: number) => setToasts((t) => [...t, i]);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Buka dialog
        </Button>
        <Button variant="secondary" onClick={() => add(0)}>
          Toast sukses
        </Button>
        <Button variant="secondary" onClick={() => add(1)}>
          Toast peringatan
        </Button>
        <Button variant="secondary" onClick={() => add(2)}>
          Toast galat
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Hapus playlist?"
        description="Playlist “Perjalanan malam” dan isinya akan dihapus. Lagu di katalog tidak terpengaruh."
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Hapus playlist
            </Button>
          </>
        }
      />
      <ToastRegion>
        {toasts.map((t, i) => (
          <Toast
            key={`${t}-${i}`}
            kind={TOASTS[t].kind}
            actionLabel={TOASTS[t].action}
            onAction={() => setToasts((x) => x.filter((_, j) => j !== i))}
            onDismiss={() => setToasts((x) => x.filter((_, j) => j !== i))}
          >
            {TOASTS[t].message}
          </Toast>
        ))}
      </ToastRegion>
    </div>
  );
}

/** Tampilan ponsel: konten, MiniPlayer, lalu BottomNav (tinggi total sekitar 120px). Ketuk mini-player untuk pemutar penuh. */
export function MobileDemo() {
  const [playing, setPlaying] = useState(true);
  const [full, setFull] = useState(false);
  const [pos, setPos] = useState(84);
  const song = SAMPLE_SONGS[0];
  const track = { title: song.title, artist: song.artist, cover: cover(song.cover) };
  return (
    <div className="grid gap-3">
      <div className="mx-auto flex h-[34rem] w-full max-w-[390px] flex-col border border-control bg-ground">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="font-display text-heading font-medium italic">Beranda</p>
          <p className="mt-2 text-small text-muted">Area konten. Di bawahnya: mini-player satu baris dan navigasi bawah, bukan player bar setinggi ±220px.</p>
        </div>
        <MiniPlayer track={track} playing={playing} progress={<div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-control"><div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${pos / song.duration})` }} /></div>} onTogglePlay={() => setPlaying((p) => !p)} onNext={() => setPos(0)} onOpen={() => setFull(true)} />
        <BottomNav current="/" />
      </div>
      <FullPlayer
        open={full}
        onClose={() => setFull(false)}
        track={track}
        playing={playing}
        position={pos}
        duration={song.duration}
        onTogglePlay={() => setPlaying((p) => !p)}
        onPrev={() => setPos(0)}
        onNext={() => setPos(0)}
        onSeek={setPos}
        onOpenQueue={() => {}}
      />
    </div>
  );
}
