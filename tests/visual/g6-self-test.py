"""Self-test of the G6 (V-35) tools (research/14 §6.95), without Inkdrop: tests/visual/g6-judge.py on synthetic
records, the isolation rules of tests/visual/g6-rules.mjs, and the refusals of tests/runtime/inkdrop-isolated.sh
with a stand-in app (it never starts or signals the real Inkdrop). Each case declares its expected outcome.

usage: python3 -I tests/visual/g6-self-test.py
"""
import copy
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("g6judge", ROOT / "tests/visual/g6-judge.py")
assert spec and spec.loader
J = importlib.util.module_from_spec(spec)
spec.loader.exec_module(J)


def probe(theme, acrylic=False):
    sd = theme == "solarized-dark"
    return {
        "inkdropVersion": "6.1.5", "theme": theme, "themeVersion": "2.2.1" if sd else "1.2.1",
        "settings": {"lineNumbers": True, "styleActiveLine": True, "acrylic": acrylic},
        "bodyClasses": ["dark-mode"] + (["acrylic-window"] if acrylic else []),
        "window": {"viewport": [1200, 700], "devicePixelRatio": 1, "screen": [400, 250, 1200, 700], "focused": True},
        "styles": {
            "activeLine": {"found": True, "rect": [60, 100, 800, 24], "backgroundColor": "rgba(0, 45, 56, 0.5)" if sd else "rgba(39, 38, 38, 0.3)"},
            "activeLineGutter": {"found": True, "rect": [0, 100, 40, 24]},
            "gutters": {"found": True, "borderRight": "0px none rgb(0, 0, 0)" if sd else "1px solid rgb(39, 38, 38)"},
            "lineNumber": {"found": True, "color": "rgb(88, 110, 116)" if sd else "rgb(98, 94, 91)"},
        },
        "layers": [],
        "note": {"_id": "note:x", "_rev": "1-a", "updatedAt": 1, "bodySha256": "ab"},
    }


def rec(theme="solarized-dark", mode="opaque", state="active"):
    p = probe(theme, mode == "acrylic")
    return {"name": f"{theme}-{mode}-{state}", "theme": theme, "mode": mode, "state": state, "line": 5, "pixels": [1200, 700],
            "stateResult": {"docUnchanged": True, "selectionEmpty": True, "cursorLine": 5, "searchError": None,
                            "activeLineHasMatch": state == "search", "activeLineClasses": ["cm-activeLine"] + (["cm-codeblock"] if state == "code" else [])},
            "probeBefore": p, "probeAfter": copy.deepcopy(p)}


def mut(r, f):
    r = copy.deepcopy(r)
    f(r)
    return r


def both(path, value):
    def f(r):
        for k in ("probeBefore", "probeAfter"):
            d = r[k]
            for p in path[:-1]:
                d = d[p]
            d[path[-1]] = value
    return f


def other_version(r):
    r["probeAfter"]["styles"]["activeLine"]["backgroundColor"] = "rgba(1, 2, 3, 0.5)"
    r["probeAfter"]["themeVersion"] = "2.3.0"


JUDGE = [
    ("SD active line as V-22", rec(), "PASS"),
    ("KD active line as V-22 (gutter line)", rec("kanagawa-dragon"), "PASS"),
    ("SD active line colour differs, same conditions", mut(rec(), lambda r: r["probeAfter"]["styles"]["activeLine"].update(backgroundColor="rgba(1, 2, 3, 0.5)")), "DIFF"),
    ("KD gutter line missing, same conditions", mut(rec("kanagawa-dragon"), lambda r: r["probeAfter"]["styles"]["gutters"].update(borderRight="0px none rgb(0, 0, 0)")), "DIFF"),
    ("SD gutter gains a line", mut(rec(), lambda r: r["probeAfter"]["styles"]["gutters"].update(borderRight="1px solid rgb(1, 1, 1)")), "DIFF"),
    ("band broken (gutter cell on another row)", mut(rec(), lambda r: r["probeAfter"]["styles"]["activeLineGutter"].update(rect=[0, 130, 40, 24])), "DIFF"),
    ("colour differs and theme version differs", mut(rec(), other_version), "HOLD"),
    ("colour differs and Inkdrop version differs", mut(rec(), lambda r: (r["probeAfter"]["styles"]["activeLine"].update(backgroundColor="x"), r["probeAfter"].update(inkdropVersion="6.2.0"))), "HOLD"),
    ("same colours under another Inkdrop version", mut(rec(), lambda r: r["probeAfter"].update(inkdropVersion="6.2.0")), "PASS"),
    ("search state records values", rec(state="search"), "RECORD"),
    ("code state records values", rec(state="code"), "RECORD"),
    ("acrylic state records values", rec(mode="acrylic"), "RECORD"),
    ("wrong theme", mut(rec(), both(["theme"], "kanagawa-dragon")), "INVALID"),
    ("active line setting off", mut(rec(), both(["settings", "styleActiveLine"], False)), "INVALID"),
    ("acrylic on in the opaque mode", mut(rec(), both(["settings", "acrylic"], True)), "INVALID"),
    ("acrylic class missing in the acrylic mode", mut(rec(mode="acrylic"), both(["bodyClasses"], ["dark-mode"])), "INVALID"),
    ("not focused", mut(rec(), both(["window", "focused"], False)), "INVALID"),
    ("window moved", mut(rec(), both(["window", "screen"], [0, 0, 1200, 700])), "INVALID"),
    ("no active line element", mut(rec(), both(["styles", "activeLine"], {"found": False})), "INVALID"),
    ("image size does not match the scale", mut(rec(), lambda r: r.update(pixels=[2400, 1400])), "INVALID"),
    ("2x scale with a 2x image", mut(rec(), lambda r: (both(["window", "devicePixelRatio"], 2)(r), r.update(pixels=[2400, 1400]))), "PASS"),
    ("note revision changed", mut(rec(), lambda r: r["probeAfter"]["note"].update(_rev="2-b")), "INVALID"),
    ("document changed in the editor", mut(rec(), lambda r: r["stateResult"].update(docUnchanged=False)), "INVALID"),
    ("text selected", mut(rec(), lambda r: r["stateResult"].update(selectionEmpty=False)), "INVALID"),
    ("cursor on another line", mut(rec(), lambda r: r["stateResult"].update(cursorLine=9)), "INVALID"),
    ("search API missing", mut(rec(state="search"), lambda r: r["stateResult"].update(searchError="CodeMirror search API not exported", activeLineHasMatch=False)), "INVALID"),
    ("no match on the active line", mut(rec(state="search"), lambda r: r["stateResult"].update(activeLineHasMatch=False)), "INVALID"),
    ("code line not marked", mut(rec(state="code"), lambda r: r["stateResult"].update(activeLineClasses=["cm-activeLine"])), "INVALID"),
]

ISO_OK = {"report": {"pid": 200, "env": "/w/d", "mainUi": True, "paths": {"userData": "/w/d", "configFile": "/w/d/config.json", "configDir": None,
          "packageDirs": ["/w/d/packages", "/Applications/Inkdrop.app/Contents/Resources/app.asar/packages"], "db": "/w/d/db"}},
          "openFiles": ["/w/d/db/000003.log", "/Applications/Inkdrop.app/Contents/MacOS/Inkdrop"],
          "data": "/w/d", "prod": "/home/inkdrop", "listener": 200, "started": 200, "othersBefore": ["100"], "othersNow": ["100"]}


def iso(**change):
    d = copy.deepcopy(ISO_OK)
    for k, v in change.items():
        if k in ("env", "pid"):
            d["report"][k] = v
        elif k.startswith("path_"):
            d["report"]["paths"][k[5:]] = v
        else:
            d[k] = v
    return d


ISOLATION = [
    ("isolated", iso(), 0),
    ("db confirmed only by an open file", iso(path_db=None), 0),
    ("no report", iso(report=None), 1),
    ("9334 held by another pid", iso(listener=100), 1),
    ("nothing listens on 9334", iso(listener=None), 1),
    ("page of another pid", iso(pid=100), 1),
    ("page PID missing", iso(pid=None), 1),
    ("started PID missing", iso(started=None), 3),
    ("env not the isolated dir", iso(env=None), 1),
    ("userData in the user's profile", iso(path_userData="/home/inkdrop"), 2),
    ("userData an empty string", iso(path_userData=""), 2),
    ("config file in the user's profile", iso(path_configFile="/home/inkdrop/config.json"), 2),
    ("no userData reported", iso(path_userData=None), 1),
    ("no config path reported", iso(path_configFile=None), 1),
    ("no packages path reported", iso(path_packageDirs=None), 1),
    ("only the bundle's packages reported", iso(path_packageDirs=["/Applications/Inkdrop.app/Contents/Resources/app.asar/packages"]), 1),
    ("db path missing and no db file open", iso(path_db=None, openFiles=["/Applications/Inkdrop.app/Contents/MacOS/Inkdrop"]), 1),
    ("db path not a path", iso(path_db="inkdrop-local-db", openFiles=[]), 2),
    ("db elsewhere", iso(path_db="/tmp/db"), 1),
    ("a prefix of the isolated dir is not inside it", iso(path_db="/w/d2/db"), 1),
    ("open files unknown", iso(openFiles=None), 1),
    ("a file of the user's profile open", iso(openFiles=["/w/d/db/000003.log", "/home/inkdrop/db/000001.log"]), 1),
    ("user's Inkdrop restarted", iso(othersNow=["101"]), 1),
    ("user's Inkdrop PIDs not recorded", iso(othersBefore=None), 1),
]


def launcher_cases(t):
    """The launcher with stand-in apps on an unused port; never the real Inkdrop. Returns (name, ok, detail)."""
    out = []
    prod = t / "prod"
    prod.mkdir()
    port = "19334"

    def app(name, body):
        d = t / f"{name}.app/Contents/MacOS"
        d.mkdir(parents=True)
        (d / "Inkdrop").write_text("#!/bin/sh\n" + body)
        (d / "Inkdrop").chmod(0o755)
        return t / f"{name}.app"

    lock = app("Lock", "echo 'Quit because of duplicated instance'\nexit 0\n")
    silent = app("Silent", "exec sleep 300\n")
    base = {**os.environ, "G6_PROD_DIR": str(prod), "G6_PORT": port, "G6_START_TIMEOUT": "2", "G6_STOP_WAIT": "2"}

    def start(work, **env):
        return subprocess.run(["bash", "tests/runtime/inkdrop-isolated.sh", "start", str(work)], cwd=ROOT, env={**base, **env}, capture_output=True, text=True)

    def alive(work):
        pid = int((work / "inkdrop.pid").read_text())
        return pid, subprocess.run(["kill", "-0", str(pid)], capture_output=True).returncode == 0

    p = start(t / "w1", INKDROP_APP=str(lock))
    out.append(("another instance holds the lock: not started, nothing signalled", p.returncode == 3 and "single-instance lock" in p.stdout, f"exit {p.returncode}"))
    p = start(prod / "work", INKDROP_APP=str(lock))
    out.append(("work dir inside the user's profile: refused", p.returncode == 1 and "refusing" in p.stderr, f"exit {p.returncode}"))
    # Alive but no debugger page on the port: not a start; the started process is stopped again.
    p = start(t / "w2", INKDROP_APP=str(silent))
    pid, up = alive(t / "w2")
    out.append(("process alive without a debugger page: not started, cleaned up", p.returncode == 1 and "no Inkdrop page" in p.stdout and not up, f"exit {p.returncode}, still running {up}"))
    # The same, with a kill that does nothing: the cleanup fails and that is reported (exit 5), never success.
    p = start(t / "w3", INKDROP_APP=str(silent), G6_TEST_KILL="true")
    pid, up = alive(t / "w3")
    out.append(("cleanup that fails is reported", p.returncode == 5 and "CLEANUP FAILED" in p.stdout and up, f"exit {p.returncode}, still running {up}"))
    subprocess.run(["kill", "-KILL", str(pid)], capture_output=True)
    # A later step without a confirmed isolation does nothing: notes on a port where no instance runs.
    w4 = t / "w4"
    w4.mkdir()
    notes = t / "notes.json"
    p = subprocess.run(["node", "tests/visual/g6-run.mjs", "notes", str(w4), str(notes)], cwd=ROOT, env=base, capture_output=True, text=True)
    out.append(("notes without a confirmed isolation: nothing done", p.returncode == 4 and not notes.exists(), f"exit {p.returncode}, wrote {notes.exists()}"))
    return out


def main():
    fails = 0
    for name, r, want in JUDGE:
        got = J.judge(r)["state"]
        ok = got == want
        fails += not ok
        print(f"{'PASS' if ok else 'FAIL'} g6 self-test: judge: {name}: {got} (declared {want})")
    script = "import { isolationProblems } from './tests/visual/g6-rules.mjs'; const cases = JSON.parse(process.argv[1]); console.log(JSON.stringify(cases.map((c) => isolationProblems(c).length)));"
    counts = json.loads(subprocess.run(["node", "--input-type=module", "-e", script, json.dumps([c for _, c, _ in ISOLATION])], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    for (name, _, want), got in zip(ISOLATION, counts):
        ok = got == want
        fails += not ok
        print(f"{'PASS' if ok else 'FAIL'} g6 self-test: isolation: {name}: {got} problems (declared {want})")
    with tempfile.TemporaryDirectory() as t:
        launcher = launcher_cases(Path(t))
    for name, ok, detail in launcher:
        fails += not ok
        print(f"{'PASS' if ok else 'FAIL'} g6 self-test: launcher: {name} ({detail})")
    total = len(JUDGE) + len(ISOLATION) + len(launcher)
    print(f"\n{'all' if not fails else str(total - fails) + ' of'} {total} g6 self-test cases behaved as expected")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
