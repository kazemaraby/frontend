# SSS HR System brand

- `sss-hr-logo.svg`: the mark, pure vector paths (no font needed); the app serves the same file as
  `public/logo.svg` (logo and favicon).
- `sss-hr-logo-1024.png`: the mark at 1024 px, transparent, for documents and stores.
- Colours: green `#006c35` (deep `#00522a`), gold `#d4a63a`, white. They are the design tokens in
  `src/index.css` ("navy" = the deep green of primary actions, "teal" = the accent green, "gold").

The SVG is made by `scripts/make_logo.py` (a redraw of the original `logo.png` with the app's font, IBM Plex Sans).
The app icons in `public/icons/` (192, 512, maskable 512, Apple touch 180) and `favicon.png` (64) are this mark
on white, rendered from the SVG.
