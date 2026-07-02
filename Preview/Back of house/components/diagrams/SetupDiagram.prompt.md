Wall elevation + VR-tracking sensor map. Set the wall/screen size, place lighthouses, the home tracker, transmitters, and the computer/printer; drag any sensor to fine-tune. Cable runs to the hub are computed automatically and flagged red past 5 m.

```jsx
<SetupDiagram
  eventId="nike-air-max-hk"
  eventName="Nike Air Max — Hong Kong"
  onChange={(config) => saveToBackend(config)}
/>
```

Read-only recap view (no controls, no drag) for a run sheet or client-facing summary:

```jsx
<SetupDiagram eventId="nike-air-max-hk" editable={false} compact />
```

No external dependencies beyond React — copy `SetupDiagram.jsx` into any host app. It falls back to hardcoded colors and generic font stacks if the Graffiti+ `--gp-font-*` tokens aren't present, so it renders correctly even outside this design system. Persistence is optional: pass `onChange` to own storage yourself, or leave `persist` on (default) to mirror config to `localStorage` under `gp-setup-<eventId>`.
