# Stashov Glossary

Every label in the interface, every status in the Gate, and every field in the vault, defined in plain language.

Counts below describe the seeded vault (1,346 signals, 1,017 library links, 13 wishes, 5 routines). Your numbers change as you use the app; the definitions do not.

---

## Quick disambiguation

Five pairs cause most of the confusion.

| You see | What it is **not** | What it actually means |
|---|---|---|
| **Active** | A single status | A filter lane containing three statuses: cooling + ready + snoozed. It excludes bought and skipped. |
| **Cooling** | The whole 14-day process | One status: the decision date is still in the future, so Buy is disabled. A **snoozed** wish also has a countdown but is not counted as cooling. |
| **Ready** | "The AI approved it" | The clock has run out. The verdict may still say skip, wait, or sample first. Ready only means the Buy button is unlocked. |
| **Blocked** | A lock or a ban | The amber/rose **verdict tone** for `SKIP_DUPLICATE` ("blocked as duplicate"). Buy can still be enabled if the wish is ready. It is unrelated to **Locked**, which is the disabled Buy button during cooling, or **BOT-BLOCKED**, which is a library website refusing automated checks. |
| **Cleared** | A stored status | Deck copy uses "cleared" to mean an approved verdict. Gate copy uses "gate cleared" to mean the 14-day clock finished. They are different things. |

Two more traps:

- **Signal ≠ wish.** A signal is any saved link. A wish is a signal that was reviewed and promoted into the Gate.
- **Archive ≠ Archived.** "Archive extra copies" is a Library action. A bought or skipped wish is described as archived in the Gate, but it is still in the vault and can be reopened.

### Words with more than one meaning

| Word | Context | Meaning there |
|---|---|---|
| **Snapshot** | A product page | The archived title, price, and source excerpt captured at promotion or ingest (`snapshot_excerpt`, `snapshot_status`). |
| **Snapshot** | Data & Backups | A timestamped copy of the vault, used to undo an import. |
| **Audit** | Library | The link-health check that produced LIVE/BOT-BLOCKED/NEEDS REVIEW and removed confirmed-dead links. |
| **Audit** | A wish | The one-item oracle read, or the 1M-context vault synthesis. Neither changes the wish automatically. |
| **Source** | A wish | `best_source` is the store/discounter; `source_platform` on a protocol is where the routine came from; a ledger entry's `source` is where the purchase happened. |
| **Live** | Library | The site answered the audit. |
| **Live** | Top bar | `NEBIUS LIVE` means an API key is configured, not that a request is in flight. |
| **Archived** | Gate | Bought or skipped, still reopenable. |
| **Archived** | Library | Hidden from active counts, still recoverable from the Archived filter. |

---

## The eight rooms

| Room | Also called | What lives there |
|---|---|---|
| **Deck** | Command deck, dashboard | Counts, budget envelope, verdict mix, last digest, router feed. |
| **Vault** | Signal index, memory | All saved links, 14 clusters, semantic search, cluster covers. |
| **Library** | Reference library | The non-shopping subset of saved links, filed on 10 shelves with a description and a "use for" note. |
| **Gate** | Impulse gate, wishlist | Wishes under a cooling-off clock, verdicts, budget and the spend ledger. |
| **Rules** | Protocols, playbooks | Pasted routines turned into structured, checkable protocols. |
| **You** | Identity buffer, personal context | Owner, location, sizes, hard constraints, owned inventory, scent profile, default cooling period. |
| **Capture** | Ingest studio | URL, screenshot-text, or note intake that classifies a signal and can start a gate item. |
| **Router** | Token Factory router | Model routing, the 1M-context oracle, telemetry, and the serverless digest job. |

---

## Signals, Vault, and clusters

**Signal** — Any saved link: a browser bookmark, a social/product link pasted into Capture, or a promotion candidate. The Deck's **Signals indexed** count is the total number of signals (`total_bookmarks`, 1,346 in the seed).

**Vault** — The whole private dataset, not just the links. It contains `bookmarks`, `wishlist`, `protocols`, `personal_context`, `spending_ledger`, `routine_log`, `telemetry`, `last_digest`, and metadata. In a local install it is `data/vault.json`; on Vercel it is the private Blob object `state/vault.json`.

**Bookmark / saved link** — A signal with a URL, title, domain, browser, original folder, category, subcategory, tags, snapshot status, and embedding. Product links and reference links share the same bookmark record; the Library classification decides which room they appear in.

**Cluster** — One of 14 top-level categories used to browse the Vault. The seeded clusters are Programming & Cloud, Life Hacks & Utilities, AI & Infrastructure, Career & Interview Prep, Menswear & Streetwear, Business/Finance/Auto/Real Estate, Watches/Footwear/Accessories, Gaming & Esports, Soccer Kits, Skincare & Health, Global Sourcing, Fragrances, Cybersecurity, and Food/Halal.

**Cluster cover** — The image on a cluster card. It can be a live wishlist product photo or a generated reference card. **Hero wishlist item** is the wish whose photo supplies the cover; "auto" picks the strongest verdict in that cluster.

**Reference card** — A generated 800×600 SVG that represents a cluster when no product photo is appropriate. There is one for each cluster in `public/cluster-cards/`.

**Memory index** — The Deck card showing total signals, the four largest clusters, and which browser profiles were synced.

**Budget envelope** — The Deck ring showing remaining fun-money, spent, and the monthly cap.

**Search by meaning** — The Vault search label. It is lexical matching across title, domain, description, use-for, category, and tags, with a local vector tie-breaker; it does not call an LLM. Library search is a simpler all-words substring match over the same fields.

**Markup caught** — A potential-savings figure: for every wish, `retail price − best verified floor`, summed. It includes wishes you have not bought, so treat it as money identified, not money saved.

**Digest / last night's digest** — The report written by the most recent Nebius serverless job run (not necessarily last night): links verified, wishes polled, timers cleared, budget left, and the largest price drops. Stored as `last_digest`; also mirrored on the Router tab.

**Router feed** — The most recent telemetry rows shown on the Deck. It is a log of model work, not a social feed.

---

## The Gate: statuses and lifecycle

**Wish** — A reviewed product saved into the Gate. A wish is created by the pre-gate review (from a bookmark, a pasted link, or Capture), never silently by saving a bookmark.

**Wishlist** — The stored `wishlist` array. The Gate is its UI; a wishlist item and a Gate item are the same record.

**Gate** — Both the room and the rule set. The room shows wishes, verdicts, budget, and the ledger. The rule set enforces the cooling-off clock, the owned-inventory check, the price floor, the budget, and routine conflicts.

**Gate item** — Another name for a wish.

### Stored statuses

| Status | What it means | Buy? | Counted in |
|---|---|---|---|
| `cooling` | The decision date is in the future. The card shows **COOLING OFF — n days left**. | Disabled | Active / Cooling |
| `ready` | The decision date has arrived. The card says **Ready — gate cleared**. | Enabled | Active / Ready |
| `snoozed` | The decision date was deliberately pushed out. The card shows **SNOOZED — n days left**. | Disabled | Active / Snoozed |
| `bought` | A purchase was recorded. One ledger entry is written. The card moves to History. | n/a | History |
| `skipped` | The wish was archived without spending. No ledger entry. The card moves to History. | n/a | History |

### Lanes and filters

**Active** — Cooling + ready + snoozed. This is the default Gate lane. "Items gated" on the Deck uses this number.

**History** — Bought + skipped. This is where decisions go after they are made.

**Cooling** — Only `cooling`. A snoozed wish is not in this lane even though it also has a countdown.

**Ready** — Only `ready`.

**Snoozed** — Only `snoozed`.

### Timestamps and the 14-day clock

**`added_at`** — When the wish entered the Gate. This is when the clock starts — not when the bookmark was first saved.

**`unlock_at`** — `added_at` plus the cooling period. The decision cannot be bought before this timestamp.

**`cooling_off_days`** — The length stored on that wish. The default is 14, configured by `personal_context.default_cooling_off_days`. Existing wishes keep their own value; changing the default only affects new wishes.

**`cooling_off_days_left`** — Whole days remaining until the later of `unlock_at` and `snoozed_until`, rounded up. It is 0 for bought and skipped wishes.

**`snoozed_until`** — The new decision date after a Snooze.

**`purchased_at` / `skipped_at`** — When the decision was recorded.

**14-day cooling-off** — The default rule: a new wish cannot be bought for 14 days. The length is per wish, so a legacy or manually created wish can differ.

**Locked** — UI language for "the Buy button is disabled." The button reads **Locked Nd**. It is not a stored status and not a verdict.

**Gate cleared** — The UI note on a `ready` card. It means the clock finished, not that the purchase was approved.

### Decisions

**Buy** — Available only when the status is `ready`. Records the amount, source, and optional note in the spend ledger, sets `purchased_at`, and moves the wish to History. If the wish has no captured price, you must enter what you paid.

**Skip** — Archives the wish without spending. Allowed while cooling, ready, or snoozed. Sets `skipped_at`; no ledger entry. A skipped wish can be reopened.

**Snooze** — Pushes the decision date out. The API accepts 1–90 days; the UI offers 7, 14, or 30. It extends from the latest of today, the original unlock date, and any previous snooze, so snoozing can never shorten an existing wait. It does not touch the ledger.

**Reopen** — Returns a bought or skipped wish to the Gate. A bought wish's active ledger entries are voided automatically and the spend is removed from the month. If the original clock had already finished, the wish returns as `ready` immediately; reopening does not restart a fresh 14 days.

**Void** — Corrects a mistaken ledger entry without deleting it. The entry stays in the file with `voided: true`, `voided_at`, and a reason; it is excluded from all totals. If it was linked to a bought wish and no other active purchase exists, the wish is reopened.

---

## Verdicts

A **verdict** is the Gate's recommendation. A **status** is the clock. They are independent: an approved wish can still be cooling, and a ready wish can still be marked skip.

### The four verdict codes

| Code | UI tone | Filter label | Meaning |
|---|---|---|---|
| `BUY_RECOMMENDED` | Green | Approved | High-utility purchase that fills a real gap; the card gives the reason. |
| `BUY_AT_DISCOUNTER` | Green | Approved | Approved, but buy from the named discounter/floor rather than retail. |
| `WAIT_OR_DUPE` | Amber | Cooling | Wait, sample first, consolidate duplicates, wait for a milestone, or resolve a routine conflict. |
| `SKIP_DUPLICATE` | Rose | Blocked | Skip because it duplicates something owned, overlaps too much, or is blocked by budget/label logic. |

**Verdict label** — The human sentence on the card, stored as `verdict_label`. It is free text, so it can say "APPROVED — HIGH UTILITY GAP FILLER", "HOLD — ROUTINE CONFLICT", "BUDGET BLOCK …", or "PRICE NEEDS REVIEW". The filter uses the underlying code, not the label. A card labelled "BUDGET BLOCK" can therefore appear under **Blocked** because its code is `SKIP_DUPLICATE`.

**PRICE NEEDS REVIEW** — A label used when a wish has no usable price. It does not mean the purchase is approved or rejected; the underlying verdict remains `WAIT_OR_DUPE`. Add a price in Details to clear it.

**New wishes** — Promotion starts every wish as `WAIT_OR_DUPE` with the label **14-DAY COOLING LOCK ACTIVE**, or **PRICE NEEDS REVIEW** when no price was confirmed.

**Capture heuristics** — Ingest can set `SKIP_DUPLICATE` for outerwear that matches owned hoodies/parkas, and `WAIT_OR_DUPE` for acid products that conflict with the evening retinoid. These are labels and recommendations; the clock still applies.

**Approved ≠ purchasable.** Only the `ready` status enables Buy.

**"Cleared" on the Deck** — The verdict legend's "n cleared" counts green (`BUY_RECOMMENDED` + `BUY_AT_DISCOUNTER`) verdicts, not ready wishes.

**Gate verdicts (Deck card)** — The card header says THIS MONTH, but the counts run over the current wishlist, not a calendar-month filter. The three tones are green (approved), amber (wait/sample), and rose (blocked). The note's "n cleared" is the green count.

---

## Price vocabulary

**Retail price** (`retail_price`) — The reference/list price. Used as the top of the price rail and the anchor for savings.

**Best verified floor** (`lowest_verified_price`) — The price the Gate expects you to pay, ideally from a discounter or verified source. This is the number used in the price block, budget preview, and savings calculation.

**Price status** — `captured` (read from page metadata or visible page text), `manual` (entered or corrected by you), or `missing` (no usable price; never replaced with a fake placeholder).

**Price rail** — The small bar under the price block: the full width is retail, the filled part is the floor. It is a visual comparison, not a discount guarantee.

**Price confidence** — `low` means the number came from visible page text rather than structured metadata. The card labels it **LOW-CONFIDENCE PAGE PRICE** and asks you to verify before checkout. High/blank means captured or manual without that warning.

**Price source** — Where the number came from: page metadata, the browser bookmarklet, a manual edit, or a saved discounter. Shown as `best_source` on the card.

**Save pill** — The card's `SAVE $x` badge: retail minus floor. If the numbers are equal it reads **AT THE FLOOR**; a low-confidence read reads **VERIFY PRICE**.

**Target price** (`target_price`) — An optional price you set in Details. When the captured floor is at or below it, the card shows **TARGET MET** and the Gate summary lists a target hit.

**Price history** (`price_history`) — Timestamped observations, capped at 60. Captures, manual edits, and **Check price** append to it. Repeating the same price within an hour updates the timestamp instead of adding a duplicate point.

**Lowest seen** (`lowest_seen_price`) — The lowest price in the observation history, with `lowest_seen_at`. This is historical, not necessarily the current floor.

**Check price** — Re-reads the saved product page, records a new observation, updates the floor, and reports the change. Rate limited.

**Cost per use** (`cost_per_use`) — A rough unit economics estimate stored on the wish; editing prices recalculates it as floor ÷ `uses_per_month`.

**Dupe alternative** — The card's suggested equivalent or cheaper route. It is a recommendation, not a matched SKU.

**Inventory overlap** — The **Owned** check: whether the wish duplicates something in `personal_context.owned_inventory`. `HIGH`, `DUPLICATE`, or `OVERLAP` tones the row as a warning.

**Routine compatibility** — The **Routine** check: whether the product conflicts with your hard constraints or active protocol. `CONFLICT`, `WARNING`, or `BLOCK` tones the row as a warning.

**Anti-hype summary** — The blunt paragraph under the checks explaining the verdict, the price provenance, or the main reason to wait.

---

## Budget and the spend ledger

**Fun-money** — The monthly discretionary budget. The seed cap is $300.

**Monthly cap** — `personal_context.monthly_discretionary_budget`. Editable from **Gate → Spend ledger → Edit budget**. Defaults to $300 if unset.

**Spent** — The sum of active (non-voided) ledger entries for the current month. **Remaining** is cap minus spent. **Over budget** means remaining is negative.

**Month rollover** — Spend is keyed by `month` (`YYYY-MM`). On the first of a new month, the old entries no longer count against the cap; the cap itself does not reset. "Spent this month" is always derived from the ledger.

**Ledger entry** — One auditable purchase row: `id`, linked `item_id`, title, category, amount, currency, `spent_at`, `month`, source, note, `voided`, `created_at`. A Buy writes exactly one entry.

**Opening balance** — The one-time migration row created from an older `spent_this_month` value when the ledger was introduced. In the seed it is $85, labelled "Existing spend (opening balance)". It is not a purchase and has no item link.

**Voided** — An entry kept for audit but excluded from totals. Voiding does not delete the row.

**Category cap** — An optional per-category monthly limit (for example Menswear $100). A blank cap means unlimited. The ledger shows spent, cap, remaining, and over-budget state per category.

**Category breakdown** — Current-month spend grouped by the wish's category, compared with the category caps.

**Monthly totals** — Historical totals per month, used for the ledger's month-by-month view.

**`spent_this_month`** — A convenience copy inside `personal_context`. It is recomputed from the ledger when gate state is normalized; editing it directly is temporary. The ledger is the source of truth.

**Budget month** — `personal_context.budget_month`, the month key the cached spend belongs to.

---

## Library vocabulary

**Reference link** — A saved link that is useful as reference (learning, docs, business, tools, guides), not as a product being price-tracked. The Library is the subset of the Vault where `librarySectionFor()` returns a shelf; product links stay in the Vault's clusters.

**Shelf / section** — One of 10 Library groupings: Education, Programming, AI/Data, Career, Business, Design, Cybersecurity, Utilities, Gaming, Sourcing. The API calls them sections; the UI calls them shelves and sections interchangeably.

**Sites filed** — The active Library count (1,017 in the seed). It excludes archived links. It is not the same as **Signals indexed** (1,346), which includes product links and non-library bookmarks.

**Description / "What it is"** — A short note explaining the site. **"What to use it for"** (`use_for`) is the practical filing note. Both are editable per link.

**Site status** — The last health check:

| Stored | UI label | Meaning |
|---|---|---|
| `ok` | **LIVE** | Checked and reachable. |
| `blocked` | **BOT-BLOCKED** | The site refused an automated request (403/challenge). Not proof the site is dead; kept for manual use. |
| `error` | **NEEDS REVIEW** | The check returned an unexpected error. |
| `timeout` | **TIMEOUT** | The check ran out of time. |
| `dead` | **DEAD** | Confirmed unreachable. The audit removes confirmed-dead links, so this may appear only in older data. |
| `unchecked` | **UNCHECKED** | No audit result yet. |
| archived flag | **Archived** | Hidden from active counts and the default list; recoverable from the Archived filter. |

**Audit stamp** — The Library header's last-check summary from `meta.library_audit`: run time, checked count, live/blocked/error counts, removed count, and restored-after-review count.

**Removed link** — A link the audit judged dead and deleted from the vault. The post-audit review restored false positives; `data/library-removal-review.json` records the decisions. Archived links are not removed links.

**Canonical URL** — A normalized URL used to detect duplicates: lowercase host without `www`, no trailing slash, tracking parameters (`utm_*`, `fbclid`, `gclid`, etc.) stripped, remaining query parameters sorted. Meaningful parameters such as a docs version are preserved.

**Duplicate group** — Two or more active Library links whose canonical URLs match. **Extra copies** is the number of links beyond the one you keep (`group size − 1`).

**Archive extra copies** — Keeps one link per canonical URL and marks the rest `library_archived`. Archived copies stay recoverable.

**Bulk actions** — Select multiple links to **Move** them to another shelf, **Archive** them, or **Restore** archived links. Up to 250 at a time.

**Gate duplicate warning** — A different check: before promotion, the incoming title is compared with active wishes (token overlap ≥ 0.65 or an exact title match). It warns you before starting a second clock on the same product. It is not the same as a Library canonical-URL duplicate.

**Reference card vs product photo** — A cluster cover can be the generated reference illustration or a real wishlist photo. Product clusters prefer the exact item photo; reference-only clusters use the card.

---

## Rules vocabulary

**Protocol / routine** — A saved, structured playbook. "Protocol" is the data object; "routine" is the same thing in the UI. **Protocols armed** is the saved count (5 in the seed).

**Steps** — The ordered actions in a protocol. Up to 40 are stored, each up to 320 characters.

**Schedule** — A free-text cadence such as "Daily — AM & PM" or "As needed". The parser infers it from AM/PM wording; you can edit it.

**Category** — The protocol's grouping, usually "Skincare, Health & Protocols". It does not have to match a Vault cluster.

**Credibility badge** — A short provenance label, for example "User-pasted — verify before use". It is not a trust score or a medical review.

**Source platform** — Where the routine came from: TikTok, YouTube, a dermatologist, a product label, or a manual paste. Free text.

**Snapshot status** — What source material was archived. Pasted routines usually say "Pasted text — source not archived"; it is not a claim that the video was downloaded.

**Rules vs hard constraints** — Rules stores protocols. The hard constraints listed in You are separate: they are injected into Gate and oracle checks and shown as ENFORCED. A protocol guardrail is advice attached to that routine; it does not automatically block a purchase.

**Conflict alert / guardrail** — The safety note shown as **ACTIVE GUARDRAIL**. The parser detects four patterns:
- a retinoid (retinol, adapalene, tretinoin) plus an exfoliating acid (AHA/BHA/glycolic/salicylic/peel) in the same paste;
- caffeine scheduled after 2:00 PM;
- fragrance scheduled for heat, sun, or the gym;
- a peptide/supplement with no third-party COA mentioned.

The guardrail is advice attached to the protocol; the Gate does not automatically block a purchase from it.

**Linked products / "Products in this rule"** — Wishlist items attached to the protocol. Their photos, brands, and verified prices appear on the protocol card; clicking one opens the Gate. Up to 5 are auto-matched from the paste; up to 12 can be stored.

**Today's Playbook** — The Rules header card listing every protocol with a check-off for today's local date, a `done/total` score, and each protocol's current streak.

**Check-off** — Marks a protocol done for one local calendar day. Unchecking removes that day. The log is stored per protocol in `routine_log`, capped at 400 days. The UI only offers today; the API rejects dates too far in the future.

**Streak** — Consecutive checked days ending today, or ending yesterday if today has not been checked yet. Missing a full day resets it to zero.

**Generate structure** — The deterministic paste parser: it detects AM/PM headers, numbered or bulleted steps, and semicolon-separated lists; infers a title, category, schedule, guardrail, and linked products. It does not require an API key. Paste limit: 12,000 characters.

**New routine** — Opens the same builder empty, for a manual protocol.

---

## You (personal context)

**Personal context** — The `personal_context` object that every review, Gate check, and oracle prompt reads. It is the only source for the You panel.

| Field | UI label | Meaning |
|---|---|---|
| `owner` | Vault owner | Display name; initials are derived from the first two words. |
| `location` | under the name | Free-text location shown with "PERSONAL AI TRACK". |
| `sizes` | dossier grid | Key/value sizing notes (tops, bottoms, footwear, suits). |
| `skin_and_health_constraints` | Hard constraints | The list labelled ENFORCED and passed into Gate/oracle reasoning. |
| `owned_inventory` | Owned inventory | Items already owned, with brand, notes, and status; the basis of the **Owned** check. |
| `fragrance_profile.loved_notes` | Loved notes | Preferred scent notes. |
| `fragrance_profile.avoid_notes` | Avoid | Notes to avoid. |
| `monthly_discretionary_budget` | Month cap | Same number as the Gate's monthly cap. |
| `spent_this_month` | — | Derived from the ledger, not independently authoritative. |
| `default_cooling_off_days` | (no direct field) | Length applied to new gates; 14 in the seed. Existing wishes keep their own value. |
| `budget_month` | — | The month key for the cached spend. |

**Vault owner** — `personal_context.owner`. If missing, the UI falls back to "Vault Owner".

**Hard constraints** — Free-text rules such as the Adapalene conflict, Halal requirement, aluminum-free deodorant, or caffeine cutoff. They are injected into gate and oracle prompts; they are not a medical device or a guarantee.

**Owned inventory** — The closet/shelf list used by the **Owned** row on each wish. The seed tracks 6 items. "Already in rotation" is UI copy, not a separate table.

**Scent profile** — Loved and avoided fragrance notes, stored under `fragrance_profile`.

### How the You panel syncs and updates

There is no separate profile database and no two-way sync. The panel is a **projection** of `personal_context` inside the vault, rendered on read and updated only through **Edit profile**:

1. The server exposes `personal_context` in `GET /api/vault`.
2. On page load and after profile saves, Gate/Rules actions, imports, photo edits, and other mutations, the client calls `refreshVault()`.
3. `renderContextView()` reads `v.personal_context` and redraws the owner block, sizes, constraints, inventory, and scent chips. Switching tabs only reveals the already-rendered panel; it does not re-fetch.
4. There is no polling or file watcher. If the vault changes outside the app, reload the page to see it.

Budget fields are the exception to "static": when a gate route or the background job runs `ensureGateState()`, it normalizes the cap, sets `budget_month`, and recomputes `spent_this_month` from the non-voided ledger. That is why hand-editing `spent_this_month` does not stick.

**Changing it locally**

- **You → Edit profile** edits name, location, sizing, hard constraints, owned inventory and scent notes. Saving calls `PATCH /api/context`; the server validates every field, writes the vault atomically and the panel re-renders from the response.
- The month cap and category caps stay in **Gate → Spend ledger → Edit budget**.
- For fields the dialog does not cover, stop the server, edit `personal_context` in `data/vault.json`, then restart. The server caches the vault in memory, so a live edit is not picked up until restart. Writes are atomic and leave a `.bak`.
- Alternatively use **You → Data & Backups → Export vault**, edit the exported `vault.personal_context`, then **Restore backup**. A restore replaces the entire vault and writes a pre-import snapshot when local storage is available.

**Changing it on the hosted deployment**

- On Vercel, the source of truth is the private Blob object `state/vault.json`, not the file in Git. Editing `data/vault.json` in the repo does not change the live vault after the Blob has been seeded.
- **You → Edit profile** works the same way and updates the Blob through the same route. There is no separate profile store.
- As a fallback, use Export → edit `vault.personal_context` → Restore backup. The import endpoint validates the arrays, replaces the vault, and updates Blob storage. The import handler refreshes the app's data automatically.
- If you change the Blob object outside the app, reload the page. There is no live multi-device merge; the last write wins, and each serverless instance may briefly hold its own cached copy.

**What changing the cap does** — It changes future budget math immediately. It does **not** change the cooling period, the verdicts, or the inventory checks. To change the cooling period for new wishes, edit `default_cooling_off_days`; existing wishes keep their stored `cooling_off_days`.

---

## Capture and promotion

**Ingest** — The Capture action. Every ingest creates a bookmark; a wish is created only when the mode is screenshot, the classifier says `wishlist`, or a price is supplied.

**Capture mode** — `URL` (web/social link), `Screenshot OCR` (pasted OCR text from the camera roll), or `Note` (a life-hack/transcript). The mode changes the source labels and the model tier.

**Pre-gate review** — The dialog that shows the captured title, brand, cluster, retail price, expected price, source, and duplicate warning. Nothing is gated until you confirm. You can correct every field; a changed price is marked `manual`.

**Promote** — Turn a reviewed bookmark or pasted link into a wish and start its clock. The button reads **Start 14-day gate**.

**Capture anywhere / bookmarklet** — A draggable bookmark that reads JSON-LD, OpenGraph, or a visible price in the open product tab, then opens `/?capture=<page-url>` with the snapshot. It works on stores that block server-side fetches. The visible-price fallback is explicitly low confidence and prefers a sale price over a struck compare-at price.

**Share target** — The PWA registration that lets a phone share a product link into Stashov. It opens the same pre-gate review. HTTPS is required outside localhost.

**Quick add** — The Gate's paste-a-link form with a clipboard **Paste** button. It skips the bookmark hunt and goes straight to review.

**Price pending** — The state when a wish has no usable price. The card asks you to add details rather than inventing a number.

---

## Router and background work

**Nebius Token Factory** — The OpenAI-compatible model API Stashov calls when `NEBIUS_API_KEY` is configured.

**NVIDIA Nemotron 3 Ultra** — The deep-reasoning tier with a 1M-token context window; used for the oracle, impulse audits, and vault-wide synthesis.

**NVIDIA Nemotron 3 Super** — The mid-tier model used for structuring work such as promotion and protocol generation.

**NVIDIA Nemotron 3 Nano** — The fast, cheap extraction tier used for classification and tagging.

**Vision OCR** — The screenshot model that extracts product names, prices, and routine text from camera-roll text.

**Qwen embedding** — The local semantic-memory model that turns saved links and wishes into vectors for search and cross-linking.

**Model routing / tiers** — Stashov sends each task to the cheapest tier that can do it: fast extraction (Nano), structuring/promotion (Super), deep reasoning (Ultra), vision OCR for screenshots, and embeddings for semantic memory. The UI calls this the model mesh.

**Nebius live / Demo fallback** — The top-bar mode pill. **NEBIUS LIVE** means a usable API key is configured and calls go to Token Factory. **DEMO FALLBACK** means deterministic local traces are used instead; the app still works.

**Oracle** — The deep-reasoning audit. **Ask the oracle** on a wish runs a one-item "talk me out of buying this" analysis; **Ask across your entire vault** runs a 1M-context synthesis over bookmarks, wishes, inventory, constraints, and routines.

**Telemetry** — Per-call rows with timestamp, task, model, tier, latency, input/output tokens, and estimated cost. The Router tab shows calls logged, tokens routed, average latency, estimated spend, the model mesh, and the most recent rows. Telemetry lives in its own small store, not in the 2.4 MB vault.

**Calls logged / Tokens routed / Avg latency / Router spend** — The four Router stat cards. Calls counted from the recent telemetry window; tokens are input + output; latency is the mean of logged calls; spend is an estimate, not a billing statement.

**Serverless job / nightly job** — The Nebius worker that verifies links, polls active wishes, counts newly cleared timers, finds deals, and writes the digest. **Run serverless job** triggers it on demand.

**Deal alert** — A wish whose retail-minus-floor saving is at least $20, surfaced in the digest. It is a price observation, not a purchase recommendation.

---

## Data, security, and deployment

**Export** — Downloads `{ app, version, exported_at, vault, sections, clusters }` as JSON. It includes everything needed to restore, including the You profile.

**Restore / import** — Validates that the file has bookmark, wishlist, and protocol arrays, snapshots the current vault when local storage allows, normalizes gate state, and replaces the vault. Restoring replaces every room, including You. Export first.

**Snapshot** — A timestamped copy of the vault. Local installs keep `.bak` plus rotating snapshots in `data/backups` (last 20, at most one every 10 minutes). Hosted `/tmp` copies are ephemeral; the Blob object is the durable store.

**Atomic write** — Temp file → fsync → rename, so a crash cannot leave a half-written vault.

**Local mode** — The default. Data lives in `data/vault.json`; the server binds to `127.0.0.1` unless configured otherwise.

**Hosted mode** — Vercel with a private Blob store (`BLOB_READ_WRITE_TOKEN`, or `VERCEL=1` plus `BLOB_STORE_ID`). On first read, if `state/vault.json` is missing, the app seeds it from the bundled `data/vault.json` and writes it to Blob. After that, Blob is authoritative.

**Access token / unlock** — `STASHOV_ACCESS_TOKEN` gates the app and API. The unlock page exchanges the token for an HMAC-derived `HttpOnly` session cookie; the token is not stored in localStorage. Signed-out API calls return 401.

**PWA** — The installable web app. Its service worker intercepts the Web Share Target POST; it is not an offline cache. Vault data still needs the server.

---

## The numbers in the seeded demo

| Figure | Value | What it counts |
|---|---|---|
| Signals indexed | 1,346 | All bookmarks in the vault. |
| Clusters | 14 | Top-level categories. |
| Library sites filed | 1,017 | Active reference links across 10 shelves. |
| Wishlist items | 13 | All wishes; 7 cooling, 6 ready, 0 snoozed, 0 history at seed. |
| Protocols armed | 5 | Saved routines. |
| Monthly cap | $300 | Discretionary budget. |
| Spent | $85 | Opening-balance ledger entry. |
| Remaining | $215 | Cap minus spent. |
| Duplicate groups | 11 | Library canonical-URL groups at seed. |

These counts are read from the data, not hardcoded into the interface. If your vault differs, trust the UI.
