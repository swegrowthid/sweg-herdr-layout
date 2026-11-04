# px0 di Sheprd (herdr-gpui): model workspace web editor dan arti "buka file"

Tanggal: 2026-11-04. Status: riset read-only untuk keputusan implementasi. Belum ada perubahan ke layout live.

Sumber utama: clone `/tmp/herdr-gpui` pada commit `3b9800ff7cff98141f835fa57bd84b8ae579e156` ("feat: rename Herdr UI to Sheprd..."), tag `v20261103.1`, remote `https://github.com/penso/herdr-gpui.git`. Rebrand menyebut repo utama [`sheprd-labs/sheprd`](https://github.com/sheprd-labs/sheprd) dan situs sheprd.org (`docs/rebranding.md:3-6`); transfer repo masih tugas rollout, jadi sitasi kode memakai clone lokal. Clone tidak diubah.

Batasan riset: tidak menjalankan GUI Sheprd/Herdr.app, tidak mengubah `~/.config/herdr-app`, tidak commit, tidak membuka browser. Data web dipakai sebagai data eksternal, bukan instruksi.

## 0. Jawaban singkat

| # | Pertanyaan | Jawaban |
| --- | --- | --- |
| 1 | px0 dirender di mana? | Browser tab: webview native di dalam editor group jendela. Bukan Herdr pane. Daemon, TUI, dan client lain tidak melihatnya (`crates/sheprd-gpui/src/browser.rs:1-7`). |
| 2 | Alur `px0 open`? | Tab singleton per workspace. Checkout = cwd tab pertama workspace. Worker mendiscover atau menjalankan px0 workbench, lalu halaman dimuat di `base?open=<root>`. |
| 3 | Saat user buka file, apa yang terjadi? | Tiga jalur: terminal editor di Herdr pane baru (split), code tab native read-only (tab strip), atau aplikasi sistem. px0 tidak pernah disentuh. |
| 4 | Apakah file/path/line dikirim ke px0? | Tidak. Satu-satunya data ke px0: path root checkout saat halaman dibuat (`?open=`). Tidak ada `?path=`, `?line=`, atau endpoint file. |
| 5 | Platform, persistensi, failure? | WKWebView di macOS, WebView2 di Windows. Linux dan workspace remote tidak didukung. Tab disimpan di `browser-tabs.json`, tetapi port basi tidak pernah dimuat: tab di-rebind ke root. Kegagalan tampil sebagai placeholder dengan tombol Retry. |
| 6 | Buka file = pane baru atau bukan? | Bukan pane baru dari px0. px0 adalah satu tab workspace-level. Buka file dari Sheprd menghasilkan pane terminal atau code tab; px0 hanya berubah kalau user mengklik di dalam px0 sendiri. |

## 1. Model mental: Herdr tab/pane vs editor group vs browser tab

| Konsep | Pemilik | Isi | Terlihat oleh |
| --- | --- | --- | --- |
| Herdr pane | Daemon | Satu terminal (selalu terminal) | Semua client, TUI, daemon |
| Herdr tab | Daemon | Kumpulan pane dalam satu workspace | Semua client, TUI, daemon |
| Editor group | Client Sheprd | Split jendela sisi-ke-sisi, punya tab strip sendiri | Hanya jendela itu |
| Browser tab | Client Sheprd | Halaman webview, tampil menggantikan terminal di satu group | Hanya jendela itu |

Editor group yang menampilkan terminal membuka koneksi client sendiri ke daemon. Jadi beberapa group bisa menampilkan Herdr tab berbeda secara live (`crates/sheprd-gpui/src/browser/groups.rs:1-8`; README GUI `## Editor Groups` baris 2890-2940). Browser tab bukan pane: ia tinggal di store client dan setiap jendela punya page sendiri untuk tab yang sama (`crates/sheprd-gpui/src/browser/store.rs:1-3`; README GUI baris 2952-2963).

```text
Dunia daemon                          Dunia client Sheprd (satu jendela)
workspace
  Herdr tab "shell"
    pane p0 (terminal)  <----------   editor group #1
                                        strip: [shell] [browser] [px0]
                                        isi:   terminal | page webview
  Herdr tab "agent"
    pane p1 (terminal)  <----------   editor group #2
                                        strip: [agent]
                                        isi:   terminal
```

## 2. px0 dirender di mana (Q1)

px0 adalah `Editor::Px0`, salah satu dari dua editor terdaftar (`crates/sheprd-gpui/src/browser/editor.rs:8-17`). Editor selalu menjadi `Place::Editor`, dan `Place::Editor` dirender sebagai browser tab tanpa chrome browser: tanpa back/forward/reload, tanpa address field, tanpa tombol annotate (`crates/sheprd-gpui/src/browser/view/render.rs:137`, `:356`; test `browser/view_tests/px0.rs:29-62` dan `browser/view_tests/code_tab.rs:47-75`).

- Halaman px0 adalah native web view lewat `wry`: WKWebView di macOS, WebView2 di Windows (`crates/sheprd-gpui/src/browser/native.rs:179-190`; README GUI baris 2998-3012).
- Di macOS page berada di bawah gambar jendela; menu dan toast tampil di atasnya. Di Windows page berada di atas jendela dan disembunyikan saat menu/popover menutupinya (`crates/sheprd-gpui/src/browser/native.rs:1-5`; README GUI baris 2998-3012).
- Linux tidak punya embedded page: `EMBEDDED = cfg!(any(target_os = "macos", windows))` (`crates/sheprd-gpui/src/browser.rs:105`; `docs/linux-browser-plan.md:12-13`).
- Identitas tab: satu tab px0 per (daemon, workspace). Membuka lagi mengembalikan id yang sama (`crates/sheprd-gpui/src/browser/store.rs:343-370`; test `browser/store/tests/px0.rs:4-44`).
- Setiap jendela membuat page sendiri untuk tab yang sama; store tab dipakai bersama seluruh jendela (`crates/sheprd-gpui/src/browser/store.rs:1-3`).

Pintu masuk membuka px0: menu Terminal, command palette (`open_px0`), menu "..." pada editor group, dan CLI/agent (`crates/sheprd-gpui/src/menus.rs:359-364`; `crates/sheprd-gpui/src/group_menu.rs:160-162`; `crates/sheprd-commands/src/lib.rs:741-744`; `docs/cli.md:111-118`).

## 3. Alur `sheprd px0 open` (Q2)

```ts
sheprd px0 open --json
  → cli/control.rs:347-350          parse "px0" → ControlCommand::Px0
    → control/client.rs:446         tabs::px0 → Request::Tab + TabOp::Px0
      → control/server/tabs.rs:47   → arrive::px0
        → arrive.rs:351-380         cek EMBEDDED + px0_root(), lalu open_there
          → open_there: pindah window ke workspace caller, tunggu snapshot "arrived" (arrive.rs:96-155)
            → browser/px0.rs:26-41  open_px0
              → browser/editor.rs:70-97  open_embedded_editor(Editor::Px0, group, None)
                → store.open_editor_tab   → id singleton (store.rs:356-370)
                → move_tab_to_group / show_browser_tab_in (editor.rs:92-95)
              → Reply::Opened { id, workspace } (arrive.rs:372-377)
  → window tick: browser/view.rs:353  ensure_px0_page
    → browser/px0.rs:43-93            ensure_px0_page
      → Launcher::want (px0.rs:103-119) → worker::Worker::start (px0/worker.rs:51-80)
        → run: config.url → probe | workbench.lock user | workbench.lock private | spawn px0 (worker.rs:161-201)
      → State::Ready(base)
      → px0::workspace_url(base, root) = base + "?open=<root>" (px0.rs:133-138)
      → tab.location = Web { url }, title "px0", bound insert (browser/px0.rs:74-91)
      → create_editor_page → webview dibuat (browser/editor.rs:121-140)
    → probe tiap 3 detik: Ready / Failed (px0/worker.rs:191-199)
```

### 3.1 Checkout yang dipilih

`px0_root()` = `local_editor_root()`, yaitu cwd pane pertama dari tab pertama workspace yang fokus (`crates/sheprd-gpui/src/browser/editor.rs:40-61`; `crates/sheprd-gpui/src/palette/projects.rs:210-225`). Syarat: endpoint bukan remote, path absolut, panjang <= 4096, tanpa karakter kontrol (`crates/sheprd-gpui/src/browser/px0.rs:21-24`). Remote workspace karena itu ditolak (`browser/view_tests/px0.rs:64-78`).

### 3.2 Discovery dan proses px0

Urutan di worker (`crates/sheprd-gpui/src/px0/worker.rs:161-201`):

| Urutan | Sumber | Aksi | Sitasi |
| --- | --- | --- | --- |
| 1 | `config px0.url` | probe alamat itu; tidak menjalankan proses | `worker.rs:167-169`, `server.rs:33-67` |
| 2 | `workbench.lock` milik user | attach ke workbench yang sudah jalan | `worker.rs:130-139`, `:170-171` |
| 3 | `workbench.lock` privat app | attach ke workbench milik app | `worker.rs:174-181` |
| 4 | binary `px0` di PATH login shell | jalankan workbench baru | `worker.rs:141-159`, `:182-188` |

Detail launch: argumen `-no-open -no-update -no-color -host 127.0.0.1 -port 0 -base-path /`, env `XDG_STATE_HOME=<state app>/px0-state`, proses diisolasi dalam process group (`crates/sheprd-gpui/src/px0/worker.rs:203-241`; test `px0/worker/tests.rs:78-116`). Workbench harus publish `workbench.lock` dan menjawab `GET <base>/api/wb/ping` dengan `{"workbench":true,"version":"..."}` dalam 15 detik (`worker.rs:242-272`; `server.rs:33-67`). Probe lalu diulang tiap 3 detik; state berubah Ready atau Failed (`worker.rs:191-199`).

Kontrak px0 yang dipakai:

- `?open=<path>` pada halaman workbench: px0 membuka folder itu sebagai child workspace sendiri lalu pindah ke `/w/<id>/` (upstream px0: `web/src/workbench.js:270-283`, `:399-406`; `workbench.go:990-1001`; URL di bagian 9).
- `/api/wb/ping`: penanda bahwa alamat benar-benar px0 workbench (README GUI baris 3563-3566; `px0/server.rs:33-67`).

### 3.3 Config `px0.url`

`[px0] url = "http://127.0.0.1:7777/"` di `~/.config/herdr/config-gpui.toml` (`crates/sheprd-gpui/src/config.rs:612`; `config-gpui.example.toml:500-504`). Hanya alamat loopback HTTP tanpa credential, query, atau fragment yang diterima; base path reverse proxy boleh (`crates/sheprd-gpui/src/px0/server.rs:10-31`; test `px0/tests.rs:129-149`). Kosong berarti discovery otomatis. Pengaturan bisa lewat Settings > Code > px0 atau `sheprd config set px0.url ...` (`docs/cli.md:113-118`).

### 3.4 Pemakaian ulang tab

- `open_editor_tab` mencari tab editor dengan scope + workspace + jenis editor yang sama. Kalau ada, id itu dikembalikan tanpa membuat tab baru (`crates/sheprd-gpui/src/browser/store.rs:343-370`).
- Kalau tab itu sudah tampil di group lain, `open_embedded_editor` memindahkannya ke group yang diminta atau group aktif, tanpa mengganti page atau state navigasi (`browser/editor.rs:70-97`; test `browser/view_tests/px0.rs:49-61`).
- CLI melaporkan id dan workspace tab itu; artinya tab terbuka, sedangkan start server berlanjut di dalam tab (`control/client/tabs.rs:111-123`, `:150-152`; `docs/cli.md:113-118`).

## 4. Saat user membuka file (Q3)

Tiga jalur nyata. Tidak ada satu pun yang menyentuh px0.

| Aksi | Handler | Hasil | Container |
| --- | --- | --- | --- |
| Klik link path di terminal | `window/links.rs:483-540` → `open_file_link` | Terminal editor (atau app sistem) | Herdr pane baru, split kanan pane asal |
| Klik link file di chat | `chat/view/rich/links.rs:41-77` → `open_file_link` | Sama dengan terminal | Pane atau app sistem |
| `sheprd code open FILE[:LINE]` | `control/client/tabs.rs:125-137` → `arrive.rs:181-210` → `open_code_view` | Code tab read-only native, loncat ke line | Tab strip editor group |
| `sheprd code edit FILE[:LINE]` | `arrive::edit` (`arrive.rs:212-260`) → `open_in_editor` | Terminal editor | Pane baru di samping caller |
| Go to Symbol/File, Enter | `code_search.rs:344-365` | Terminal editor | Pane di samping pane fokus |
| Go to Symbol/File, Cmd-Enter | `code_search.rs:344-365` | Code tab read-only | Tab strip |
| Tombol `e` di review | `review/view/keys.rs:122` | Terminal editor | Pane baru |
| Security alert membuka manifest | `security/actions.rs:103` | Code tab read-only | Tab strip |

### 4.1 Klik link file: editor pane, bukan tab

```ts
terminal link click / chat link
  → window/links.rs:483-540 activate_terminal_link
    → window/links.rs:559-583 open_link → Fallback::File
      → window/file_links.rs:281-360 open_file_link
        → resolve path di background executor
        → in_editor? target editable? → editor::command_line valid?
          → true:  editor.rs:218-232 open_in_editor
                     → pane.split di daemon (pane baru di kanan pane asal)
                     → shell mengetik "EDITOR +LINE FILE" (editor.rs:334+)
                     → Neovim: reuse socket --listen per tab (editor.rs:1-11)
          → false: cx.open_url("file://...") / folder app sistem
```

Kebijakan target: `open_files_in = "editor"` atau `"system"`, dan Alt/Option membalik pilihan itu (`window/links.rs:533-537`; `config.rs:382-389`; README GUI baris 2711-2718). Pane editor dimiliki daemon, jadi menutup editor menutup pane (`crates/sheprd-gpui/src/editor.rs:1-11`).

### 4.2 `code open`: code tab native, bukan px0

```ts
sheprd code open FILE:LINE
  → control/client/tabs.rs:125-137        TabOp::Code { path, line }
    → control/server/tabs.rs:35           → arrive::code (arrive.rs:181-210)
      → code_view.rs:218-270 open_code_view
        → cari tab lain dengan Location::Code path sama; kalau ada, pakai itu
        → kalau tidak, store.open(... Some(Location::Code))
        → load ulang text dari disk (background), outline, syntax highlight
        → show_browser_tab + focus + go_to(line)
```

`Location::Code` adalah tab yang digambar app sendiri, tidak pernah memuat page (`crates/sheprd-gpui/src/browser/location.rs:56-90`; `code_view.rs:1-12`). Tombol `Open in editor` di header code tab memakai jalur yang sama dengan `code edit` (`code_view/render.rs:205-212`).

### 4.3 Call tree gabungan: siapa membuka apa

```ts
buka file dari Sheprd
  → terminal link / chat link
    → open_file_link → terminal editor pane (daemon pane split) | system app
  → code open / Cmd-Enter / security alert
    → open_code_view → read-only code tab (client tab, Location::Code)
  → code edit / review "e" / Go to Symbol Enter
    → open_in_editor → terminal editor pane (daemon pane split)
  → (tidak ada jalur) → px0
```

Bukti negatif: `open_px0` hanya dipanggil dari `window/commands.rs:437-439` (command palette), `group_menu.rs:222-224` (menu group), `control/server/tabs/arrive.rs:351-380` (CLI), dan `browser/px0.rs` sendiri (retry). `Location::Code` tidak pernah membentuk URL px0, dan tidak ada pemanggilan `px0` di modul terminal atau chat.

## 5. Apakah file/path/line dikirim ke px0? (Q4)

Jawaban: tidak. Kontrak data Sheprd ke px0 hanya dua hal.

| Data | Arah | Bentuk | Sitasi |
| --- | --- | --- | --- |
| Alamat workbench | Sheprd → px0 | `GET /api/wb/ping`, cek `workbench` + `version` | `px0/server.rs:33-67` |
| Root checkout | Sheprd → px0 | `base?open=<absolute-dir>`, URL-encoded | `px0.rs:133-138`; test `px0/tests.rs:151-162` |
| File + line | Tidak dikirim | tidak ada `?path=`, `?line=`, endpoint, atau IPC | grep modul `px0` tidak menemukan path/line |

Argumen launcher px0 juga tidak memuat target: `-no-open -no-update -no-color -host 127.0.0.1 -port 0 -base-path /` (`px0/worker.rs:214-226`). Jadi px0 tidak pernah menerima file dari Sheprd, bahkan saat pertama dijalankan.

Catatan pembanding: px0 sendiri mendukung target file, yaitu CLI `px0 file:line` di README px0, dan URL `?path=<rel>&line=<n>` untuk server workspace (upstream px0: `main.go:470-490`, `:554-576`). Sheprd tidak memakai kontrak itu, karena workbench dibuka dengan `?open=` folder dan halaman child dimuat pada root.

### 5.1 Tidak ada bridge page ↔ app untuk px0

Pesan dari page hanya dua: title/load, favicon, dan annotation pick untuk page preview lokal (`crates/sheprd-gpui/src/browser/view.rs:414-439`; README GUI baris 2989-2997). Bridge `window.ipc` hanya disuntik ke page preview folder lokal (`crates/sheprd-gpui/src/browser/location.rs:1-6`, `PREVIEW_SCHEME`). px0 adalah halaman web biasa dari loopback, jadi tidak mendapat bridge dan tidak bisa meminta Sheprd membuka file.

### 5.2 Satu-satunya "jalan ke file"

- User mengklik file di dalam UI px0 sendiri. px0 yang menavigasi tab-nya; Sheprd hanya menerima laporan URL halaman (`browser/view.rs:425-432`) dan menyimpannya sebagai `Location::Web` tab.
- `sheprd browser navigate <id> <url>` bisa memindahkan page tab px0 ke URL lain (`control/server/tabs/page.rs:68-90`), tetapi itu bukan semantik buka file dan tidak dipakai oleh jalur file mana pun.

Konsekuensi: kalau Herdr ingin "klik file -> buka di px0", mekanisme itu harus ditambah. Sheprd tidak punya, dan px0 tidak diekspos sebagai API stabil untuk itu (yang resmi adalah CLI `px0 file:line`).

## 6. Persistensi, platform, kegagalan, batasan (Q5)

### 6.1 Lokasi data

| Data | Path | Sitasi |
| --- | --- | --- |
| Browser tabs, termasuk tab px0 | `$XDG_STATE_HOME/herdr/gpui/browser-tabs.json` | `browser/store.rs:232-234`; `sheprd-client/src/local_path.rs:72-96` |
| Editor groups + lebar | `$XDG_STATE_HOME/herdr/gpui/editor-groups.json` | `browser/layouts.rs:61` |
| Config GUI + `[px0] url` | `$XDG_CONFIG_HOME/herdr/config-gpui.toml` | `config.rs:612` |
| State workbench milik app | `<state app>/px0-state/px0/` (workbench.json, workbench.lock) | `px0/worker.rs:174-189`; README GUI baris 3568-3570 |
| Discovery milik user | `$XDG_STATE_HOME/px0/workbench.lock` atau `~/.px0/workbench.lock` | `px0/worker.rs:130-139` |

### 6.2 Perilaku restore

- Tab px0 disimpan sebagai `place: "px0"` dengan `location` dan label terakhir. Saat restore, tab muncul lebih dulu dengan data simpanan dan placeholder "Starting px0", sebelum server siap.
- Binding `(base, root)` disimpan di memori per jendela, bukan di disk. Setelah restart binding kosong, jadi tab di-rebind: `location` direset ke `base?open=<root>` sebelum page dibuat (`browser/px0.rs:15-17`, `:74-91`). Port basi dari file tidak pernah dimuat.
- Artinya posisi terakhir di dalam px0 hilang setiap restart. Yang kembali hanya root checkout.
- Kalau state px0 turun ke Idle/Starting saat binding lama masih ada, page ditutup dan diganti placeholder (`browser/px0.rs:53-56`).

### 6.3 Kegagalan

| Kejadian | Efek | Sitasi |
| --- | --- | --- |
| Build tanpa page (Linux) atau workspace remote | Flash warning; CLI exit 8; tidak ada tab | `browser/px0.rs:32-39`; `control/server/tabs/arrive.rs:364-370`; `docs/cli.md:113-118` |
| px0 tidak terpasang | Placeholder "px0 is not installed; install it on your login shell's PATH, or set px0.url" + Retry | `px0/error.rs:5`; `locales/en-US/error-px0.ftl:5` |
| Alamat bukan workbench | Probe gagal; placeholder error + Retry | `px0/server.rs:33-67`; `browser/px0.rs:95-133` |
| px0 timeout/exit saat start | `Error::Timeout` / `Error::Exited`; placeholder + Retry | `px0/worker.rs:242-272`; `px0/error.rs:23-26` |
| Workbench mati setelah Ready | Probe 3 detik gagal; state Failed; page lama tetap tampil (tombol Retry hanya tampil saat page belum pernah dibuat) | `px0/worker.rs:191-199`; `browser/px0.rs:95-133` |
| Retry ditekan | `Launcher::reset`, binding dibersihkan, worker start ulang | `browser/px0.rs:126-131`; `px0.rs:121-130` |

Kepemilikan proses: workbench yang di-attach tidak pernah dianggap milik app dan tidak dihentikan (`px0/worker/tests.rs:10-26`). Workbench yang dijalankan app dihentikan saat quit, termasuk anak-anaknya, dalam process group (`px0.rs:63-74`; `px0/worker.rs:37-48`; `owned_process.rs:17-33`). px0 sendiri mengelola child per checkout dan idle cleanup 30 menit (px0 docs).

### 6.4 Batasan

- Hanya macOS dan Windows (`browser.rs:105`; README GUI baris 3591-3592).
- Hanya workspace lokal; remote SSH ditolak (`browser/editor.rs:40-47`; `browser/px0.rs:21-24`).
- Hanya alamat loopback HTTP; tidak boleh query/fragment/credential (`px0/server.rs:10-31`; test `px0/tests.rs:129-149`).
- Satu tab px0 per workspace per daemon. Tidak ada cara membuka dua checkout dalam dua tab px0.
- Tidak terlihat daemon: px0 bukan pane, bukan tab Herdr. Agent di TUI tidak bisa mengontrol tab px0 lewat pane.
- Tidak ada deep link file/line dari Sheprd ke px0.
- Biaya webview tetap ada: satu process web content per jendela per page (wry), di tambah proses px0 workbench + child px0 + LSP. Ini berbeda dari mod px0 di herdr-app yang hanya men-spawn px0 lalu membuka browser eksternal.

## 7. Kesimpulan: buka file = pane baru atau bukan? (Q6)

Tegas: dalam model Sheprd, buka file bukan pane px0 baru, dan px0 tidak terlibat.

- Buka file dari Sheprd menghasilkan salah satu: (1) Herdr pane baru berisi terminal editor (split dari pane asal), (2) code tab read-only di tab strip client, atau (3) aplikasi sistem. `code open` memakai tab, bukan pane; `code edit` memakai pane, bukan tab (tabel bagian 4).
- px0 sendiri adalah satu tab workspace-level yang berisi satu webview milik px0. "Buka file" di dalam px0 adalah navigasi internal tab itu, dikendalikan px0, bukan aksi Sheprd.
- Kalau Herdr meniru model "px0 as workspace web editor":
  - Butuh host webview di dalam jendela. herdr-app 0.1.12 tidak punya browser pane (PR #235 masih draft, issue #425 ditutup "not planned"; lihat [riset layout](20261104-workspace-custom-vs-px0.md)), jadi saat ini px0 hanya bisa jadi browser tab eksternal atau butuh implementasi webview sendiri.
  - Dengan webview: px0 menjadi tab singleton per workspace. Buka file tidak menambah pane, hanya tab/navigasi internal. Ini konsisten dengan UX "satu editor per workspace", bukan "satu pane per file".
  - Rail Files/Git di Herdr tetap bisa untuk glance, tetapi "klik file -> fokus di px0" harus dibuat sendiri: Sheprd tidak mengirim path/line ke px0, dan px0 tidak menerima perintah itu dari host.
  - Tanpa webview (status sekarang): buka file tetap seperti sekarang, dan px0 tetap pindah app (context switch), bukan pane.

Minimum yang perlu ditambah untuk "open file in px0" (jika arah itu dipilih): kontrak URL ke workspace child px0 (`?path=<rel>&line=<n>`, sudah didukung px0 untuk target CLI), atau CLI px0, lalu hubungkan aksi code tab, link terminal, dan link chat ke situ. Ini belum ada di Sheprd; jangan menganggapnya bagian dari integrasi referensi.

## 8. Kompatibilitas dengan Herdr app sekarang

**8.1 Attach ke daemon yang ada: bisa.** Sheprd punya dua mesin.

- "Herdr 1" adalah daemon Herdr klasik (herdr.dev). Sheprd menempel ke binary client socket, merender cell yang dikirim, dan boleh menjalankan `herdr server` terpasang kalau sesi target belum ada (`README.md:151-153`; `crates/sheprd-gpui/README.md:5-10`, `:19-27`).
- "herdr-core" (Herdr 2) adalah runtime terminal baru: JSON-RPC + stream byte, protocol generation 1, diemulasikan `sheprd-terminal` menjadi cell yang sama (`crates/sheprd-core-client/README.md:3-14`; `crates/sheprd-gpui/README.md:1769-1784`).
- Keduanya berjalan berdampingan. Tidak ada migrasi sesi antar mesin (`crates/sheprd-gpui/README.md:1773-1775`; `docs/cli.md:353-354`).

**8.2 Sesi herdr-core milik herdr-app 0.1.12: daemon-nya sama, adopsi tab tidak terverifikasi.**

- Endpoint herdr-core diresolusi seperti `hc`: `HC_SOCKET`, lalu config `socket`, lalu runtime folder, lalu `$XDG_STATE_HOME/herdr-core/<session>/` dengan session default `default` (`crates/sheprd-core-client/src/endpoint.rs:1-63`; test `crates/sheprd-core-client/src/tests/endpoint.rs:40-48`).
- Sheprd join core yang sudah berjalan lebih dulu, atau menjalankan `herdr-core` milik user / versi pinned bawaan (`README.md:145-149`; `crates/sheprd-gpui/README.md:1780-1784`).
- Bukti lingkungan read-only: `~/.local/state/herdr-core/default/` berisi `default.sock`, `terminals.json`, dan `docs.json`; dokumen di `docs.json` berkey `herdr-app`. Jadi tab/layout herdr-app 0.1.12 hidup di core yang sama.
- Yang tidak dijanjikan dokumen: Sheprd menampilkan tab/layout itu. Sidebar Herdr 2 hanya mendaftar pane dari tab Herdr 2 milik Sheprd (`crates/sheprd-gpui/README.md:1797-1801`). Tidak ada kode impor dokumen herdr-app di `crates/`.
- Status: **tidak terverifikasi** untuk "sesi langsung terlihat". Uji: (a) `hc ls` / `herdr-core ls`; (b) Sheprd join core user atau start core pinned; (c) bisakah terminal lama di-attach ke tab baru; (d) aman tidak dua app menulis dokumen core yang sama.

**8.3 Layout dan mods tidak portabel, harus dibangun ulang.**

- Mods herdr-app = JavaScript lewat QuickJS/gpui-kit, hampir seluruh API GPUI, dengan `exec`/`fetch` tanpa sandbox (`docs/mods-plan.md:10`, `:33-50`).
- Mods Sheprd = Luau sandbox, UI berupa tree data, folder `<config>/herdr/gpui-mods/<name>/` berisi `mod.toml` + `*.luau`, worker thread sendiri, slot tetap (`docs/mods.md:1-20`; `docs/mods-plan.md:18-30`).
- Layout beda produk: herdr-app memakai `~/.config/herdr-app/layouts/*.json`; Sheprd memakai `$XDG_STATE_HOME/herdr/gpui/editor-groups.json` (`crates/sheprd-gpui/src/browser/layouts.rs:61`) dan config `~/.config/herdr/config-gpui.toml` (`crates/sheprd-gpui/src/config.rs:612`).
- Tidak ada importer di repo. SWEG.json + 873 baris mod JS (lihat [riset layout](20261104-workspace-custom-vs-px0.md)) harus ditulis ulang, bukan ditranslasi.

## 9. Sumber dan bukti

File kunci (semua relatif ke root clone commit `3b9800f`):

| File | Isi yang dipakai |
| --- | --- |
| `crates/sheprd-gpui/src/px0.rs` | Config, Launcher, `workspace_url` (`?open=`) |
| `crates/sheprd-gpui/src/px0/worker.rs` | Discovery, spawn, probe 3 detik, cleanup |
| `crates/sheprd-gpui/src/px0/server.rs` | Validasi loopback, `/api/wb/ping`, baca `workbench.lock` |
| `crates/sheprd-gpui/src/browser/px0.rs` | Tab px0, binding `(base, root)`, placeholder, Retry |
| `crates/sheprd-gpui/src/browser/editor.rs` | `Editor::{Px0, VsCode}`, singleton tab, page creation |
| `crates/sheprd-gpui/src/browser/store.rs` | Store tab, `editor_tab`, `visited`, `browser-tabs.json` |
| `crates/sheprd-gpui/src/browser/view.rs` | Tick `ensure_px0_page`, event page (`Loaded`, `Title`) |
| `crates/sheprd-gpui/src/browser/native.rs` | Webview `wry`, layering macOS/Windows |
| `crates/sheprd-gpui/src/code_view.rs` | `open_code_view`, code tab read-only |
| `crates/sheprd-gpui/src/editor.rs` | `open_in_editor`, pane split + terminal editor |
| `crates/sheprd-gpui/src/window/file_links.rs` | `open_file_link` (link terminal/chat) |
| `crates/sheprd-gpui/src/control/` | CLI → control socket → `TabOp::{Px0, Code, Edit}` |
| `docs/cli.md` | Kontrak `code open`, `code edit`, `px0 open`, exit 8 |
| `crates/sheprd-gpui/README.md` | Browser Tabs, Editor Groups, Code Navigation, VS Code, Herdr 2, px0 |
| `docs/mods.md`, `docs/mods-plan.md` | Mods Luau vs model herdr-app (JS) |
| `crates/sheprd-core-client/` | Endpoint herdr-core dan join existing core |

URL eksternal:

- Repo referensi: [penso/herdr-gpui](https://github.com/penso/herdr-gpui) (clone riset), [sheprd-labs/sheprd](https://github.com/sheprd-labs/sheprd) (repo utama per rebrand).
- px0: [px0.ai/docs](https://px0.ai/docs/), [Review Workbench](https://px0.ai/docs/guides/review-workbench/), [arsitektur px0](https://github.com/px0-ai/px0/blob/master/docs/internals/architecture.md), [px0 README](https://raw.githubusercontent.com/px0-ai/px0/HEAD/README.md).
- Kontrak `?open=` dan deep link file px0: [px0 main.go](https://raw.githubusercontent.com/px0-ai/px0/HEAD/main.go), [px0 workbench.go](https://raw.githubusercontent.com/px0-ai/px0/HEAD/workbench.go), [px0 web/src/workbench.js](https://raw.githubusercontent.com/px0-ai/px0/HEAD/web/src/workbench.js).
- Herdr 1 dan herdr-core: [herdr.dev](https://herdr.dev/), [herdrdev/herdr-core](https://github.com/herdrdev/herdr-core).
