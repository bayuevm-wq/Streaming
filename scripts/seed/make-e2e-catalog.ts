// Membuat katalog contoh untuk uji E2E di CI: 3 lagu (MP3 sunyi sintetis, 90 detik, bukan musik), 2 album, 2 artis.
//   node scripts/seed/make-e2e-catalog.ts <folder>   lalu   node scripts/seed.ts --relaxed --catalog <folder>/catalog.json
// Sementara dipakai sampai katalog asli (scripts/seed/catalog.json) diisi.
import { writeSample } from "./make-sample.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("pakai: node scripts/seed/make-e2e-catalog.ts <folder>");
  process.exit(1);
}
console.log(writeSample(dir, "e2e", 89)); // 89 + n detik => 90, 91, 92
