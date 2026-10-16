| # | セレクタ（短縮） | プロパティ | SD | KD | 変化した要素 SD/KD | FAIL した検査 |
|---|---|---|---|---|---|---|
| 1 | `tl .workspace-tabs .workspace-tab-header-container` | background-color | 必要 | 必要 | 1/1 | translucent.left-dock.tab-strip, translucent.right-dock.tab-strip, translucent.centre.tab-strip |
| 2 | `tl .workspace-ribbon.mod-primary` | background-color | 必要 | 必要 | 1/1 | translucent.ribbon |
| 3 | `tl .workspace-sidedock-vault-profile` | background-color | 必要 | 必要 | 1/1 | translucent.vault-profile |
| 4 | `tl .workspace-ribbon.mod-primary::before` | background-color | 必要 | 必要 | 1/1 | translucent.ribbon-corner.background |
| 5 | `mm:is([flowchart], [sequence])` | fill | 必要 | 必要 | 192/192 | mm.reading.flowchart-v2.colours, mm.reading.sequence.colours, mm.live.flowchart-v2.colours, mm.live.sequence.colours |
| 6 | `mm[flowchart] .node :is(rect, circle, ellipse, polygon, path)` | fill | 必要 | 必要 | 56/56 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 7 | `mm[flowchart] .node :is(rect, circle, ellipse, polygon, path)` | stroke | 必要 | 必要 | 58/58 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 8 | `mm[flowchart] .cluster rect` | fill | 必要 | 必要 | 6/6 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 9 | `mm[flowchart] .cluster rect` | stroke | 必要 | 必要 | 6/6 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 10 | `mm[flowchart] .cluster-label :is(span, p)` | color | 検証不足 | 検証不足 | 0/0 | なし |
| 11 | `mm[flowchart] .cluster-label text` | fill | 必要 | 必要 | 8/8 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 12 | `mm[flowchart] :is(.label, [class~="nodeLabel"], span[class~="edgeLabel"])` | color | 必要 | 必要 | 234/234 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 13 | `mm[flowchart] :is(.label, [class~="nodeLabel"], span[class~="edgeLabel"])` | fill | 必要 | 必要 | 80/80 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 14 | `mm[flowchart] :is(.node, [class~="edgeLabel"]) .label text` | fill | 必要 | 必要 | 8/8 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 15 | `mm[flowchart] .flowchart-link:not([style*="stroke:"])` | stroke | 必要 | 必要 | 20/20 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 16 | `mm[flowchart] :is(.marker, [class~="arrowMarkerPath"]:not([stroke]))` | fill | 必要 | 必要 | 38/38 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 17 | `mm[flowchart] :is(.marker, [class~="arrowMarkerPath"]:not([stroke]))` | stroke | 必要 | 必要 | 38/38 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 18 | `mm[flowchart] :is([class~="edgeLabel"], [class~="edgeLabel"] p)` | background-color | 必要 | 必要 | 46/46 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 19 | `mm[flowchart] [class~="labelBkg"]` | background-color | 必要 | 必要 | 20/20 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 20 | `mm[flowchart] [class~="edgeLabel"] rect` | fill | 必要 | 必要 | 2/2 | mm.reading.flowchart-v2.colours, mm.live.flowchart-v2.colours |
| 21 | `mm[sequence] line` | fill | 必要 | 必要 | 32/32 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 22 | `mm[sequence] line` | stroke | 必要 | 必要 | 28/28 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 23 | `mm[sequence] :is(.actor, .actor-man circle)` | fill | 必要 | 必要 | 16/16 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 24 | `mm[sequence] :is(.actor, .actor-man circle)` | stroke | 必要 | 必要 | 16/16 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 25 | `mm[sequence] text.actor > tspan` | fill | 必要 | 必要 | 8/8 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 26 | `mm[sequence] .actor-line` | stroke | 必要 | 必要 | 4/4 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 27 | `mm[sequence] :is([class~="messageLine0"], [class~="messageLine1"])` | fill | 必要 | 必要 | 12/12 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 28 | `mm[sequence] :is([class~="messageLine0"], [class~="messageLine1"])` | stroke | 必要 | 必要 | 12/12 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 29 | `mm[sequence] marker:is([id$="-arrowhead"], [id$="-crosshead"]) path` | fill | 必要 | 必要 | 4/4 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 30 | `mm[sequence] marker:is([id$="-arrowhead"], [id$="-crosshead"]) path` | stroke | 必要 | 必要 | 4/4 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 31 | `mm[sequence] marker[id$="-sequencenumber"]` | fill | 必要 | 必要 | 4/4 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 32 | `mm[sequence] [class~="messageText"]` | fill | 必要 | 必要 | 12/12 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 33 | `mm[sequence] [class~="sequenceNumber"]` | fill | 必要 | 必要 | 12/12 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 34 | `mm[sequence] :is(.activation0, .activation1, .activation2)` | fill | 必要 | 必要 | 2/2 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 35 | `mm[sequence] :is(.activation0, .activation1, .activation2)` | stroke | 必要 | 必要 | 2/2 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 36 | `mm[sequence] .note` | fill | 必要 | 必要 | 2/2 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 37 | `mm[sequence] .note` | stroke | 必要 | 必要 | 2/2 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 38 | `mm[sequence] :is([class~="noteText"], [class~="noteText"] > tspan)` | fill | 必要 | 必要 | 4/4 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 39 | `mm[sequence] [class~="loopLine"]` | fill | 必要 | 必要 | 18/18 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 40 | `mm[sequence] [class~="loopLine"]` | stroke | 必要 | 必要 | 18/18 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 41 | `mm[sequence] [class~="labelBox"]` | fill | 必要 | 必要 | 4/4 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 42 | `mm[sequence] [class~="labelBox"]` | stroke | 必要 | 必要 | 4/4 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 43 | `mm[sequence] :is([class~="labelText"], [class~="labelText"] > tspan)` | fill | 必要 | 必要 | 4/4 | mm.reading.sequence.colours, mm.live.sequence.colours |
| 44 | `mm[sequence] :is([class~="loopText"], [class~="loopText"] > tspan)` | fill | 必要 | 必要 | 10/10 | mm.reading.sequence.colours, mm.live.sequence.colours |
1362 1.14.4 43.7.7
