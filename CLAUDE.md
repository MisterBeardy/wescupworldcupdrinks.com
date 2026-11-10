@AGENTS.md

## Design system
Uses @misterbeardy/design-system (github.com/MisterBeardy/design-system).
- Installed via: github:MisterBeardy/design-system#v1.1.0
- Pre-deploy: switch to the latest pinned tag (file: breaks cloud builds)
- Accent: hue 95, chroma 0.15 (key "wescup" in app-registry.js), pasted in
  app/globals.css
- Dark mode bridge: an inline script in app/layout.tsx sets data-theme on
  <html> from prefers-color-scheme, before first paint, and follows changes
- Framework bridge: Tailwind 4 `@theme inline` in app/globals.css (bg-bg,
  bg-surface, text-ink, text-muted, border-border, accent/success/warning/danger)
- Type: page text in var(--font-display) (Space Grotesk), numbers and data in
  var(--font-mono) (JetBrains Mono, tabular) via the `.num` class. No other
  faces loaded. Tailwind: --font-sans → var(--font-display); --font-mono stays
  out of @theme.
- Styles imported: styles.css, from app/layout.tsx before globals.css
- Settings/list/stats UI uses Group/Row/GlyphTile/Segmented/Switch/StatStrip.
  Colour goes on the glyph tile, never on the card surface. Data colour never
  collapses into the accent. Team flags are the only per-team colour.
- Before UI work, read node_modules/@misterbeardy/design-system/readme.md —
  especially "Visual language" — and the .prompt.md beside each component used.
- Never copy tokens; never hardcode a color that exists as a token.
