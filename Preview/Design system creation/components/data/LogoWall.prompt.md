Partner / brand-logo wall for proof — the homepage marquee in static grid form.

```jsx
<LogoWall label="On the wall with" columns={4}
  logos={[{src:"/assets/k11.svg",alt:"K11 ECOAST"}, "ADIDAS", "RED BULL", "NIKE"]} />
```

Logos render as mono-weight marks — greyscale on dark, greyscale on light chips. Hairline grid between cells, never boxed. Strings fall back to mono wordmarks when you don't have image assets yet.
