# Stashov — 3-Minute Demo Script

**Target runtime:** 2:50 (hard stop 3:00)
**Source of truth:** the real vault in `data/vault.json` (1,346 signals, 13 gated wishes, 1,017 library links, 5 protocols)
**Format:** 1920×1080, 30 fps, one take with live narration (or record VO separately and lay it over)

All numbers below are what the app currently renders. If the live Blob vault differs, record against `npm start` → `http://localhost:3847` so the screen matches the script, and put `stashov.com` on the end card.

---

## Before you hit record

- [ ] Unlock the app and open the **Gate** tab. Confirm the strip reads **$215** remaining and the chips read **Cooling 7 / Ready 6**.
- [ ] Scroll the Gate until the **SEIKO 5 Sports** card and the **Acqua di Parma** card have both rendered (images loaded, no spinners).
- [ ] Open **Rules**. Today's Playbook must read **0/5 done**. If a routine is already checked, click it once to uncheck it.
- [ ] Open **Library**. Confirm **1,017** sites filed, then click **Duplicates** once to warm the scan, note **11 groups**, and close the dialog. The badge should read **11**.
- [ ] Browser at 100% zoom, bookmarks bar hidden (`Ctrl+Shift+B`), devtools and extensions closed, notifications silenced.
- [ ] Cursor parked at the top-left, outside the content.
- [ ] Do a 10-second mic test and confirm you are recording the tab, not the whole desktop.

---

## 0:00 – 0:12 · Cold open (Deck)

**On screen:** Deck tab, hero stat row visible — *Signals indexed 1,346*, *Items gated 13*. Do not move the mouse.

**VO:**
> Four years of saving links. 1,346 of them. Last month I almost spent $195 on a cologne I didn't need. So I built the thing that stops me.

**Beat:** hold one second of silence before cutting.

---

## 0:12 – 0:28 · What it is (fast tour)

**On screen:** Click **Gate** → **Library** → **Rules**, about four seconds each. Land on **Gate**.

**VO:**
> Stashov is a personal AI over everything I save. Shopping goes through a fourteen-day gate. Reference links go to a library. And the routines I actually follow become living protocols.

**Beat:** let the Gate strip settle before speaking again.

---

## 0:28 – 1:22 · The Gate countdown

**On screen (0:28):** Gate tab at the top. Budget strip and status chips visible.

**VO:**
> This is the Gate. Thirteen things I want. Zero bought. Seven are still cooling, and this watch has three days left — so the Buy button is locked. No override.

**On screen (0:42):** Scroll to the **SEIKO 5 Sports** card. Rest the cursor on the **Locked 3d** button, then on the cooling rail.

**VO:**
> Six have cleared, like this cologne. It retails at $195; Stashov found a verified floor of $108. It also checks what I already own, whether it clashes with my routine, and the AI's case against buying it.

**On screen (1:02):** Click **Ready 6** in the status bar, then hover the **Acqua di Parma** card: price block, Owned / Routine / Dupe rows, anti-hype paragraph.

**VO:**
> Every purchase draws from a $300 monthly cap. Two hundred and fifteen dollars left, and one auditable ledger entry per buy.

**On screen (1:14):** Scroll back to the budget strip. Do **not** click Buy.

---

## 1:22 – 2:03 · Protocol check-off

**On screen (1:22):** Click **Rules**. The **Today's Playbook** card is at the top, showing **0/5 done**.

**VO:**
> Saved routines become protocols. This is my AM/PM skin protocol, generated from a TikTok caption — six steps, with a guardrail that blocks the exfoliating bar I saved because it fights the Adapalene in my night routine.

**On screen (1:40):** Scroll to the **Clear Skin & Hyperpigmentation Protocol** card. Point at the **ACTIVE GUARDRAIL** line, the six steps, and the linked product photos at the top of the card.

**VO:**
> Then there's Today's Playbook. One tap checks it off: one of five done, and the streak is stored in the vault. It's not a screenshot in my camera roll anymore.

**On screen (1:54):** Scroll back to Today's Playbook and click the **Clear Skin** row once. The counter flips to **1/5 done** and the row gets its check. Hold two seconds on the result.

---

## 2:03 – 2:46 · Library cleanup

**On screen (2:03):** Click **Library**. Header shows **1,017 sites filed**; shelf tiles are visible.

**VO:**
> Not everything is a purchase. 1,017 links live in ten reference shelves — education, programming, business, utilities — each one checked and described.

**On screen (2:15):** Click **Duplicates**. The dialog reads **11 pages saved more than once — 11 extra copies can be archived.** Keep the default "keep" selection on each group and scroll one group (murf.ai) to show both copies.

**VO:**
> The cleanup pass: eleven pages were saved twice. Keep one copy of each, archive the extras. Nothing is deleted — archived links stay recoverable, and the library is eleven duplicates lighter.

**On screen (2:30):** Click **Archive 11 extra copies**. Wait for the toast. If the grid does not switch automatically, set the status filter to **Archived** and hover one card's restore icon. Then set it back to **All statuses**.

**Beat:** stop moving the mouse for the last sentence.

---

## 2:46 – 3:00 · Close

**On screen:** Click **Deck**. Hero stats fully visible; cursor off-screen.

**VO:**
> 1,346 memories. One fourteen-day gate. Routines that actually get done. Stashov runs on Nebius Token Factory and NVIDIA Nemotron. The live demo is at stashov dot com.

**Beat:** two seconds of silence, then stop the recording. Do not fade to black in-camera.

---

## If a take goes wrong

| Problem | Reset |
|---|---|
| Routine already checked | Click the same row again. The counter returns to 0/5. |
| Duplicates already archived | Library → status **Archived** → **Select** → select all → **Restore**. Refresh until the badge reads 11. |
| A purchase was recorded | Gate → **Spend ledger** → void the entry, then reopen the wish. |
| A dialog is stuck loading | Close it, wait for the library grid, reopen **Duplicates**. |
| Live numbers differ from this script | Record on localhost with the real vault (`npm start`), mention `stashov.com` on the end card. |

## Do not show

- The **You** tab (sizes, location, personal constraints) — irrelevant to this story and easy to over-share.
- The unlock token, URL bar history, or password manager.
- The Router tab unless its logs are clean; the voiceover already names the stack.

## Upload checklist

- [ ] Trim to **under 3:00**. Verify the final file length, not the timeline length.
- [ ] 1920×1080, H.264, audio normalized so speech peaks around −6 dB.
- [ ] YouTube visibility **Public** (or Unlisted only if the rules allow it).
- [ ] Title: **Stashov — a personal AI that stops impulse buys (Nebius × NVIDIA)**
- [ ] Description: one-line pitch, `https://stashov.com`, the GitHub repo, the Nemotron/Token Factory stack, and "Demo access token is in the submission form." Never paste the token publicly.
- [ ] Add chapters: `00:00 Why`, `00:28 The Gate`, `01:22 Routines`, `02:03 Library`, `02:46 Close`.
