# Mermaid

## Flowchart

```mermaid
flowchart LR
  A[Start] --> B{Decision}
  B -->|yes| C(Rounded)
  B -.->|no| D([Stadium])
  C ==> E[(Database)]
  D --> F((Circle))
  subgraph S1 [Group]
    E --> G>Flag]
    G --> H{{Hexagon}}
  end
  H --- I[/Lean/]
```

## Flowchart with user styles

```mermaid
flowchart LR
  P[Styled] --> Q[Classed]
  Q --> R[Plain]
  style P fill:#f96,stroke:#333,color:#000
  classDef hot fill:#f00,color:#fff
  class Q hot
  linkStyle 0 stroke:#0f0
```

## Flowchart with SVG text labels

```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart LR
  subgraph S2 [Text group]
    J[Text start] -->|text edge| K(Text end)
  end
```

## Sequence

```mermaid
sequenceDiagram
  autonumber
  participant A as Alice
  actor B as Bob
  A->>B: Hello Bob
  activate B
  B-->>A: Hi Alice
  deactivate B
  Note over A,B: A shared note
  loop Every minute
    A->>B: Ping
  end
  alt is sick
    B->>A: Not so good
  else is well
    B->>A: Fine
  end
  A-xB: Bye
```

## Class

```mermaid
classDiagram
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
  note for Duck "A note"
```

## State

```mermaid
stateDiagram-v2
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
  Still --> fork_state
```

## Entity relationship

```mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains
  CUSTOMER {
    string name PK
    string email
  }
  ORDER {
    int id PK
    date placed
  }
```

## Gantt

```mermaid
gantt
  title A Gantt
  dateFormat YYYY-MM-DD
  section A
  One :done, a1, 2026-01-01, 8d
  Two :active, a2, after a1, 9d
  Milestone :milestone, m1, 2026-01-09, 0d
  section B
  Three :crit, b1, 2026-01-05, 12d
  Four : b2, after b1, 10d
```

## Pie

```mermaid
pie title Pets
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15
  "Birds" : 40
```

## User journey

```mermaid
journey
  title My day
  section Work
    Make tea: 5: Me
    Do work: 1: Me, Cat
  section Home
    Sit down: 3: Me
```

## Git graph

```mermaid
gitGraph
  commit id: "A"
  branch develop
  checkout develop
  commit id: "B"
  commit id: "C"
  checkout main
  merge develop id: "M"
  commit id: "D" tag: "v1"
```

## Mindmap

```mermaid
mindmap
  root((Mind map))
    Origins
      Long history
      Popularisation
    Tools
      Pen
      Paper
```

## Timeline

```mermaid
timeline
  title History
  2002 : First
  2004 : Second : Third
  section Later
  2010 : Fourth
```

## Quadrant chart

```mermaid
quadrantChart
  title Reach
  x-axis Low --> High
  y-axis Low --> High
  quadrant-1 We
  quadrant-2 Expand
  quadrant-3 Re-evaluate
  quadrant-4 Improve
  Campaign A: [0.3, 0.6]
  Campaign B: [0.7, 0.2]
```

## Requirement

```mermaid
requirementDiagram
  requirement test_req {
    id: 1
    text: the test text.
    risk: high
    verifymethod: test
  }
  element test_entity {
    type: simulation
  }
  test_entity - satisfies -> test_req
```

## C4

```mermaid
C4Context
  title System
  Person(user, "User", "A user")
  System(sys, "System", "The system")
  System_Ext(ext, "External", "Outside")
  Rel(user, sys, "Uses")
  Rel(sys, ext, "Calls")
```

## Sankey

```mermaid
sankey-beta
Source,Target,Value
A,B,10
A,C,5
B,D,8
```

## XY chart

```mermaid
xychart-beta
  title "Sales"
  x-axis [jan, feb, mar]
  y-axis "Revenue" 0 --> 100
  bar [30, 60, 45]
  line [30, 60, 45]
```

## Block

```mermaid
block-beta
  columns 3
  a["A"] b["B"] c["C"]
  d["D"]:2 e["E"]
```

## Packet

```mermaid
packet-beta
  0-15: "Source Port"
  16-31: "Destination Port"
  32-63: "Sequence Number"
```

## Kanban

```mermaid
kanban
  Todo
    t1[Create task]
    t2[Review]
  Doing
    d1[Write code]
```

## Architecture

```mermaid
architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service server(server)[Server] in api
  db:L -- R:server
```

## Radar

```mermaid
radar-beta
  axis a["A"], b["B"], c["C"]
  curve one["One"]{1, 2, 3}
  curve two["Two"]{3, 1, 2}
```

## Treemap

```mermaid
treemap-beta
"Root"
  "A": 10
  "B": 20
```

## Not a diagram

An image that must not change: ![[half-transparent.png]]
