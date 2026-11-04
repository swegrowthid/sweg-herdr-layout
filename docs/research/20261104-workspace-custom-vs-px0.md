# Workspace SWEG: custom Files/Git atau px0

Tanggal: 2026-11-04. Status: data untuk keputusan, belum ada perubahan ke layout live.
Pertanyaan: dari sisi efisiensi Herdr app, panel Files dan Git kustom di Workspace rail lebih baik, atau pakai px0 saja?

Laporan pendukung:
- [custom-mods-cost-audit.md](custom-mods-cost-audit.md) - audit kode, timer, spawn, drift clone.
- [px0-profile.md](px0-profile.md) - start-up, proses, memori, fitur, batas embed px0.

## 1. Ringkasan

Tiga angka menentukan:

1. Biaya runtime rail kustom kecil. Sekitar 90-96 spawn subprocess/menit dan 39 redraw jendela penuh/menit saat idle. CPU app 0,06-0,1%; CPU proses anak sekitar 1,6% dari satu core (0,2% dari 8 core). Memori tambahan sekitar 5-7 MB.
2. Biaya perawatan rail kustom besar. 873 baris mod + 181 baris delta layout. Clone dipin ke Herdr 0.1.12. Upstream bergerak 45 commit dalam 33 jam. Clone tidak ikut update.
3. px0 sudah menutupi fungsi Files dan Git, bahkan melampaui: edit, stage per hunk, commit, push/pull, search, LSP, PR. px0 tetap di browser tab; tidak bisa jadi pane di Herdr 0.1.12.

Kesimpulan: efisiensi Herdr app bukan alasan untuk mempertahankan clone Git kustom. Biaya dominan adalah perawatan dan drift, bukan CPU. px0 memindahkan biaya dari Herdr ke browser: sekitar 45-61 MB footprint server + 48-65 MB footprint tab (estimasi), CPU idle 0%.

Rekomendasi bertahap:
- Tahap 1 (murah, aman): optimasi cepat 3 baris kebijakan - hapus timer 4 s px0, tambah cek `hidden` di files/changes, perlambat footer.
- Tahap 2: hapus `sweg-focus-changes` (206 baris). Percayakan review/commit ke px0.
- Tahap 3 (opsional): kalau rail jarang dipakai, hapus seluruh rail. Herdr jadi lebih dekat stok, dengan tombol `</>` dan `cmd-shift-e` ke px0.

## 2. Kondisi Workspace sekarang

Layout aktif: `SWEG` di `~/.config/herdr-app/layouts/SWEG.json` (isi = `layouts/sweg-focus/` di repo ini).
Enam mod kustom: `sweg-focus-files`, `sweg-focus-changes`, `sweg-focus-panel` (head+foot), `sweg-focus-px0`, `sweg-focus-tabs`, `sweg-focus-menu`. Total 873 baris.

```
SWEG.json root row
-> sidebar 268 px (spaces, agents, footer)
-> workspace 480 px (kolom penuh, dock kiri/kanan)
   -> head  40 px  sweg-focus-panel.part=head
   -> body stack    active: ws-files
      -> ws-files  sweg-focus-files   timer 10 s -> sh + 2 git
      -> ws-git    sweg-focus-changes timer 10 s -> 4-5 git
      -> ws-px0    sweg-focus-px0     timer 4 s  -> notify saja
   -> foot  28 px  sweg-focus-panel.part=foot -> timer 5 s -> 4 git
-> work
   -> tabs   sweg-focus-tabs (timer 2 s, cek dock, tanpa spawn)
   -> terminal + header sweg-pane
   -> status workspace-status + system-stats (timer 5 s -> sh + top)
```

Pemetaan biaya yang tidak terlihat: satu timer adalah satu wakeup. Satu `cx.notify()` menggambar ulang seluruh jendela (aturan resmi `~/.config/herdr-app/AGENTS.md`). View yang pernah tampil tetap hidup walau rail disembunyikan; timer-nya terus jalan.

## 3. Metode ukur

- Host: Apple M1 Pro, 8 core, 16 GB RAM, macOS 27.2. Herdr app 0.1.12 (PID 28892 saat ukur). px0 0.1.20.
- Sampling spawn: libproc via ctypes (`proc_listpids` + `proc_pidinfo`), interval 10 ms. `ps` dan `top` diblokir sandbox.
- Sampling CPU/RSS: libproc `PROC_PIDTASKINFO`, jendela 60-90 detik.
- Benchmark CPU anak: `resource.getrusage(RUSAGE_CHILDREN)` atas perintah git/sh yang sama dengan kode mod.
- A/B layout: rail tampil (SWEG), rail disembunyikan (`layout.toggle`), `main`, `terminals` (tanpa mod panel). App dikembalikan ke SWEG setelah ukur; hash `SWEG.json` sama (`f1c72aa4`), tanpa overlay sisa.
- Konteks ukur tidak sepi total: agent di terminal sempat menulis file. Angka spawn adalah rentang, bukan konstanta. Angka per mod dari kode dan dari [audit](custom-mods-cost-audit.md).

## 4. Data pembanding

### 4.1 Runtime Herdr app per state

| State | Spawn/menit | Redraw jendela/menit | CPU app | Keterangan |
| --- | --- | --- | --- | --- |
| SWEG, rail tampil (ketiga view pernah tampil) | 90-96 (model); 100-140 (sampel total) | 39 | 0,06-0,1% | Model: files 18 + changes 24-30 + footer 48. Sampel total termasuk `system-stats` 12-18 |
| SWEG, rail disembunyikan | 42-48 | 27 | 0,06% | Footer berhenti (cek hidden). Files/changes/px0 tetap jalan |
| `main` (shipped, panel hidden) | 42-48 (model); ~40 (sampel) | 12 | 0,06% | Shipped files+changes juga polling 10 s |
| `terminals` (tanpa mod panel) | ~1 | 0 | 0,18% (noise) | Baseline bersih |
| Rail dihapus (hitungan) | 0-18 | 0-6 | - | Sisa `system-stats` dan tabs saja |

RSS Herdr: 58-65 MB saat rail tampil; 58 MB saat disembunyikan. Selisih rail sekitar 5-7 MB, tetapi angka ini bising karena isi terminal ikut berubah.

### 4.2 CPU proses anak per siklus

Benchmark perintah yang sama dengan kode mod, repo ini:

| Siklus | Perintah | CPU/eksekusi | Frekuensi | CPU/menit |
| --- | --- | --- | --- | --- |
| Footer | 4 git | 43,5 ms | 12/menit | 522 ms = 0,87% 1 core |
| Files | sh + 2 git | 26,5 ms | 6/menit | 159 ms = 0,26% 1 core |
| Changes | 4 git | 42,9 ms | 6/menit | 257 ms = 0,43% 1 core |
| **Total rail** | - | - | - | **938 ms = 1,56% 1 core = 0,2% 8 core** |
| system-stats (shipped) | sh + top | 13,2 ms | 12/menit | 158 ms = 0,26% 1 core |

Catatan: GPU dan biaya energi redraw tidak terukur. Angka ini menjelaskan mengapa CPU app terlihat rendah: CPU anak masuk proses terpisah.

### 4.3 Duplikasi kerja

48 dari 90-96 spawn/menit (50-53%) adalah perintah kembar:

| Perintah | Footer 5 s | Files 10 s | Changes 10 s | Total/menit |
| --- | --- | --- | --- | --- |
| `git rev-parse --show-toplevel` | 12 | 6 | 6 | 24 |
| `git status --porcelain` | 12 | 6 | 6 | 24 |

Tiga mod membaca state git yang sama tanpa state bersama.

### 4.4 Memori: rail vs px0

| Komponen | Phys footprint | Resident | CPU idle | Proses |
| --- | --- | --- | --- | --- |
| Rail kustom (di dalam Herdr) | +5-7 MB | +5-7 MB | 0,06-0,1% app + 1,56% 1 core anak | 0 tambahan permanen |
| px0 workbench + child + LSP (sudah berjalan) | 61 MB | 45,1 MB | 0,0% | 3 |
| px0 server direct mode (saat dipakai mod) | 11-12 MB/run | 23,6 MB | 0,0% | 1 sementara |
| Tab browser px0 (estimasi) | 48-65 MB | 39-51 MB | 0,0% | renderer sudah ada |
| Klaim vendor px0 untuk tab | 80-150 MB RSS | - | - | - |

Estimasi total px0 di sistem: 93-126 MB untuk workbench + 1 tab, sebelum renderer/font/Mermaid. Browser sudah berjalan, jadi yang ditambah adalah satu tab, bukan satu runtime browser baru.

### 4.5 Latensi dan UX

| Aspek | Rail kustom | px0 |
| --- | --- | --- |
| Waktu sampai terlihat | instan, di dalam jendela | server siap 69 ms; aktivasi singleton 14-20 ms, lalu pindah app ke browser |
| Konteks | sejajar terminal, satu jendela | tab browser terpisah; perlu pindah app |
| File tree | ya, read-only | ya, plus edit dan save |
| Git diff / commit | status, diff, `git add -A` + commit | status, diff, stage per hunk, commit, push, pull |
| Search / LSP | tidak ada | ya |
| PR | tidak ada | ya |
| Ikut repo space | ya (kustom) | ya (dibuka per folder) |
| Embed di pane Herdr | ya | tidak bisa; Herdr 0.1.12 tidak punya browser pane |

### 4.6 Perawatan dan drift

| Item | Nilai |
| --- | --- |
| Kode mod kustom | 873 baris (clones 517 + mod baru 356) |
| Diff clone vs shipped 0.1.12 | +99/-67 (files +14/-11, changes +10/-11, tabs +75/-45) |
| Diff layout vs `main` | +95/-39 (181 baris) |
| Key kustom | 6 |
| Duplikasi helper | `place()`/`location()` di 4 mod; parsing git di 3 mod |
| Upstream sejak v0.1.12 | 45 commit, 51 file, ~33 jam; `files/main.js` sudah +13/-5 |
| Riwayat v0.1.4 -> v0.1.12 | 205 commit, 8 rilis, 10 hari; files/changes/tabs ketiganya berubah |
| Browser pane Herdr | tidak ada di 0.1.12; PR #235 masih draft; issue #425 closed "not planned" |

Klaim di `docs/plans/20261103-setup-layout.md` soal `Herdr px0 open`, `code open`, dan `browser open --beside` tidak terbukti untuk herdr-app 0.1.12. Jangan dipakai sebagai dasar keputusan.

## 5. Interpretasi

```
Biaya rail kustom saat ini
-> runtime      kecil      (0,2% total CPU, 5-7 MB, 1,5 wakeup/detik)
-> maintenance  besar      (873 baris clone, drift cepat, merge manual tiap update)
-> UX           unik        (panel in-window, footer selalu terlihat, ikut space)
```

```
Biaya px0-only
-> runtime      sedang      (93-126 MB, CPU ~0%, 1 proses tambahan saat dipakai)
-> maintenance  kecil      (0 mod clone; app diupdate vendor)
-> UX           konteks     (pindah ke browser, fitur jauh lebih lengkap)
```

Yang perlu dicatat:

1. Efisiensi CPU bukan pembeda besar. Rail kustom hanya ~0,2% total CPU. Bedanya terasa di wakeup dan baterai, bukan di angka CPU.
2. Efisiensi memori berpihak ke rail kustom: 5-7 MB versus 93-126 MB.
3. Efisiensi perawatan dan fitur berpihak ke px0: 873 baris clone hilang, fitur git jauh lebih lengkap.
4. Membuka view Git sekali menambah 24-30 spawn/menit permanen sampai layout switch atau restart.
5. Rail yang disembunyikan tetap membayar 42-48 spawn/menit. Ini murni pemborosan.
6. `system-stats` (shipped) memakan 12-18 spawn/menit sendiri. Ini di luar rail, tetapi masuk tagihan layout.

## 6. Opsi keputusan

| Opsi | Spawn/menit idle | Redraw/menit | Kode yang dirawat | Kapan masuk akal |
| --- | --- | --- | --- | --- |
| A. Status quo | 90-96 | 39 | 873 baris + 6 key | Tidak disarankan sebagai steady state |
| B. Hybrid: buang clone Git, simpan Files + launcher | 18-26 | 12-18 | 873 - 206 = 667 baris | Glance in-window penting, commit/push dikerjakan di px0 |
| C. px0-only: hapus rail | 0-18 | 0-6 | 0 baris mod rail (sisa `sweg-pane`, `sweg-menu`) | Review/commit/PR memang dikerjakan di px0 |
| D. Rail + optimasi cepat | 35-50 | 12-16 | 873 baris | Tetap ingin rail penuh, tetapi mau hemat wakeup |

Optimasi cepat opsi D, urut dampak:
1. Hapus `cx.timer.every(4000)` di `sweg-focus-px0/main.js:57`. Live data sudah memicu render. Hemat 15 redraw/menit.
2. Tambah cek `hidden` di awal `refresh()` files dan changes (pola `sweg-focus-panel/main.js:65`). Hemat 42-48 spawn/menit saat rail disembunyikan.
3. Naikkan interval footer dari 5 s ke 15-30 s, atau ganti ke `watchFolder`. Hemat 24-32 spawn/menit.
4. Satukan pembacaan git antar tiga mod. Hemat sampai 48 spawn/menit, tetapi menambah coupling. Paling akhir.

## 7. Rekomendasi

Mulai dari yang murah, lalu putuskan dengan data pemakaian nyata.

Tahap 1 - tambal pemborosan (30 menit, risiko rendah):
- Hapus timer 4 s px0.
- Tambah cek `hidden` di files/changes.
- Ubah interval footer ke 15 s, atau hanya folder + branch.
Hasil: 90-96 turun ke sekitar 60-70 spawn/menit saat tampil, 0 saat disembunyikan. UX tidak berubah.

Tahap 2 - uji px0 sebagai pengganti Git panel (1 minggu):
- Sembunyikan view Git; commit/push dari px0.
- Catat berapa kali view Git dibuka. Kalau hampir tidak pernah, lanjut tahap 3.

Tahap 3 - hapus clone yang tidak dipakai:
- Hapus `sweg-focus-changes` dan polling git di footer. Rail tinggal Files + px0 launcher.
- Hasil: sekitar 18-26 spawn/menit, 12-18 redraw/menit, 206 baris lebih sedikit, satu clone lebih sedikit untuk dirawat.

Tahap 4 - kalau rail jarang dipakai:
- Hapus seluruh rail dan 5 mod-nya. Pertahankan `sweg-pane` (`</>` + `cmd-shift-e`) dan `sweg-menu`.
- Hasil: Herdr kembali ramping; Files/Git sepenuhnya di px0.

Alasan memilih jalur bertahap: data runtime menunjukkan rail tidak merusak performa. Yang mahal adalah perawatan jangka panjang. Menghapus semuanya sekarang berisiko membuang UX yang sengaja dibangun. Menyimpan semuanya berarti membayar drift tanpa henti. Jalur bertahap memisahkan dua hal itu.

## 8. Limitasi

- Angka spawn bervariasi 100-140/menit pada sampel karena `watchFolder` tidak memakai debounce. Build atau agent yang menulis banyak file membuat burst.
- CPU anak tidak termasuk GPU dan energi; redraw jendela penuh 39/menit belum dihargai dalam ms.
- Atribusi memori tab browser adalah estimasi korelasi waktu, bukan bukti URL per renderer.
- Hanya satu host, satu repo kecil, dan filesystem cache hangat.
- Snapshot upstream bergerak cepat; angka commit bisa basi dalam hitungan jam.
- A/B layout memakai switch singkat ke `main` dan `terminals`. App sudah dikembalikan ke SWEG; satu overlay yang semula terbuka ditutup.
