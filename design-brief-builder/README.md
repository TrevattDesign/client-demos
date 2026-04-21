# Design brief builder

An internal wizard that produces a `.md` design-context file for any website project.

The output pairs with Claude CMS and the `/impeccable` skill. Drop the file into a site's repo root (as `.impeccable.md` or `{project-name}.md`) and every website change will be checked against it.

## Run

No build step. Any static server works.

```bash
python3 -m http.server 5174
# then open http://localhost:5174
```

Or open `index.html` directly in a browser.

## Files

- `index.html` — shell
- `styles.css` — styling (warm editorial, no reflex fonts)
- `schema.js` — questions, options, per-site-type presets
- `app.js` — wizard state, rendering, navigation, download
- `generator.js` — markdown output

State is saved to `localStorage` under `design-brief-state`. Use the **Reset** button to clear.

## Adding a question

Edit `schema.js`. Supported field types: `text`, `textarea` (optionally with `templates`), `radio`, `chips` (with `min`/`max`), `checkboxes`, `gallery`, `urlList`, `color`. Then reference the new field in `generator.js` to include it in the output.
