// One sample per Mermaid diagram type that Obsidian 1.14.5 (Mermaid 11.13.0) can draw; texts kept short but with the
// elements that carry colour (research/14 section 6.195).
export const SAMPLES = {
  class: `classDiagram
  class Animal {
    +int age
    +isMammal()
  }
  class Duck {
    +String beakColor
    +swim()
  }
  class Shape {
    <<interface>>
  }
  Animal <|-- Duck
  Animal "1" --> "*" Shape : uses
  note for Duck "A note"`,
  stateDiagram: `stateDiagram-v2
  [*] --> Still
  Still --> Moving : go
  Moving --> Still
  Moving --> Crash
  Crash --> [*]
  state Moving {
    [*] --> Fast
    Fast --> [*]
  }
  note right of Still : A note
  state fork_state <<fork>>
  Still --> fork_state`,
  er: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains
  CUSTOMER {
    string name PK
    string email
  }
  ORDER {
    int id PK
    date placed
  }`,
  gantt: `gantt
  title A Gantt
  dateFormat YYYY-MM-DD
  section A
  One :done, a1, 2026-01-01, 8d
  Two :active, a2, after a1, 9d
  Milestone :milestone, m1, 2026-01-09, 0d
  section B
  Three :crit, b1, 2026-01-05, 12d
  Four : b2, after b1, 10d`,
  pie: `pie title Pets
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15
  "Birds" : 40`,
  journey: `journey
  title My day
  section Work
    Make tea: 5: Me
    Do work: 1: Me, Cat
  section Home
    Sit down: 3: Me`,
  gitGraph: `gitGraph
  commit id: "A"
  branch develop
  checkout develop
  commit id: "B"
  commit id: "C"
  checkout main
  merge develop id: "M"
  commit id: "D" tag: "v1"`,
  mindmap: `mindmap
  root((Mind map))
    Origins
      Long history
      Popularisation
    Tools
      Pen
      Paper`,
  timeline: `timeline
  title History
  2002 : First
  2004 : Second : Third
  section Later
  2010 : Fourth`,
  quadrantChart: `quadrantChart
  title Reach
  x-axis Low --> High
  y-axis Low --> High
  quadrant-1 We
  quadrant-2 Expand
  quadrant-3 Re-evaluate
  quadrant-4 Improve
  Campaign A: [0.3, 0.6]
  Campaign B: [0.7, 0.2]`,
  requirement: `requirementDiagram
  requirement test_req {
    id: 1
    text: the test text.
    risk: high
    verifymethod: test
  }
  element test_entity {
    type: simulation
  }
  test_entity - satisfies -> test_req`,
  c4: `C4Context
  title System
  Person(user, "User", "A user")
  System(sys, "System", "The system")
  System_Ext(ext, "External", "Outside")
  Rel(user, sys, "Uses")
  Rel(sys, ext, "Calls")`,
  sankey: `sankey-beta
Source,Target,Value
A,B,10
A,C,5
B,D,8`,
  xychart: `xychart-beta
  title "Sales"
  x-axis [jan, feb, mar]
  y-axis "Revenue" 0 --> 100
  bar [30, 60, 45]
  line [30, 60, 45]`,
  block: `block-beta
  columns 3
  a["A"] b["B"] c["C"]
  d["D"]:2 e["E"]`,
  packet: `packet-beta
  0-15: "Source Port"
  16-31: "Destination Port"
  32-63: "Sequence Number"`,
  kanban: `kanban
  Todo
    t1[Create task]
    t2[Review]
  Doing
    d1[Write code]`,
  architecture: `architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service server(server)[Server] in api
  db:L -- R:server`,
  radar: `radar-beta
  axis a["A"], b["B"], c["C"]
  curve one["One"]{1, 2, 3}
  curve two["Two"]{3, 1, 2}`,
  treemap: `treemap-beta
"Root"
  "A": 10
  "B": 20`,
};
