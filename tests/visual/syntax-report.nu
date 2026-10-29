# Syntax fidelity report (step 8, research/14 §6.17, §6.19) from a runtime result file of tests/runtime/run.mjs,
# desktop, opaque, first pass:
# - <out>/fidelity.csv: per view, language and theme, the runs with Inkdrop's colour out of all runs, and the
#   differing runs by category (shared: the class carries other Inkdrop colours and the theme chose one of
#   them; bare: text without a token element, coloured by the base colour; others: a failed group);
# - <out>/differences.csv: every differing run, once per view / language / text / tokens, with its
#   category and the themes it differs in;
# - <out>/classes.csv: every group of syn.<view>.classes (element classes, or bare text) with its class
#   (EXACT / CONFLICT / MISMATCH / DOMINATED), the theme's colour and Inkdrop's colours with run counts.
#
# usage: nu tests/visual/syntax-report.nu <runtime-electron-*.json> <out dir>
def main [result: string, out: string] {
  mkdir $out
  let all = (open $result | get results | where {|r| $r.platform == "desktop" and $r.appearance == "opaque" })
  let rows = ($all | where {|r| ($r.id | str starts-with "syn.") and ($r.id | str ends-with ".fidelity") })
  let cat = {|r, c| $r.measured? | default [] | where category == $c | length }
  $rows
  | each {|r|
      let parts = ($r.id | split row ".")
      let n = ($r.detail | parse --regex '^(?<same>\d+)/(?<total>\d+) runs' | first)
      let shared = (do $cat $r "shared")
      let bare = (do $cat $r "bare")
      { view: ($parts | get 1), lang: ($parts | get 2), theme: $r.theme, same: ($n.same | into int), total: ($n.total | into int),
        shared: $shared, bare: $bare, other: (($r.measured? | default [] | length) - $shared - $bare), status: $r.status }
    }
  | sort-by view lang theme
  | save --force $"($out)/fidelity.csv"
  $rows
  | where status == "DIFF"
  | each {|r|
      let parts = ($r.id | split row ".")
      $r.measured | each {|m| { view: ($parts | get 1), lang: ($parts | get 2), text: $m.text, category: $m.category, inkdrop: $m.inkdrop, inkdrop_colour: $m.inkdropColour, obsidian: $m.obsidian, theme_var: $m.got, theme: $r.theme } }
    }
  | flatten
  | group-by {|m| [$m.view $m.lang $m.text $m.inkdrop $m.obsidian] | str join "|" }
  | values
  | each {|g| ($g | first | reject theme) | insert themes ($g | get theme | uniq | str join " ") }
  | sort-by view lang
  | save --force $"($out)/differences.csv"
  $all
  | where {|r| ($r.id | str starts-with "syn.") and ($r.id | str ends-with ".classes") }
  | each {|r|
      let view = ($r.id | split row "." | get 1)
      $r.measured | each {|g| { view: $view, theme: $r.theme, group: $g.sig, bare: $g.bare, class: $g.class, theme_colour: $g.theme,
        inkdrop: ($g.inks | each {|i| $"($i.colour) ($i.tokens | str join '/') x($i.runs)" } | str join "; "), differing: $g.differing } }
    }
  | flatten
  | sort-by view theme class group
  | save --force $"($out)/classes.csv"
  print $"wrote ($out)/fidelity.csv, differences.csv and classes.csv"
}
