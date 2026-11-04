# px0 sebagai workspace web editor: model Sheprd, opsi implementasi, rekomendasi

Tanggal: 2026-11-04. Status: riset dan desain. Belum ada perubahan ke layout live.
Pertanyaan: user ingin workspace Herdr terasa seperti web editor dengan px0. Kalau membuka file, apakah konsepnya membuat pane baru atau bagaimana? Beri opsi implementasi dan rekomendasi.

Dokumen pendukung:
- [herdr-gpui-px0-workspace.md](herdr-gpui-px0-workspace.md) - model Sheprd (herdr-gpui) dengan sitasi source.
- [px0-open-file.md](px0-open-file.md) - permukaan open-file px0 0.1.20, teruji.
- [herdr-app-px0-pane-options.md](herdr-app-px0-pane-options.md) - opsi pane/tab/reader di herdr-app 0.1.12, status PR upstream.
- [20261104-workspace-custom-vs-px0.md](20261104-workspace-custom-vs-px0.md) - biaya panel kustom vs px0.

## 0. Ringkasan

1. Produk referensi `herdr-gpui` sudah rebrand menjadi **Sheprd** (commit `3b9800f`, 2026-11-03). Sheprd menaruh px0 di **browser tab native** (webview `wry`: WKWebView di macOS, WebView2 di Windows), satu tab per workspace. Bukan pane Herdr.
2. Di model Sheprd, **buka file bukan pane baru**. File dibuka di dalam px0 sendiri (tab internal px0). Kalau dari sisi Sheprd: link file membuka **pane terminal editor**, `code open` membuka **code tab read-only**, atau aplikasi sistem. px0 tidak pernah menerima path atau line.
3. herdr-app 0.1.12 **tidak bisa** meniru model itu. Mod dilarang memakai web view. Tidak ada command browser. PR #235 masih draft, konflik, tanpa review. Maintainer menyebut browser ada di roadmap dan mungkin menjadi **mod resmi**, tanpa tanggal.
4. Jadi px0 sekarang hanya bisa menjadi **window terpisah** (browser sistem). Konsekuensi: buka file terjadi di dalam px0, bukan pane Herdr. Kalau ingin file tampil di dalam window Herdr, itu harus **mod viewer pane read-only** (pane baru), bukan px0.
5. Rekomendasi: **Opsi A (Editor Window)** sekarang. px0 jadi jendela editor terpisah, Herdr tetap terminal cockpit, satu aksi membuka atau memfokuskan workspace px0. Jangan bangun bridge per file dulu. **Opsi B (viewer pane native)** hanya kalau glance di dalam window wajib. **Opsi D (tunggu browser mod resmi)** sebagai jalur upgrade. **Opsi E (pindah ke Sheprd)** hanya kalau halaman web di dalam window adalah syarat keras.

## 1. Model referensi Sheprd

Empat konsep berbeda. Ini kunci untuk menjawab pertanyaan "pane baru atau bukan".

| Konsep | Pemilik | Isi | Terlihat oleh |
| --- | --- | --- | --- |
| Herdr pane | Daemon | Satu terminal (selalu terminal) | Semua client |
| Herdr tab | Daemon | Kumpulan pane dalam satu workspace | Semua client |
| Editor group | Sheprd (client) | Split jendela, punya tab strip sendiri | Jendela itu |
| Browser tab | Sheprd (client) | Halaman webview, menggantikan terminal di grup | Jendela itu |

```
Jendela Sheprd
├─ editor group kiri
│  └─ tab strip: [shell] [agent]
│     └─ isi: terminal (pane daemon)
├─ editor group kanan (split)
│  └─ tab strip: [px0]
│     └─ isi: webview -> px0 workbench /w/<id>/
│        └─ tab internal px0: file yang dibuka user
└─ code tab read-only (dari `sheprd code open FILE:LINE`)
```

Fakta kunci dari source:

- px0 adalah `Editor::Px0`, dirender sebagai browser tab tanpa toolbar. Bukan `Place::Pane` (`crates/sheprd-gpui/src/browser/editor.rs:8-17`, `browser/view/render.rs:137`).
- Tab px0 singleton per (daemon, workspace). Membuka lagi mengembalikan id yang sama, lalu tab dipindah ke group yang diminta (`browser/store.rs:343-370`, `browser/editor.rs:70-97`).
- Halaman dimuat di `base?open=<checkout root>`. Checkout = cwd pane pertama tab pertama workspace (`crates/sheprd-gpui/src/px0.rs:133-138`, `browser/editor.rs:40-61`).
- Worker px0: cek config `px0.url` -> `workbench.lock` user -> lock privat app -> spawn `px0 -no-open -no-update -no-color -host 127.0.0.1 -port 0 -base-path /`; ping `/api/wb/ping` 15 detik; probe tiap 3 detik (`px0/worker.rs:161-272`).
- Data yang dikirim Sheprd ke px0 hanya dua: alamat workbench (ping) dan root checkout (`?open=`). Tidak ada `?path=`, `?line=`, IPC, atau bridge.

## 2. Arti "buka file"

Di Sheprd ada tiga jalur nyata. Tidak ada yang menyentuh px0:

| Aksi | Hasil | Container |
| --- | --- | --- |
| Klik link path di terminal / chat | Terminal editor | **Pane baru** (split kanan pane asal) |
| `sheprd code open FILE[:LINE]` | Code view read-only, loncat baris | **Tab**, bukan pane |
| `sheprd code edit FILE[:LINE]` | Terminal editor | **Pane baru** |
| Klik file di dalam px0 | px0 membuka tab internal | **Tab internal px0**, bukan Herdr |
| Klik file di panel Herdr 0.1.12 | Preview di panel | Bukan pane, bukan tab |

```
buka file dari Sheprd
-> terminal link / chat link
   -> open_file_link
      -> terminal editor pane (split daemon) | aplikasi sistem
-> code open / Cmd-Enter
   -> open_code_view
      -> code tab read-only (client tab, Location::Code)
-> code edit / review "e"
   -> open_in_editor
      -> terminal editor pane
-> tidak ada jalur -> px0
```

Kesimpulan: **px0-as-workspace berarti "satu tab editor per workspace", bukan "satu pane per file".** File hidup di dalam px0. Kalau Herdr mau "klik file -> buka di px0", mekanisme itu harus dibuat sendiri. Sheprd pun tidak punya.

## 3. Kenapa herdr-app 0.1.12 tidak bisa langsung meniru

| Batas | Bukti | Akibat |
| --- | --- | --- |
| Mod tidak boleh HTML/CSS/web view | `~/.config/herdr-app/AGENTS.md:35` | px0 tidak bisa dirender di pane mod |
| Pane = terminal atau mod saja | `AGENTS.md:126-132` | Tidak ada tipe pane web |
| Tidak ada command browser | `herdr-app commands` 69 command | px0 hanya lewat sistem browser |
| PR #235 browser pane | open, draft, `mergeable: false`, konflik 105 commit, 0 review, macOS only, +321/-2 | Tidak bisa dipakai sekarang |
| Roadmap resmi | Maintainer issue #218: "browser is in the roadmap ... probably will be an official mod" | Bentuk akhir kemungkinan mod dengan native view, tanpa tanggal |
| Batas mod viewer | `readTextFile` 1 MiB; `EditorState` tanpa API lompat baris; props pane beku | Viewer native read-only, bukan editor penuh |

Jadi keputusan sebenarnya bukan "pane atau tab" di dalam Herdr. Keputusannya: **px0 di luar window atau menunggu webview masuk ke Herdr**. Semua opsi lain adalah kompromi.

## 4. Opsi implementasi

### Opsi A - Editor Window (rekomendasi utama)

px0 menjadi jendela editor terpisah, berjalan seperti aplikasi sendiri. Herdr tetap cockpit terminal.

```
Herdr window                          px0 window (browser app mode / web app)
├─ sidebar                          ┌──────────────────────────────┐
├─ tabs -> panes (terminal)         │ px0 workbench                │
│  └─ agent, shell, dll             │  /w/<id>/  = workspace repo  │
└─ aksi "Open workspace"            │  file tree, git, editor, LSP │
   -> helper -> pre-warm -> open    └──────────────────────────────┘
```

Alur aksi:

```ts
Herdr aksi (mod atau key)
  -> helper shell/python
     -> baca ~/.px0/workbench.lock          (fallback: px0 <root>)
     -> GET  /api/wb/ping
     -> POST /api/wb/open {target: root}    (header Origin)
     -> poll GET /api/wb/state sampai running
     -> open "<wb>/w/<id>/"                 (app window / browser)
```

- Buka file: di dalam px0. Tidak ada pane Herdr, tidak ada tab Herdr.
- Buka file dari Herdr: tidak didukung di opsi ini. Klik file tetap preview di panel Files.
- Kerja: helper 80-120 baris + wiring mod 40-60 baris. Tanpa perubahan core.
- Risiko: dua window dan context switch; fokus browser; format `workbench.lock` bukan API stabil; id workspace harus cocok (`sha256("dir\0"+realpath(root))[:12]`).
- Cocok kalau: user menerima editor di window lain. Ini paling dekat dengan pengalaman Sheprd tanpa mengubah produk.

### Opsi B - Viewer pane native (in-window)

Klik file di panel Files membuka pane mod read-only di dalam window Herdr.

```ts
klik file di Files mod
  -> setShared("viewer.target", {file, line})
  -> panes().find(p => p.mod === "viewer")
     -> ada:  run("pane.focus", {pane})
     -> tidak: run("pane.split", {
                 direction: "right", pane, mod: "viewer",
                 props: {file, line}
               })
  -> Viewer mod: readTextFile -> EditorState(readonly) -> Editor
```

- Buka file: **pane baru** di Herdr, read-only, syntax highlight, line number.
- Kerja: 180-260 baris JS + 2 `mod.json`.
- Risiko: tanpa lompat baris; file > 1 MiB terpotong; props pane beku (pakai shared); drift mod saat Herdr update.
- Cocok kalau: glance cepat sambil mengetik di terminal lebih penting daripada fidelity px0. Ini tidak memberi "web editor".

### Opsi C - Bridge klik file ke px0 (tab browser baru)

Klik file membuka px0 di tab browser baru, langsung pada file dan line.

```ts
klik file (modifier, mis. cmd-klik)
  -> helper: hitung root + workspace id + path relatif
  -> pre-warm child (POST /api/wb/open + poll state)
  -> open "<wb>/w/<id>/?path=<rel>&line=<n>"
```

- Buka file: tab browser baru di px0. Tidak ada pane Herdr. Tidak ada proses px0 baru bila workbench dan child hidup.
- Kerja: 40-80 baris.
- Risiko: satu klik satu tab; child dingin membuang query (wajib pre-warm); path harus relatif root; px0 menghapus `path`/`line` setelah load; fokus browser dicuri; navigasi tab existing hanya lewat AppleScript (rapuh, izin Automation, jangan jalur utama).
- Cocok kalau: dipakai sebagai akselerator dengan modifier, bukan jalur utama.

### Opsi D - Tunggu browser mod resmi (dependency)

- Browser masuk roadmap, kemungkinan sebagai mod resmi dengan native view. Tanpa tanggal.
- Kalau tersedia: px0 menjadi tab di dalam Herdr, satu per workspace, reuse tab. Persis model Sheprd.
- Kerja sekarang: 0. Siapkan desain agar mudah dimigrasikan.
- Risiko: tidak bisa dijadwalkan. Jangan jadikan prasyarat.

### Opsi E - Pindah ke Sheprd

- Sheprd sudah punya semua yang dicari: browser tab, px0 tab per workspace, code tab FILE[:LINE], link terminal ke browser.
- Sheprd bisa attach ke daemon Herdr 1 dan join `herdr-core` yang sudah berjalan. Core milik herdr-app 0.1.12 ada di endpoint yang sama (`~/.local/state/herdr-core/default/default.sock`, docs.json berkey `herdr-app`).
- Tetapi: adopsi tab/layout herdr-app ke UI Sheprd **tidak terverifikasi** (tidak ada importer; sidebar hanya daftar tab milik Sheprd). Layout JSON dan mods JS tidak portabel; Sheprd memakai Luau dan `editor-groups.json`. Belum terpasang di mesin ini.
- Cocok kalau: halaman web di dalam window adalah syarat keras dan user rela membangun ulang layout/mods.

### Opsi F - Companion webview app (tidak disarankan sekarang)

Bangun aplikasi kecil WKWebView/wry yang hanya memuat px0 tanpa chrome browser, dengan hotkey fokus dan dukungan deep link. Ini memberi tampilan seperti Sheprd tanpa pindah produk. Tetapi menambah codebase, packaging, signing, dan maintenance baru. Pakai hanya kalau Opsi A terasa kasar.

## 5. Matriks keputusan

| Kriteria | A. Editor Window | B. Viewer pane | C. Bridge tab | D. Tunggu upstream | E. Sheprd |
| --- | --- | --- | --- | --- | --- |
| px0 di dalam window Herdr | Tidak | Tidak | Tidak | Ya (nanti) | Ya |
| File terbuka jadi apa | tab internal px0 | pane baru read-only | tab browser baru | internal px0 | internal px0 |
| Fitur edit/git/LSP px0 | Penuh | Read-only + px0 | Penuh | Penuh | Penuh |
| Context switch | Tinggi | Rendah | Sedang | Tidak ada | Tidak ada |
| Kerja sekarang | Rendah (120-180 baris) | Sedang (180-260) | Rendah (40-80) | Nol | Tinggi (migrasi) |
| Drift yang ditanggung | Rendah | Sedang-tinggi (mod) | Rendah | Nol | Sedang (ekosistem baru) |
| Memori sistem | +93-126 MB (px0 + tab) | +5-7 MB (pane) | sama dengan A | px0 di dalam app | serupa A |
| Tanggal tersedia | Sekarang | Sekarang | Sekarang | Tidak ada | Sekarang (dengan biaya) |

## 6. Rekomendasi

Urutan eksekusi yang disarankan:

**Fase 1 - Opsi A, 1-2 hari, risiko rendah.**
- Helper: baca lock, pre-warm, buka `?open=<root>` di jendela px0.
- Mod: satu aksi `Open px0 workspace` + key. Hapus timer 4 detik yang sudah tercatat sebagai pemborosan.
- Window: pakai browser app mode (Brave/Chrome `--app`) atau web app macOS agar tanpa tab bar. Letakkan di samping Herdr.
- Tidak mengubah layout rail. Tidak membangun bridge per file.

**Fase 2 - evaluasi 1 minggu.**
- Apakah dua window mengganggu? Kalau ya, pertimbangkan Opsi F atau E.
- Apakah panel Files/Git rail masih dipakai? Kalau tidak, hapus clone Git dan polling git footer, sesuai analisis biaya sebelumnya.
- Catat berapa kali `Open px0 workspace` dipakai per hari.

**Fase 3 - pilih jalur permanen.**
- Kalau in-window glance wajib: tambah Opsi B viewer pane.
- Kalau px0 window sudah nyaman: hapus Files/Git kustom, sisakan launcher + `sweg-pane`.
- Kalau halaman web harus di dalam Herdr: pantau mod browser resmi (Opsi D). Bila tidak terbit dalam waktu yang dibutuhkan, pindah ke Sheprd (Opsi E).

Jangan lakukan sekarang:
- Jangan membuat pane per file. Itu bukan model px0; px0 adalah satu workspace tab.
- Jangan memakai AppleScript sebagai jalur utama buka file.
- Jangan menulis ulang layout ke Sheprd sebelum uji adopsi core.

## 7. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| `workbench.lock` berubah format | Aksi open gagal | Fallback spawn `px0 <root>`; tampilkan pesan |
| Workspace id tidak cocok | Membuka child baru, bukan yang hidup | Verifikasi `GET /api/wb/state`; hitung `realpath` |
| Fokus browser mencuri keyboard | Mengganggu agent | `open -g`; satu aksi manual, bukan otomatis |
| Child px0 idle stop 30 menit | Deep link ke holding page | Pre-warm sebelum buka |
| Dua window membingungkan | User kembali ke rail | Fase evaluasi; sediakan hotkey fokus |
| Upstream browser mod tidak terbit | Rencana B macet | Opsi A tetap jalan; Opsi E tersedia |
| Migrasi Sheprd mengubah layout | Kehilangan SWEG | Uji adopsi core dulu; pertahankan herdr-app tetap terpasang |

## 8. Jawaban langsung

- **Apakah buka file membuat pane baru?** Di model px0-as-workspace: tidak. File dibuka di dalam px0. Di Sheprd, aksi file native menghasilkan pane terminal editor atau code tab, bukan pane px0.
- **Apakah px0 bisa jadi pane di herdr-app sekarang?** Tidak. Tidak ada webview.
- **Opsi terbaik sekarang?** Opsi A: px0 sebagai jendela editor terpisah, Herdr sebagai terminal cockpit. Bridge klik file (Opsi C) hanya akselerator opsional. Viewer pane native (Opsi B) hanya kalau glance di dalam window wajib. Browser mod resmi (Opsi D) adalah jalur upgrade, bukan prasyarat.

## 9. Metode dan sumber

- Riset paralel 3 agent: model Sheprd (source clone `penso/herdr-gpui` commit `3b9800f`), permukaan open-file px0 (source tag `v0.1.20`, uji instance terisolasi), opsi herdr-app 0.1.12 (API mod, PR/issue GitHub, source Sheprd).
- Semua pengukuran app read-only. Tidak ada perubahan layout, key, atau UI user. px0 user (PID 82419/82755) tidak disentuh.
- Sumber utama ada di tiga dokumen pendukung dan dokumen biaya. Data web dianggap data eksternal.
