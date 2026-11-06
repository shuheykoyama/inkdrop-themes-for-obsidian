---
title: edge cases
tags: [a, b]
---

# Edge cases

## E01 tilde fence

~~~js
const a = 1; // tilde
~~~

## E02 four backticks containing three

````js
const b = 2; // outer
```
const c = 3; // still inside outer
```
````

## E03 fence in list items

- item
  ```js
  const d = 4; // list 2 spaces
  ```

1. numbered
   ```js
   const e = 5; // list 3 spaces
   ```

- bullet

    ```js
    const f = 6; // list 4 spaces (indented code?)
    ```

## E04 fence in blockquote

> ```js
> const g = 7; // quote
> ```

## E05 info string variants

```js title="a.js"
const h = 8; // attrs
```

```js {1,3}
const i = 9; // braces
```

```JS
const j = 10; // upper case
```

```js:file.js
const k = 11; // colon
```

```{.js}
const l = 12; // pandoc style
```

``` js
const m = 13; // leading space in info
```

```javascript typescript
const n = 14; // two words
```

## E06 closing fence variants

```js
const o = 15; // closed by longer fence
`````

```js
const p = 16; // fewer backticks do not close
``
const q = 17; // still inside
```

```js
const r = 18; // trailing spaces after closing fence
```   

## E07 indented code and inline

    const s = 19; // indented code block

Inline ```js const t = 20;``` triple backticks on one line.

## E08 right after a paragraph

paragraph text
```js
const u = 21; // no blank line before
```
after text

## E09 inside an HTML block

<div>
```js
const v = 22; // inside html block
```
</div>

## E10 math block with fence-like lines

$$
```js
const w = 23; // inside math
```
$$

## E11 alert with fence

> [!NOTE]
> ```js
> const x = 24; // in alert
> ```

## E12 no info and unknown language

```
const y = 25; // no info
```

```foobar
const z = 26; // unknown language
```

## E13 markdown block with nested code

````markdown
# Title

**bold** and *em* and `code` and [link](https://example.com)

> quote

- list

```js
const nested = 1;
```
````

## E14 language aliases

```ls
x = 1 # livescript
```

```rscript
x <- c(1, 2, 3) # r
```

## E15 unclosed fence (last)

```js
const unclosed = 27; // never closed
