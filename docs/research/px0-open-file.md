# Buka file di px0 0.1.20 yang sudah berjalan

Tanggal: 2026-11-04. Status: riset teruji di instance terisolasi. Belum ada perubahan kode.
Pertanyaan: kalau user klik file di panel Herdr, apakah file itu bisa langsung terbuka di tab browser px0 yang sudah ada, tanpa pane baru?
Sumber utama: source px0 tag `v0.1.20` (`https://github.com/px0-ai/px0`, clone di `/tmp/px0-src` dan ekstrak tag di `/tmp/px0-0120`), binary `~/.local/bin/px0` 0.1.20, docs px0.

## 1. Jawaban tegas (a)

**Tidak.** px0 0.1.20 tidak punya mekanisme native untuk membuka file/line di browser tab yang sudah terbuka.

Yang tersedia hanya tiga permukaan:

| Kebutuhan | Mekanisme px0 0.1.20 | Hasil |
| --- | --- | --- |
| Buka file di tab browser yang sudah ada | Tidak ada IPC, tidak ada endpoint push, tidak ada URL scheme | Tidak bisa tanpa browser automation |
| Buka file di tab browser baru | Deep link URL `?path=<rel>&line=<n>` | Bisa, halaman reload dan px0 membuka file di editor internal |
| Buka file tanpa pane Herdr baru | CLI `px0 <file>:<line>` atau helper HTTP ke workbench | Bisa, tetapi menambah proses px0 dan/atau tab browser |

Jadi opsi A "klik file di Herdr, file terbuka di tab px0 existing" **tidak layak** sebagai jalur native px0. Opsi itu layak sebagai **"buka URL deep link di tab baru"**, atau sebagai **"navigasi tab existing lewat browser automation"** (AppleScript/JXA, butuh izin Automation, rapuh).

Bukti terkuat: CLI `px0 <file>` selalu spawn server baru, dan tidak ada endpoint atau socket untuk menyuruh UI yang sudah terbuka membuka file.

## 2. Alur yang terlibat

Production:

```ts
Herdr file click
  → helper (mod)
    → workbench lock file (~/.px0/workbench.lock)          ← hanya workbench yang punya lock
    → GET /api/wb/ping (workbench)
    → wbItemID(root) = sha256("dir\x00" + realpath(root))[:12]
    → POST /api/wb/open {"target": root} (workbench)       ← start atau reuse child px0
    → GET  /api/wb/state (poll state == "running")
    → deep link: <wb>/w/<id>/?path=<rel>&line=<n>
      → reverse proxy → child px0
        → browser load: web/src/main.js baca ?path= dan ?line=
          → openFile(rel, {line}) di editor internal px0
```

Kunci: langkah terakhir berjalan **saat halaman dimuat**. Tidak ada jalur runtime untuk mengirim perintah "buka file" ke halaman yang sudah hidup.

## 3. Tabel bukti uji

Semua uji memakai instance sendiri. Lingkungan: macOS, px0 0.1.20, `XDG_STATE_HOME`/`XDG_CONFIG_HOME`/`XDG_CACHE_HOME` diarahkan ke `/tmp/px0-isolated`, semua proses dimatikan setelah uji. Browser tidak dibuka; `BROWSER` diganti stub yang hanya mencatat URL.

| # | Permukaan | Command/request yang diuji | Hasil teramati | Kesimpulan |
| --- | --- | --- | --- | --- |
| 1 | CLI `file:line` | `px0 -no-open -port 0 ... /tmp/px0-isolated/ws/a.go:3` | `url http://127.0.0.1:58620?line=3&path=a.go` | CLI mem-parse line, spawn server baru, tidak membuka browser dengan `-no-open` |
| 2 | CLI kedua, target sama | command yang sama saat instance #1 hidup | `url http://127.0.0.1:58630?line=3&path=a.go`; dua proses hidup | Tidak ada single-instance forwarding untuk target file |
| 3 | CLI di git repo | `cd gitrepo; px0 ... src/x.go:3` | `workspace /private/tmp/px0-isolated/gitrepo`, `url http://127.0.0.1:58696?line=3&path=src%2Fx.go` | Root = git top-level; path relatif; `/` di-encode |
| 4 | CLI `line:col` | `px0 ... a.go:7:5` | `url ...?line=7&path=a.go` | Kolom dibuang; hanya line dipakai |
| 5 | CLI bare, workbench hidup | `px0` tanpa argumen, `BROWSER=stub` | stdout `✓ workbench already running http://127.0.0.1:58634`; stub menerima URL yang sama; exit 0 | Reuse hanya untuk workbench; argumen file tidak diteruskan |
| 6 | CLI file, workbench hidup | `px0 ... b.md:4` tanpa `-port` | `url http://127.0.0.1:7778?line=4&path=b.md`; stub menerima URL itu | Instance baru (7777 milik user sibuk, walk ke 7778); tab browser baru |
| 7 | HTTP workbench ping | `GET /api/wb/ping` | `{"version":"0.1.20","workbench":true}` HTTP 200 | Workbench bisa dideteksi |
| 8 | HTTP workbench state | `GET /api/wb/state` | JSON `items[]` berisi `id`, `path`, `state`, `href=/w/<id>/`; HTTP 200 | Daftar workspace bisa dibaca |
| 9 | HTTP workbench open, tanpa Origin | `POST /api/wb/open` body `{"target":"/tmp/px0-isolated/ws"}` | `{"error":"request did not come from px0"}` HTTP 403 | POST butuh header `Origin` yang sama dengan `Host` |
| 10 | HTTP workbench open, dengan Origin | header `Origin: http://127.0.0.1:58634` | `{"href":"/w/9f244893920a/","id":"9f244893920a"}` HTTP 200 | Workbench bisa start child dari luar UI |
| 11 | HTTP open target file | body `{"target":"/tmp/px0-isolated/ws/a.go"}` dan `a.go:7` | `{"href":"/w/9f244893920a/","id":"9f244893920a"}` HTTP 200; jumlah child tetap 1 | Target file diterima, tetapi file/line dibuang; hanya root workspace yang dipakai |
| 12 | Deep link child hidup | `GET /w/9f244893920a/?path=a.go&line=3` | HTTP 200, 57025 byte, `<base href="/w/9f244893920a/">`; `static/app.js` memuat kode pembaca `?path=`/`?line=` | Deep link dikirim ke browser; pembukaan file terjadi di JS |
| 13 | Child tidak hidup | `POST /api/wb/stop`, lalu `GET /w/9f244893920a/?path=a.go&line=3` | HTTP 200, 1126 byte, holding page dengan `refresh content="1; url=/w/9f244893920a/"` | Query `path`/`line` hilang saat child dingin; file tidak terbuka |
| 14 | Path relatif | `GET /w/9f244893920a/api/file?path=sub/c.go&start=0&count=3` | HTTP 200, JSON lines | Path workspace-relatif dipakai |
| 15 | Path absolut | `GET /w/9f244893920a/api/file?path=/tmp/px0-isolated/ws/a.go` | HTTP 400 `{"error":"bad path"}` | Deep link harus pakai path relatif root workspace |
| 16 | ID workspace | `sha256("dir\x00" + "/private/tmp/px0-isolated/ws")[:12]` | `9f244893920a` = id hasil #10 | Formula ID terkonfirmasi |
| 17 | ID dengan path literal | `sha256("dir\x00" + "/tmp/px0-isolated/ws")[:12]` | `bc9406652f43` (beda) | Wajib `realpath`/resolve symlink sebelum hitung ID; di macOS `/tmp` -> `/private/tmp` |
| 18 | ID repo user | `sha256("dir\x00" + "/Users/kyomel/eay-kyomel/sweg-herdr-layout")[:12]` | `3c2a6cf2a86c` = base-path child user 82755 | Workspace user bisa dihitung tanpa request ke port user |
| 19 | CLI help | `px0 --help` | Hanya flag server; tidak ada subcommand "open in running instance" | Tidak ada celah CLI |
| 20 | Route server | grep `routePath` untuk `/api/` di `server.go` v0.1.20 | Tidak ada route open/focus/reveal; `/api/stream` hanya SSE keluar | Tidak ada endpoint push ke UI |
| 21 | Cleanup | kill semua PID uji | `pgrep -fl px0` sisa hanya `82419 px0` dan child user `82755`; port uji kosong; lock user tetap `{"pid":82419,"url":"http://127.0.0.1:7777"}` | Instance user tidak tersentuh |

## 4. Permukaan open-file yang ada

### 4.1 CLI

- `px0 <file>` dan `px0 <file>:<line>` memakai `splitTargetLine` untuk mem-parse `:line` atau `:line:col`. Hanya line yang dipakai; kolom dibuang.
- Tiga aturan root: git top-level, cwd (kalau target relatif di dalam cwd), atau parent dir file.
- URL browser dibuat oleh `viewerURL` dengan query `path` dan `line`.
- CLI selalu membuka workbench (tanpa target) atau server standalone (dengan target). Tidak ada single-instance forwarding untuk target.
- Bare `px0` memakai `runningWorkbench()`: baca lock, ping `/api/wb/ping`, lalu panggil `openBrowser(u)` kalau browser launch aktif (tanpa `-no-open`). File target tidak pernah diteruskan.
- `listen` mencoba port yang diminta sampai +100. Kalau port default 7777 sibuk, instance baru mengambil 7778 (teruji #6). Port pilihan tidak dicatat di file mana pun untuk server standalone.

### 4.2 HTTP API

- Workbench: `/api/wb/ping`, `/api/wb/state`, `/api/wb/open`, `/api/wb/stop`, `/api/wb/pin`, `/api/wb/remove`, `/api/wb/browse`, `/api/wb/complete`.
- `POST` untuk aksi butuh `Origin` yang sama dengan `Host` (`localPost`). GET state cukup lewat `trustedGet` (Host harus IP atau localhost). Tidak ada token; proses lokal mana pun bisa memanggil dengan header yang benar.
- `/api/wb/open` hanya membuka **workspace root**. Target file atau `file:line` diterima, tetapi `wb.resolveTarget` mengembalikan `wbDirItem(root)`. File dan line hilang (uji #11).
- Child workspace: `/api/file` membaca file untuk render. Ini GET read-only; tidak mengubah tab UI.
- `/api/stream` adalah one-way SSE server ke browser. Tidak ada endpoint untuk menyuntik event ke UI.

### 4.3 Deep link URL

Dua bentuk:

1. Server standalone: `http://127.0.0.1:<port>/?path=<rel>&line=<n>`
2. Workbench child: `http://127.0.0.1:<wb-port>/w/<id>/?path=<rel>&line=<n>`

Perilaku yang teruji:

- Halaman hanya membaca query **saat load**. `web/src/main.js` memanggil `openFile(path, {line})`, lalu menghapus `path`/`line` dari address bar dengan `history.replaceState`. Reload setelah itu kembali ke tampilan default workspace.
- Kalau child sedang mati, proxy mengembalikan holding page. Meta refresh-nya menuju `/w/<id>/` **tanpa query**, jadi `path`/`line` hilang (uji #13). Urutan yang benar: pastikan child `running` dulu, baru buka deep link.
- Path harus relatif terhadap root workspace. Path absolut ditolak, kecuali path yang sudah diberi tahu LSP ke server.
- Tidak ada hash route, tidak ada `px0://`, tidak ada skema URL yang didaftarkan. `install.sh` dan source tidak berisi skema URL.

### 4.4 Fokus/navigasi tab browser (c)

- px0 tidak pernah mengontrol tab browser. `openBrowser` di macOS menjalankan `open <url>`. Perintah `open` menyerahkan URL ke LaunchServices dan default browser umumnya membuka **tab baru**. Tidak ada cara menunjuk tab existing lewat `open`.
- px0 juga tidak tahu tab mana yang menampilkan instance-nya. Tidak ada heartbeat atau daftar klien.
- Jalur native untuk menavigasi tab existing tidak ada. Pilihan yang tersisa:
  1. Buka tab baru (paling sederhana, teruji sampai batas URL).
  2. AppleScript/JXA ke browser: set URL tab aktif atau tab yang cocok. Butuh izin Automation, dictionary per browser, dan rapuh saat browser berganti. Tidak diuji di sesi ini (tidak membuka browser).
  3. Kalau nanti Herdr sendiri yang memiliki tab web (browser tab bawaan Herdr), navigasi tab jadi tanggung jawab Herdr, bukan px0. Herdr 0.1.12 yang terpasang belum punya perintah ini: `herdr-app --version` = 0.1.12, dan `herdr-app commands` tidak berisi perintah browser/px0. Skill `herdr-gpui-browser` yang terpasang menjelaskan versi Herdr lain (ada `Herdr browser open` dan `Herdr px0 open`), jadi jangan anggap itu tersedia di 0.1.12.
- Fokus window: `open <url>` biasanya mengaktifkan browser dan mencuri fokus dari Herdr. `open -g` menghindari fokus, tetapi tetap menambah tab baru.

## 5. Resep yang sudah diuji (b)

### A. Reuse workbench + child yang sudah hidup, lalu buka deep link di tab browser

Ini jalur dengan proses px0 paling sedikit: tidak ada server baru, tidak ada pane Herdr baru. Batas: tetap tab browser baru.

```bash
# 1. Cari workbench yang hidup (lock hanya ada untuk workbench).
if [ -n "$XDG_STATE_HOME" ]; then STATE_DIR="$XDG_STATE_HOME/px0"; else STATE_DIR="$HOME/.px0"; fi
LOCK="$STATE_DIR/workbench.lock"
WB_URL=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["url"])' "$LOCK")
curl -sf "$WB_URL/api/wb/ping"   # {"version":"0.1.20","workbench":true}

# 2. Tentukan root workspace. Pakai git top-level kalau ada, lalu realpath.
ROOT=$(realpath "$(git -C /path/to/repo rev-parse --show-toplevel 2>/dev/null || echo /path/to/repo)")

# 3. Pastikan child hidup. POST butuh Origin yang sama dengan Host. Ambil id dari respons.
RESP=$(curl -sf -X POST "$WB_URL/api/wb/open" \
  -H 'Content-Type: application/json' -H "Origin: $WB_URL" \
  -d "{\"target\":\"$ROOT\"}")
ID=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["id"])' "$RESP")
# Polling GET /api/wb/state sampai item dengan id itu state == "running".
curl -sf "$WB_URL/api/wb/state"

# 4. Hitung path relatif, lalu buka deep link. Ini yang membuka file di editor internal px0.
REL=$(python3 -c 'import os,sys,urllib.parse; print(urllib.parse.quote(os.path.relpath(sys.argv[1], sys.argv[2])))' "/path/to/repo/src/x.go" "$ROOT")
open "$WB_URL/w/$ID/?path=$REL&line=42"
```

Catatan dari uji: langkah 3 wajib sebelum langkah 4. Kalau child dingin, langkah 4 hanya menampilkan holding page dan query hilang.

Kalau tidak mau memanggil POST, id workspace yang sudah hidup bisa dihitung langsung: `sha256("dir\x00" + realpath(root))[:12]`. Formula ini terverifikasi di uji #16 sampai #18. Hasil hash harus sama dengan `id` dari `/api/wb/state`.

Contoh turunan untuk repo ini, memakai child yang sudah jalan di mesin user: `http://127.0.0.1:7777/w/3c2a6cf2a86c/?path=docs%2Fresearch%2Fpx0-open-file.md&line=1`. URL ini tidak diuji ke port user; angkanya berasal dari bukti #18 dan lock user.

### B. CLI per file, tanpa workbench

```bash
px0 "/path/to/repo/src/x.go:42" -port 0 -no-update -no-telemetry
```

Hasil: server px0 baru di port acak, browser tab baru dengan URL `http://127.0.0.1:<port>/?line=42&path=src%2Fx.go`. `-no-open` mencegah tab browser. Cara ini dipakai mod SWEG sekarang (lewat `pane.split`), tetapi menambah pane Herdr dan proses.

### C. Reuse server standalone yang sudah hidup

```bash
# Harus tahu port-nya. px0 standalone tidak menulis lock/port file.
# Opsi: jalankan px0 dengan -port tetap, catat port itu saat start.
open "http://127.0.0.1:7788/?path=src%2Fx.go&line=42"
```

Tidak ada cara menemukan port server standalone yang sudah jalan dari luar. Satu-satunya sumber adalah stdout CLI di pane. Workbench mode menghilangkan masalah ini.

### D. Navigasi tab existing lewat browser automation (belum diuji)

```bash
# Contoh Chrome; butuh izin Automation. Nama aplikasi dan dictionary berbeda per browser.
osascript -e 'tell application "Google Chrome" to set URL of active tab of front window to "http://127.0.0.1:7777/w/3c2a6cf2a86c/?path=docs%2Fresearch%2Fpx0-open-file.md&line=1"'
```

Risiko: izin macOS, browser harus sedang jalan, tab aktif salah, dan perilaku berbeda di Safari/Arc/Firefox. Jangan jadikan jalur utama.

## 6. Batasan dan risiko (d)

1. **Tidak ada push ke tab existing.** Semua jalur memaksa load halaman (tab baru atau automation). px0 tidak punya IPC.
2. **Tab dingin kehilangan file.** Deep link ke child yang mati berakhir di holding page tanpa query. Wajib pre-warm.
3. **Satu klik satu tab.** Deep link tidak memakai ulang tab. Setelah beberapa klik, banyak tab px0 baru.
4. **Address bar dibersihkan.** px0 menghapus `path`/`line` setelah open. Bookmark atau reload tidak membuka file yang sama.
5. **Fokus browser.** `open` mengaktifkan browser dan mencuri fokus dari Herdr. `open -g` mengurangi itu, tetapi tab tetap baru.
6. **Path harus relatif root.** Path absolut ditolak. Root harus dihitung dengan aturan px0: git top-level, cwd, atau parent dir, lalu `realpath` (symlink seperti `/tmp` -> `/private/tmp` mengubah ID).
7. **ID workspace wajib cocok.** Salah hitung ID berarti menulis workspace baru, bukan memakai yang sudah hidup. Verifikasi dengan `GET /api/wb/state`.
8. **API workbench tanpa autentikasi.** Proses lokal mana pun bisa memanggil `POST /api/wb/open` dengan header `Origin`/`Host` yang benar. Mod harus memvalidasi path dari klik user; jangan meneruskan teks bebas.
9. **Idle stop child.** Child tanpa tab aktif dihentikan setelah 30 menit. Klik berikutnya harus pre-warm lagi.
10. **Port standalone tidak bisa ditemukan.** Untuk server standalone acak, tidak ada lock atau file port. Reuse hanya mungkin kalau port dipatok.
11. **Herdr 0.1.12 belum punya browser tab.** Perintah `browser`/`px0` dari skill Herdr tidak ada di versi terpasang, jadi tidak bisa dipakai sebagai kanal navigasi sekarang.
12. **Tidak teruji dengan browser nyata.** Sesi ini tidak membuka browser. Bukti berhenti di URL, HTTP, dan kode JS. Perilaku dedupe tab atau fokus harus diuji manual di browser user.

## 7. Kesimpulan untuk opsi A

- **Native px0: tidak layak.** Tidak ada cara membuka file di tab browser yang sudah ada. px0 0.1.20 tidak punya IPC, endpoint push, atau URL scheme.
- **Layak dengan kompromi:** klik file menghasilkan URL deep link dan membuka **tab browser baru**. Kalau px0 workbench sudah jalan dan child workspace untuk repo itu hidup, tidak ada proses px0 baru dan tidak ada pane Herdr baru. Ini opsi termurah.
- **Layak hanya dengan browser automation:** navigasi tab existing. Butuh izin macOS, kode per browser, dan fallback ke tab baru.
- **Rekomendasi untuk mod Herdr:** tahap 1, buat helper yang membaca lock workbench, hitung ID, pre-warm child lewat `/api/wb/open`, lalu `open "<deep-link>"`. Sediakan fallback `px0 <file>:<line>` kalau workbench tidak ada. Tahap 2 (opsional), kalau user memakai browser yang bisa di-script, tambah kanal navigasi tab existing dengan izin eksplisit.
- **Pertanyaan terbuka untuk sisi Herdr:** apakah versi Herdr berikutnya punya browser tab internal yang bisa dinavigasi ke URL arbitrer dan memakai ulang tab yang sama. Kalau ya, deep link px0 bisa dipasang di sana tanpa browser automation. Perlu riset terpisah.

## 8. Metode, lingkungan, dan pembersihan

- Host: macOS, px0 0.1.20 darwin/arm64 di `~/.local/bin/px0`.
- Instance user sebelum dan sesudah: `82419 px0` (workbench, 127.0.0.1:7777) dan `82755` (child, base-path `/w/3c2a6cf2a86c/`, repo `sweg-herdr-layout`). Tidak ada request atau aksi ke port 7777.
- State user dibaca read-only: lock `~/.px0/workbench.lock` berisi `{"pid":82419,"url":"http://127.0.0.1:7777"}`.
- Semua eksperimen: instance sendiri dengan `-no-open -port 0 -no-update -no-telemetry -no-lsp -no-agent`, `XDG_STATE_HOME=/tmp/px0-isolated/state`, `XDG_CONFIG_HOME=/tmp/px0-isolated/config`, `XDG_CACHE_HOME=/tmp/px0-isolated/cache`. Port teramati: 58620, 58630, 58634, 58696, 58697, 58698, 58699, 7778.
- Browser tidak dibuka. `BROWSER=/tmp/px0-isolated/browser-stub.sh` mencatat URL yang akan dibuka.
- Setelah uji: semua PID uji di-SIGTERM. Verifikasi akhir `pgrep -fl px0` hanya menyisakan `82419` dan `82755`. Port uji kosong. Lock user tidak berubah. Workbench terisolasi menghapus lock-nya sendiri saat SIGTERM.

## 9. Sumber

Source px0 tag v0.1.20:

- [`main.go:95-110`](https://github.com/px0-ai/px0/blob/v0.1.20/main.go#L95-L110) - bare `px0` membuka workbench; target tidak diteruskan.
- [`main.go:373-380`](https://github.com/px0-ai/px0/blob/v0.1.20/main.go#L373-L380) - reuse workbench lewat lock dan ping; hanya `openBrowser(u)`.
- [`main.go:474-552`](https://github.com/px0-ai/px0/blob/v0.1.20/main.go#L474-L552) - `resolveTarget` dan `splitTargetLine` (git root, cwd, parent dir, `:line`, `:line:col`).
- [`main.go:554-574`](https://github.com/px0-ai/px0/blob/v0.1.20/main.go#L554-L574) - `viewerURL` dengan query `path` dan `line`.
- [`main.go:626-645`](https://github.com/px0-ai/px0/blob/v0.1.20/main.go#L626-L645) - `listen` walk port sampai +100.
- [`main.go:647-695`](https://github.com/px0-ai/px0/blob/v0.1.20/main.go#L647-L695) - `openBrowser`; di macOS `open <url>`.
- [`workbench.go:78-98`](https://github.com/px0-ai/px0/blob/v0.1.20/workbench.go#L78-L98) - direktori state, lock, `wbItemID`.
- [`workbench.go:369-385`](https://github.com/px0-ai/px0/blob/v0.1.20/workbench.go#L369-L385) - daftar route workbench, termasuk `/api/wb/open`.
- [`workbench.go:412-430`](https://github.com/px0-ai/px0/blob/v0.1.20/workbench.go#L412-L430) - `start` reuse child yang sudah starting/running.
- [`workbench.go:683-694`](https://github.com/px0-ai/px0/blob/v0.1.20/workbench.go#L683-L694) - `trustedGet`.
- [`workbench.go:992-1053`](https://github.com/px0-ai/px0/blob/v0.1.20/workbench.go#L992-L1053) - `handleOpen`; target file diubah menjadi `wbDirItem(root)`.
- [`workbench.go:1055-1078`](https://github.com/px0-ai/px0/blob/v0.1.20/workbench.go#L1055-L1078) - `resolveTarget` workbench.
- [`workbench.go:1144-1215`](https://github.com/px0-ai/px0/blob/v0.1.20/workbench.go#L1144-L1215) - proxy `/w/<id>/` dan holding page.
- [`workbench.go:1293-1336`](https://github.com/px0-ai/px0/blob/v0.1.20/workbench.go#L1293-L1336) - `runningWorkbench`, write/remove lock.
- [`server.go:470-479`](https://github.com/px0-ai/px0/blob/v0.1.20/server.go#L470-L479) - `resolvePath`: path absolut hanya untuk path LSP.
- [`server.go:1689-1702`](https://github.com/px0-ai/px0/blob/v0.1.20/server.go#L1689-L1702) - `/api/stream` hanya SSE keluar.
- [`server.go:2576-2595`](https://github.com/px0-ai/px0/blob/v0.1.20/server.go#L2576-L2595) - `localPost`: POST, Host IP/localhost, Origin sama dengan Host.
- [`web/src/main.js:156-169`](https://github.com/px0-ai/px0/blob/v0.1.20/web/src/main.js#L156-L169) - baca `?path=`/`?line=` saat load, lalu `replaceState` membersihkan URL.
- [`web/src/workbench.js:272-283`](https://github.com/px0-ai/px0/blob/v0.1.20/web/src/workbench.js#L272-L283) - `open()` menavigasi halaman kerja ke `href`.
- [`web/src/workbench.js:401-406`](https://github.com/px0-ai/px0/blob/v0.1.20/web/src/workbench.js#L401-L406) - `?open=` hanya untuk alur clone PR.
- [`docs/internals/workbench.md`](https://github.com/px0-ai/px0/blob/v0.1.20/docs/internals/workbench.md) - single instance, proxy, holding page, `/api/wb/open`.

Dokumentasi web px0:

- [Architecture and internals](https://px0.ai/docs/reference/architecture-and-internals/) - daftar endpoint `/api/file`, `/api/stream`, dan model satu workspace per proses.
- [Changelog](https://px0.ai/changelog) - tidak ada entri "open file in running instance" sampai 0.1.20.

Lokal:

- `~/.local/bin/px0 --help` dan `px0 --version` (0.1.20).
- `herdr-app --version` (0.1.12) dan `herdr-app commands` (tidak ada perintah browser/px0).
- Lock user `~/.px0/workbench.lock` (dibaca read-only).
