# Profil efisiensi px0 0.1.20

Tanggal ukur: 2026-11-04, 05:38-05:52 WIB.
Tujuan: data pembanding untuk keputusan Workspace rail Herdr app 0.1.12 (panel Files, Git, launcher px0 kustom) versus mengandalkan px0.
Metode: pengukuran lokal read-only, instance scratch terpisah, plus riset docs dan changelog.

## Lingkungan ukur

| Item | Nilai |
| --- | --- |
| Host | Apple M1 Pro, 8 core, 16 GB RAM, macOS 27.2 (26B123) |
| px0 | 0.1.20, binary `~/.local/bin/px0`, `file`: Mach-O 64-bit arm64 |
| Herdr app | 0.1.12, CFBundleIdentifier `dev.herdr.app` |
| px0 user yang berjalan | PID 82419 (workbench) + PID 82755 (workspace child) + PID 82903 (LSP) |
| Sandbox | `ps` dan `top` diblokir; dipakai `pgrep`, `lsof`, `footprint`, libproc via `/tmp/proc_cpu.py` dan `/tmp/proc_bsdinfo.py` |

## 1. Waktu start px0 sampai siap

Metode: spawn `~/.local/bin/px0 -no-open -no-update -no-telemetry -port 0 <scratch-dir>` lewat Python `subprocess`, ukur `time.monotonic()`.
Tiga definisi "siap": (a) baris `url http://127.0.0.1:<port>` muncul, (b) `GET /` mengembalikan 200, (c) baris `indexed N files` muncul.
Setiap run memakai scratch dir di `/tmp`, lalu process group dimatikan dan sisa proses diverifikasi kosong.

| Skenario | n | URL line (median, range) | HTTP 200 (median, range) | Index selesai (median, range) |
| --- | --- | --- | --- | --- |
| Direct mode, proyek kecil (4 file, git) | 5 | 56.8 ms (49.5-75.6) | 69.4 ms (56.9-77.8) | 71.1 ms (67.0-89.7) |
| Direct mode, 500 file `.ts` | 2 | 88.1 ms (84.4-91.8) | 91.7 ms (88.8-94.5) | 113.2 ms (109.9-116.6) |
| Bare `px0` (workbench) saat instance user aktif | 3 | 14.1 ms (13.2-17.2) | 16.7 ms (15.6-19.9) | n/a |

Catatan:
- Server melayani HTTP sebelum indexing selesai (listen-first). Contoh 500 file: HTTP siap 91.7 ms, index selesai 113.2 ms.
- Index 500 file butuh 24-25 ms di dalam proses, sekitar 20.000 file/detik (angka turunan).
- Baris 3 bukan start server baru. Bare `px0` mendeteksi workbench yang sudah jalan di port 7777, lalu keluar ("workbench already running"). Jadi 14-20 ms adalah biaya aktivasi instance yang sudah ada.
- Start workbench baru tidak bisa diukur tanpa menghentikan instance user. Direct mode adalah mode yang dipakai mod SWEG (`px0 <cwd> -port 0`).
- Flag `-no-update` dan `-no-telemetry` dipakai. Tanpa flag itu, px0 memeriksa update dan mengirim telemetry saat start. Dampak ke waktu siap tidak diukur.

## 2. Jumlah proses, RSS, dan CPU idle

Idle = tidak ada request dan tidak ada interaksi UI selama jendela sampel.

| Komponen | PID | Jumlah proses | phys_footprint | Resident (libproc) | CPU idle | Threads |
| --- | --- | --- | --- | --- | --- | --- |
| Direct mode (scratch, mod path) | 2 run | 1 | 11-12 MB | 23.6 MB | 0.0% (15 s) | 13 |
| Workbench user | 82419 | 1 | 12 MB | 13.2 MB | 0.0% (15 s) | 13 |
| Workspace child user | 82755 | 1 | 24 MB | 19.9 MB | 0.0% (15 s) | 18 |
| LSP `typescript-language-server` | 82903 | 1 | 25 MB (peak 27 MB) | 12.0 MB | 0.0% (15 s) | 11 |
| Total workbench + child + LSP | - | 3 | 61 MB | 45.1 MB | 0.0% | - |

Catatan:
- Direct mode tidak meninggalkan child process persisten. Child yang terlihat sesaat adalah proses `git` sementara.
- Angka diri px0 (`/api/metrics`): workbench `rssBytes` 12.6 MiB, child 18.3 MiB, total 30.9 MiB, `lspMemBytes` 11.95 MiB, `cpuUsage` 0.43% (rata-rata siklus hidup, bukan idle sesaat).
- Data diri direct mode: `rssBytes` 12.0 MiB, `peakRSSBytes` 22.4 MiB, `goroutines` 7.
- `phys_footprint` dan resident adalah metrik berbeda. `footprint` menghitung dirty dan compressed memory. Resident ikut menghitung clean shared page.
- CPU idle 0.0% dari sampel 15 detik di semua proses. Docs px0 menyebut mekanisme git watcher berhenti saat tab browser hidden, dan scavenger `debug.FreeOSMemory()` setelah 15 detik idle.
- LSP hanya jalan setelah file dibuka. Jumlah dan ukuran LSP bergantung bahasa yang dipakai.

## 3. Fitur px0 versus panel Files/Git Herdr

Sumber kolom px0: HTML workspace (komentar SECTION), daftar endpoint di `static/app.js`, docs, dan changelog.
Sumber kolom Herdr: mod `files` dan `changes` bawaan Herdr 0.1.12, plus varian kustom `sweg-focus-files` dan `sweg-focus-changes` di `~/.config/herdr-app/mods/`.

| Fitur | px0 0.1.20 | Panel Herdr 0.1.12 (varian SWEG) | Bukti |
| --- | --- | --- | --- |
| File tree | Ya. Tree penuh, mode changed-only, new file/folder, expand/collapse, badge status git, file terhapus | Ya. Lazy file browser per folder space, preview read-only | px0 `/api/tree`, `/api/fs/new`; `files/main.js` "read-only previews" |
| Editor dan tulis file | Ya. Editor virtualized, edit langsung, save, markdown, CSV/TSV table, image viewer | Tidak. Preview `readonly: true`, tanpa save | px0 `/api/file`, `/api/file/save`; `files/main.js:137` |
| Git status dan diff | Ya. Status reaktif (SSE), diff unified/split, gutter | Ya. `git status`, `git diff`, commit message | px0 `/api/git/refresh`, `/api/diff`; `sweg-focus-changes/main.js` |
| Git write | Ya. Stage/unstage per file dan per hunk, commit (auto-stage, pesan AI), push, pull, abort | Sebagian. Hanya `git add -A` lalu `git commit -m` | px0 `/api/git/stage`, `/api/git/hunk`, `/api/git/push`; `sweg-focus-changes/main.js:155-166` |
| Search | Ya. Full-text workspace, fuzzy file finder, symbol palette | Tidak ada search di panel | px0 `/api/search`, `/api/find` |
| LSP | Ya. Server lazy, hover, diagnostics, symbols, references, call trail | Tidak ada | px0 `/api/lsp/*`, `/api/symbols`, `/api/outline` |
| Agent | Ya. Dispatch harness, thread multi-turn, inline/batch edit, snapshot turn | Panel tidak dispatch edit. Agent tetap jalan di terminal | px0 `/api/agent/*`, `/api/threads/*` |
| PR review | Ya. GitHub, GitLab, Gitea, Bitbucket; komentar, submit review, merge | Tidak ada | px0 `/api/pr/*` |
| Terminal | Tidak | Ya (proses inti Herdr) | px0 tidak punya section atau endpoint terminal; README Herdr |
| Integrasi native | Tidak. UI di browser tab | Ya. Pane, layout, live reload | README Herdr; `defaults/AGENTS.md` |

Sumber web: [px0 architecture](https://px0.ai/docs/reference/architecture-and-internals/), [px0 changelog](https://px0.ai/changelog), [px0 README](https://github.com/px0-ai/px0/blob/master/README.md), [Herdr README](https://github.com/herdrdev/herdr-app/blob/master/README.md), [Herdr changelog](https://github.com/herdrdev/herdr-app/blob/master/CHANGELOG.md).

## 4. Arsitektur px0 dan kemungkinan embed ke pane Herdr 0.1.12

| Aspek | Data | Sumber |
| --- | --- | --- |
| Binary | Go static, `go:embed` seluruh frontend, tanpa Node, tanpa CGO, tanpa database | docs architecture; `otool -L` hanya system library |
| Ukuran binary | 15.381.314 byte (14.67 MiB) di disk | `ls -l ~/.local/bin/px0`; docs klaim ~12 MB |
| Transport | HTTP + JSON + SSE di `127.0.0.1`, gzip, `-base-path` untuk reverse proxy | docs architecture |
| Proses | Direct mode 1 proses. Workbench 1 parent + 1 child per workspace + LSP lazy | pengukuran; docs workbench |
| Asset halaman workspace | HTML 57.0 KB (gzip 16.0 KB), `app.js` 623.1 KB (gzip 208.8 KB), `style.css` 155.3 KB (gzip 42.3 KB), `themes.css` 16.8 KB (gzip 4.5 KB). Total gzip sekitar 265 KB | `curl` ke instance yang berjalan |
| Asset halaman workbench | HTML 8.3 KB, `workbench.js` 37.7 KB (gzip 14.0 KB), `workbench.css` 8.0 KB (gzip 2.6 KB) | `curl` |
| Dependensi eksternal UI | Google Fonts (JetBrains Mono) dimuat dari `fonts.googleapis.com`; Mermaid diunduh on demand ke cache lokal | HTML UI; docs |
| Update dan telemetry | Auto-update di background saat start (flag `-no-update`), telemetry aktif secara default (flag `-no-telemetry`), endpoint PostHog ada di binary | `px0 --help`; string binary; changelog v0.1.11 |
| Keamanan | CSP ketat, `frame-ancestors 'none'`, guard `localPost` untuk endpoint write | header HTTP; docs architecture |

Hasil verifikasi embed ke Herdr 0.1.12: tidak mungkin.

- Pane Herdr hanya berisi terminal atau mod panel. "Split a tab into panes to put terminals or mod panels beside each other." ([README](https://github.com/herdrdev/herdr-app/blob/master/README.md))
- Mod tidak bisa memakai web view. "You can't: use HTML, CSS, a web view, Node APIs or `setTimeout`." ([defaults/AGENTS.md](https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md), baris 35; salinan lokal `~/.config/herdr-app/AGENTS.md` ditulis oleh app 0.1.12)
- `herdr-app commands` 0.1.12 tidak punya command browser atau webview. Daftar command hanya space, tab, pane, terminal, agent, layout, mod, app, window.
- Changelog Herdr 0.1.12 (rilis terbaru, 2026-11-02) tidak memuat browser pane atau web view. Seluruh changelog tidak memuat kata browser atau webview.
- `gpui-kit.d.ts` 0.1.12 tidak punya elemen webview. String `web_view` hanya nama accessibility role.
- CSP px0 `frame-ancestors 'none'` juga memblokir iframe seandainya ada pane berbasis web. Catatan: webview native top-level secara teori tidak terkena `frame-ancestors`, tetapi Herdr 0.1.12 tetap tidak punya webview.
- Klaim di `docs/plans/20261103-setup-layout.md` soal `browser open --beside` tidak ditemukan di `herdr-app commands`, docs, atau changelog 0.1.12. Jangan pakai klaim itu sebagai dasar embed.
- Integrasi yang mungkin di 0.1.12: terminal pane menjalankan `px0 <folder> -port 0`, browser sistem membuka UI. Ini persis pola mod `sweg-focus-px0` sekarang.

## 5. Biaya sisi browser

Atribusi yang berhasil: px0 workbench port 7777 punya 3 koneksi ESTABLISHED dari proses network service Chrome (PID 93610), bukan dari renderer tab. Renderer tidak memiliki socket loopback, dan Chrome tidak dibuka dengan remote debugging. Akses DevTools akan mengganggu user, jadi tidak dipakai.

| Objek | phys_footprint | Peak | Resident | CPU idle | Catatan |
| --- | --- | --- | --- | --- | --- |
| Chrome network service PID 93610 | 34 MB | 43 MB | 57.4 MB | 0.0% | Dipakai semua tab; tidak bisa diatribusikan ke px0 saja |
| Kandidat renderer PID 82496 | 48 MB | 60 MB | 38.9 MB | 0.0% (12 s) | Mulai 0.88 detik setelah proses px0 user mulai |
| Kandidat renderer PID 82500 | 65 MB | 118 MB | 51.3 MB | 0.0% (12 s) | Mulai 0.93 detik setelah proses px0 user mulai |

Status: atribusi tepat gagal. Dua renderer kandidat dipilih lewat korelasi waktu mulai dengan start px0 (04:55:42). Tidak ada bukti URL di command line renderer, jadi salah satu atau keduanya bisa milik tab lain.

Estimasi biaya tab px0:
- Rendah: sekitar 48-65 MB `phys_footprint` (39-51 MB resident) per tab, dari kandidat terukur. Label: estimasi.
- Docs px0 menyebut tab browser 80-150 MB (RSS) untuk DOM, V8, dan GPU compositing. Label: klaim vendor.
- Selisih wajar terjadi karena workspace uji kecil dan proses renderer baru idle.
- Browser tidak menambah proses aplikasi baru. Chrome sudah berjalan sejak hari sebelumnya, jadi biaya marginal px0 adalah satu tab, bukan satu runtime browser.
- Biaya yang tidak terukur: porsi GPU process, compositor, font, dan Mermaid on demand.

## 6. Catatan metode dan limitasi

- Instance uji selalu baru: `-port 0 -no-open -no-update -no-telemetry`, cwd scratch di `/tmp`. Process group dimatikan dengan SIGTERM, sisa proses diverifikasi kosong (`pgrep` kosong, direktori scratch dihapus).
- Proses px0 user (82419, 82755, 82903) tidak disentuh. Hanya operasi read-only: `pgrep`, `lsof`, `footprint`, libproc, dan `GET` ke endpoint lokal.
- Tidak ada browser atau app GUI baru yang dibuka. Tidak ada instalasi. `~/.config/herdr-app` hanya dibaca.
- `herdr-app` dipakai read-only: `--version`, `status`, `commands`, `--help`, `--skill`. Tidak ada `herdr-app do` yang mengubah UI.
- Herdr app 0.1.12 tidak punya browser pane. Verifikasi dilakukan dari docs, changelog, daftar command, dan AGENTS.md yang ditulis app itu sendiri.
- Waktu start diukur tanpa update check dan telemetry. Start pertama di mesin nyata bisa berbeda.
- Start workbench baru tidak terukur karena instance user aktif (single-instance mutex).
- Pengukuran hanya di satu host dan satu kondisi. File system cache hangat setelah run pertama. Sampel 500 file hanya 2 run.
- CPU idle dari sampel pendek (12-15 detik). Beban periodik yang lebih jarang dari jendela sampel bisa terlewat.
- `ps` dan `top` diblokir sandbox. Semua data proses berasal dari `pgrep`, `lsof`, `footprint`, dan libproc.
- Klaim vendor di docs tidak diverifikasi ulang: start sub-millisecond, RSS server 20-30 MB, tab 80-150 MB, total 100-180 MB. Angka docs dianggap data eksternal, bukan hasil ukur.

## Sumber

- [px0 Architecture & Systems Internals](https://px0.ai/docs/reference/architecture-and-internals/)
- [px0 Changelog](https://px0.ai/changelog)
- [px0 README (memory accounting)](https://github.com/px0-ai/px0/blob/master/README.md)
- [px0 internal architecture spec](https://github.com/px0-ai/px0/blob/master/docs/internals/architecture.md)
- [Herdr Guide](https://herdr.dev/guide/)
- [Herdr README](https://github.com/herdrdev/herdr-app/blob/master/README.md)
- [Herdr defaults/AGENTS.md](https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md)
- [Herdr CHANGELOG](https://github.com/herdrdev/herdr-app/blob/master/CHANGELOG.md)
- Lokal read-only: `~/.config/herdr-app/AGENTS.md`, `~/.config/herdr-app/mods/files/main.js`, `~/.config/herdr-app/mods/changes/main.js`, `~/.config/herdr-app/mods/sweg-focus-*/main.js`, `~/.config/herdr-app/layouts/SWEG.json`

## Ringkasan untuk keputusan

- px0 murah di sisi server: start sekitar 70 ms, 1-2 proses, footprint 11-24 MB per proses, CPU idle 0%.
- Biaya utama px0 ada di browser: satu tab Chrome, estimasi 48-65 MB footprint dari sampel, klaim docs 80-150 MB.
- px0 menyaingi dan melampaui panel Files/Git Herdr untuk tree, edit, git write, search, LSP, agent, dan PR. Panel Herdr unggul di terminal dan integrasi native.
- px0 tidak bisa di-embed di pane Herdr 0.1.12. Ganti mod dengan px0 berarti tetap memakai browser tab di luar Herdr, bukan panel native di rail.
- px0 workbench singleton: bila sudah jalan, launch berikutnya hanya fokus ke tab yang ada (14-20 ms). Tidak ada duplikasi server.
