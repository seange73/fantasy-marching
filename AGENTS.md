# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Running the App

There is no build system, bundler, or package.json. This is a static multi-page HTML app. Serve it with any static file server:

```bash
python -m http.server 8080
# or use VS Code Live Server extension
```

Supabase is loaded via CDN in each HTML file — no npm install needed.

## Architecture

**Stack:** Vanilla HTML/CSS/JS + Supabase (PostgreSQL, Auth, Realtime). No frameworks, no bundler, no TypeScript.

**Page structure:** Each `.html` file is fully self-contained with inline `<style>` and `<script>` tags. There is one shared JS file: `js/supabase.js`.

**`js/supabase.js`** is the only shared module. It:
- Initializes `window.supabaseClient` (used everywhere)
- Sets up auth state listener with redirect logic (auth page ↔ dashboard)
- Exposes `window.fantasyMarching.getCurrentUser()` and `window.fantasyMarching.getUserProfile()`
- Exposes global escaping helpers `escapeHtml`, `jsStr`, `avatarHtml` — always run user-controlled text (usernames, bios, corps names) through these before `innerHTML`
- Exposes `window.fantasyMarching.renderHeaderUser(user)` — the single source of truth for the top-right header block (avatar, name, admin link). It fetches the profile, renders `#userAvatar`/`#userName`, toggles `#adminLink`/`#adminDivider`, and returns the profile row. Pages MUST call this instead of re-implementing the fetch/render; duplicating it per page is what caused avatars to load on some pages but not others. profile.html is the deliberate exception (it renders two profiles, own + viewed).
- Dynamically loads `js/notifications.js` (the shared notification bell) on every page
- Must be loaded before any page script that uses Supabase

**Auth:** Admin access is controlled by `profiles.is_admin = true`. Pages check this on `DOMContentLoaded` and redirect if not authorized. There is no role-based middleware — each page enforces its own access check.

## Supabase Schema Overview

**Core tables:**
- `profiles` — extends `auth.users`. Has `is_admin` boolean.
- `leagues` — has `is_global` flag, optional `password`, `pick_timer_seconds` for draft.
- `league_members` — joins users to leagues with `role` and `status`.
- `league_teams` — one team per user per league.
- `league_team_roster` — corps+caption combos on a team; `is_starting` controls lineup.
- `league_matchups` — week-based head-to-head with `team1_score`, `team2_score`, `winner_id`, linked to an `event_id`.
- `league_drafts` — snake draft state: `draft_order` (JSONB array), `current_user_id`, `pick_deadline`, `status`.
- `draft_picks` — individual picks by round/pick number.
- `events` — DCI competitions: `corps_list` (array), `final_scores` (JSONB), `caption_winners` (JSONB), `is_completed`.
- `event_scores` — per-corps per-event scores: brass, percussion, color_guard, general_effect, visual, music, total.
- `predictions` — user predictions before an event: `score_predictions` (JSONB), `caption_predictions` (JSONB).
- `prediction_results` — scored after event: `total_points`, `accuracy`, `breakdown` (JSONB).
- `global_league_teams` / `global_league_roster` / `global_league_scores` — parallel global league system open to all users.
- `free_agent_transactions` — waiver/FA pickups by week.
- `league_trade_offers` — `from_team_offers` / `to_team_offers` stored as JSONB arrays.
- `notifications` — in-app notifications with `type`, `data` (JSONB), `read`.
- `caption_rankings_2024` — historical static data for draft reference.

**Views (SECURITY DEFINER — known issues):**
- `league_standings` — computed wins/losses/avg_score per team.
- `available_draft_corps` — corps not yet drafted in a league.
- `global_league_leaderboard` — global standings.
- `prediction_leaderboard` — prediction scoring standings.
- `user_prediction_stats` — exposes `auth.users` email; flagged as security error.

## Key Database Functions (RPCs)

All game logic runs as Postgres functions called via `supabaseClient.rpc(...)`:

| Function | Purpose |
|---|---|
| `make_draft_pick` / `make_draft_pick_safe` | Submit a draft pick; safe variant handles concurrency |
| `auto_pick_for_user` | Autopick best available when timer expires |
| `check_and_execute_all_autopicks` | Runs autopick check across all active drafts |
| `initialize_draft` | Sets up draft order, creates teams |
| `create_league_matchups` / `generate_league_matchups` | Generates weekly head-to-head schedule |
| `calculate_team_score_for_week` | Sums event_scores for a team's starting roster |
| `update_matchup_scores` | Updates team1/team2 scores and sets winner |
| `update_all_league_scores` | Recalculates all matchup scores |
| `update_global_league_scores` | Updates global league standings |
| `score_event_predictions` | Scores all predictions after an event completes |
| `get_current_week_number` | Returns the current DCI competition week |
| `accept_trade` | Executes a trade between two teams |
| `make_free_agent_transaction` | Drops + adds a corps on a team |
| `handle_new_user` | Trigger that creates a profile row on signup |

## Scoring Flow

1. Admin enters scores in `admin.html` → writes to `event_scores`, updates `events.is_completed`.
2. After a 500ms delay, calls `score_event_predictions({ p_event_id })` RPC.
3. Separately, matchup scores are updated via `update_matchup_scores` / `update_all_league_scores`.
4. Team scores are computed from `event_scores` joined to `league_team_roster` where `is_starting = true`.

## Domain Vocabulary

- **Corps** — a competing marching band (e.g. "Blue Devils")
- **Caption** — a scoring category: `brass`, `percussion`, `color_guard`, `general_effect`, `visual`, `music`
- **Week number** — competition period; drives matchup grouping and FA transaction windows
- **Snake draft** — draft order reverses each round; `snake_direction` tracks current direction
- **Global league** — an open league all users can join without an invite; separate tables from private leagues
- **Autopick** — automatic selection triggered when `pick_deadline` passes

## Known Security Issues (Active)

Three Supabase advisor errors exist (do not ignore when making schema changes):
1. `user_prediction_stats` view exposes `auth.users` email to the `anon` role.
2. `league_standings` view uses `SECURITY DEFINER` — bypasses RLS.
3. `available_draft_corps` view uses `SECURITY DEFINER` — bypasses RLS.

Reference: https://supabase.com/docs/guides/database/database-linter
