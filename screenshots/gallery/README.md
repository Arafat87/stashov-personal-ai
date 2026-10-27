# Stashov — submission gallery

Ten images, in the order the submission form expects. Every file is **1800 × 1200 px (3:2)**, PNG, and under 5 MB.

| # | File | Caption |
|---|------|---------|
| 1 | `gate-review.png` | Pre-gate review dialog with JSON-LD capture, duplicate warnings, price provenance |
| 2 | `impulse-gate.png` | Gate lane view: cooling/ready/bought/skipped/snoozed with countdown timers |
| 3 | `library-audit.png` | Reference library with 10 sections, health status badges, duplicate clusters |
| 4 | `routine-conflict.png` | Clear Skin PM protocol flagging AHA/BHA conflict with Adapalene |
| 5 | `capture-bookmarklet.png` | Capture dialog with draggable bookmarklet and mobile fallback note |
| 6 | `telemetry-console.png` | Nebius Token Factory routing latency, token usage, cost per call |
| 7 | `profile-editor.png` | Editable You profile: sizes, constraints, owned inventory, scent notes |
| 8 | `cluster-cards.png` | 14 generated 800×600 SVG reference cards |
| 9 | `mobile-share.png` | PWA Web Share Target flow from Android Chrome |
| 10 | `ledger-budget.png` | Monthly fun-money ledger with category caps and history |

## How each frame was captured

- **1–7, 10** are real UI frames from the running app (headless Chrome, 2400 × 1600 capture, downscaled to 1800 × 1200). No mockups, no recolouring.
- **7** shows the You room rather than the edit dialog: the dialog's full form (sizing, constraints, six owned items, scent notes) is taller than a 3:2 frame, so the profile surface with its **Edit profile** entry point is used instead — every field named in the caption is visible.
- **8** is a contact sheet of the actual `public/cluster-cards/*.svg` files (all 14), rendered at their 800 × 600 ratio.
- **9** pairs two real phone captures (412 × 915 viewport): the capture dialog with its mobile share-sheet note, and the pre-gate review opened from a shared `/?capture=…` link.

## Data note

Frames 1, 2 and 10 use a **throwaway copy of the vault** (`STASHOV_DATA_DIR`) so the Gate could show cooling, ready, bought, skipped and snoozed lanes with a populated ledger. The copy was seeded only through the app's own API (buy, skip, snooze, promote, budget) and was deleted after capture — `data/vault.json` was never modified.
