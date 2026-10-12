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
  Animal <|-- Duck
  Animal : +int age
  Animal: +isMammal()
  class Duck{
    +String beakColor
    +swim()
  }
```

## State

```mermaid
stateDiagram-v2
  [*] --> Still
  Still --> Moving
  Moving --> Still
  Moving --> Crash
  Crash --> [*]
```

## Gantt

```mermaid
gantt
  title Plan
  dateFormat YYYY-MM-DD
  section A
  Task one :done, a1, 2026-01-01, 3d
  Task two :active, a2, after a1, 4d
  section B
  Task three :crit, b1, 2026-01-05, 3d
```

## Pie

```mermaid
pie title Pets
  "Dogs" : 40
  "Cats" : 35
  "Rats" : 25
```

## Entity relationship

```mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains
```

## Git graph

```mermaid
gitGraph
  commit
  branch develop
  commit
  checkout main
  merge develop
```

## Mindmap

```mermaid
mindmap
  root((Root))
    Branch A
      Leaf
    Branch B
```

## Not a diagram

An image that must not change: ![[half-transparent.png]]
