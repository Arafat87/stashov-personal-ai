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

## Quick Start

```bash
# 1. Clone or open the repository
cd E:/locket

# 2. (Optional) Configure your Nebius Token Factory API Key
cp .env.example .env
# Edit .env and set NEBIUS_API_KEY=...

# 3. Sync & categorize local browser bookmarks (Chrome / Brave / Edge)
npm run sync-bookmarks

# 4. Run the Nebius Serverless Job worker check
npm run worker

# 5. Start the Stashov Web Vault & Agent Server
npm start
# Open http://localhost:3847
```

---

## License

Released under the [Apache 2.0 License](./LICENSE).
