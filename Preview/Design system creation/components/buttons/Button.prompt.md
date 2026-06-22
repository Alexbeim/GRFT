Primary CTA + secondary/link button for Graffiti+. Use `primary` (yellow fill) for the one main action per surface; `link` for "View project →" style text actions.

```jsx
<Button variant="primary">Book a demo</Button>
<Button variant="secondary" onDark>Our story</Button>
<Button variant="link" href="/projects/01">View project</Button>
```

Variants: `primary` (yellow fill, ink text, darkens to `#B07A00` on press), `secondary` (ink/paper outline — set `onDark` over black), `link` (text + `→` arrow). 2px radius max — never rounded. One primary per surface.
