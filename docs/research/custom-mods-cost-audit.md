# Audit biaya runtime dan risiko clone: custom mods Workspace rail (Herdr app 0.1.12)

Tanggal: 2026-11-04, 05:38-05:55 WIB.
Host: Apple M1 Pro, 16 GB RAM, macOS 27.2 (26B123).
Aplikasi: Herdr app 0.1.12 (`/Users/kyomel/Applications/Herdr.app`), PID pengukuran 28892.
Layout: `SWEG` (isi = `layouts/sweg-focus/layouts/sweg-focus.json` di repo ini).
Mod yang diaudit: `sweg-focus-files`, `sweg-focus-changes`, `sweg-focus-panel` (2 copy: head + foot), `sweg-focus-px0`, `sweg-focus-tabs`, `sweg-focus-menu`.
Pembanding: mod shipped `files`, `changes`, `tabs` versi 0.1.12, plus px0 0.1.20.
Sifat: audit kode + docs + spot check runtime. A/B runtime adalah tugas Lead. Audit ini tidak mengubah UI user.

## 1. Angka kunci

Definisi idle: rail tampil, cwd ada, folder adalah git repo, working tree tidak berubah, tidak ada interaksi, tidak ada folder tree yang di-expand.

| Metrik | Nilai | Dasar |
| --- | --- | --- |
| Timer kustom | 5 timer: files 10 s, changes 10 s, footer 5 s, px0 4 s, tabs 2 s | lihat bagian 3 |
| Spawn subprocess saat idle, ketiga view pernah tampil | **90-96 exec/menit** (5.400-5.760/jam) | 18 + 24-30 + 48 |
| Spawn saat hanya view Files (kondisi setelah launch) | **66 exec/menit** | 18 + 48 |
| Porsi footer panel | **48 exec/menit = 50-53%** dari total | footer 12 siklus x 4 |
| Spawn yang duplikat | **48 exec/menit** adalah `rev-parse --show-toplevel` (24x) dan `git status` (24x) yang sama, dijalankan 3 mod | bagian 3.4 |
| Redraw jendela penuh saat idle, ketiga view pernah tampil | **39 redraw/menit** (2.340/jam) | 6 + 6 + 12 + 15 |
| Redraw saat hanya view Files | **18 redraw/menit** | 6 + 12 |
| Redraw saat rail disembunyikan | **27 redraw/menit** | files 6 + changes 6 + px0 15 |
| Spawn saat rail disembunyikan | **42-48 exec/menit** | files 18 + changes 24-30 |
| Runtime spot check | CPU app 0.06-0.10% saat idle; RSS 64-77 MB; spawn seluruh layout 99-134/menit (tidak bisa diatribusikan per mod) | bagian 3.5 |
| Diff clone vs shipped | **+99 / -67 baris** total: files +14/-11, changes +10/-11, tabs +75/-45 | bagian 5 |
| Mod baru tanpa padanan shipped | **356 baris** (panel 172, px0 114, menu 70). Total mod kustom 873 baris | bagian 5 |
| Diff layout vs `main` 0.1.12 | **+95 / -39 baris** semantik (181 baris diff teks) | bagian 5.3 |
| Upstream sejak tag v0.1.12 (sekitar 33 jam) | **45 commit, 51 file**; `defaults/mods/files/main.js` +13/-5; `AGENTS.md` +30/-2; changes/tabs/main.json tidak berubah | bagian 6 |
| Riwayat upstream v0.1.4 -> v0.1.12 | 205 commit, 8 rilis, 10 hari; files/main.js +41/-24, changes/main.js +54/-29, tabs/main.js +46/-8 | bagian 6 |
| Browser pane di Herdr app | **Tidak ada** di 0.1.12. Tag terakhir v0.1.12 (rilis 2026-11-02). PR browser pane #235 masih draft. | bagian 6 |
| Fitur px0 0.1.20 | Menutupi tree, preview/edit, diff, stage/hunk, commit, push/pull, PR, search, LSP. Tidak menggantikan rail in-window. | bagian 7 |

Kesimpulan angka: biaya runtime rail kecil di mesin ini (CPU idle sekitar 0.1%). Biaya yang dominan adalah perawatan clone dan drift saat Herdr update. Kalau rail dihapus dan Files/Git diserahkan ke px0, spawn 90-96/menit dan redraw 39/menit hilang, bersama 873 baris kode kustom.

## 2. Metode dan batas

Yang dibaca (read-only):
- `~/.config/herdr-app/AGENTS.md` (986 baris, ditulis app untuk versi 0.1.12).
- `~/.config/herdr-app/mods/sweg-focus-*/main.js` + `mod.json`.
- `~/.config/herdr-app/mods/{files,changes,tabs}/main.js` (shipped) + `mod.json`.
- `~/.config/herdr-app/layouts/SWEG.json`, `main.json`, `settings.json`, `shared.json`, `keys.json`, `update-notes.json`, `installed.json`.
- Repo ini: `layouts/sweg-focus/`, `README.md`, `docs/plans/20261103-setup-layout.md`, git log.

Yang dijalankan (read-only atau aman):
- `herdr-app --version`, `--help`, `status`, `ls`, `commands`, `check` (6 mod).
- `pgrep`, libproc (`proc_listchildpids`, `proc_pidpath`, `proc_pidinfo`, `sysctl KERN_PROCARGS2`), `diff`, `grep`, `curl` (docs web), GitHub API (tag, changelog, compare, search).
- Tidak ada `herdr-app do`, tidak ada `layout.switch`, tidak ada switch/toggle/buka overlay. Tidak ada file user yang diubah.

Data web diperlakukan sebagai data eksternal. Semua URL sumber ada di bagian akhir.

## 3. Timer, exec, dan redraw per mod

### 3.1 Tabel utama

| Mod | Timer | Tick/menit | Exec per siklus | Exec/menit | Redraw per siklus | Redraw/menit |
| --- | --- | --- | --- | --- | --- | --- |
| `sweg-focus-files` | `cx.timer.every(10000)` (main.js:42) | 6 | 3 + n folder | **18 + 6n** | 1 | **6** |
| `sweg-focus-changes` | `every(10000)` (main.js:48) | 6 | 4 atau 5 | **24-30** | 1 | **6** |
| `sweg-focus-panel` part `foot` | `every(5000)` (main.js:60) | 12 | 4 (6 jika HEAD belum ada) | **48** (72) | 1 | **12** |
| `sweg-focus-px0` | `every(4000)` (main.js:57) | 15 | 0 | **0** | 1 | **15** |
| `sweg-focus-tabs` | `every(2000)` (main.js:44) | 30 | 0 (kecuali dock pindah) | **0** | 0 (kecuali dock pindah) | **0** |
| `sweg-focus-menu` | tidak ada | - | - | **0** | - | **0** |
| **Total idle (n=0)** | - | - | - | **90-96** | - | **39** |

Keterangan:
- `n` = jumlah folder yang di-expand di file tree. Setiap folder tambah 1 `sh -c` per siklus (6/menit).
- Redraw per siklus dihitung dari `cx.notify()` di blok `finally`. Aturan resmi: setiap redraw satu mod menggambar ulang seluruh jendela (AGENTS.md:860-861). Jadi 1 notify = 1 redraw jendela penuh.
- `tabs` tidak memanggil `notify()` saat idle. Timer 2 s hanya membaca `shared("workspace.dock")` (main.js:21-32, 48-67). Kalau nilai sama, fungsi kembali sebelum ada kerja. Kalau dock berubah: 1 `layout.set` + 1 notify.
- `px0` tidak menjalankan `exec` sama sekali. Timer hanya `cx.notify()` (main.js:57).

### 3.2 Perintah per siklus (bisa dicek ulang)

`sweg-focus-files`, tiap 10 s (main.js:68-103):
1. Loop `["", ...this.folders]`: `exec("sh", ["-c", script, path])` (main.js:29-30). Idle tanpa expand = 1.
2. `exec("git", ["rev-parse", "--show-toplevel"], {cwd, on})` (main.js:88).
3. Jika repo: `exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"])` (main.js:92).
Total 3 (tanpa expand), 3+n dengan n folder.

`sweg-focus-changes`, tiap 10 s (main.js:64-115):
1. `git rev-parse --show-toplevel` (main.js:75).
2. `git status ...` (main.js:79).
3. `git rev-parse --verify HEAD` (main.js:81).
4. `git diff HEAD --numstat -z --no-renames` (main.js:83). Jika HEAD belum ada: 2 panggilan diff.
5. `load()` untuk file yang sedang terbuka: `git diff HEAD ... -- path` (main.js:130). Untuk file untracked: `readTextFile` (main.js:122), tanpa exec.
Total 4 (tidak ada file terbuka atau file untracked) sampai 5 (file tracked terbuka). File pertama otomatis terbuka (main.js:107), jadi kondisi umum = 5.

`sweg-focus-panel` part `foot`, tiap 5 s (main.js:64-120):
1. `git rev-parse --show-toplevel` (main.js:80).
2. Paralel: `git rev-parse --abbrev-ref HEAD`, `git status ...`, `git diff HEAD --numstat ...` (main.js:86-90).
Total 4. Jika `git diff HEAD` gagal: 2 panggilan fallback tambahan (cached + work), total 6.
Timer hanya aktif kalau `props().part === "foot"` (main.js:58-61).

Watch folder (files :50, changes :57): loop `await watchFolder(root)` lalu `refresh()`. Ini bukan timer. Setiap batch perubahan file memicu satu siklus penuh tanpa debounce. Saat build/test menulis banyak file, spawn melonjak. Ini risiko burst, bukan idle.

### 3.3 Total per skenario

| Skenario | Exec/menit | Redraw/menit | Catatan |
| --- | --- | --- | --- |
| A. Baru launch, view Files aktif (Git/px0 belum pernah tampil) | 66 | 18 | files 18 + footer 48; files 6 + footer 12 |
| B. Steady state: ketiga view pernah tampil minimal sekali | 90-96 | 39 | files 18 + changes 24-30 + footer 48; + px0 15 |
| C. Rail disembunyikan (`layout.toggle:workspace`) | 42-48 | 27 | footer berhenti (cek `hidden` di main.js:65); files/changes/px0 tetap jalan |
| D. Layout `main` (pembanding, files+changes shipped di panel, setelah panel pernah dibuka) | 42-48 | 12 | tanpa footer, tanpa px0, tanpa clone |
| E. px0-only (rail dihapus, px0 dipakai dari terminal/tombol pane) | 0 | 0 | biaya rail hilang; biaya px0 terpisah |

Catatan penting: view yang pernah tampil tetap hidup di layout. Timer-nya terus jalan walaupun view itu tidak terlihat (aturan resmi AGENTS.md:762-765). Artinya membuka view Git sekali menambah 24-30 exec/menit dan 6 redraw/menit secara permanen sampai layout switch atau app restart.

Delta terhadap pembanding shipped (D): rail kustom menambah **+48 exec/menit** (footer) dan **+27 redraw/menit** (footer 12 + px0 15), plus 30 tick timer tabs/menit. Timer files/changes sendiri sama dengan shipped (10 s + watchFolder), jadi timer itu bukan biaya tambahan.

### 3.4 Duplikasi kerja lintas mod

| Perintah | Footer 5 s | Files 10 s | Changes 10 s | Total/menit |
| --- | --- | --- | --- | --- |
| `git rev-parse --show-toplevel` | 12 | 6 | 6 | 24 |
| `git status --porcelain` (semantik sama) | 12 | 6 | 6 | 24 |
| **Duplikat** | | | | **48** |

48 dari 90-96 exec/menit (50-53%) adalah dua panggilan metadata yang sama, diulang oleh tiga mod. Tidak ada state bersama di antara ketiganya.

### 3.5 Spot check runtime

Sampel diambil dengan sampler libproc (`proc_listchildpids` + `proc_pidinfo` + `sysctl KERN_PROCARGS2`) pada PID 28892. Tidak memakai `ps`/`top`.

| Sampel | Waktu | Jendela | Layout saat mulai/akhir | Hasil |
| --- | --- | --- | --- | --- |
| S1 | 05:41:23-05:41:53 | 30 s, interval 20 ms | SWEG / SWEG | 67 child transien: git 35, bash 7, sh 7, tidak terbaca 18 = **134 spawn/menit (batas bawah)** |
| S2 | 05:42:08-05:43:08 | 60 s, interval 10 ms | SWEG / main + overlay `frame-settings` | Layout berpindah di tengah, jadi angka spawn dibuang. CPU app **0.06%** (user 0.03% + sys 0.03%), RSS 76.6 MB, 31 thread |
| S3 | 05:43-05:45 (perkiraan) | 90 s, interval 15 ms | main / SWEG | Segmen SWEG sekitar 17 s: 28 spawn = **99 spawn/menit** |
| S4 | 05:49:52-05:49:57 | 5 s | SWEG / SWEG, overlay kosong | CPU app **0.1%**, RSS 63.9 MB, 31 thread |

Interpretasi:
- CPU idle app di bawah 0.1% di mesin ini. Render GPU tidak masuk hitungan CPU; biaya energi tidak diukur.
- Angka spawn runtime seluruh layout (99-134/menit) lebih tinggi dari model rail (66-96/menit) karena layout SWEG juga menjalankan mod shipped lain yang mem-spawn, terutama `system-stats` (timer 5 s, `exec("/bin/sh", ["-c", SCRIPT])`, lalu `sh` menjalankan `top`/`awk`/`sysctl`). Sampel mengamati child `sh` system-stats hidup sekitar 1,3 s per spawn.
- Atribusi per mod dari runtime tidak bisa dipercaya tanpa mengontrol UI. Angka per mod di bagian 3 berasal dari kode. Spot check ini hanya memvalidasi orde besaran, dan hasilnya konsisten.
- Lead melakukan A/B (switch layout, buka overlay settings) selama sampling. Sampel S2 tercemar. S1 dan S4 bersih dari sisi layout, tetapi view mana yang pernah dibuka sebelumnya tidak diketahui.

## 4. Kepatuhan aturan resmi AGENTS.md

Kutipan persis dari `~/.config/herdr-app/AGENTS.md` (versi 0.1.12):

1. Baris 762-765:
   > "A copy starts the first time it shows, then stays alive while its block is in the layout, shown or not (a hidden column, the other child of a stack, a pane in another tab or behind a zoom): switching back finds it as it was. Its timers keep running while hidden, so poll gently."
2. Baris 837-838:
   > "render(cx) describes the UI and runs again after cx.notify() and whenever Herdr's live data changes (spaces, agents, terminals, focus, theme, shared state). Don't poll those."
3. Baris 860-869:
   > "Animate natively, never with a timer. Every redraw of a mod redraws the whole window, so cx.timer.every(90, () => cx.notify()) for a spinner costs real battery. ... Timers are for data (a clock, a fetch), and only as often as what they show changes."
4. Baris 956-957:
   > "Files also refreshes on its 10-second timer: cx.spawn(async (cx) => { for (;;) { await watchFolder(dir); this.reload(); cx.notify(); } })."

Penilaian:

| Mod | Status | Alasan |
| --- | --- | --- |
| `sweg-focus-files` | Wajar (mewarisi shipped), satu pola berisiko | Timer 10 s + watchFolder sama dengan versi shipped yang didokumentasikan aturan 4. Tidak ada cek `hidden`, jadi aturan 1 dilanggar saat rail disembunyikan: 18 exec + 6 redraw/menit tetap jalan. |
| `sweg-focus-changes` | Wajar (mewarisi shipped), satu pola berisiko | Sama seperti files. 24-30 exec + 6 redraw/menit tetap jalan saat hidden. |
| `sweg-focus-panel` part foot | Berisiko sedang | Polling data git tiap 5 s. Data hanya berubah saat ada event file/commit. Aturan 3 minta "only as often as what they show changes". Positif: ada cek `hidden` (main.js:65) sehingga exec berhenti saat rail disembunyikan. Duplikasi: dari 48 exec/menit panggilan kembar lintas 3 mod, footer menyumbang 24. |
| `sweg-focus-px0` | **Melanggar** | Timer 4 s hanya memanggil `cx.notify()`. Isi view berasal dari live data (`terminals()`, `panes()`, `spaces()`, `focused()`), jadi render sudah otomatis saat data berubah (aturan 2). Timer ini membuang 15 redraw jendela penuh/menit tanpa perubahan data. Ini pola yang dilarang aturan 3. |
| `sweg-focus-tabs` | Berisiko rendah | Timer 2 s hanya membaca shared state, tidak fetch, tidak redraw saat nilai stabil. RECIPE menyebut ini fallback untuk `reload_dock` (best effort). Tetap 30 tick/menit yang bisa dihindari dengan event. |
| `sweg-focus-menu` | Wajar | Tidak ada timer. |

Kesimpulan: clone files/changes mewarisi pola resmi shipped, jadi wajar. Dua pola yang jelas di luar aturan adalah timer 4 s px0 (redraw tanpa data berubah) dan tidak adanya cek `hidden` di files/changes/px0. Footer 5 s berada di batas: data, bukan animasi, tetapi lebih sering dari perubahan datanya.

## 5. Diff clone vs shipped 0.1.12

Verifikasi dasar: mod shipped di `~/.config/herdr-app/mods/{files,changes,tabs}/main.js` **identik byte-per-byte** dengan sumber tag `v0.1.12` di GitHub. Perbandingan memakai `diff -u`.

### 5.1 Tabel diff

| Clone | Baris file | Diff vs shipped | Fitur yang diubah | TODO/FIXME |
| --- | --- | --- | --- | --- |
| `sweg-focus-files` | 175 (shipped 171) | +14 / -11 (43 baris diff, 2 hunk) | `location()` jadi level space (`place()`, lepas `focused()`), header 42 px dihapus, preview bar 34 px, `bg(chrome)` + border samping | tidak ada |
| `sweg-focus-changes` | 206 (shipped 206) | +10 / -11 (43 baris diff, 2 hunk) | `location()` level space, header 42 px dihapus (jumlah file dan +/- pindah ke footer), `bg(chrome)` + border samping | tidak ada |
| `sweg-focus-tabs` | 136 (shipped 103) | +75 / -45 (158 baris diff, 3 hunk) | panel sync shipped dibuang; tombol Files/Changes dihapus; tombol Workspace; `+` masuk ke baris tab scroll; `readDock`/`applyDock`/`syncSettings`; `nextCommand` `reload_dock`; timer 2 s | tidak ada |
| **Total clone** | **517** | **+99 / -67 (244 baris diff)** | | |

`herdr-app check` lulus untuk 6/6 mod. Tidak ada file `*.error` di config live.

### 5.2 Mod baru tanpa padanan shipped

| Mod | Baris | Fungsi | Timer |
| --- | --- | --- | --- |
| `sweg-focus-panel` | 172 | Header (judul view, chevron, hide, popup switcher, padding traffic light) dan footer (folder, branch, jumlah changes, +add/-del). Satu mod, dua copy lewat `props.part`. | head 0, foot 5 s |
| `sweg-focus-px0` | 114 | Launcher: status running/idle, folder, branch, tombol Open/Split, daftar sesi px0 dari `terminals()` argv, hint key. | 4 s notify |
| `sweg-focus-menu` | 70 | Popup pilih view + dock kiri/kanan. Menulis `shared("workspace.dock")` lalu `run("sweg-focus-tabs.reload_dock")`. | none |
| **Total** | **356** | | |

Total kode mod kustom: 175 + 206 + 172 + 114 + 136 + 70 = **873 baris**.

### 5.3 Layout, keys, dan footprint repo

| Item | Nilai |
| --- | --- |
| Diff teks `main.json` -> `SWEG.json` | 150 tambah / 94 hapus (334 baris), termasuk urutan key JSON yang ditulis ulang app |
| Diff semantik (key diurutkan) | **+95 / -39 (181 baris)** |
| Perubahan layout nyata | Kolom `workspace` baru (head 40 px, body stack `ws-files`/`ws-git`/`ws-px0`, foot 28 px); blok `panel` dihapus dari `work-body`; `tabs` diganti `sweg-focus-tabs`; header pane `pane` -> `sweg-pane`; status jadi row `workspace-status` + `system-stats` (tambahan); `terminal_menu: "sweg-menu"`; metadata `cloned_from` |
| Metadata pin | `SWEG.json` `cloned_from {main, 0.1.12}`; `mod.json` clone `cloned_from {files|changes|tabs, 0.1.12}` |
| Key kustom live | 6: `cmd-shift-f/g/e/t/b/x` (`keys.json` live). Snippet repo `layouts/sweg-focus/keys.json` hanya 5 (`cmd-shift-t` tidak ada di snippet) |
| Duplikasi kode | `place()`/`location()` di 4 mod; `find()` di 2 mod; flag `READ` di 2 mod; parsing status git di 3 mod |
| Mod pendukung (bukan bagian rail) | `sweg-pane` 144 baris (tombol `</>` + key `cmd-shift-e`), `sweg-menu` 206 baris (menu terminal). Tanpa timer. Dipakai juga oleh layout `sweg` lama. |
| Footprint repo | 71 file tracked, sekitar 10 MB. 11 salinan `gpui-kit.d.ts` = 8,6 MB (86%); file ini dibuat app per versi, jadi basi setelah Herdr update. `RECIPE.md` 167 baris, `README.md` 79 baris. |
| Riwayat kerja | 10 commit dalam 11,4 jam (2026-11-03 17:57 -> 2026-11-04 05:19). 4 commit menyentuh mod sweg-focus, 2 merge. |

## 6. Risiko drift saat Herdr update

### 6.1 Mekanisme

- App update sendiri. "Updates: an installed app downloads them by itself and offers Restart and What changed." (AGENTS.md:636). Jadi update datang tanpa diminta.
- Mod shipped milik Herdr. "Shipped mods are Herdr's; duplicate with mod.clone before editing." (AGENTS.md:785-786). Salinan clone dengan nama sendiri tidak dilacak app dan tidak ikut update.
- Clone dipin ke 0.1.12: `mod.json` clone berisi `"cloned_from": {..., "version": "0.1.12"}`, layout berisi `cloned_from main 0.1.12`. Pin ini adalah catatan, bukan mekanisme update.
- `update-notes.json` lokal: `{"last_run": "0.1.12", "presented": []}`. Tidak ada catatan versi lebih baru.
- Tidak ada mekanisme otomatis untuk merge fix upstream ke clone. Setiap update yang menyentuh files/changes/tabs butuh diff + re-apply manual.

### 6.2 Bukti upstream bergerak cepat

Data diambil 2026-11-04 sekitar 05:45 WIB (2026-11-03 22:45 UTC) lewat GitHub API.

| Bukti | Angka |
| --- | --- |
| Tag terakhir | `v0.1.12` (2026-11-02). Tidak ada tag setelahnya |
| Changelog master | rilis terbaru tetap 0.1.12 |
| Commit master setelah v0.1.12 | **45 commit, 51 file berubah dalam sekitar 33 jam** (compare `v0.1.12...master`; tag commit 2026-11-02 13:28 UTC) |
| Mod shipped yang sudah berubah di master | `files/main.js` **+13/-5**; `machine-add/main.js` +25/-5; `spaces/main.js` +40/-13 |
| AGENTS.md default | +30/-2 |
| `changes/main.js`, `tabs/main.js`, `layouts/main.json` | tidak berubah sejak v0.1.12 |
| Riwayat 8 rilis sebelumnya (v0.1.4 -> v0.1.12) | 205 commit; `files/main.js` +41/-24, `changes/main.js` +54/-29, `tabs/main.js` +46/-8. Ketiga sumber clone berubah minimal sekali dalam 10 hari. |

### 6.3 Daftar risiko

| # | Risiko | Kemungkinan | Dampak | Catatan |
| --- | --- | --- | --- | --- |
| 1 | Clone tidak menerima fix upstream | Tinggi (sudah terjadi) | Sedang | Fix pertama yang terlewat: `files` di master menambah perbaikan OneDrive/Windows curly quote dan fallback ke PowerShell saat `sh` tidak ada (+13/-5). Rilis berikutnya akan membawa fix itu ke mod shipped, bukan ke clone. |
| 2 | API `herdr`/`gpui-kit` berubah | Sedang | Tinggi (mod gagal load) | 21 API `herdr` dan 12 komponen `gpui-kit`/`gpui-base` dipakai lintas 6 mod. App menulis ulang `.d.ts` tiap start. `herdr-app check` adalah pengaman, tetapi tidak otomatis. |
| 3 | Perubahan schema layout | Rendah (saat ini) | Sedang | `main.json` tidak berubah sejak v0.1.12. `SWEG.json` adalah layout personal; `layout.set` menulis ulang seluruh tree dari data live, jadi bisa memigrasi diri, tetapi bug di `applyDock` bisa merusak file. RECIPE sudah menulis peringatan ini. |
| 4 | Tabrakan tulis settings/layout | Rendah | Tinggi | `sweg-focus-tabs.syncSettings` menulis `settings.json` user; `applyDock` memanggil `layout.set`. Kalau serialisasi app berubah, dua jalur tulis ini bisa salah. Guard idempoten ada (`indexOf` cek sebelum set, `fileFor` guard). |
| 5 | Polling saat rail hidden | Pasti | Rendah | 42-48 exec + 27 redraw/menit saat rail disembunyikan. Baterai/wakeup terbuang. Mudah diperbaiki. |
| 6 | Stale type definitions di repo | Pasti setelah update | Rendah | 11 salinan `gpui-kit.d.ts` (8,6 MB) pinned 0.1.12. Agent yang menulis mod baru di repo ini bisa memakai tipe lama. |
| 7 | Ketergantungan aset shipped | Rendah | Rendah | Clone memakai ikon milik mod shipped (`mods/files/*.svg`, `mods/workspace-chrome/*.svg`). Rename aset upstream = ikon hilang. |
| 8 | Dua sumber kebenaran | Pasti | Rendah | Live `~/.config/herdr-app/layouts/SWEG.json` dan repo `layouts/sweg-focus/layouts/sweg-focus.json` saat audit identik, tetapi harus disinkron manual. Nama layout juga beda (`SWEG` vs `sweg-focus`). |
| 9 | Feedback loop ganda | Pasti | Sedang | Fix pada clone tidak dikirim upstream; fix upstream tidak masuk clone. Setiap perbaikan dikerjakan dua kali atau hilang. |

### 6.4 Status rilis Herdr setelah 0.1.12

Pertanyaan: apakah ada browser pane atau perubahan relevan setelah 0.1.12 yang mengubah keputusan?

| Sumber | Hasil | Kesimpulan |
| --- | --- | --- |
| `~/.config/herdr-app/update-notes.json` | `{"last_run": "0.1.12", "presented": []}` | Tidak ada catatan versi lebih baru di mesin ini |
| GitHub tags API | Tag terakhir `v0.1.12` (commit rilis 2026-11-02 13:28 UTC) | Belum ada rilis 0.1.13 |
| GitHub releases page | Halaman rilis kosong (repo memakai tag) | Tidak ada rilis tambahan |
| Changelog master | Entri terbaru tetap `[0.1.12] - 2026-11-02` | Belum ada catatan rilis baru |
| Commit master setelah tag | 45 commit (terminal find bar, scrollbar, `terminal.scroll`, ligatures, bundle core macOS, fix Files Windows/OneDrive, mod spaces/machine-add). Search commit "browser" = 0 hasil. | Tidak ada pekerjaan browser pane yang masuk master |
| PR #235 "feat: add a native browser pane with a browser new-tab option" | Status open, draft, belum merge (dibuat 2026-10-31) | Browser pane masih usulan, belum ada di rilis |
| Issue #425 "Mods can't host a native view (needed for PDF/HTML/media previews and a browser mod)" | Closed, state reason `not planned` (2026-11-03) | Jalur mod tidak akan mendapat native view dalam waktu dekat |
| `herdr-app --help` dan `herdr-app commands` (69 command) | Tidak ada command browser, web, px0, atau code | App 0.1.12 tidak punya pane browser |
| `herdr.dev` dan `herdr.dev/guide` | 0 kemunculan "browser", "web view", "webview" | Situs resmi tidak menjanjikan browser pane |
| Proyek lain `penso/herdr-gpui` (Herdr UI) | Punya browser tab dan CLI `herdr-gpui browser open` | Produk/repo berbeda. Bukan `herdrdev/herdr-app` 0.1.12; tidak relevan untuk keputusan ini kecuali user pindah produk |

Kesimpulan: tidak ada browser pane di 0.1.12 dan tidak ada rilis setelah 0.1.12. Browser pane baru berupa PR draft. Jadi alasan "Herdr 0.1.12 has no browser pane" di komentar `sweg-focus-px0/main.js:2-3` masih benar. Rencana "menunggu Herdr punya browser pane" tidak punya tanggal rilis; jangan dipakai sebagai asumsi.

## 7. Fitur custom: ada di shipped? tergantikan px0?

Sumber px0: docs dan changelog resmi px0 0.1.20, plus pengukuran di [px0-profile.md](px0-profile.md).

| # | Fitur custom rail | Ada di shipped 0.1.12? | Digantikan px0 0.1.20? |
| --- | --- | --- | --- |
| 1 | Rail full-height, dock kiri/kanan, header + footer | Tidak. Layout shipped menaruh panel Files/Changes di dalam work body | Tidak. px0 ada di tab browser, di luar jendela Herdr |
| 2 | Lokasi mengikuti repo space, bukan pane fokus | Tidak (shipped ikut pane fokus) | Ya. px0 dibuka per folder, launcher/shell menentukan folder space |
| 3 | Footer selalu tampil: folder, branch, jumlah changes, +add/-del | Sebagian (hanya header panel Changes saat panel terbuka) | Sebagian. px0 menampilkan status repo dan diff, tetapi tidak sebagai footer selalu terlihat |
| 4 | File tree + tanda status git (A/M/D/U) | Ya | Ya |
| 5 | Preview file read-only dengan syntax highlight | Ya | Ya, plus edit, save, LSP |
| 6 | Daftar changes + diff + commit bar (`git add -A`, `git commit -m`) | Ya | Ya, plus stage per file/hunk, AI commit message, push, pull, PR review |
| 7 | Launcher px0: status, folder, branch, Open/Split, daftar sesi | Tidak (fitur baru) | Tidak perlu launcher terpisah. px0 punya dashboard sendiri; jalur lain: terminal atau tombol `</>` di `sweg-pane` (`cmd-shift-e`) |
| 8 | Tombol Workspace + hapus tombol Files/Changes di tab bar | Tidak | Tidak berlaku |
| 9 | Preferensi dock (shared key + seed settings + sync) | Tidak | Tidak berlaku |
| 10 | Key `cmd-shift-f/g/x/b` | Tidak | Tidak berlaku |
| 11 | Tombol `+` menempel ke tab terakhir | Tidak (kosmetik) | Tidak berlaku |
| 12 | Daftar sesi px0 di dalam rail | Tidak | Ya, di dashboard px0 |

Ringkas: px0 **menggantikan fungsi Files dan Git** (bahkan melampaui: edit, LSP, stage per hunk, commit, push/pull, PR). px0 **tidak menggantikan** nilai tambah rail: panel sejajar dengan terminal di dalam satu jendela, dock kiri/kanan, footer selalu terlihat, dan key switching. Kalau nilai itu tidak dipakai sehari-hari, rail kustom tidak punya pembenaran biaya perawatan.

## 8. Implikasi keputusan

| Opsi | Biaya runtime | Biaya perawatan | Konsekuensi |
| --- | --- | --- | --- |
| A. Pertahankan rail apa adanya | 90-96 exec + 39 redraw/menit saat idle; 42-48 + 27 saat hidden; CPU idle 0,06-0,1% | 873 baris mod + 166 baris delta clone + 181 baris delta layout + 6 key + merge manual tiap update yang menyentuh files/changes/tabs | UX rail penuh. Risiko drift menumpuk diam-diam |
| B. Hybrid: pertahankan rail, buang clone files/changes (pakai mod shipped di rail) | Sama besar (shipped files/changes juga 10 s + watch) | Menghemat 2 dari 3 clone (46 baris delta) | Kehilangan lokasi level space dan styling chrome; tidak menghemat timer |
| C. px0-only: hapus rail dan clone | Rail 0; px0 terpisah (server 12-24 MB footprint, tab browser estimasi 48-65 MB, CPU idle 0%) | Hapus 873 baris mod, 181 baris delta layout, 6 key; sisakan `sweg-pane` (`</>`) | Tidak ada panel di dalam jendela; Files/Git lewat browser tab |
| D. Pertahankan rail + optimasi cepat | Perkiraan turun ke 30-48 exec + 12-16 redraw saat shown; 0 saat hidden | Sama dengan A, ditambah sedikit perubahan kode | Butuh edit 3 mod. Tidak menyelesaikan drift |

Optimasi cepat kalau opsi A/D dipilih (urutan dampak):
1. Hapus timer 4 s di `sweg-focus-px0` (main.js:57). Live data sudah memicu render. -15 redraw/menit.
2. Tambah cek `hidden` (pola main.js:65) di awal `refresh()` files dan changes. -42-48 exec/menit dan -12 redraw/menit saat rail disembunyikan.
3. Naikkan interval footer dari 5 s ke 10-15 s, atau pakai `watchFolder` untuk space lokal. -24 sampai -32 exec/menit.
4. Satukan pembacaan git (satu mod state untuk 3 view) untuk menghapus hingga 48 exec/menit duplikat. Perubahan paling besar, menambah coupling.

Data ini tidak memutuskan pilihan. Data menunjukkan: kalau rail dipakai harian untuk navigasi cepat sambil mengetik di terminal, opsi A/D masuk akal dan optimasi 1-2 murah untuk ditambal. Kalau Files/Git dipakai untuk review, commit, dan PR, opsi C lebih murah secara perawatan dan px0 sudah terpasang (0.1.20, sudah berjalan).

## 9. Temuan sampingan

1. Klaim di `docs/plans/20261103-setup-layout.md` (bagian "Konteks terverifikasi") salah untuk app ini: "Binary `Herdr` punya `px0 open`, `code open <file>:<line>`, `browser open --beside`, `config get/set`". Verifikasi: `herdr-app --help` dan `herdr-app commands` (69 command) tidak punya subcommand browser/px0/code/web. Klaim itu cocok dengan CLI produk lain (`herdr-gpui`, repo `penso/herdr-gpui`), bukan `herdrdev/herdr-app` 0.1.12. Jangan pakai klaim itu sebagai dasar keputusan.
2. `shared.json` menyimpan key debug sisa uji: `dock.debug`, `dock.debug.render`, `dock.selftest`, `dock.selftest2`. Tidak berbahaya, tetapi sebaiknya dibersihkan.
3. Layout SWEG menambahkan mod shipped `system-stats` ke status bar (timer 5 s, `exec("/bin/sh", ["-c", SCRIPT])`, lalu `top -l 1`). Ini kandidat pemakan CPU/wakeup terbesar di layout, terpisah dari rail. Di luar scope audit ini, tetapi relevan untuk biaya total.
4. Nama layout live `SWEG` berbeda dari nama di repo `sweg-focus`. Isi file identik saat audit. Ini menyulitkan sinkronisasi dan pencarian.
5. Aset `herdr-app check`: 6/6 mod lulus, tanpa `TODO`/`FIXME`, tanpa `*.error`.

## 10. Limitasi

- Audit ini statis untuk angka per mod. Angka runtime adalah spot check, bukan A/B. Lead melakukan switch layout dan membuka overlay selama pengukuran (S2 tercemar; S3 hanya 17 s segmen SWEG).
- View mana yang pernah dibuka sebelum sampling tidak diketahui. Karena timer view yang pernah tampil tetap hidup (AGENTS.md:762-765), kondisi awal runtime tidak bisa dipastikan.
- Sampler child pada 10-20 ms bisa melewatkan proses yang hidup sangat singkat. Angka spawn runtime adalah batas bawah.
- CPU app tidak termasuk proses anak (`git`, `sh`, `top`). Biaya CPU anak, GPU, dan energi tidak diukur. `powermetrics` butuh privilege dan tidak dicoba.
- Hanya satu host dan satu kondisi. Hasil bisa berbeda di repo besar, remote space, atau saat build berjalan.
- Data px0 berasal dari docs/changelog vendor dan pengukuran rekan ([px0-profile.md](px0-profile.md)), bukan pengukuran ulang oleh audit ini.
- Data upstream adalah snapshot 2026-11-04 sekitar 05:45 WIB. Upstream bergerak cepat (45 commit dalam sekitar 33 jam), jadi angka bisa berubah dalam hitungan jam.
- Semua file `~/.config/herdr-app` dibaca read-only. Tidak ada perubahan layout, mod, settings, shared, atau keys milik user.

## Sumber

Lokal (read-only):
- `~/.config/herdr-app/AGENTS.md`, `mods/sweg-focus-*/main.js`, `mods/{files,changes,tabs}/main.js`
- `~/.config/herdr-app/layouts/SWEG.json`, `layouts/main.json`, `shared.json`, `settings.json`, `keys.json`, `update-notes.json`
- `herdr-app --version/--help/status/ls/commands/check`
- [px0-profile.md](px0-profile.md) (repo ini)

Web:
- [Herdr changelog (raw master)](https://raw.githubusercontent.com/herdrdev/herdr-app/master/CHANGELOG.md)
- [Herdr releases page](https://github.com/herdrdev/herdr-app/releases) (kosong; rilis tercatat lewat tag)
- [Herdr tags API](https://api.github.com/repos/herdrdev/herdr-app/tags) (tag terakhir v0.1.12)
- [Compare v0.1.12...master](https://github.com/herdrdev/herdr-app/compare/v0.1.12...master) (45 commit, 51 file)
- [PR #235: native browser pane (draft, belum merge)](https://github.com/herdrdev/herdr-app/pull/235)
- [Issue #425: mods can't host a native view (closed, not planned)](https://github.com/herdrdev/herdr-app/issues/425)
- [herdr.dev](https://herdr.dev/) dan [herdr.dev/guide](https://herdr.dev/guide/) (tidak menyebut browser pane)
- [px0 docs](https://px0.ai/docs)
- [px0 changelog](https://px0.ai/changelog)
- [px0.ai](https://px0.ai)
- [penso/herdr-gpui skill browser (produk lain, bukan herdr-app)](https://github.com/penso/herdr-gpui)

## Lampiran: cara cek ulang

```sh
# Timer per mod
grep -n 'timer\.' ~/.config/herdr-app/mods/sweg-focus-*/main.js
grep -n 'timer\.' ~/.config/herdr-app/mods/{files,changes,tabs}/main.js

# Exec per siklus
grep -n 'exec(' ~/.config/herdr-app/mods/sweg-focus-files/main.js
grep -n 'exec(' ~/.config/herdr-app/mods/sweg-focus-changes/main.js
grep -n 'exec(' ~/.config/herdr-app/mods/sweg-focus-panel/main.js

# Diff clone vs shipped
diff -u ~/.config/herdr-app/mods/files/main.js   ~/.config/herdr-app/mods/sweg-focus-files/main.js
diff -u ~/.config/herdr-app/mods/changes/main.js ~/.config/herdr-app/mods/sweg-focus-changes/main.js
diff -u ~/.config/herdr-app/mods/tabs/main.js    ~/.config/herdr-app/mods/sweg-focus-tabs/main.js

# Diff layout (dari ~/.config/herdr-app)
diff -u layouts/main.json layouts/SWEG.json

# Validasi mod
for m in sweg-focus-files sweg-focus-changes sweg-focus-panel sweg-focus-px0 sweg-focus-tabs sweg-focus-menu; do
  herdr-app check ~/.config/herdr-app/mods/$m
done
```

Rumus total:
- exec/menit = (6 x (3 + n)) + (6 x 4..5) + (12 x 4) = 90-96 untuk n = 0.
- redraw/menit = 6 + 6 + 12 + 15 = 39.
- hidden: exec = 18 + 24..30 = 42-48; redraw = 6 + 6 + 15 = 27.
