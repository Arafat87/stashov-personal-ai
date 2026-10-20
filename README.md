# Stashov — Context-Aware Personal AI Memory, Browser Bookmark Vault & Impulse Gate

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](./LICENSE)
[![Track: Personal AI](https://img.shields.io/badge/Track-Personal_AI-76b900.svg)](#)
[![Infra: Nebius Token Factory](https://img.shields.io/badge/Infra-Nebius_Token_Factory-38bdf8.svg)](#)

**Stashov** is an always-on, private **Personal AI** built for the **Nebius x NVIDIA Global AI Hackathon (Personal AI Track)**. It ingests your real browser bookmarks (Chrome, Brave, Edge), camera-roll screenshots, and video/social links, organizes them into a semantic memory vault, converts static life hacks into conflict-checked daily protocols, and runs a strict **Impulse-Gate Buyer Engine** against what you already own and your monthly budget.

---

## Why Stashov Exists

Regular bookmark folders and wishlist apps fail in two ways:
1. **Retrieval & Link Rot:** Saved posts across TikTok, X, YouTube, Reddit, and Chrome/Brave bookmark bars rot or drown in unorganized folders and camera-roll screenshots.
2. **Zero Personal Context:** A standard wishlist doesn't know you *already own* two charcoal hoodies and a winter parka, that a viral skincare cleanser contains acids that conflict with your evening `0.1% Adapalene` retinoid routine, or that you already bookmarked four fragrance wholesale discounters that carry the same cologne for $87 less.

Stashov unifies your **saved bookmarks**, **wishlist**, **living routines**, and **personal constraints** into one connected brain on open infrastructure you control.

---

## Nebius Token Factory & NVIDIA Model Routing

Every task in Stashov is routed to the optimal open-weight model on **Nebius Token Factory** (`https://api.tokenfactory.nebius.com/v1`):

| Cognitive Tier | Model on Nebius Token Factory | Role in Stashov |
| :--- | :--- | :--- |
| **1M-Context Deep Reasoning** | `nvidia/Nemotron-3-Ultra-550b-a55b` | Vault-wide synthesis across 1,386 bookmarks, "Talk Me Out of Buying This" impulse audits, skincare/supplement conflict detection, and weekly digests. |
| **Mid-Tier Agentic Synthesis** | `nvidia/Nemotron-3-Super-120b-a12b` | Promoting bookmarks into structured wishlist cards, protocol checklist generation, and dupe comparison. |
| **Fast Structured Extraction** | `nvidia/Nemotron-3-Nano-30B-A3B` | Sub-second URL/transcript classification, auto-tagging across 14 categories, and function-calling price schema extraction. |
| **Vision OCR Ingestion** | `zai-org/GLM-5.3-Flash` / `Qwen3.8-27B` | Camera-roll screenshot OCR (extracting product names, prices, brands, and routine steps from mobile screenshots). |
| **Unified Semantic Memory** | `Qwen/Qwen3-Embedding-8B` | Embedding bookmarks, wishlist items, owned inventory, and protocols for semantic search and automatic cross-linking. |
| **Autonomous Background Worker** | **Nebius Serverless Jobs** (`jobs/nebius-serverless-worker.js`) | Scheduled deal/discounter polling, link-rot verification, cooling-off timer unlocks, and digest compilation. |

---

## Key Features Implemented

1. **Automated Browser Bookmark Importer & 14-Category Organizer (`scripts/sync-bookmarks.js`):**
   - Automatically scans local **Google Chrome**, **Brave Browser**, and **Microsoft Edge** bookmark stores.
   - Deduplicates **1,386 unique bookmarks** and classifies them into **14 structured categories** (Programming & Cloud, AI Models & Infra, Career & Interview Prep, Menswear & Streetwear, Fragrances & Cologne, Skincare/Health & Protocols, Watches/Footwear & Accessories, Soccer Kits, Global Sourcing Proxies, etc.).
2. **Smart Buyer & Impulse-Gate Engine:**
   - **"Already Own" Closet & Shelf Overlap Check:** Blocks duplicate impulse saves (e.g., flagging a saved parka when you already own a Black Quilted Winter Parka).
   - **Monthly Fun-Money Budget Enforcer:** Tracks real-time spend against your monthly discretionary cap ($300/mo) and calculates **Cost-Per-Use**.
   - **Discounter & Chemical/Spec Dupe Finder:** Cross-links retail product saves against your own bookmarked discounters (`Olfactory Factory LLC`, `FragranceNet`, `Quince`, `Thursday Factory Seconds`).
   - **14-Day Cooling-Off Lock:** Locks new impulse saves behind a timer before recommending checkout.
3. **Living Playbooks & Routine Conflict Detector:**
   - Converts static life-hack bookmarks into structured Morning/Evening protocols (Clear Skin AM/PM Split, Crash-Free Energy Stack, Fragrance Layering & Discounter Rules, Research Peptide COA Safety Checklist).
   - Actively flags ingredient/routine conflicts (e.g., blocking an exfoliating acid cleanser in the PM window alongside `0.1% Adapalene`).
4. **2-Second Ingest Studio & Transparent Router Telemetry:**
   - Ingests URLs, camera-roll screenshots, or notes and logs live model routing latency, token usage, and cost in the **Nebius Token Factory Telemetry Console**.

---

## Quick Start (Local)

```bash
# 1. Clone the repository
git clone https://github.com/arafatsani/stashov-personal-ai.git
cd stashov-personal-ai

# 2. Install dependencies
npm ci

# 3. (Optional) Configure your Nebius Token Factory API Key
cp .env.example .env
# Edit .env and set NEBIUS_API_KEY=your_key_here

# 4. Sync & categorize local browser bookmarks (Chrome / Brave / Edge)
npm run sync-bookmarks

# 5. Run the Nebius Serverless Job worker check
npm run worker

# 6. Start the Stashov Web Vault & Agent Server
npm start
# Open http://localhost:3847
```

---

## Deploy to Production (Demo URL for Hackathon)

### Option A: Vercel (Recommended — Free Tier, Zero Config)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your GitHub repo
3. Vercel auto-detects `vercel.json` and deploys the Node.js server
4. In **Settings → Environment Variables**, add:
   - `NEBIUS_API_KEY` = your Token Factory API key
   - (All other model env vars are pre-configured in `vercel.json`)
5. Deploy → Get your `https://stashov-personal-ai.vercel.app` demo URL

### Option B: Render (Free Web Service)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New +** → **Web Service** → Connect repo
3. Render auto-detects `render.yaml` and configures the service
4. In **Environment**, add `NEBIUS_API_KEY` as a secret
5. Deploy → Get your `https://stashov-personal-ai.onrender.com` demo URL

### Option C: Nebius Serverless Endpoints (Native)

1. Use the Nebius AI Cloud console to create a Serverless Endpoint pointing to this repo
2. Configure the same environment variables
3. Deploy directly on Nebius infrastructure

---

## Hackathon Submission Checklist

- [x] **Working project on Nebius Token Factory** using NVIDIA Nemotron models (Ultra, Super, Nano, Lightning)
- [x] **Category: Personal AI** — always-on private assistant with persistent memory, skills, tool access
- [x] **Project description** — what/why/how documented in this README
- [ ] **Working demo URL** — deploy via Vercel/Render/Nebius (see above)
- [ ] **≤3-minute public YouTube demo video** — script in `Personal AI Hackerthon.md` Section 7
- [x] **Public code repo** — Apache 2.0 license visible at top, README with setup/run instructions
- [x] **NVIDIA Nemotron + Token Factory usage highlighted** — model routing table above + telemetry console
- [ ] **Feedback on Nebius + NVIDIA tools** — add to submission form
- [x] **Category = Personal AI**

---

## Project Structure

```
stashov-personal-ai/
├── server.js                    # Main HTTP server + REST API (6 endpoints)
├── vercel.json                  # Vercel deployment config
├── render.yaml                  # Render deployment config
├── package.json                 # npm scripts: start, sync-bookmarks, worker, test
├── .env.example                 # Environment template
├── LICENSE                      # Apache 2.0
├── README.md                    # This file
├── scripts/
│   └── sync-bookmarks.js        # Chrome/Brave/Edge bookmark importer + 14-category classifier
├── jobs/
│   └── nebius-serverless-worker.js  # Nebius Serverless Job: deal poller, link-rot verifier, digest generator
├── public/
│   └── index.html               # 6-tab Web Vault (Bookmarks, Wishlist, Protocols, Context, Ingest, Router)
├── data/
│   └── vault.json               # SQLite-free JSON vault: 1,386 bookmarks, 12 wishlist items, 5 protocols, personal context, telemetry
└── tests/
    └── stashov.test.js          # 4 passing tests (bookmarks, classifier, embeddings, serverless job)
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vault` | Full vault summary + personal context + wishlist + protocols + telemetry |
| GET | `/api/bookmarks` | Paginated, filtered, hybrid semantic+lexical search across 1,386 bookmarks |
| POST | `/api/bookmarks/sync` | Re-sync local browser bookmarks (Chrome, Brave, Edge) |
| POST | `/api/ingest` | Ingest URL, screenshot OCR, or life-hack note → auto-categorize + impulse-gate |
| POST | `/api/impulse-gate` | Run Nemotron 3 Ultra "Talk Me Out of Buying This" deep audit on any item |
| POST | `/api/promote-bookmark` | Promote any browser bookmark into the impulse-gated wishlist |
| POST | `/api/vault-audit` | 1M-context Nemotron 3 Ultra synthesis across entire vault |
| POST | `/api/serverless-job` | Trigger Nebius Serverless Job worker on demand |

---

## Feedback on Nebius Token Factory & NVIDIA Tools (for Judges)

> **Nebius Token Factory:** The OpenAI-compatible API made integration trivial — drop-in replacement for any OpenAI SDK. The model catalog (`/api/public/models_info`) exposes capabilities (`function_calling`, `context_and_rag`, `responses_api`, `MTP` fast decode) so routing logic is data-driven, not hardcoded. Pricing is transparent (e.g., Qwen3-Embedding-8B at $0.01/M tokens makes semantic memory near-free). Serverless Jobs are a perfect fit for periodic background work without managing infra.

> **NVIDIA Nemotron 3 Ultra (1M context):** The 1M-token window is not a gimmick — it enables genuine multi-document synthesis in one pass: 1,386 bookmarks + full Reddit review threads + ingredient sheets + personal inventory + budget + routines. This is the "killer feature" that makes a personal AI actually *personal*.

> **Nemotron 3 Nano/Super/Lightning:** The tiered routing (Ultra for deep reasoning, Nano for fast extraction, Lightning for MTP decode) cuts latency and cost by 10x vs. using Ultra for everything. `Nemotron-3.5-Lightning` with MTP is notably fast for structured extraction.

> **Suggested improvements:** Fine-tune support for Nemotron models would let us distill the "Impulse-Gate" prompt into a smaller specialized model. WebSocket/streaming support on Token Factory would improve perceived latency for the 1M-context Ultra calls.

---

## License

Released under the [Apache 2.0 License](./LICENSE).
