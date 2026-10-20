# Sourced by tests/visual/capture-obsidian.sh: hides / shows the window of the Inkdrop started for V-38 around
# a capture (other-window.sh), so it never sits between the captured window and the backdrop.
# CAPTURE_INKDROP=off (step 11G G5, research/14 §6.73) skips it entirely: other-window.sh is not run, so
# Inkdrop's endpoint is never even looked up. OTHER_WINDOW_SH replaces other-window.sh in the self-test only.
inkdrop_window() {
  if [ "${CAPTURE_INKDROP:-on}" = off ]; then return 0; fi
  bash "${OTHER_WINDOW_SH:-$root/tests/visual/other-window.sh}" "$1" inkdrop
}
