#!/usr/bin/env python3
"""Create a layout folder from layouts/_template.

Usage:
    python3 scripts/new-layout.py <slug>

The slug is the layout name. It must match ^[a-z][a-z0-9-]{1,31}$ and
layouts/<slug>/ must not exist yet. The script copies the template to
layouts/<slug>/ and replaces the {{slug}} placeholder in file contents and in
file and folder names.
"""

import re
import shutil
import sys
from pathlib import Path

PLACEHOLDER = "{{slug}}"
SLUG_PATTERN = re.compile(r"^[a-z][a-z0-9-]{1,31}$")
ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "layouts" / "_template"

USAGE = "usage: python3 scripts/new-layout.py <slug>"

NEXT_STEPS = """\
Created {folder}

Next steps:
  1. Edit {folder}/layouts/{slug}.json: blocks, ids, sizes, root properties.
  2. Edit {folder}/mods/{slug}-example/main.js, or clone a shipped mod.
  3. Check the mod: herdr-app check {folder}/mods/{slug}-example
  4. Merge {folder}/keys.json into ~/.config/herdr-app/keys.json by hand.
  5. Install: copy {folder}/layouts/{slug}.json to
     ~/.config/herdr-app/layouts/ and {folder}/mods/* to
     ~/.config/herdr-app/mods/.
  6. Switch: herdr-app do layout.switch --name {slug}
  7. Save a screenshot as {folder}/preview.png, then fill in RECIPE.md.
  8. Do not commit gpui-kit.d.ts or jsconfig.json; they are generated.
  9. Add the folder to git and open a pull request. See CONTRIBUTING.md.
"""


def copy_template(slug):
    data = PLACEHOLDER.encode()
    name = slug.encode()
    target_root = ROOT / "layouts" / slug
    for source in sorted(TEMPLATE.rglob("*")):
        relative = source.relative_to(TEMPLATE)
        parts = [part.replace(PLACEHOLDER, slug) for part in relative.parts]
        target = target_root.joinpath(*parts)
        if source.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes().replace(data, name))
        shutil.copymode(source, target)


def main(argv):
    if len(argv) != 2:
        print(USAGE, file=sys.stderr)
        return 2
    slug = argv[1]
    if not SLUG_PATTERN.fullmatch(slug):
        print(f"error: invalid slug {slug!r}", file=sys.stderr)
        print("A slug has lowercase letters, digits and dashes, starts with a letter, and is 2 to 32 chars long.", file=sys.stderr)
        return 2
    if not TEMPLATE.is_dir():
        print(f"error: template folder not found: {TEMPLATE}", file=sys.stderr)
        return 1
    target = ROOT / "layouts" / slug
    if target.exists():
        print(f"error: {target.relative_to(ROOT)} already exists", file=sys.stderr)
        return 1
    copy_template(slug)
    print(NEXT_STEPS.format(folder=f"layouts/{slug}", slug=slug))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
