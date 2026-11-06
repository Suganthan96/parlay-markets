# How We Use Arkiv — Parlay Markets

## Do the things you filter on, who can edit each entity, and when it expires fit what the app does?

**`parlay.markets`** — Filtered by `status = str('open')` to build the markets list. The LP wallet owns these; only the LP can mark them resolved (via `updateEntity`). Expires 7 days after close — long enough for bettors to find their resolved markets but not forever.

**`parlay.tickets`** — Filtered by `owner = addr(wallet)` for the user's ticket history. Each ticket is owned by the bettor's wallet address; only they (or a contract-authorized updater) can change its status. Expires in 30 days — enough time to claim winnings.

**`parlay.liveodds`** — Filtered by `marketAddress = addr(0x...)` to show real-time odds in the parlay builder. Owned by the LP; expires in 5 minutes. The 5-minute TTL is key: when the LP stops refreshing (market closed, server down), stale odds disappear automatically — no manual cleanup, no "last seen 2h ago" UI bugs.

## Does each Arkiv feature you use change something users see?

| Arkiv feature | What the user sees |
|---|---|
| Entity ownership | "Your tickets" tab queries `.ownedBy(wallet)` — only your data, no API |
| Expiration on `liveodds` | Odds in the parlay builder always reflect the latest prices; expired entries never show |
| `str().indexed()` on `status` | Filter button: "Open / Resolved" markets |
| `dec().indexed()` on `closesAt` | Markets sorted by closing time — closest deadline first |
| `addr().indexed()` on `marketAddress` | Odds lookup by contract address without iterating all entries |
