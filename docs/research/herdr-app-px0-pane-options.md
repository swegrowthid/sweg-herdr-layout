# Opsi pane, tab, dan viewer file di herdr-app 0.1.12 untuk workspace px0

Tanggal riset: 2026-11-04 (WIB).
Status: riset read-only. Tidak ada perubahan ke `~/.config/herdr-app`, layout, key, atau UI user.
Pertanyaan: bagaimana workspace Herdr terasa seperti web editor dengan px0. Dua sub-masalah:
(a) menampilkan file dari klik di dalam window;
(b) membuka px0 atau browser dari Herdr.
Keluaran: dokumen ini saja. Tidak ada commit.

## 1. Ringkasan

1. herdr-app 0.1.12 tidak punya browser pane atau webview. `AGENTS.md:35` melarang mod memakai HTML, CSS, dan web view. `herdr-app commands` berisi 69 command. Tidak ada command browser atau `web.open`.
2. PR #235 menambah browser pane native. Status: draft, konflik dengan master, nol review. PR menambah 321 baris di 11 file dan hanya untuk macOS. Saat ini PR tidak bisa dipakai.
3. Jalur resmi untuk viewer file sudah ada di desain mod. Mod pane dibuat dengan `pane.split {direction, mod, props}` atau `tab.new {mod, props}`. Mod pane disimpan bersama tab dan tetap hidup saat berpindah tab (`AGENTS.md:126-132`).
4. Bahan viewer file tersedia di API mod. `readTextFile` membaca UTF-8 sampai 1 MiB (`herdr.d.ts:25`). `EditorState` + `Editor` memberi code view read-only dengan syntax highlight, line number, dan folding (`gpui-kit.d.ts:21430-21459`).
5. Mod `files` bawaan sudah memakai `Editor` untuk preview di dalam panel. Klik file hanya menampilkan preview di panel yang sama, bukan pane atau tab baru (`mods/files/main.js:122-169`).
6. Batas penting 0.1.12: `EditorState` tidak punya API lompat ke baris. Props mod pane tidak bisa diubah setelah pane dibuat. Tidak ada API untuk memberi fokus programatik ke `Editor`.
7. px0 di 0.1.12 hanya bisa jalan di pane terminal. Halamannya terbuka di browser sistem. Mod kustom `sweg-focus-px0` sudah melakukan ini (`layouts/sweg-focus/mods/sweg-focus-px0/main.js:1-3`).
8. Sheprd (`penso/herdr-gpui`, commit `3b9800f`) sudah punya model target: browser tab native, code tab read-only, px0 tab per workspace, dan link terminal ke browser tab. Sheprd adalah app pihak ketiga yang terpisah, bukan herdr-app.
9. Rekomendasi jangka pendek: Opsi A (viewer mod sebagai pane) + Opsi D (px0 ke browser sistem). Opsi C (editor terminal) dipakai bila butuh lompat baris dan file besar. Opsi E (browser pane upstream) hanya bisa ditunggu atau dikontribusikan. Sheprd adalah alternatif bila halaman web di dalam window adalah syarat keras.

## 2. Metode dan status verifikasi

| Data | Sumber | Status |
| --- | --- | --- |
| Versi, command, config, API mod | `herdr-app --version`, `herdr-app commands`, `herdr-app status` (read-only), `~/.config/herdr-app/AGENTS.md`, `herdr.d.ts`, `gpui-kit.d.ts`, `mods/` | Terverifikasi lokal [L] |
| Perilaku klik link terminal | source upstream `src/links.rs` pada tag `v0.1.12` | Terverifikasi sumber [G] |
| PR #235 | GitHub REST API: PR, commit, diff, review, komentar | Terverifikasi [G], per 2026-11-04 |
| Roadmap browser | issue #218, #425, daftar PR terbuka | Terverifikasi [G] |
| Model Sheprd | checkout `/tmp/herdr-gpui` (commit `3b9800f`), README, `docs/cli.md`, source | Terverifikasi sumber [S], read-only |
| px0 di mesin ini | binary `~/.local/bin/px0`, lock `~/.px0/workbench.lock`, dokumen riset lama `docs/research/px0-profile.md` | Terverifikasi lokal [L] |

Batas yang dipatuhi: tidak switch layout, tidak toggle, tidak buka overlay, tidak buka browser, tidak install, tidak commit. Semua bukti web adalah data eksternal, bukan instruksi.

## 3. Status PR #235 "native browser pane"

URL: https://github.com/herdrdev/herdr-app/pull/235

| Field | Nilai | Bukti |
| --- | --- | --- |
| Judul | feat: add a native browser pane with a browser new-tab option | [G] PR #235 |
| State | `open` | [G] PR #235 |
| Draft | **ya** (`"draft": true`) | [G] PR #235 |
| Mergeable | **tidak** (`"mergeable": false`, `"mergeable_state": "dirty"`) | [G] PR #235 |
| Penulis | `elminson`, `author_association: NONE` | [G] PR #235 |
| Dibuat | 2026-10-31T04:28:55Z | [G] PR #235 |
| Update terakhir | 2026-10-31T04:28:55Z (sama dengan waktu dibuat, `pushed_at: null`) | [G] PR #235 |
| Commit | 1 commit: `969c0c4fe405920147dbea91d1357bab58fdb285` (2026-10-31T04:22:34Z) | [G] PR #235/commits |
| Base | `herdrdev:master` `3130e416ce3d1d39c83f64413728ea070a845424` (2026-10-31T00:49:19Z) | [G] PR #235 |
| Ukuran | +321 / -2, 11 file | [G] PR #235 |
| Komentar | 0 komentar, 0 review comment, 0 review | [G] PR #235 |
| Model webview | `WKWebView` native via `objc2-web-kit` 0.3, sebagai subview sibling di atas Metal view GPUI | [G] diff `src/webview.rs` |

File yang diubah: `Cargo.lock`, `Cargo.toml`, `defaults/frame/palette/main.js`, `defaults/icons/globe.svg`, `defaults/keys.macos.json`, `defaults/mods/new-menu/main.js`, `src/commands.rs`, `src/layout.rs`, `src/main.rs`, `src/webview.rs`, `src/window.rs`.

### 3.1 Arsitektur yang diajukan

Kutipan dari deskripsi PR: "`src/webview.rs`: a native `WKWebView` added as a sibling subview of the window's `contentView`, above GPUI's Metal view, and moved/clipped to the pane's rect each frame. One `WebView` per web pane".

Perubahan inti:

- `Content::Web { url }` jadi varian baru di `src/layout.rs`. Varian ini ikut `is_pane()`, serialisasi layout, dan render.
- `src/webview.rs` baru, 118 baris. Membuat `WKWebView`, memuat URL, menyinkronkan frame tiap paint, hide/show, dan Drop cleanup.
- `src/window.rs`: `webviews: HashMap<String, WebView>` + `sync_webviews` + render block `Content::Web`.
- Command baru `web.open {url?, space?, name?}` di `src/commands.rs`. Tanpa URL, command membuka prompt lalu memakai hasilnya.
- UI: baris "Browser" di menu `+` (`defaults/mods/new-menu/main.js`), "New browser tab" di palette, ikon globe, shortcut `cmd-shift-b` (`defaults/keys.macos.json`).
- Dependency macOS: `objc2`, `objc2-app-kit`, `objc2-foundation`, `objc2-web-kit`, `raw-window-handle` (`Cargo.toml`).

Kutipan scope dari deskripsi PR: "**macOS only.** Linux (WebKitGTK) and Windows (WebView2) are deferred. No address bar / back-forward yet (one URL per tab) - intended as a follow-up mod. Kept as a draft until Can weighs in on the core change."

### 3.2 Mengapa PR belum bisa dipakai

1. Draft. Penulis menunggu keputusan maintainer tentang perubahan core. Deskripsi PR meminta review pada "whether a browser belongs in core vs. another boundary".
2. Konflik. Base PR `3130e41` tertinggal 105 commit dari `master` `9a6e0310` (2026-11-03T22:12:49Z). Bandingkan `3130e41...master`: `ahead_by: 105`, 109 file berubah. File yang dipakai PR ikut berubah besar: `src/window.rs` +791/-102, `src/commands.rs` +33/-11, `Cargo.toml`, `Cargo.lock`, `defaults/mods/new-menu/main.js`, `defaults/frame/palette/main.js`, `defaults/keys.macos.json`.
3. Nol respons. Tidak ada review, komentar, atau push sejak 2026-10-31.
4. Tidak ada di rilis. Tag terbaru `v0.1.12` = commit `4aa3460749947e7771aa39a8a2cec58d46649926` (2026-11-02T13:28:33Z). `master` sekarang 45 commit di depan `v0.1.12` (51 file), dan tidak ada file webview atau browser di 45 commit itu.
5. Scope terbatas. macOS saja, satu URL per tab, tanpa address bar, tanpa back/forward. Untuk px0 ini cukup, tetapi bukan browser penuh.

### 3.3 Stance roadmap resmi

Issue #218 "Mods can't show a web page in a pane": https://github.com/herdrdev/herdr-app/issues/218

Komentar maintainer `ogulcancelik` (CONTRIBUTOR), 2026-10-31T00:41:44Z, lalu issue ditutup:
https://github.com/herdrdev/herdr-app/issues/218#issuecomment-6536660100

> "browser is in the roadmap, needs some more tasting but probably will be an official mod."

Arti: bentuk yang paling mungkin bukan PR #235 (varian core `Content::Web`), tetapi mod resmi dengan elemen native view. Karena itu PR #235 kemungkinan besar tidak menjadi jalur utama.

### 3.4 PR dan issue terkait (per 2026-11-04)

| Item | Status | Relevansi |
| --- | --- | --- |
| [#425](https://github.com/herdrdev/herdr-app/issues/425) "Mods can't host a native view" | closed oleh penulis, 2026-11-03 | Bukti teknis: patch host 236 baris di 9 file + crate `native/herdr-native-view`; elemen `herdr.nativeView` untuk web, pdf, media, quicklook. Repo: `obqyuxi/herdr-universal-preview` |
| [#412](https://github.com/herdrdev/herdr-app/pull/412) "let layouts choose a mod to open terminal links" | open, **draft**, clean | Jalur agar klik link/file di terminal diarahkan ke mod, bukan system opener |
| [#405](https://github.com/herdrdev/herdr-app/pull/405) "render markdown previews in files panel" | open, bukan draft, clean | Preview `.md` dirender di panel Files |
| [#370](https://github.com/herdrdev/herdr-app/pull/370) "mods can answer a code editor's lsp requests and read its caret" | open, bukan draft | Menambah caret/selection API untuk `EditorState`, relevan untuk lompat baris |
| [#248](https://github.com/herdrdev/herdr-app/pull/248) "wrap long lines in the changes diff and the files preview" | open, bukan draft | Perbaikan tampilan preview |

### 3.5 Proyeksi realistis

- `v0.1.12` (terpasang): tidak ada browser pane. Pasti.
- `v0.1.13` atau rilis berikutnya dari `master` sekarang: kemungkinan besar tetap tidak ada. Tidak ada commit browser di 45 commit pasca `v0.1.12`.
- PR #235 apa adanya: kecil kemungkinan mendarat. Draft, konflik 105 commit, nol review, dan arah roadmap berbeda.
- Browser resmi: menunggu keputusan maintainer. Tidak ada tanggal. Estimasi kasar: minggu sampai bulan, bukan hari.
- Jika user butuh sekarang: pakai Opsi A/C/D di dokumen ini, atau pertimbangkan Sheprd.

## 4. API mod 0.1.12 yang relevan

Semua path di bawah relatif ke `~/.config/herdr-app`.

| API | Kegunaan untuk tujuan ini | Bukti |
| --- | --- | --- |
| `exec(command, args, {cwd, on})` | Jalankan program dengan environment user. Batas 30 s, output 8 MiB. Dipakai untuk `open` URL, `nvim`, `bat`, `hc` | `herdr.d.ts:10-13` |
| `hc(args)` | Jalankan `herdr-core`. Contoh: `hc read <terminal> --lines N` untuk membaca output px0 | `herdr.d.ts:15-16` |
| `readTextFile(path, {on})` | Baca teks UTF-8 sampai 1 MiB. Jalan di luar UI thread. Null bila tidak ada | `herdr.d.ts:23-25` |
| `writeTextFile(path, text, expected)` | Tulis teks dengan cek stale. Bisa untuk mode edit | `herdr.d.ts:26-28` |
| `run(name, args)` | Jalankan command app. Termasuk `pane.split`, `tab.new`, `pane.focus`, `pane.zoom` | `herdr.d.ts:44-78` |
| `pane.split {direction*, pane?, argv?, mod?, props?}` | Buat pane baru: terminal (`argv`) atau mod (`mod` + `props`) di kanan/bawah pane target | `herdr.d.ts:57`; `AGENTS.md:532`; output `herdr-app commands` |
| `tab.new {name?, space?, folder?, argv?, task?, mod?, props?}` | Buat tab dengan satu pane mod. Cocok untuk viewer full-screen | `herdr.d.ts:53-55`; output `herdr-app commands` |
| `pane.focus {pane}` | Fokus pane yang sudah ada. Untuk memakai ulang satu viewer pane | `herdr.d.ts:58`; `AGENTS.md:537` |
| `panes()` | Daftar pane. Pane mod punya `mod` dan `pane`. Untuk mencari viewer yang sudah ada | `herdr.d.ts:182-206` |
| `openOverlay(spec)` | Tampilkan mod sebagai `dialog`, `popup`, atau `window` di atas layout. `window` bisa `key` + `keep` | `herdr.d.ts:331-363`; `AGENTS.md:923-937` |
| `props()` | Props dari layout atau overlay. Mod pane menerima `{file, line}` di sini | `herdr.d.ts:380-386` |
| `shared(key)` / `setShared(key, value)` | State lintas mod. `setShared` memicu re-render semua mod. Untuk mengganti target viewer tanpa membuat pane baru | `herdr.d.ts:388-392` |
| `nextCommand()` | Antrean command `<mod>.<name>` untuk copy mod ini | `herdr.d.ts:394-401` |
| `watchFolder(path)` | Batch perubahan folder. Untuk auto-reload file yang sedang dilihat | `herdr.d.ts:403-413` |
| `EditorState.new({language, value, readonly, font_family, font_size, line_numbers, folding, soft_wrap, syntax})` + `Editor.new(state)` | Code view read-only dengan syntax highlight, line number, folding | `gpui-kit.d.ts:21430-21459`; contoh `AGENTS.md:888-892` |
| `EditorState.value()` / `set_value()` / `on(...)` / `release()` | Ganti isi saat target berubah; lepas state lama | `gpui-kit.d.ts:21431-21436` |
| `fetch(url, options)` | HTTP dari mod. Bisa untuk cek px0 `/api/wb/ping` atau endpoint lokal | `gpui-kit.d.ts:22187` |
| `herdr-app do <command> [args]` | Jalankan command app dari shell. Untuk agent atau script | `AGENTS.md:600`; `herdr-app --help` |
| `notify`, `openOverlay`, `closeOverlay` | Umpan balik dan panel sementara | `herdr.d.ts:362-378` |

Batas model mod 0.1.12 yang mengikat opsi:

1. Tidak ada HTML, CSS, web view, Node API, atau `setTimeout` (`AGENTS.md:35`). Jadi halaman px0 tidak bisa dirender di dalam blok mod.
2. `readTextFile` hanya UTF-8 sampai 1 MiB (`herdr.d.ts:23-25`). File biner harus ditolak. File besar harus dipotong.
3. `EditorState` tidak punya API scroll ke baris, pilih rentang, atau baca caret. API-nya hanya `value`, `set_value`, `on`, `release` (`gpui-kit.d.ts:21430-21459`). Props `{line}` hanya bisa ditampilkan di header, belum bisa jadi posisi kursor.
4. Props mod pane tidak bisa diubah setelah pane dibuat. Tidak ada command update props. Solusi: state `shared` atau buat pane baru.
5. Mod pane tetap bisa fokus dan menerima keyboard bila `mod.json` memakai `"focusable": true` (`AGENTS.md:537`, `AGENTS.md:748`).
6. Klik link di terminal 0.1.12 langsung ke system opener: `open` di macOS, `xdg-open` di Linux, `explorer` di Windows (`src/links.rs` tag `v0.1.12:114-136`, https://github.com/herdrdev/herdr-app/blob/v0.1.12/src/links.rs). Mod tidak bisa mencegatnya di 0.1.12. PR #412 (draft) menambah `terminal_links` untuk ini.
7. Mod adalah kode trusted. Command dan akses jaringan tidak dibatasi (`AGENTS.md:963`). Ini berbeda dari model keamanan Sheprd, yang menganggap setiap halaman web tidak trusted.

## 5. Preseden mod shipped

| Mod | Fungsi | Yang bisa dipakai | Batas |
| --- | --- | --- | --- |
| `files` | File browser + preview di panel | `readTextFile` + `EditorState(readonly)` + `Editor`; truncate 400.000 karakter; tolak biner via `\0`; `LANG` map; watch folder; `cx.timer.every(10000)` | Klik file hanya mengisi preview di panel yang sama, bukan pane/tab baru (`main.js:122-169`) |
| `peek` | Bar di atas terminal peek (agent/sub-agent) | Pola overlay untuk terminal, tombol aksi, `closeOverlay` | Bukan viewer file. `mod.json`: `{ "place": "none", "title": "Peek" }` |
| `pane` | Contoh pane header | Pola tombol pane header yang menjalankan `run(command, args)` (`main.js:38`) | Hanya header. Tidak ada tombol viewer |
| `sweg-focus-px0` (repo ini) | Launcher px0 | Mulai px0 di split terminal, deteksi sesi via `terminals()`, buka folder | Halaman tetap di browser sistem. Tanpa embed |

Kesimpulan: jalur "klik file -> pane viewer" belum ada di shipped mods. Bahannya lengkap: `files` sudah punya kode baca + render Editor. Yang kurang hanya pemanggilan `pane.split`/`tab.new` dan mod viewer terpisah.

## 6. Opsi implementasi

### Opsi A - Viewer mod sebagai pane (rekomendasi utama)

Satu mod baru `viewer`. Mod `files` (atau klon `sweg-focus-files`) mengirim target lewat `setShared`, lalu membuat atau memfokuskan satu pane viewer.

Alur:

```ts
// Production: klik file di mod Files
Files mod
  -> setShared("viewer.target", { file: "src/app.ts", line: 42 })
  -> panes().find(p => p.mod === "viewer")
     -> ada: run("pane.focus", { pane })          // pakai ulang viewer
     -> tidak ada: run("pane.split", {
          direction: "right",
          pane: targetPane,                        // pane model eksplisit
          mod: "viewer",
          props: { file, line }
        })
  -> Viewer mod render
     -> setShared("viewer.target") berubah -> cx.notify()
     -> readTextFile(file, { on: machine })        // 1 MiB, UTF-8
     -> EditorState.new({ language, value, readonly: true, syntax })
     -> Editor.new(state).flex_1().min_h(0)
```

Prasyarat:

- Folder mod `viewer/` dengan `mod.json { "place": "none" }` + `main.js`. Copy ke `~/.config/herdr-app/mods/viewer/` (atau lewat folder layout repo).
- Hook di mod Files: pada `this.show(path, cx)`, panggil aksi viewer. Resolusi pane target: `focused()?.pane ?? panes().find(p => p.tab === focused()?.tab)?.pane`. Pane eksplisit wajib saat yang fokus adalah terminal block layout, karena split implisit gagal (`herdr.d.ts:218-226`).
- Viewer membaca `props()` sebagai nilai awal dan `shared("viewer.target")` sebagai target aktif. Saat target berubah, `release()` state lama lalu buat `EditorState` baru.
- Tangani error: `readTextFile` null (file hilang), biner (`\0`), lebih dari 1 MiB, dan file terpotong. Tampilkan pesan di body.
- `herdr-app check ~/.config/herdr-app/mods/viewer` harus lulus. Uji juga di window.

Risiko:

- Tidak ada lompat baris. Nomor baris hanya tampil di header atau daftar; kursor tidak bisa dipindah. Mitigasi parsial: arahkan pengguna ke Opsi C untuk lompat baris.
- Batas 1 MiB dan potongan 400.000 karakter untuk file besar.
- Posisi scroll dan pilihan hilang saat target berganti.
- Fokus keyboard ke `Editor` tidak punya API programatik. Klik dulu untuk scroll keyboard.
- Scrollbar di dalam `Editor` belum terdokumentasi di `gpui-kit.d.ts`. Perlu uji visual.
- Props pane beku. Navigasi hanya lewat `shared`; dua viewer pane akan menampilkan target yang sama.
- Mod kustom ikut menanggung drift saat Herdr update (lihat `docs/research/custom-mods-cost-audit.md`).

Estimasi: 180-260 baris JS baru (viewer 150-220, hook Files 15-25, menu/key opsional 20), 2 mod.json, 1-2 file.

Hasil: file muncul di pane native dalam window. Pane bisa di-resize, di-zoom, disimpan bersama tab, dan dibuka ulang. Ini paling dekat dengan "file dari klik" tanpa menyentuh core.

### Opsi B - Viewer sebagai overlay window

Mod viewer yang sama dipakai lewat `openOverlay({mod: "viewer", kind: "window", key: "viewer", keep: true, width, height, props: {file, line}})`. Satu instance dipakai ulang karena `key` yang sama mengganti window lama (`AGENTS.md:930-936`).

Prasyarat: satu mod viewer; pemanggil memakai `openOverlay`, bukan `pane.split`. Bila overlay ditutup, state tetap di mod.

Risiko: bukan pane, jadi tidak ikut split/zoom/tab dan tidak tersimpan bersama tab. Layout switch menutup window (`AGENTS.md:934`). Window tidak mengambil keyboard saat dibuka; mod harus fokus sendiri, dan `Editor` tidak punya API fokus. Lebih cocok untuk inspeksi cepat daripada alur editor.

Estimasi: 110-170 baris (bisa berbagi inti dengan Opsi A), 1 file.

### Opsi C - Editor atau pager di pane terminal

Tanpa mod viewer baru. Mod Files memanggil pane split dengan `argv`, misalnya `["nvim", "+42", "/abs/path"]`, `["less", "+42", "/abs/path"]`, atau `["bat", "--paging=never", "/abs/path"]`.

Prasyarat: program terpasang di mesin pane target. Path absolut. Untuk mesin remote, argv berjalan di mesin pane target, jadi path harus valid di sana.

Risiko: tampilan terminal, bukan UI native. Read-only tidak bisa dipaksa untuk `nvim`. Lompat baris bergantung program. Setiap klik membuka pane baru bila tidak ada logika fokus ulang.

Estimasi: 15-40 baris perubahan di mod Files, 0 mod baru.

Hasil: cara tercepat untuk "klik file -> buka editor di sebelah". Cocok untuk file besar dan lompat baris. Paling dekat dengan perilaku `code edit` Sheprd.

### Opsi D - px0 ke browser sistem dengan bridge dari Herdr

px0 tetap web app di browser sistem. Mod Herdr memperbaiki alur buka dan fokus.

Tiga bagian:

1. Mulai px0 di split terminal seperti sekarang (`sweg-focus-px0`). px0 versi terpasang (0.1.20) membuka browser sendiri secara default.
2. Temukan URL px0. Dua jalur: (a) baca `~/.px0/workbench.lock` dengan `readTextFile` (isi saat ini: `{"pid": 82419, "url": "http://127.0.0.1:7777"}`); (b) setelah pane px0 jalan, `hc(["read", address, "--lines", "200"])` lalu cari baris `url http://127.0.0.1:<port>`.
3. Buka dengan `exec("open", [url])` atau `exec("open", ["-a", "Google Chrome", url])`. Untuk workspace root, px0 menerima query `?open=<root>` (dipakai Sheprd; `px0.rs:134-138` di checkout Sheprd).

Risiko:

- Tidak ada kontrol fokus browser. `open` bisa membuka tab baru, tetapi tidak bisa menjamin window depan. Tidak ada API window browser.
- `?open=` adalah parameter workspace, bukan file. Deep link per file belum terverifikasi. Jadi klik file di Herdr belum tentu membuka file yang sama di px0.
- Format `~/.px0/workbench.lock` milik px0, bukan API stabil. Perlu fallback dan error state.
- Batas proses: exec 30 s dan 8 MiB output. Jangan polling 4 s seperti mod sekarang; audit sebelumnya mencatat timer px0 4 s sebagai beban idle.
- Halaman tetap di luar window. Ini memenuhi "buka px0 dari Herdr", bukan "px0 jadi pane".

Estimasi: 40-80 baris di mod px0 atau mod baru, 0-1 file.

### Opsi E - Browser pane upstream (PR #235 atau mod resmi)

Ikut jalur core: tunggu PR #235 diterima atau mod resmi dengan elemen native view. Bentuk akhir kemungkinan besar bukan `Content::Web`, tetapi elemen native view untuk mod, sesuai komentar roadmap di issue #218 dan usulan issue #425.

Prasyarat: keputusan maintainer, review core, dan rebase 105 commit. Keamanan harus dirancang: halaman tidak trusted, overlay di atas native view, serah-terima keyboard, dan konsen akses agent (rincian di body issue #218).

Risiko: tidak ada tanggal. PR #235 tidak aktif. Alternatifnya menulis patch host sendiri seperti `obqyuxi/herdr-universal-preview`, tetapi itu memaksa fork app dan mengulang biaya drift.

Estimasi: 0 baris config bila menunggu. PR #235 sudah 321 baris di 11 file. Patch host versi issue #425: 236 baris di 9 file plus crate native. Perawatan jangka panjang besar.

### 6.1 Perbandingan opsi

| Opsi | File di window | px0 di window | Butuh core | Kerja (baris) | Risiko utama |
| --- | --- | --- | --- | --- | --- |
| A. Viewer pane mod | Ya, pane native | Tidak | Tidak | 180-260 | Tanpa lompat baris; batas 1 MiB; drift mod |
| B. Viewer overlay | Ya, window melayang | Tidak | Tidak | 110-170 | Bukan pane; tutup saat layout switch |
| C. Terminal editor pane | Ya, di terminal | Tidak | Tidak | 15-40 | UI terminal; butuh program eksternal |
| D. px0 + browser sistem | Tidak | Tidak | Tidak | 40-80 | Di luar window; fokus tidak terkendali |
| E. Upstream browser pane | Ya, halaman asli | Ya | Ya | 321+ (PR #235) | Tidak ada tanggal; konflik; macOS saja |

## 7. Tabel banding Sheprd vs herdr-app 0.1.12

Sheprd = `penso/herdr-gpui` (commit `3b9800f`, 2026-11-03). Repo publik 2.131 star, rilis terakhir `v20261103.1` (2026-11-03T09:04:00Z, https://github.com/penso/herdr-gpui/releases/tag/v20261103.1). Sheprd menyebut dirinya "Unaffiliated project" terhadap Herdr (`README.md:35`). App ini tidak terpasang di mesin ini. Mod Sheprd memakai Luau dan folder `<config>/herdr/gpui-mods` (`docs/mods.md:1-14`), jadi tidak kompatibel dengan mod JS `~/.config/herdr-app/mods`.

| Fitur | Sheprd | herdr-app 0.1.12 | Workaround mod di 0.1.12 |
| --- | --- | --- | --- |
| Halaman web di dalam window | Ya. Browser tab berisi web view native (`crates/sheprd-gpui/README.md:2952-3000`; `src/browser.rs:1-9`). WebKit di macOS, WebView2 di Windows | Tidak. Web view dilarang untuk mod (`AGENTS.md:35`). 69 command, tanpa browser | Tidak ada. Hanya system browser |
| Browser tab di samping terminal | Ya. Tab di editor group; split `Cmd-\`; tab browser hanya milik Sheprd, daemon tidak melihatnya (`README:2890-2950`, `README:2954-2958`) | Tidak | Tidak ada |
| Alamat URL, back/forward, zoom | Ya. Toolbar dengan address bar, back, forward, reload, zoom per tab (`README:2970-2990`) | Tidak | Tidak ada |
| px0 | Tab px0 per workspace, embed. Deteksi `workbench.lock`, start sendiri, `?open=<root>`, `sheprd px0 open` (`README:3553-3592`; `src/browser/px0.rs:1-40`; `src/px0.rs:134-138` di Sheprd) | px0 di pane terminal, halaman di browser sistem (`sweg-focus-px0/main.js:1-3`, 114 baris) | Opsi D: URL discovery + `exec("open")`. Tidak embed |
| Viewer file read-only | Code tab: syntax colouring, outline, `FILE[:LINE]`, file sampai 1 MiB, 20.000 baris pertama diwarnai (`README:2811-2815`; `docs/cli.md:105`) | Preview di panel Files saja (`mods/files/main.js:122-169`) | Opsi A: viewer pane mod dengan `Editor` |
| Klik file -> buka di pane/tab | Go to File / code tab; `sheprd code open FILE[:LINE]` (`docs/cli.md:105`) | Klik hanya preview di panel (`files/main.js:148,169`) | Opsi A atau C |
| Klik path di terminal -> buka di baris | Ya. Cmd-click path membuka terminal editor di pane split kanan pada baris cetak (`README:2650-2712`) | System opener saja (`src/links.rs` v0.1.12:114-136) | Tidak ada di 0.1.12. PR #412 (draft) membuka jalur mod |
| Klik URL di terminal -> browser tab | Bisa, `open_links_in = "browser-tab"` (`README:2720`) | System opener | Tidak ada |
| Agent/CLI membuka halaman | Ya. `sheprd browser open/reload/list/navigate/zoom/text/screenshot`, `sheprd px0 open --json` (`docs/cli.md:98-118`; `skills/herdr-gpui-browser/SKILL.md:53-78`) | `exec` atau `herdr-app do` bisa menjalankan command, tetapi tidak ada window browser | Opsi D. Agent menyuruh mod lewat `notify`/shared/command |
| Berkas lokal dirender dengan aset | Ya. Skema `herdr-preview` menyajikan file dari folder halaman, dot file ditolak (`src/browser/location.rs:12`; `SKILL.md:53-70`) | Tidak | Tidak ada. Hanya `readTextFile` per file |
| Markdown dirender | Ya, di browser tab lokal | `TextView.markdown` di mod; panel Files belum merender (PR #405) | Opsi A: viewer mod pakai `TextView.markdown` untuk `.md` |
| PDF, media, Office native | Sebagian. Web view dapat menampilkan PDF/image/video; tidak ada viewer native khusus untuk mod | Tidak. Issue #425 ditutup; butuh patch core | Tidak ada |
| Catatan/annotasi halaman | Ya. Pill annotasi, `herdr.send`, review loop (`SKILL.md:148-165`) | Tidak | Tidak ada |
| Layout workspace SWEG | Tidak kompatibel. Sheprd punya editor group, config, dan state sendiri (`README:2890-2966`) | Ya. Layout dan 873 baris mod kustom ada di sini | - |
| Platform | macOS, Windows, Linux; page embed hanya macOS/Windows (`src/browser.rs:105`); Linux jatuh ke system browser (`control/server/browser.rs:39-48`) | macOS (app terpasang), Linux, Windows | - |
| Status pemakaian di mesin ini | Belum terpasang (tidak ada binary `sheprd`; tidak ada config Sheprd) | Terpasang dan berjalan, layout `SWEG` | - |

Kesimpulan banding: Sheprd sudah berisi seluruh model yang dicari user (browser tab px0, code tab, link ke browser). herdr-app 0.1.12 tidak. Namun keduanya app berbeda. Pindah ke Sheprd berarti kehilangan layout SWEG dan mod JS di repo ini. Tidak pindah berarti menerima batas di atas.

## 8. Rekomendasi

Urutan yang disarankan:

1. Opsi A dulu. Satu mod viewer pane memberi "klik file -> file terbuka di pane native" tanpa menyentuh core. Biaya 180-260 baris. Ini menjawab sub-masalah (a).
2. Tambah Opsi C sebagai aksi kedua ("Open at line" / "Open in editor"). Biaya kecil, menutup kekurangan lompat baris Opsi A.
3. Pakai Opsi D untuk px0. Bridge URL + `exec("open")` merapikan alur yang sekarang serba manual. Ini menjawab sub-masalah (b) sejauh mungkin di 0.1.12.
4. Jangan menunggu PR #235 untuk perencanaan. Perlakukan sebagai dependency opsional. Bila halaman web di dalam window wajib, keputusan sebenarnya ada di level produk: tunggu/kontribusi upstream, atau pakai Sheprd sebagai client kedua.

Keputusan yang perlu diambil Lead atau user:

- Apakah halaman px0 harus berada di dalam window Herdr? Jika ya, 0.1.12 tidak bisa. Pilihannya hanya upstream atau Sheprd.
- Apakah lompat baris wajib? Jika ya, Opsi A tidak cukup; tambah Opsi C atau tunggu PR #370.
- Apakah file besar dan file biner harus tampil? Jika ya, arahkan ke Opsi C (program eksternal), karena batas 1 MiB.

## 9. Sumber

PR dan issue herdr-app:

- PR #235: https://github.com/herdrdev/herdr-app/pull/235
- Commit PR: https://github.com/herdrdev/herdr-app/commit/969c0c4fe405920147dbea91d1357bab58fdb285
- Diff PR: https://github.com/herdrdev/herdr-app/pull/235.diff
- Issue #218 dan komentar roadmap: https://github.com/herdrdev/herdr-app/issues/218#issuecomment-6536660100
- Issue #425: https://github.com/herdrdev/herdr-app/issues/425
- PR #412: https://github.com/herdrdev/herdr-app/pull/412
- PR #405: https://github.com/herdrdev/herdr-app/pull/405
- PR #370: https://github.com/herdrdev/herdr-app/pull/370
- PR #248: https://github.com/herdrdev/herdr-app/pull/248
- Master `9a6e0310`: https://github.com/herdrdev/herdr-app/commit/9a6e0310fecd
- Tag `v0.1.12` (`4aa3460`): https://github.com/herdrdev/herdr-app/tree/v0.1.12
- `src/links.rs` v0.1.12: https://github.com/herdrdev/herdr-app/blob/v0.1.12/src/links.rs

Sheprd:

- Repo: https://github.com/penso/herdr-gpui
- Rilis terakhir: https://github.com/penso/herdr-gpui/releases/tag/v20261103.1
- Situs: https://sheprd.org
- Checkout lokal read-only: `/tmp/herdr-gpui` commit `3b9800ff7cff98141f835fa57bd84b8ae579e156`

Lokal read-only:

- `~/.config/herdr-app/AGENTS.md`, `herdr.d.ts`, `gpui-kit.d.ts`, `mods/`, `layouts/` (versi app 0.1.12)
- `herdr-app --version`, `herdr-app commands`, `herdr-app status`
- `~/.local/bin/px0` 0.1.20 dan `~/.px0/workbench.lock`
- `docs/research/px0-profile.md`, `docs/research/custom-mods-cost-audit.md`, `docs/research/20261104-workspace-custom-vs-px0.md`
- Repo ini: `layouts/sweg-focus/mods/sweg-focus-px0/main.js`, `layouts/sweg-focus/mods/sweg-focus-files/main.js`
