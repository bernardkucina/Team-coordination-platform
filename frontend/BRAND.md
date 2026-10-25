# Hub Pulse brand kit: Nalepke

Playful and tactile: every object looks like a sticker on a laptop. Ink outlines, pastel fills, hard offset shadows. Gamification pieces (streaks, badges, lives) should feel like something you want to collect.

## Colors

| Token | Hex | Use |
| --- | --- | --- |
| `--ink` | #1E2235 | Text, outlines, primary buttons, sidebar, toasts |
| `--ground` | #F1F3FA | Page background |
| `--surface` | #FFFFFF | Cards, panels, fields |
| `--butter` | #FFE48A | Rewards, highlights, active nav shadow, focus ring |
| `--mint` | #BFE8D1 | Good, done, on pace, progress fill |
| `--sky` | #BCD7FF | Info, remote, current week, avatars |
| `--raspberry` | #FFC6D3 | Behind, missed |
| `--muted` | #5B6078 | Secondary text |
| `--field` | #C9CDE0 | Field and quiet borders |

Rules:
- Pastels are only backgrounds. Text on them is always `--ink`.
- Butter is the reward color. Don't use it for ordinary actions.
- Old token names (`--blue`, `--navy`, ...) still exist and point at the kit, so older components keep working.

## Type

- **Funnel Display** 800: headings, big numbers, KPI values (`--font-display`).
- **Funnel Sans** 400–700: everything else (`--font-body`).
- Loaded from Google Fonts in `src/app/layout.tsx`.

## Shapes

- Outline: `--stroke` 2px in ink on every card, panel, board and progress bar.
- Shadow: `--shadow` 3px 3px 0 ink (cards), `--shadow-sm` 2px 2px 0 ink (small objects). No blurred shadows.
- Radius: 16px cards, 10px small objects and fields, capsules (999px) for buttons, pills, nav and segmented controls.
- Primary button: ink capsule with a butter offset shadow. Pressed state shifts 1px and drops the shadow.
- Progress bar: white outlined track, mint fill with an ink edge.

## Gamification pieces

- Streak week: sky square with ink outline. Paused week: dashed outline, hatched. Current week: white with outline.
- Lives (Community misses): butter circles, used ones dashed and faded.
- Badges: butter capsule with an ink outline and a small ink icon disc.
