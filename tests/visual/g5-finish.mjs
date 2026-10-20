// Step 11G G5 (research/14 §6.75): what the end of tests/visual/g5-capture.mjs may report, from the outcome of
// each restoring step. Kept apart from the capture script so its negative tests need no screen.
//   screen   released only when the instance this run started was stopped (stop exit 0), its process is gone
//            and the CDP port 9333 no longer answers; when nothing was started, only the port is checked;
//   restore  LaunchServices `restore` exited 0, and separately its `check` is the same as before the run;
//   exit     0 all 8 captures taken, screen released and restore complete; 1 captures incomplete or stopped
//            early; 3 screen not confirmed released; 4 LaunchServices not restored (the most serious first).
// The safe restoring steps are always tried; this only decides what may be claimed about them.
export function finish({ started, stopStatus, pidAlive, portOpen, restoreStatus, lsSame, captures, total, stoppedEarly }) {
  const released = (started ? stopStatus === 0 && pidAlive === false : pidAlive !== true) && portOpen === false;
  const restored = restoreStatus === 0;
  const same = lsSame === true;
  const complete = captures === total && !stoppedEarly;
  const exitCode = !released ? 3 : !restored || !same ? 4 : !complete ? 1 : 0;
  const screenLine = released
    ? "SCREEN RELEASED"
    : `SCREEN NOT CONFIRMED RELEASED (stop exit ${stopStatus ?? "-"}, process ${pidAlive === false ? "gone" : pidAlive === true ? "still running" : "unknown"}, port 9333 ${portOpen === false ? "closed" : "still answering"}); restoring is not complete`;
  const restoreLine = `LaunchServices restore ${restored ? "ran" : `FAILED (exit ${restoreStatus ?? "-"})`}; check ${same ? "same as before" : "DIFFERENT from before"}`;
  const captureLine = `${captures} of ${total} captures; ${stoppedEarly ? `stopped early: ${stoppedEarly}` : complete ? "all taken" : "incomplete"}`;
  return { released, restored, lsSame: same, complete, exitCode, screenLine, restoreLine, captureLine };
}
