# Custom Herdr layout "sweg"

Plan kerja untuk layout kustom Herdr desktop versi sweg.
Dibuat: 2026-11-03. Status: menunggu approval sebelum eksekusi.

## Konteks terverifikasi

- Layout aktif sekarang: `main` (`shared.json` -> `"layout":"main"`).
- Interface Herdr = file biasa di `~/.config/herdr-app`, live-reload ~1 detik.
- Layout shipped (`main`, `terminals`, `win98`) read-only, ditimpa tiap
  start. Wajib clone sebelum edit.
- Struktur `main.json`: sidebar kiri 268px (`workspace-chrome`, `spaces`,
  `agents`), work column (`tabs` bar 42px, `work-body` = `main` + `panel`
  kanan 368px stack `files|changes`, `status` 28px = `workspace-status`
  + `system-stats`).
- CPU+RAM sudah tampil sebagai teks via mod `system-stats` (refresh 5s,
  script `top`/`sysctl` macOS + `/proc` Linux).
- Binary `Herdr` punya `px0 open`, `code open <file>:<line>`,
  `browser open --beside`, `config get/set`.
- `focused().cwd` memberi lokasi pane terakhir ke mod.
- `settings()` mengembalikan `Record<string, unknown>` - custom key di
  `settings.json` kemungkinan terbaca mod (verifikasi saat implementasi).
- Preferensi user: theme `graphite` + palet gruvbox (accent `#458588`),
  font `Kode Mono`, appearance `dark`.

## Phase 1 - Layout `sweg`

Goal: clone `main` -> `sweg`. Panel Files/Changes pindah dari kolom
kanan ke dalam sidebar kiri.

1. `herdr-app do layout.clone '{"name":"main","as":"sweg"}'`
   -> `~/.config/herdr-app/layouts/sweg.json`, langsung aktif.
2. Edit `sweg.json`:
   - Sisipkan blok `panel` (stack `files|changes`) di kolom `sidebar`,
     antara `sidebar-lists` dan `sidebar-footer`.
   - Pertahankan semua `id` (`panel`, `panel-body`, `files`, `changes`)
     dan `hidden: true` supaya toggle Files/Changes di tab bar tetap
     bekerja (`shared("workspace.panels")`).
   - Hapus blok `panel` dari `work-body`.
3. Verifikasi:
   - `herdr-app status` bersih / tidak ada `layout.error`.
   - `herdr-app shot` -> review visual.
   - Toggle Files/Changes dari tab bar -> terbuka di sidebar.
   - Spaces/agents sidebar tetap berfungsi normal.

Done when: `layout.switch` ke `sweg` tanpa error; Files/Changes terbuka
di dalam sidebar kiri saat di-toggle.

## Phase 2 - Mod `status` (ditunda, repo tersendiri)

Mod footer full-width pengganti `workspace-status` + `system-stats`.
Spec lengkap tersimpan di memory (Engram, topic
`sweg-herdr-layout/status-mod-spec`).

Ringkasan spec:

- Kiri: info workspace (machine, branch, jumlah agent, "N needs you").
- Kanan: progress bar berwarna untuk CPU %, RAM used/total, Disk %,
  Network KB/s (nilai saja), Battery % (`pmset`, fallback `uptime`).
- Warna bar: `accent` -> kuning >=70% -> merah/`blocked` >=85%.
- `cx.timer.every(5000)`, satu `exec` per machine aktif.
- `mod.json`: `{ "place": "none" }`. Dipasang lewat block `status` di
  `sweg.json`: `content: { "mod": "status" }`.

## Phase 3 - Code reader px0

Goal: buka code reader berdasarkan `focused().cwd` (lokasi pane
terakhir). Tool dipilih lewat opsi settings.

### Settings

`settings.json` key baru:

```json
"code_editor": "px0"
```

Nilai: `"px0"` (default) | `"builtin"` (`Herdr code open`) | argv array
untuk editor eksternal, misal `["zed", "$dir"]`.

Verifikasi: custom key `settings.json` bertahan restart dan terbaca via
`settings()`. Fallback kalau tidak: `shared("code.editor")` + chooser
popup di mod.

### Potongan yang dibangun

- `mods/sweg-pane` (clone `pane`): ikon px0 di pane header. Host
  `nextCommand()` untuk command `open_editor` (mod harus visible supaya
  command keybinding sampai).
- `mods/sweg-menu` (clone `menu`): item "Open in px0" di terminal
  right-click menu. `sweg.json` root: `"terminal_menu": "sweg-menu"`.
- `keys.json` section `global`: `"ctrl-shift-e": "sweg-pane.open_editor"`.
- Helper `openEditor(cwd)` (duplikasi tipis di kedua mod): baca
  `settings().code_editor` -> `exec` sesuai tool.
- `sweg.json`: `pane.header.content.mod` -> `"sweg-pane"`.

### Open behavior

- px0 dibuka split di samping terminal (mode beside).
- Verify dulu: `Herdr px0 --help` untuk flag beside/path arg.
- Fallback: `exec("px0", [dir])` lalu `Herdr browser open
  http://127.0.0.1:7777 --beside`.
- `exec` dari mod mungkin tidak membawa env `HERDR_*`; `px0 open`
  tetap menarget window app, `cwd` menentukan checkout.

Done when: shortcut, ikon header, dan menu klik kanan sama-sama membuka
code editor di lokasi pane terakhir; ganti `"code_editor"` mengubah tool
yang terbuka; `herdr-app check` pass untuk `sweg-pane` dan `sweg-menu`.

## Constraints umum

- Jangan edit file shipped (`layouts/` bawaan, `mods/` bawaan, `frame/`,
  `AGENTS.md`, `*.d.ts`) - ditimpa tiap start. Selalu clone.
- Tidak ada `setTimeout`/`setInterval` - pakai `cx.timer`. Animasi pakai
  `.frames`/`.spin`/`.loop`/`.transition`, bukan timer.
- Pakai `theme()` colors; jangan hardcode hex kecuali warna custom user.
- Escape hatch `ctrl-alt-shift-escape` -> kembali ke `main`.
- Jangan rebind key terminal umum (ctrl+letter yang dipakai program).

## Struktur repo (akhir)

    layouts/sweg/
    ├── sweg.json
    ├── mods/
    │   ├── sweg-pane/
    │   └── sweg-menu/
    ├── RECIPE.md
    └── preview.png

Mod `status` tidak di sini - repo tersendiri.

## Urutan eksekusi

1. Phase 1 (layout) -> verifikasi visual.
2. Phase 3 (px0) -> clone mods, wiring, verify `Herdr px0 --help`.
3. Phase 2 menyusul saat repo mod `status` dibuat.
