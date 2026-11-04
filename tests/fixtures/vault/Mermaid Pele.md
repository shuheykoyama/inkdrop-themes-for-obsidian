# Mermaid (Pele)

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

## Event modeling

```mermaid
eventmodeling

timeframe 01 ui CartUI
timeframe 02 command AddItem
timeframe 03 event ItemAdded

resetframe 04 event External.InventoryChanged
timeframe 05 processor InventoryProcessor
timeframe 06 command ChangeInventory
timeframe 07 event Cart.InventoryChanged
```

## Agent flow

```mermaid
agentflow-beta TB
  flow intake["Intake"]
    receive["Receive request"]@{ shape: input }
  end

  flow processing["Processing"]
    validate["Validate"]@{ shape: task }
    enrich["Enrich"]@{ shape: task }
    validate --> enrich
  end
  processing@{ view: "collapsed" }

  flow output["Output"]
    publish["Publish"]@{ shape: action }
  end

  receive --> validate
  enrich --> publish
```

## Cynefin

```mermaid
cynefin-beta
  title Strategy Categorization

  complex
    "Market research"

  complicated
    "Competitive analysis"

  clear
    "Standard pricing"

  chaotic
    "Crisis management"

  complex --> complicated : "Pattern identified"
  complicated --> clear : "Best practice codified"
  clear --> chaotic : "Complacency"
  chaotic --> complex : "Stabilized"
```

## Ishikawa

```mermaid
ishikawa-beta
    Blurry Photo
    Process
        Out of focus
        Shutter speed too slow
        Protective film not removed
        Beautification filter applied
    User
        Shaky hands
    Equipment
        LENS
            Inappropriate lens
            Damaged lens
            Dirty lens
        SENSOR
            Damaged sensor
            Dirty sensor
    Environment
        Subject moved too quickly
        Too dark
```

## Railroad

```mermaid
railroad-ebnf-beta
title "Arithmetic Expression Grammar"

expression = term ( ( "+" | "-" ) term )* ;
term = factor ( ( "*" | "/" ) factor )* ;
factor = number | "(" expression ")" ;
number = digit+ ;
digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
```

## Swimlane

```mermaid
swimlane-beta LR
  subgraph Applicant
    apply[Submit application]
    sign[Sign agreement]
  end

  subgraph Reviewer
    screen[Screen application]
    decide{Approved?}
  end

  subgraph System
    create[Create account]
    notify[Send welcome email]
  end

  apply -->|Application received| screen
  screen --> decide
  decide -->|Approved| create --> notify --> sign
  decide -->|Needs changes| apply
```

## Tree view

```mermaid
treeView-beta
    my-project/
        src/
            App.tsx ::highlight icon(logos:react) ## main component
            index.js ## entry point
        .env ## environment variables
        Dockerfile
        package.json
```

## Use case

```mermaid
usecase-beta
direction LR
actor Customer
actor Support
systemBoundary Storefront
  Browse("Browse catalog")
  Checkout("Checkout")
end
systemBoundary Fulfilment
  Track("Track delivery")
end
Customer --> Browse
Customer --> Checkout
Customer --> Track
Support --> Track
Checkout ..> : include Browse
```

## Venn

```mermaid
venn-beta
  set A["Frontend"]
    text A1["React"]
    text A2["Design Systems"]
  set B["Backend"]
    text B1["API"]
  union A,B["Shared"]
    text AB1["OpenAPI"]
```

## Wardley map

```mermaid
wardley-beta
title Sourcing Strategy

anchor Customer [0.80, 0.95]
component Custom App [0.45, 0.85] (build)
component Off-the-shelf Tool [0.85, 0.65] (buy)
component Managed Service [0.60, 0.40] (outsource)
component Cloud Platform [0.95, 0.25] (market)

Customer -> Custom App
Custom App -> Off-the-shelf Tool
Custom App -> Managed Service
Off-the-shelf Tool -> Cloud Platform
```

## Not a diagram

An image that must not change: ![[half-transparent.png]]
