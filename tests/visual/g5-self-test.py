"""Negative tests of the step 11G G5 tools (research/14 section 6.73), without a screen, Obsidian or Inkdrop.

Inkdrop is never touched:
  - tests/visual/inkdrop-window.sh with CAPTURE_INKDROP=off does not run other-window.sh (a stand-in that only
    records calls); without it, it does (the positive control);
  - capture-obsidian.sh reaches other-window.sh only through inkdrop_window;
  - g5-capture.mjs --plan: 8 distinct conditions (2 builds x 2 themes x 2 states), each with its own theme
    folder, output folder and image, every one with CAPTURE_INKDROP=off; the script names no Inkdrop endpoint.
g5-judge.py on made-up captures (images at half scale, the regions as g5-regions.js reports them): all as
expected passes; a title bar that differs with the fix fails; a pre-fix title bar the same as the tab strip, a
missing capture, a region that is not flat, outside the window or too small, an unexpected computed title
bar, another frame, an unfocused window and a changed image make it INVALID.

usage: python3 -I tests/visual/g5-self-test.py
"""
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VIS = ROOT / "tests" / "visual"
W, H = 600, 350  # half of 1200 x 700 points
TAB, TITLE_OFF = (0, 33, 41), (40, 60, 70)
TB_RECT, TAB_RECT = [100, 4, 300, 22], [180, 40, 80, 20]
results = []


def say(name, ok, detail: object = ""):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'} g5 self-test: {name}{'' if ok or not detail else f' -- {detail}'}")


def png(path, pixel):
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        for x in range(W):
            raw += bytes(pixel(x, y))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    Path(path).write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw))) + chunk(b"IEND", b""))


def in_rect(x, y, r):
    return r[0] * 0.5 <= x < (r[0] + r[2]) * 0.5 and r[1] * 0.5 <= y < (r[1] + r[3]) * 0.5


EXPECTED: dict = {("after", "solarized-dark", "translucent"): "rgba(0, 33, 41, 0.7)", ("after", "kanagawa-dragon", "translucent"): "rgba(24, 22, 22, 0.7)",
            ("before", "solarized-dark", "translucent"): "rgba(0, 0, 0, 0)", ("before", "kanagawa-dragon", "translucent"): "rgba(0, 0, 0, 0)"}


def captures(root, edit=lambda c, rec: None, title=lambda c: None):
    """8 made-up captures; `title(c)` gives the title bar colour of condition c (None: the tab strip's)."""
    for build in ("after", "before"):
        for theme in ("solarized-dark", "kanagawa-dragon"):
            for mode in ("translucent", "opaque"):
                c = (build, theme, mode)
                name = f"obsidian-{theme}-{mode}-gray-active-{build}"
                d = root / build
                (d / "screenshots").mkdir(parents=True, exist_ok=True)
                (d / "measurements").mkdir(exist_ok=True)
                tcol = title(c) or (TITLE_OFF if build == "before" and mode == "translucent" else TAB)
                img = d / "screenshots" / f"{name}.png"
                png(img, lambda x, y: tcol if in_rect(x, y, TB_RECT) else TAB)
                expected = EXPECTED.get(c, "rgb(0, 45, 56)")
                rec = {"build": build, "theme": theme, "mode": mode, "image": f"{build}/screenshots/{name}.png",
                       "imageSha256": hashlib.sha256(img.read_bytes()).hexdigest(), "frame": "custom",
                       "translucent": mode == "translucent", "focusedAfterShot": True,
                       "window": {"innerWidth": 1200, "innerHeight": 700}, "expectedTitlebar": expected,
                       "regions": {"titlebar": {"rect": list(TB_RECT), "bigEnough": True, "background": expected, "centre": {"inside": True}},
                                   "left-tabstrip": {"rect": list(TAB_RECT), "bigEnough": True, "background": "x", "centre": {"inside": True}}}}
                edit(c, rec)
                # A record marked _skip is not written (a capture that is missing).
                if not rec.get("_skip"):
                    (d / "measurements" / f"{name}.g5.json").write_text(json.dumps(rec))


def judge(tmp, name, **kw):
    root = Path(tmp) / name
    captures(root, **kw)
    r = subprocess.run([sys.executable, "-I", str(VIS / "g5-judge.py"), str(root), "--out", str(root / "judge.json")], capture_output=True, text=True)
    out = json.loads((root / "judge.json").read_text()) if (root / "judge.json").exists() else {}
    return out.get("overall"), r.stdout.strip().splitlines()[-3:]


def main():
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        # Inkdrop: the switch, with a stand-in for other-window.sh that records its calls.
        stub, calls = t / "other-window.sh", t / "calls.txt"
        stub.write_text(f'echo "$@" >> "{calls}"\n')
        for value, want in (("off", 0), ("", 1), ("on", 1)):
            if calls.exists():
                calls.unlink()
            env = {**os.environ, "OTHER_WINDOW_SH": str(stub)}
            env.pop("CAPTURE_INKDROP", None)
            if value:
                env["CAPTURE_INKDROP"] = value
            subprocess.run(["bash", "-c", f'root="{ROOT}"; . "$root/tests/visual/inkdrop-window.sh"; inkdrop_window hide; inkdrop_window show'], env=env, check=True)
            n = len(calls.read_text().splitlines()) if calls.exists() else 0
            say(f"inkdrop_window with CAPTURE_INKDROP={value or '(unset)'}: other-window.sh called {n} times (declared {want * 2})", n == want * 2)
        cap = (VIS / "capture-obsidian.sh").read_text()
        direct = [l for l in cap.splitlines() if "other-window.sh" in l and not l.lstrip().startswith("#")]
        say("capture-obsidian.sh runs other-window.sh only through inkdrop_window", not direct, direct)
        g5 = (VIS / "g5-capture.mjs").read_text()
        code = "\n".join(l for l in g5.splitlines() if not l.lstrip().startswith("//"))
        say("g5-capture.mjs names no Inkdrop endpoint or helper", not re.search(r"other-window|9334|Inkdrop\.app|inkdrop_window", code))
        plan = json.loads(subprocess.run(["node", str(VIS / "g5-capture.mjs"), "--themes", str(t / "themes"), "--out", str(t / "out"), "--tmp", str(t / "tmp"), "--plan"], capture_output=True, text=True, check=True).stdout)
        keys = {(c["build"], c["theme"], c["mode"]) for c in plan}
        say("plan: 8 distinct conditions", len(plan) == 8 and len(keys) == 8, keys)
        say("plan: every capture with CAPTURE_INKDROP=off", all(c["env"].get("CAPTURE_INKDROP") == "off" for c in plan))
        say("plan: 8 distinct image files", len({c["image"] for c in plan}) == 8)
        say("plan: the two builds use their own theme and output folders", all(f"/{c['build']}/" in c["themeDir"] + "/" and c["outDir"].endswith(c["build"]) for c in plan))
        # The judgement.
        cases = [
            ("all as expected", "PASS", {}),
            ("with the fix, the Solarized Dark title bar differs from the tab strip", "FAIL", {"title": lambda c: (60, 80, 90) if c == ("after", "solarized-dark", "translucent") else None}),
            ("before the fix, the Kanagawa Dragon title bar is the tab strip's (control fails)", "INVALID", {"title": lambda c: TAB if c[:2] == ("before", "kanagawa-dragon") else None}),
            ("a capture missing", "INVALID", {"edit": lambda c, rec: rec.update(_skip=True) if c == ("after", "kanagawa-dragon", "opaque") else None}),
            # A title bar region reaching below the bar: on a pre-fix capture the bar and what is below differ.
            ("title bar region not flat", "INVALID", {"edit": lambda c, rec: rec["regions"]["titlebar"].update(rect=[100, 4, 300, 40]) if c == ("before", "kanagawa-dragon", "translucent") else None}),
            ("region outside the window", "INVALID", {"edit": lambda c, rec: rec["regions"]["left-tabstrip"].update(rect=[1190, 40, 80, 20]) if c[0] == "after" else None}),
            ("region too small", "INVALID", {"edit": lambda c, rec: rec["regions"]["titlebar"].update(bigEnough=False) if c == ("after", "kanagawa-dragon", "translucent") else None}),
            ("computed title bar not the expected one", "INVALID", {"edit": lambda c, rec: rec["regions"]["titlebar"].update(background="rgba(0, 0, 0, 0)") if c == ("after", "solarized-dark", "translucent") else None}),
            ("frame is not custom", "INVALID", {"edit": lambda c, rec: rec.update(frame="hidden") if c[0] == "after" else None}),
            ("window not focused at the capture", "INVALID", {"edit": lambda c, rec: rec.update(focusedAfterShot=False) if c == ("before", "solarized-dark", "translucent") else None}),
            ("image changed after the capture", "INVALID", {"edit": lambda c, rec: rec.update(imageSha256="0" * 64) if c == ("after", "solarized-dark", "opaque") else None}),
        ]
        for i, (name, want, kw) in enumerate(cases):
            got, tail = judge(tmp, f"j{i}", **kw)
            say(f"judge: {name}: {got} (declared {want})", got == want, tail)
    bad = results.count(False)
    print(f"\n{f'all {len(results)}' if not bad else f'{bad} of {len(results)}'} g5 self-test cases {'behaved as expected' if not bad else 'FAILED'}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
