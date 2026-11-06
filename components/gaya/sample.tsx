// Data dan sampul CONTOH untuk halaman /gaya. Fiktif; bukan konten katalog.
export const SAMPLE_SONGS = [
  { id: "s1", title: "Malam Belum Selesai", artist: "Laras Mendung", album: "Lampu Kota", duration: 222, cover: 1 },
  { id: "s2", title: "Kota Tanpa Bunyi", artist: "Ombak Kecil", album: "Setengah Sadar", duration: 245, cover: 2 },
  { id: "s3", title: "Surat untuk Kemarin", artist: "Rintik", album: "Lembah Sunyi", duration: 178, cover: 3 },
  { id: "s4", title: "Jalan Pulang Panjang", artist: "Laras Mendung", album: "Lampu Kota", duration: 311, cover: 1 },
] as const;

/** Tiga sampul vektor contoh (warna sengaja beragam: sampul pengguna tak bisa dikendalikan). */
export function SampleCover({ n }: { n: number }) {
  if (n === 2) {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="100" fill="#C9553D" />
        <path d="M0 70 L100 20 V45 L0 95Z" fill="#F4D9B8" />
        <path d="M0 30 L100 -20 V0 L0 50Z" fill="#2B1B17" />
      </svg>
    );
  }
  if (n === 3) {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="100" fill="#2F6F73" />
        <circle cx="72" cy="26" r="9" fill="#F6EFD9" />
        <path d="M0 70 Q25 40 50 62 T100 55 V100 H0Z" fill="#E0B14A" />
        <path d="M0 85 Q30 62 60 80 T100 74 V100 H0Z" fill="#1B3B3E" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="100" fill="#1E2A5A" />
      <circle cx="64" cy="40" r="26" fill="#F3E6C8" />
      <circle cx="30" cy="74" r="10" fill="#F28C4B" />
      <rect y="78" width="100" height="22" fill="#121A3D" />
    </svg>
  );
}
