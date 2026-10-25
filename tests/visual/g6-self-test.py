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
import time
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
    }


def rec(theme="solarized-dark", mode="opaque", state="active"):
    p = probe(theme, mode == "acrylic")
    return {"name": f"{theme}-{mode}-{state}", "theme": theme, "mode": mode, "state": state, "line": 5, "pixels": [1200, 700],
            "stateResult": {"docUnchanged": True, "selectionEmpty": True, "cursorLine": 5, "searchError": None,
                            "activeLineHasMatch": state == "search", "activeLineClasses": ["cm-activeLine"] + (["cm-codeblock"] if state == "code" else []),
                            "searchMatches": 3 if state == "search" else 0, "searchPanelOpen": False, "selectionMatches": 0,
                            "findBarOpen": state == "search", "findBarText": "Create" if state == "search" else None},
            "probeBefore": p, "probeAfter": copy.deepcopy(p), "noteUnchanged": True}


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
    ("note changed during the shot", mut(rec(), lambda r: r.update(noteUnchanged=False)), "INVALID"),
    ("note identity not compared", mut(rec(), lambda r: r.pop("noteUnchanged")), "INVALID"),
    ("document changed in the editor", mut(rec(), lambda r: r["stateResult"].update(docUnchanged=False)), "INVALID"),
    ("text selected", mut(rec(), lambda r: r["stateResult"].update(selectionEmpty=False)), "INVALID"),
    ("cursor on another line", mut(rec(), lambda r: r["stateResult"].update(cursorLine=9)), "INVALID"),
    ("search API missing", mut(rec(state="search"), lambda r: r["stateResult"].update(searchError="CodeMirror search API not exported", activeLineHasMatch=False)), "INVALID"),
    ("no match on the active line", mut(rec(state="search"), lambda r: r["stateResult"].update(activeLineHasMatch=False)), "INVALID"),
    ("code line not marked", mut(rec(state="code"), lambda r: r["stateResult"].update(activeLineClasses=["cm-activeLine"])), "INVALID"),
    ("search highlight left over in the active line state", mut(rec(), lambda r: r["stateResult"].update(searchMatches=2)), "INVALID"),
    ("CodeMirror search panel left open in the code block state", mut(rec(state="code"), lambda r: r["stateResult"].update(searchPanelOpen=True)), "INVALID"),
    ("selection-match highlights in the search state", mut(rec(state="search"), lambda r: r["stateResult"].update(selectionMatches=1)), "INVALID"),
    ("a record without the highlight fields", mut(rec(), lambda r: [r["stateResult"].pop(k) for k in ("searchMatches", "searchPanelOpen", "selectionMatches")]), "INVALID"),
    ("Inkdrop's find bar left open in the code block state", mut(rec(state="code"), lambda r: r["stateResult"].update(findBarOpen=True)), "INVALID"),
    ("search state without Inkdrop's find bar", mut(rec(state="search"), lambda r: r["stateResult"].update(findBarOpen=False)), "INVALID"),
    ("search state with an empty find bar", mut(rec(state="search"), lambda r: r["stateResult"].update(findBarText="")), "INVALID"),
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


PROD_OK = {"report": {"pid": None, "env": None, "mainUi": True, "inkdropVersion": "6.2.0", "paths": {"configFile": "/home/inkdrop/config.json"}},
           "listener": 300, "started": 300, "configExpected": "/home/inkdrop/config.json", "othersNow": []}


def prod(**change):
    d = copy.deepcopy(PROD_OK)
    for k, v in change.items():
        if k == "configFile":
            d["report"]["paths"]["configFile"] = v
        elif k == "version":
            d["report"]["inkdropVersion"] = v
        else:
            d[k] = v
    return d


PRODUCTION = [
    ("the started Inkdrop with the user's config", prod(), 0),
    ("9334 held by another pid", prod(listener=301), 1),
    ("started PID unknown", prod(started=None), 2),
    ("another Inkdrop running too", prod(othersNow=["302"]), 1),
    ("running Inkdrops unknown", prod(othersNow=None), 1),
    ("no report", prod(report=None), 1),
    ("another config.json", prod(configFile="/tmp/config.json"), 1),
    ("no config path reported", prod(configFile=None), 1),
    ("version not reported", prod(version=""), 1),
]


def shot_cases(t):
    """g6-shot.mjs: the backdrop is closed whatever happens, a failed capture is never a result, and the public
    record keeps no note identity."""
    png = t / "ok.png"
    png.write_bytes(bytes.fromhex("89504e470d0a1a0a") + b"\0" * 200)
    script = r"""
import { shoot, splitNote } from './tests/visual/g6-shot.mjs';
import { spawnSync } from 'node:child_process';
const [t, png] = process.argv.slice(1);
const marker = '41.25';
const alive = () => spawnSync('pgrep', ['-f', `sleep ${marker}`]).status === 0;
const res = {};
for (const [k, capture] of [['fails', ['false']], ['noPng', ['sh', '-c', `echo text > ${t}/b.png`]], ['ok', ['cp', png, `${t}/c.png`]]]) {
  const file = { fails: `${t}/a.png`, noPng: `${t}/b.png`, ok: `${t}/c.png` }[k];
  let err = null;
  try { await shoot({ backdrop: ['sleep', marker], capture, file, settleMs: 200 }); } catch (e) { err = e.message; }
  res[k] = { err, backdropLeft: alive() };
}
const n = { _id: 'note:x', _rev: '1-a', updatedAt: 1, bodySha256: 'ab' };
const same = splitNote({ a: 1, note: n }, { a: 2, note: { ...n } });
const changed = splitNote({ note: n }, { note: { ...n, _rev: '2-b' } });
const missing = splitNote({}, {});
res.split = { publicText: JSON.stringify(same.public), same: same.public.noteUnchanged, changed: changed.public.noteUnchanged, missing: missing.public.noteUnchanged, privateKept: same.private.before?._id === 'note:x' };
console.log(JSON.stringify(res));
"""
    r = json.loads(subprocess.run(["node", "--input-type=module", "-e", script, str(t), str(png)], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    sp = r["split"]
    return [
        ("capture command fails: an error, backdrop closed", r["fails"]["err"] is not None and not r["fails"]["backdropLeft"], r["fails"]),
        ("capture writes no PNG: an error, backdrop closed", r["noPng"]["err"] is not None and not r["noPng"]["backdropLeft"], r["noPng"]),
        ("capture succeeds: no error, backdrop closed", r["ok"]["err"] is None and not r["ok"]["backdropLeft"], r["ok"]),
        ("public record without note ID, revision or body hash", all(x not in sp["publicText"] for x in ("note:x", "1-a", "bodySha256", '"ab"')) and sp["privateKept"], sp["publicText"][:80]),
        ("note unchanged / changed / not read", sp["same"] is True and sp["changed"] is False and sp["missing"] is False, sp),
    ]


def complete_cases(t):
    """g6-judge.py's completeness over the set of captures."""
    import hashlib

    def build(d, skip=(), extra=(), bad_sha=(), no_image=()):
        (d / "measurements").mkdir(parents=True)
        (d / "screenshots").mkdir()
        for (th, m, st), copy_ in [(k, False) for k in J.EXPECTED if k not in skip] + [(k, True) for k in extra]:
            name = f"inkdrop-{th}-v35-{m}-{st}"
            img = d / "screenshots" / f"{name}.png"
            img.write_bytes(name.encode())
            sha = hashlib.sha256(img.read_bytes()).hexdigest()
            if (th, m, st) in no_image:
                img.unlink()
            # An extra record of an existing condition is a second file for it.
            fname = f"{name}-copy" if copy_ and (th, m, st) in J.EXPECTED else name
            (d / "measurements" / f"{fname}.json").write_text(json.dumps({"name": name, "theme": th, "mode": m, "state": st,
                "image": f"screenshots/{name}.png", "imageSha256": "0" * 64 if (th, m, st) in bad_sha else sha}))
        return d

    k = ("kanagawa-dragon", "opaque", "code")
    cases = [
        ("all 8 conditions once", build(t / "c1"), 0),
        ("one condition missing", build(t / "c2", skip=(k,)), 1),
        ("one condition repeated (a second file for it)", build(t / "c3", extra=(k,)), 2),
        ("an image missing", build(t / "c4", no_image=(k,)), 1),
        ("an image not matching its SHA-256", build(t / "c5", bad_sha=(k,)), 1),
        ("a condition not in the plan", build(t / "c6", extra=(("solarized-dark", "acrylic", "search"),)), 1),
    ]
    return [(name, len(J.completeness(d)) == want, f"{len(J.completeness(d))} problems (declared {want})") for name, d, want in cases]


def production_cases(t):
    """tests/runtime/inkdrop-production.sh with a stand-in Inkdrop (a sleeping python process with a marker) and
    a stand-in profile; never the real Inkdrop, its profile, the keychain or LaunchServices."""
    out = []
    marker = "G6FAKEINKDROP"
    spawn_fake = f"python3 -c 'import time; time.sleep(300)' {marker} > /dev/null 2>&1 &"
    pkgs = t / "pkgs"
    (pkgs / "solarized-dark").mkdir(parents=True)
    (pkgs / "solarized-dark/package.json").write_text("{}")

    def profile(name):
        p = t / name
        (p / "packages/math").mkdir(parents=True)
        (p / "packages/math/index.js").write_text("x")
        (p / "config.json").write_text('{"core": {"theme": "solarized-dark"}}')
        (p / "keymap.json").write_text("{}")
        (p / "state-cache").mkdir()
        return p

    def sh(cmd, work, p, **env):
        e = {**os.environ, "G6_PROD_DIR": str(p), "G6_PORT": "19335", "G6_QUIT_WAIT": "3", "G6_PACKAGES": str(pkgs),
             "G6_TEST_PGREP": f"pgrep -f {marker}", "G6_TEST_HELPERS": "pgrep -f G6FAKEHELPER", "G6_TEST_QUIT": f"pkill -f {marker}", "G6_TEST_OPEN": spawn_fake, **env}
        return subprocess.run(["bash", "tests/runtime/inkdrop-production.sh", cmd, str(work)], cwd=ROOT, env=e, capture_output=True, text=True)

    def running():
        return subprocess.run(["pgrep", "-f", marker], capture_output=True).returncode == 0

    # Was running: quit for the run, everything put back, started normally again.
    p = profile("p1")
    subprocess.run(["sh", "-c", spawn_fake])
    time.sleep(0.5)
    w = t / "w1"
    w.mkdir()
    r1 = sh("prepare", w, p)
    placed = (p / "packages/solarized-dark").exists()
    (p / "config.json").write_text('{"core": {"theme": "kanagawa-dragon"}, "editor": {"lineNumbers": true}}')
    r2 = sh("restore", w, p)
    ok = r1.returncode == 0 and placed and r2.returncode == 0 and "RESTORED" in r2.stdout \
        and json.loads((p / "config.json").read_text()) == {"core": {"theme": "solarized-dark"}} and not (p / "packages/solarized-dark").exists() and running()
    out.append(("was running: quit, config and packages restored, started again", ok, f"prepare {r1.returncode}, restore {r2.returncode}, running {running()}"))
    subprocess.run(["pkill", "-f", marker])
    # Was not running: restored and left quit.
    p = profile("p2")
    w = t / "w2"
    w.mkdir()
    r1 = sh("prepare", w, p)
    (p / "config.json").write_text("{}")
    r2 = sh("restore", w, p)
    ok = r1.returncode == 0 and r2.returncode == 0 and "left quit" in r2.stdout and not running() and json.loads((p / "config.json").read_text()) == {"core": {"theme": "solarized-dark"}}
    out.append(("was not running: restored and left quit", ok, f"prepare {r1.returncode}, restore {r2.returncode}, running {running()}"))
    # Inkdrop does not quit at the restore: config.json is not written back and the restore is not a success.
    p = profile("p3")
    w = t / "w3"
    w.mkdir()
    sh("prepare", w, p)
    (p / "config.json").write_text("{}")
    subprocess.run(["sh", "-c", spawn_fake])
    time.sleep(0.5)
    r = sh("restore", w, p, G6_TEST_QUIT="true")
    out.append(("Inkdrop does not quit: RESTORE NOT CONFIRMED, nothing written", r.returncode == 5 and "RESTORE NOT CONFIRMED" in r.stdout and (p / "config.json").read_text() == "{}", f"exit {r.returncode}"))
    subprocess.run(["pkill", "-f", marker])
    # A recorded file that changed and cannot be restored from the backup (keymap.json): not a success.
    p = profile("p4")
    w = t / "w4"
    w.mkdir()
    sh("prepare", w, p)
    (p / "keymap.json").write_text('{"changed": true}')
    r = sh("restore", w, p)
    out.append(("a recorded file differs after the restore: RESTORE NOT CONFIRMED", r.returncode == 5 and "keymap.json" in r.stdout, f"exit {r.returncode}"))
    # Inkdrop running and not quitting at the prepare: nothing is changed.
    p = profile("p5")
    w = t / "w5"
    w.mkdir()
    subprocess.run(["sh", "-c", spawn_fake])
    time.sleep(0.5)
    r = sh("prepare", w, p, G6_TEST_QUIT="true")
    out.append(("Inkdrop does not quit at the prepare: not prepared, nothing placed", r.returncode == 1 and not (p / "packages/solarized-dark").exists(), f"exit {r.returncode}"))
    subprocess.run(["pkill", "-f", marker])
    # The production check fails (nothing on the port): capture takes no picture.
    w = t / "w6"
    w.mkdir()
    (w / "mode.txt").write_text("production\n")
    shots = t / "shots"
    c = subprocess.run(["node", "tests/visual/g6-run.mjs", "capture", str(w), str(shots), str(t / "tmp"), "note:x", "5", "9", "word", "opaque"], cwd=ROOT,
                       env={**os.environ, "G6_PORT": "19335", "G6_PROD_DIR": str(p)}, capture_output=True, text=True)
    out.append(("production check fails: no capture", c.returncode == 4 and not shots.exists(), f"exit {c.returncode}"))
    # Inkdrop gone but port 9334 still open: the restore touches no file.
    p = profile("p7")
    w = t / "w7"
    w.mkdir()
    sh("prepare", w, p)
    (p / "config.json").write_text("{}")
    srv = subprocess.Popen(["python3", "-m", "http.server", "19335", "--bind", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        r = sh("restore", w, p)
    finally:
        srv.kill()
        srv.wait()
    out.append(("main process gone but 9334 open: nothing written back", r.returncode == 5 and "no file was touched" in r.stdout and (p / "config.json").read_text() == "{}", f"exit {r.returncode}"))
    # No Inkdrop running: no quit is sent at the prepare or the restore.
    p = profile("p8")
    w = t / "w8"
    w.mkdir()
    flag = t / "quit-sent"
    r1 = sh("prepare", w, p, G6_TEST_QUIT=f"touch '{flag}'")
    r2 = sh("restore", w, p, G6_TEST_QUIT=f"touch '{flag}'")
    out.append(("nothing running: no quit sent", r1.returncode == 0 and r2.returncode == 0 and not flag.exists(), f"prepare {r1.returncode}, restore {r2.returncode}, quit sent {flag.exists()}"))
    # A theme package that cannot be copied: no partial package is left in packages/, the prepare fails.
    p = profile("p9")
    w = t / "w9"
    w.mkdir()
    bad = t / "badpkgs/kanagawa-dragon"
    bad.mkdir(parents=True)
    (bad / "package.json").write_text("{}")
    (bad / "secret.css").write_text("x")
    (bad / "secret.css").chmod(0)
    r = sh("prepare", w, p, G6_PACKAGES=str(t / "badpkgs"))
    (bad / "secret.css").chmod(0o644)
    left = sorted(x.name for x in (p / "packages").iterdir())
    out.append(("a package copy fails: no partial package left, not prepared", r.returncode == 1 and "no partial package left" in r.stdout and left == ["math"], f"exit {r.returncode}, packages {left}"))
    # The backup copy fails (config.json unreadable): no backup confirmed, and a restore writes nothing.
    p = profile("p10")
    w = t / "w10"
    w.mkdir()
    (p / "config.json").chmod(0)
    r1 = sh("prepare", w, p)
    (p / "config.json").chmod(0o644)
    (p / "config.json").write_text("{}")
    r2 = sh("restore", w, p)
    out.append(("backup copy fails: not prepared, restore writes nothing", r1.returncode == 1 and "the backup copy failed" in r1.stdout and r2.returncode == 5 and (p / "config.json").read_text() == "{}", f"prepare {r1.returncode}, restore {r2.returncode}"))
    # The backup copy does not match the original: no backup confirmed, and a restore writes nothing.
    p = profile("p11")
    w = t / "w11"
    w.mkdir()
    r1 = sh("prepare", w, p, G6_TEST_CORRUPT_BACKUP="1")
    (p / "config.json").write_text("{}")
    r2 = sh("restore", w, p)
    out.append(("backup SHA-256 mismatch: not prepared, restore writes nothing", r1.returncode == 1 and "does not match" in r1.stdout and not (w / "private/backup/config.json").exists() and r2.returncode == 5 and (p / "config.json").read_text() == "{}", f"prepare {r1.returncode}, restore {r2.returncode}"))
    # The confirmed backup changed before the restore: nothing is written.
    p = profile("p12")
    w = t / "w12"
    w.mkdir()
    sh("prepare", w, p)
    (w / "private/backup/config.json").write_text('{"tampered": true}')
    (p / "config.json").write_text("{}")
    r = sh("restore", w, p)
    out.append(("backup changed after its confirmation: restore writes nothing", r.returncode == 5 and "no file was touched" in r.stdout and (p / "config.json").read_text() == "{}", f"exit {r.returncode}"))
    # Inkdrop quit for the run, then the backup fails: reported as quit, config.json untouched, started again.
    p = profile("p13")
    w = t / "w13"
    w.mkdir()
    subprocess.run(["sh", "-c", spawn_fake])
    time.sleep(0.5)
    r = sh("prepare", w, p, G6_TEST_CORRUPT_BACKUP="1")
    ok = r.returncode == 1 and "was quit for the run, and is started again normally" in r.stdout and "config.json untouched" in r.stdout and running()
    out.append(("quit and then the backup fails: reported, config.json untouched, started again", ok, f"exit {r.returncode}, running {running()}"))
    subprocess.run(["pkill", "-f", marker])
    return out


def loop_cases(t):
    """g6-shot.mjs captureLoop: the next shot is not taken once the document or the note changed."""
    script = r"""
import { captureLoop } from './tests/visual/g6-shot.mjs';
const conds = [1, 2, 3].map((i) => ({ name: `c${i}` }));
const run = async (docAt, noteAt) => {
  const shots = [];
  const r = await captureLoop({ conditions: conds,
    setState: async (c) => ({ docUnchanged: c.name !== docAt }),
    takeShot: async (c, st) => { shots.push(c.name); return { noteUnchanged: c.name !== noteAt, stateResult: st }; } });
  return { shots, stopped: r.stopped, done: r.done };
};
console.log(JSON.stringify({ doc: await run('c2', null), note: await run(null, 'c2'), none: await run(null, null) }));
"""
    r = json.loads(subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    return [
        ("document changed by the state step: that shot and the rest not taken", r["doc"]["shots"] == ["c1"] and r["doc"]["stopped"], r["doc"]),
        ("note changed during a shot: no further shot", r["note"]["shots"] == ["c1", "c2"] and r["note"]["stopped"], r["note"]),
        ("nothing changed: all shots", r["none"]["shots"] == ["c1", "c2", "c3"] and r["none"]["stopped"] is None, r["none"]),
    ]


def runner_cases(t):
    """tests/visual/g6-c-run.sh with stand-ins for the production script and g6-run.mjs: every way out after the
    backup goes through the restore, and the restore result is reported apart from the capture result."""
    prod = t / "prod.sh"
    prod.write_text("""#!/bin/sh
echo "prod $1" >> "$CALLS"
case "$1" in
  prepare) [ "$FAIL_AT" = prepare ] && exit 1; mkdir -p "$2/private/backup"; echo '{}' > "$2/private/backup/config.json"; echo sum > "$2/private/backup/config.sha256" ;;
  restore) [ "${RESTORE_EXIT:-0}" = 0 ] && echo "RESTORED: as before"; exit "${RESTORE_EXIT:-0}" ;;
  start) [ "$FAIL_AT" = start ] && exit 1 ;;
  restart) [ "$FAIL_AT" = restart ] && exit 5 ;;
esac
exit 0
""")
    run = t / "run.sh"
    run.write_text(r"""#!/bin/sh
sub="$1"; work="$2"
echo "run $sub $(eval echo \${$#})" >> "$CALLS"
case "$sub" in
  notes) if [ -n "$NOTES_JSON" ]; then printf '%s' "$NOTES_JSON"; else printf '%s' '{"notes": [{"_id": "note:SECRETID", "bodySha256": "HASHSECRET", "plainLines": [5], "codeLines": [9], "plainWord": "Create"}]}'; fi > "$work/private/notes.json" ;;
  note) printf '{"rev": "1"}' > "$work/private/$4" ;;
  capture) eval mode=\${$#}; [ "$FAIL_AT" = "capture-$mode" ] && exit 1; [ "$NOTE_CHANGED" = "$mode" ] && exit 3
    # The stand-in "captures": the prepared records of this mode, and their images unless NO_IMAGES is set.
    mkdir -p "$3/measurements" "$3/screenshots"; cp "$TEMPLATE/$mode/measurements/"* "$3/measurements/"
    [ -n "$NO_IMAGES" ] || cp "$TEMPLATE/$mode/screenshots/"* "$3/screenshots/" ;;
esac
exit 0
""")
    # Records and images that g6-judge.py accepts, per mode, for the stand-in captures.
    import hashlib
    tpl = t / "template"
    for th, m, st in J.EXPECTED:
        name = f"inkdrop-{th}-v35-{m}-{st}"
        (tpl / m / "measurements").mkdir(parents=True, exist_ok=True)
        (tpl / m / "screenshots").mkdir(parents=True, exist_ok=True)
        img = tpl / m / "screenshots" / f"{name}.png"
        img.write_bytes(name.encode())
        r = rec(th, m, st)
        r.update(name=name, image=f"screenshots/{name}.png", imageSha256=hashlib.sha256(img.read_bytes()).hexdigest())
        (tpl / m / "measurements" / f"{name}.json").write_text(json.dumps(r))
    out = []

    def go(name, **env):
        w = t / f"r-{name}"
        calls = t / f"calls-{name}"
        calls.write_text("")
        e = {**os.environ, "G6_TEST_PROD": f"sh {prod}", "G6_TEST_RUN": f"sh {run}", "CALLS": str(calls), "TEMPLATE": str(tpl), **env}
        p = subprocess.run(["bash", "tests/visual/g6-c-run.sh", str(w), str(t / f"o-{name}"), str(t / "tmp")], cwd=ROOT, env=e, capture_output=True, text=True)
        return p, calls.read_text().split("\n")

    p, calls = go("ok")
    out.append(("8 conditions with images judged, RESTORED: success once, exit 0", p.returncode == 0 and calls.count("prod restore") == 1 and "CAPTURE: COMPLETE" in p.stdout and "RESTORE: RESTORED" in p.stdout and (t / "o-ok/judge.json").exists(), f"exit {p.returncode}"))
    p, calls = go("noimages", NO_IMAGES="1")
    out.append(("captures exit 0 but images missing: CAPTURE fails, restore runs", p.returncode == 1 and "CAPTURE: judge: INCOMPLETE or INVALID" in p.stdout and "prod restore" in calls, f"exit {p.returncode}"))
    old = t / "r-old"
    (old / "private/backup").mkdir(parents=True)
    (old / "private/backup/config.json").write_text("{}")
    (old / "private/backup/config.sha256").write_text("sum")
    calls_old = t / "calls-old"
    calls_old.write_text("")
    q = subprocess.run(["bash", "tests/visual/g6-c-run.sh", str(old), str(t / "o-old"), str(t / "tmp")], cwd=ROOT,
                       env={**os.environ, "G6_TEST_PROD": f"sh {prod}", "G6_TEST_RUN": f"sh {run}", "CALLS": str(calls_old), "TEMPLATE": str(tpl)}, capture_output=True, text=True)
    out.append(("an existing work dir (an old backup in it): refused, neither prepare nor restore", q.returncode == 1 and "REFUSED" in q.stdout and calls_old.read_text() == "", f"exit {q.returncode}"))
    p, calls = go("start", FAIL_AT="start")
    out.append(("start fails: restore runs, capture not reported as done", p.returncode == 1 and "prod restore" in calls and "stopped at start" in p.stdout and "RESTORE: RESTORED" in p.stdout, f"exit {p.returncode}"))
    p, calls = go("restart", FAIL_AT="restart")
    out.append(("restart fails: restore runs, no capture", p.returncode == 1 and "prod restore" in calls and not any(c.startswith("run capture") for c in calls), f"exit {p.returncode}"))
    p, calls = go("capture", FAIL_AT="capture-opaque")
    out.append(("capture fails: restore runs, the acrylic part not run", p.returncode == 1 and "prod restore" in calls and "run capture acrylic" not in calls, f"exit {p.returncode}"))
    p, calls = go("note", NOTE_CHANGED="opaque")
    out.append(("note changed: stopped, restore runs, no further step", p.returncode == 1 and "stopped at capture-opaque (exit 3)" in p.stdout and calls[-2:] == ["prod restore", ""] and "run settings true" not in calls, f"exit {p.returncode}"))
    p, calls = go("restorefail", RESTORE_EXIT="5")
    out.append(("restore fails: reported NOT CONFIRMED, not called usable, exit 1", p.returncode == 1 and "RESTORE: NOT CONFIRMED" in p.stdout and "not known to be usable" in p.stdout, f"exit {p.returncode}"))
    p, calls = go("prepare", FAIL_AT="prepare")
    out.append(("prepare fails before a backup: no restore", p.returncode == 1 and "prod restore" not in calls and "RESTORE: not run" in p.stdout, f"exit {p.returncode}"))
    out.append(("the note ID and body hash of the inventory never reach the output", all("SECRETID" not in x and "HASHSECRET" not in x for x in (p.stdout, go("leak")[0].stdout)), "stdout checked"))
    for name, notes in (("no tutorial note", '{"notes": []}'), ("a tutorial note without a code block line", '{"notes": [{"_id": "n1", "plainLines": [5], "codeLines": [], "plainWord": "Create"}]}')):
        p, calls = go(name.replace(" ", "-"), NOTES_JSON=notes)
        out.append((f"{name}: stopped before any note or capture step, no note created, restore runs", p.returncode == 1 and "no tutorial note with a plain line and a code block line" in p.stdout
                    and not any(c.startswith(("run note ", "run capture", "run settings")) for c in calls) and "prod restore" in calls, f"exit {p.returncode}"))
    return out


def notes_cases(t):
    """g6-notes.js against stand-in Inkdrop APIs shaped as 6.2.0 returns them (§6.113): rows of { doc } (index
    store) and rows of notes (SQL store) give the tutorial note; any other shape is an error, not an empty result."""
    script = r"""
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const src = readFileSync('tests/visual/g6-notes.js', 'utf8');
const note = { _id: 'note:1', _rev: '1-a', updatedAt: 1, title: 'Basic', tags: ['tag:t'], body: ['Some plain text line here with words', '```js', 'const x = 1;', '```', ''].join(String.fromCharCode(10)) };
const tagsOk = [{ _id: 'tag:t', name: 'Tutorial' }, { _id: 'tag:o', name: 'Other' }];
const make = ({ tags = tagsOk, find = { rows: [{ doc: note }] }, count = 7 } = {}) => ({ localDB: {
  tags: { all: async () => tags }, notes: { findWithTag: async () => find, count: async () => count } } });
const run = async (api) => { try { const r = await vm.runInNewContext(src, { inkdrop: api, crypto: globalThis.crypto, TextEncoder }); return { ok: r }; } catch (e) { return { err: e.message }; } };
const out = {
  index: await run(make()),
  sql: await run(make({ find: { query: {}, rows: [note], cursor: null } })),
  none: await run(make({ tags: [{ _id: 'tag:o', name: 'Other' }] })),
  docsShape: await run(make({ find: { docs: [note] } })),
  tagsShape: await run(make({ tags: { docs: tagsOk } })),
  noBody: await run(make({ find: { rows: [{ doc: { _id: 'note:2' } }] } })),
  countOdd: await run(make({ count: { n: 1 } })),
};
console.log(JSON.stringify(out));
"""
    r = json.loads(subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    good = lambda x: x.get("ok") and len(x["ok"]["notes"]) == 1 and x["ok"]["notes"][0]["plainLines"] == [1] and x["ok"]["notes"][0]["codeLines"] == [3] and x["ok"]["notes"][0]["plainWord"] == "plain"
    return [
        ("findWithTag rows of { doc } (6.2.0 index store): the tutorial note, its lines and word", good(r["index"]) and r["index"]["ok"]["count"] == 7, r["index"]),
        ("findWithTag rows of notes (6.2.0 SQL store): the same", good(r["sql"]), r["sql"]),
        ("no tutorial tag: zero notes, not an error", r["none"].get("ok") and r["none"]["ok"]["notes"] == [] and r["none"]["ok"]["tutorialTags"] == 0, r["none"]),
        ("findWithTag without rows: an error, not an empty result", "unexpected result shape" in (r["docsShape"].get("err") or ""), r["docsShape"]),
        ("tags.all not an array: an error", "unexpected result shape" in (r["tagsShape"].get("err") or ""), r["tagsShape"]),
        ("a row without a note body: an error", "without a note" in (r["noBody"].get("err") or ""), r["noBody"]),
        ("count not a number: reported as null, the inventory still read", good(r["countOdd"]) and r["countOdd"]["ok"]["count"] is None, r["countOdd"]),
        ("the body itself is not returned", all("Some plain text" not in json.dumps(x) for x in r.values()), "checked"),
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
    # The cleanup after a failed start must confirm more than the main PID: a helper it started that is still
    # running and still listening on the port, a helper still running, a change in the user's Inkdrop PIDs.
    listening = app("Listening", f"python3 -m http.server {port} --bind 127.0.0.1 > /dev/null 2>&1 &\nexec sleep 300\n")
    p = start(t / "w5", INKDROP_APP=str(listening), G6_TEST_SPARE_HELPERS="1")
    left = [int(x) for x in (t / "w5/tree.txt").read_text().split()]
    out.append(("port still open after a failed start", p.returncode == 5 and f"port {port} is still open" in p.stdout, f"exit {p.returncode}"))
    for x in left:
        subprocess.run(["kill", "-KILL", str(x)], capture_output=True)
    helper = app("Helper", "sleep 300 &\nexec sleep 300\n")
    p = start(t / "w6", INKDROP_APP=str(helper), G6_TEST_SPARE_HELPERS="1")
    left = [int(x) for x in (t / "w6/tree.txt").read_text().split()]
    out.append(("a started helper still running after a failed start", p.returncode == 5 and "a process it started" in p.stdout, f"exit {p.returncode}"))
    for x in left:
        subprocess.run(["kill", "-KILL", str(x)], capture_output=True)
    others = t / "others.txt"
    others.write_text("100\n")
    changer = app("Changer", f"echo 999 > '{others}'\nexec sleep 300\n")
    p = start(t / "w7", INKDROP_APP=str(changer), G6_TEST_OTHERS=str(others))
    out.append(("the user's Inkdrop PIDs changed during a failed start", p.returncode == 5 and "user's Inkdrop processes changed" in p.stdout, f"exit {p.returncode}"))
    # Raw A1 data goes only to <work>/private/<name>.json, <work> outside the repository; the output check runs
    # before anything else, so an allowed place gets as far as the isolation check (exit 4, nothing written).
    def notes(work, name):
        return subprocess.run(["node", "tests/visual/g6-run.mjs", "notes", str(work), name], cwd=ROOT, env=base, capture_output=True, text=True)
    w8 = t / "w8"
    w8.mkdir()
    p = notes(w8, "notes.json")
    out.append(("notes in an allowed place without a confirmed isolation: nothing done", p.returncode == 4 and not (w8 / "private/notes.json").exists(), f"exit {p.returncode}"))
    p = notes(ROOT / "tests", "notes.json")
    out.append(("notes output inside the repository: refused", p.returncode == 7 and not (ROOT / "tests/private").exists(), f"exit {p.returncode}"))
    p = notes(w8, "../escape.json")
    out.append(("notes output outside <work>/private: refused", p.returncode == 7 and not (t / "escape.json").exists(), f"exit {p.returncode}"))
    w9 = t / "w9"
    w9.mkdir()
    (t / "elsewhere").mkdir()
    (w9 / "private").symlink_to(t / "elsewhere")
    p = notes(w9, "notes.json")
    out.append(("notes output through a symbolic link: refused", p.returncode == 7 and not any((t / "elsewhere").iterdir()), f"exit {p.returncode}"))
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
    counts = json.loads(subprocess.run(["node", "--input-type=module", "-e", script.replace("isolationProblems", "productionProblems"), json.dumps([c for _, c, _ in PRODUCTION])], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    for (name, _, want), got in zip(PRODUCTION, counts):
        ok = got == want
        fails += not ok
        print(f"{'PASS' if ok else 'FAIL'} g6 self-test: production check: {name}: {got} problems (declared {want})")
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        (t / "l").mkdir()
        launcher = launcher_cases(t / "l")
        rest = [("inventory", c) for c in notes_cases(t)] + [("loop", c) for c in loop_cases(t)] + [("run", c) for c in runner_cases(t)] + [("shot", c) for c in shot_cases(t)] + [("completeness", c) for c in complete_cases(t)] + [("method C", c) for c in production_cases(t)]
    for kind, (name, ok, detail) in rest:
        fails += not ok
        print(f"{'PASS' if ok else 'FAIL'} g6 self-test: {kind}: {name} ({detail})")
    for name, ok, detail in launcher:
        fails += not ok
        print(f"{'PASS' if ok else 'FAIL'} g6 self-test: launcher: {name} ({detail})")
    total = len(JUDGE) + len(ISOLATION) + len(PRODUCTION) + len(launcher) + len(rest)
    print(f"\n{'all' if not fails else str(total - fails) + ' of'} {total} g6 self-test cases behaved as expected")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
