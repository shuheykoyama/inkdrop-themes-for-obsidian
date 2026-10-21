// Step 11G G5 (research/14 §6.75, §6.77): what tests/visual/g5-capture.mjs may do and claim at its start and
// end, from the outcome of each step. Kept apart from the capture script so its negative tests need no screen.

// Before anything is started: the LaunchServices `check` must exit 0 with output to compare with later (the
// handler and the records), and that output must be the known normal state (research/14 §6.83): the default
// obsidian:// handler is /Applications/Obsidian.app and the E43 copy of tests/runtime/current-installer.sh is
// neither a candidate nor a registered path (it is registered only while E43 runs; G5 found it left over once,
// §6.79). Otherwise no isolated instance is started, and nothing is changed to make it so.
export const E43_COPY = ".cache/inkdrop-themes-for-obsidian/";
export function mayStart({ checkStatus, checkOut }) {
  if (checkStatus !== 0) return { ok: false, why: `LaunchServices check before the run exited ${checkStatus ?? "-"}` };
  if (typeof checkOut !== "string" || !checkOut.trim()) return { ok: false, why: "LaunchServices check before the run printed nothing to compare" };
  if (!checkOut.split("\n").some((l) => l.trim() === "default: /Applications/Obsidian.app")) return { ok: false, why: "the default obsidian:// handler is not /Applications/Obsidian.app" };
  if (checkOut.includes(E43_COPY)) return { ok: false, why: "the E43 copy is still registered with LaunchServices" };
  return { ok: true, why: null };
}

// After the run, what is to be done (research/14 §6.85): only when the start of the isolated instance was
// attempted is it stopped, the screen checked and LaunchServices restored and checked (a start that failed half
// way included). Otherwise nothing was started and nothing is touched: the screen was never taken (NOT STARTED)
// and LaunchServices is left exactly as it was.
export function afterRun({ startAttempted }) {
  return startAttempted ? { stop: true, restore: true, screen: "verify" } : { stop: false, restore: false, screen: "not started" };
}

// At the end:
//   screen   released only when the instance this run started was stopped (stop exit 0), its process is gone,
//            the CDP port 9333 no longer answers and no backdrop window of this run is left; when nothing was
//            started, the port and the backdrop are checked;
//   restore  confirmed only when the check before was valid, LaunchServices `restore` exited 0, the check after
//            exited 0, and its output is the same as before (a matching output of a failed check is not enough);
//   exit     0 all 8 captures taken, screen released and restore confirmed; 1 captures incomplete or stopped
//            early; 3 screen not confirmed released; 4 LaunchServices not confirmed restored (the most serious
//            first).
// The safe restoring steps are always tried; this only decides what may be claimed about them.
export function finish({ started, stopStatus, pidAlive, portOpen, backdropAlive = false, checkBeforeOk, restoreStatus, checkAfterStatus, lsSame, captures, total, stoppedEarly }) {
  const released = (started ? stopStatus === 0 && pidAlive === false : pidAlive !== true) && portOpen === false && backdropAlive === false;
  const restored = checkBeforeOk === true && restoreStatus === 0 && checkAfterStatus === 0 && lsSame === true;
  const complete = captures === total && !stoppedEarly;
  const exitCode = !released ? 3 : !restored ? 4 : !complete ? 1 : 0;
  const screenLine = released
    ? "SCREEN RELEASED"
    : `SCREEN NOT CONFIRMED RELEASED (stop exit ${stopStatus ?? "-"}, process ${pidAlive === false ? "gone" : pidAlive === true ? "still running" : "unknown"}, port 9333 ${portOpen === false ? "closed" : "still answering"}, backdrop ${backdropAlive === false ? "closed" : "still open"}); restoring is not complete`;
  const restoreLine = `LaunchServices: check before ${checkBeforeOk === true ? "valid" : "NOT valid"}, restore ${restoreStatus === 0 ? "exit 0" : `FAILED (exit ${restoreStatus ?? "-"})`}, check after ${checkAfterStatus === 0 ? "exit 0" : `FAILED (exit ${checkAfterStatus ?? "-"})`}, output ${lsSame === true ? "same as before" : "DIFFERENT from before"}: ${restored ? "restored" : "NOT confirmed restored"}`;
  const captureLine = `${captures} of ${total} captures; ${stoppedEarly ? `stopped early: ${stoppedEarly}` : complete ? "all taken" : "incomplete"}`;
  return { released, restored, lsSame: lsSame === true, complete, exitCode, screenLine, restoreLine, captureLine };
}
