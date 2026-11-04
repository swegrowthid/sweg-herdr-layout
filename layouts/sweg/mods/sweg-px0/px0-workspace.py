#!/usr/bin/env python3
"""Open the px0 workbench workspace for a folder and print its URL.

The sweg-px0 mod calls this, then opens the URL with `open`. This
script never opens a browser.

With --check it prints one JSON object with the install and workbench state
instead (see check()). The result always exits 0, so the mod can render a
setup card when px0 is missing.

Why it exists: px0 has no way to open a file in an already open browser tab.
It does have a workbench API (loopback only) that can start/reuse the child
workspace for a checkout. This script does the discovery and pre-warm, then
returns the deep-link URL for that workspace. Herdr then only has to open
the URL in a browser window.

Test overrides (used by the implementation tests):
  PX0_WORKBENCH_URL  use this workbench instead of discovering one
  PX0_WORKBENCH_LOCK use this lock file instead of the default paths
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PING_TIMEOUT = 2.0
START_TIMEOUT = 20.0
OPEN_TIMEOUT = 20.0
CHECK_TIMEOUT = 3.0
INSTALL_COMMAND = "curl -fsSL https://px0.ai/install.sh | sh"
INSTALL_URL = "https://px0.ai"


def fail(message):
    print(message, file=sys.stderr)
    return 1


def lock_paths():
    paths = []
    override = os.environ.get("PX0_WORKBENCH_LOCK")
    if override:
        paths.append(Path(override).expanduser())
    state = os.environ.get("XDG_STATE_HOME")
    if state:
        paths.append(Path(state) / "px0" / "workbench.lock")
    paths.append(Path.home() / ".px0" / "workbench.lock")
    return paths


def read_lock():
    for path in lock_paths():
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        url = data.get("url")
        if isinstance(url, str) and (url.startswith("http://127.0.0.1:") or url.startswith("http://localhost:")):
            return url.rstrip("/")
    return None


def ping(base):
    try:
        with urllib.request.urlopen(base + "/api/wb/ping", timeout=PING_TIMEOUT) as response:
            data = json.loads(response.read())
            return response.status == 200 and data.get("workbench") is True
    except (OSError, ValueError, urllib.error.URLError):
        return False


def program():
    found = shutil.which("px0")
    if found:
        return found
    local = Path.home() / ".local" / "bin" / "px0"
    return str(local) if local.is_file() else None


def version(px0):
    for flag in ("--version", "-v"):
        try:
            result = subprocess.run(
                [px0, flag],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                timeout=CHECK_TIMEOUT,
                text=True,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        lines = result.stdout.strip().splitlines()
        first = lines[0].strip() if lines else ""
        if result.returncode == 0 and first:
            return first
    return None


def start_workbench():
    px0 = program()
    if not px0:
        raise RuntimeError("px0 is not installed")
    subprocess.Popen(
        [px0, "-no-open", "-no-update", "-no-color", "-host", "127.0.0.1", "-port", "0", "-base-path", "/"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    deadline = time.monotonic() + START_TIMEOUT
    while time.monotonic() < deadline:
        base = read_lock()
        if base and ping(base):
            return base
        time.sleep(0.2)
    raise RuntimeError("px0 workbench did not start")


def discover():
    override = os.environ.get("PX0_WORKBENCH_URL")
    if override:
        base = override.rstrip("/")
        if not ping(base):
            raise RuntimeError("PX0_WORKBENCH_URL is not a px0 workbench")
        return base
    base = read_lock()
    if base and ping(base):
        return base
    return start_workbench()


def check():
    px0 = program()
    base = read_lock()
    running = bool(base and ping(base))
    return {
        "installed": px0 is not None,
        "path": px0,
        "version": version(px0) if px0 else None,
        "workbench": {"running": running, "url": base if running else None},
        "install": {"command": INSTALL_COMMAND, "url": INSTALL_URL},
    }


def request_json(base, path, payload=None, origin=False):
    headers = {"Content-Type": "application/json"}
    if origin:
        headers["Origin"] = base
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(base + path, data=data, headers=headers, method="POST" if data else "GET")
    with urllib.request.urlopen(request, timeout=PING_TIMEOUT) as response:
        return response.status, json.loads(response.read())


def workspace_id(root):
    return hashlib.sha256(b"dir\x00" + root.encode()).hexdigest()[:12]


def wait_ready(base, wid):
    deadline = time.monotonic() + OPEN_TIMEOUT
    last = None
    while time.monotonic() < deadline:
        try:
            _, state = request_json(base, "/api/wb/state")
        except (OSError, ValueError, urllib.error.URLError) as error:
            last = str(error)
            time.sleep(0.25)
            continue
        for item in state.get("items") or []:
            if item.get("id") != wid:
                continue
            if item.get("state") == "running":
                return
            last = item.get("error") or item.get("state")
            break
        time.sleep(0.25)
    raise RuntimeError("px0 workspace did not start: " + str(last or "timeout"))


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--check":
        print(json.dumps(check()))
        return 0
    if len(sys.argv) != 2:
        return fail("usage: px0-workspace.py <folder> | --check")
    root = os.path.realpath(sys.argv[1])
    if not os.path.isdir(root):
        return fail("not a folder: " + root)
    try:
        base = discover()
        wid = workspace_id(root)
        try:
            request_json(base, "/api/wb/open", {"target": root}, origin=True)
        except urllib.error.HTTPError as error:
            if error.code == 403:
                raise RuntimeError("px0 workbench rejected the request (Origin check)") from error
            raise
        wait_ready(base, wid)
    except (OSError, RuntimeError, ValueError) as error:
        return fail(str(error))
    print(base + "/w/" + wid + "/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
