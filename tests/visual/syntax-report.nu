# Syntax fidelity report (step 8, research/14 §6.17) from a runtime result file of tests/runtime/run.mjs:
# - <out>/fidelity.csv: per view, language and theme, the runs with Inkdrop's colour out of all runs
#   (desktop, opaque, first pass);
# - <out>/not-reproducible.csv: every run whose colour differs from Inkdrop's, once per view / language /
#   text / tokens, with the themes it differs in.
#
# usage: nu tests/visual/syntax-report.nu <runtime-electron-*.json> <out dir>
def main [result: string, out: string] {
  mkdir $out
  let rows = (open $result | get results
    | where {|r| ($r.id | str starts-with "syn.") and ($r.id | str ends-with ".fidelity") and $r.platform == "desktop" and $r.appearance == "opaque" })
  # "54/108 runs have Inkdrop's colour..." -> same / total
  $rows
  | each {|r|
      let parts = ($r.id | split row ".")
      let n = ($r.detail | parse --regex '^(?<same>\d+)/(?<total>\d+) runs' | first)
      { view: ($parts | get 1), lang: ($parts | get 2), theme: $r.theme, same: ($n.same | into int), total: ($n.total | into int), status: $r.status }
    }
  | sort-by view lang theme
  | save --force $"($out)/fidelity.csv"
  $rows
  | where status == "NOT REPRODUCIBLE"
  | each {|r|
      let parts = ($r.id | split row ".")
      $r.measured | each {|m| { view: ($parts | get 1), lang: ($parts | get 2), text: $m.text, inkdrop: $m.inkdrop, inkdrop_var: $m.inkdropVar, obsidian: $m.obsidian, theme_var: $m.got, theme: $r.theme } }
    }
  | flatten
  | group-by {|m| [$m.view $m.lang $m.text $m.inkdrop $m.obsidian] | str join "|" }
  | values
  | each {|g| ($g | first | reject theme) | insert themes ($g | get theme | uniq | str join " ") }
  | sort-by view lang
  | save --force $"($out)/not-reproducible.csv"
  print $"wrote ($out)/fidelity.csv and ($out)/not-reproducible.csv"
}
