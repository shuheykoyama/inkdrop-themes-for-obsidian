# Colour candidates for the Obsidian classes whose text carries several Inkdrop tokens (RV5, research/14
# §6.19): for each candidate token, how many runs and characters of that class would get Inkdrop's colour, per
# theme. Input: the correspondence table (tests/visual/token-table.mjs) and one page dump per theme from
# tests/runtime/code-tokens.js (its `vars` give each --ink-* variable's computed colour in that theme).
# The counts come from the test note only, so they weigh its languages and samples, not code in general.
#
# usage: nu tests/visual/syntax-candidates.nu <correspondence.csv> <page-solarized-dark.json> <page-kanagawa-dragon.json> <out.csv>
def main [table: string, sd_page: string, kd_page: string, out: string] {
  let rows = (open $table)
  let themes = [[theme vars]; [solarized-dark (open $sd_page | get vars)] [kanagawa-dragon (open $kd_page | get vars)]]
  # Each subject: which runs (view column, class string, languages) and the candidate tokens, current first.
  let subjects = [
    [subject column classes langs default candidates];
    ["default code text (editing)" obsidian_source "-" [] "--ink-md-codeblock-color" ["--ink-md-codeblock-color" "punctuation" "variable-name"]]
    ["default code text (Reading)" obsidian_reading "-" [] "--ink-mde-preview-codeblock-text-color" ["--ink-mde-preview-codeblock-text-color" "variable-name" "punctuation"]]
    ["cm-atom" obsidian_source "cm-atom" [] "--ink-md-codeblock-color" ["atom" "property-name-definition" "null" "name"]]
    ["cm-string-2" obsidian_source "cm-string-2" [] "--ink-md-codeblock-color" ["string-special" "regexp" "brace"]]
    ["cm-variable" obsidian_source "cm-variable" [] "--ink-md-codeblock-color" ["variable-name" "property-name" "name" "namespace"]]
    ["Reading JS function" obsidian_reading "function" [js javascript] "--ink-mde-preview-codeblock-text-color" ["variable-name-function" "variable-name-definition" "property-name-definition"]]
  ]
  # Characters of the runs' text (the CSV reader turns numeric text such as 42 into numbers).
  let len = {|t| $t | get text | reduce --fold 0 {|x, acc| $acc + ($x | into string | str length) } }
  let full = {|v| if ($v | str starts-with "--") { $v } else { $"--ink-syntax-($v)-color" } }
  $subjects | each {|s|
    let runs = ($rows | where {|r| ($r | get $s.column) == $s.classes and (($s.langs | is-empty) or ($r.lang in $s.langs)) })
    $s.candidates | enumerate | each {|c|
      $themes | each {|t|
        let want = ($t.vars | get (do $full $c.item))
        let hits = ($runs | where {|r|
          let v = if $r.inkdrop_var == "-" { $s.default } else { $r.inkdrop_var | str replace "--syntax-" "--ink-syntax-" }
          ($t.vars | get $v) == $want })
        {
          subject: $s.subject, candidate: ($c.item | str replace "--ink-" "" | str replace -r "-color$" ""), current: ($c.index == 0), theme: $t.theme,
          runs: ($hits | length), runs_total: ($runs | length),
          chars: (do $len $hits), chars_total: (do $len $runs)
        }
      }
    } | flatten
  } | flatten | save --force $out
  print $"wrote ($out)"
}
