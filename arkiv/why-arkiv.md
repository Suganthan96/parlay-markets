# Why Arkiv — Parlay Markets

## If this data sat in Postgres instead of Arkiv, what could people no longer do?

**Live odds would have no ownership guarantee.** In Postgres, any server-side bug or hack could silently tamper with quoted odds. In Arkiv, every `parlay.liveodds` entity is signed by the LP wallet — anyone can verify the entity's owner and that the data was written exactly as the LP intended.

**Tickets would require trusting our backend.** A bettor's `parlay.tickets` entity in Arkiv is *owned by their wallet*. If we tried to update it without their key, the write would fail. No centralized server holds that power. In Postgres, we could change `status = 'won'` for any ticket arbitrarily.

**Stale odds would need a manual cleanup job.** Arkiv's native expiration means `parlay.liveodds` entries vanish after 5 minutes without us writing delete logic. In Postgres, a cron job or a TTL index (Redis) would be required; it can silently fail.

**Permissioned queries would need an API.** Anyone can query Arkiv directly with SQL-like filters and get the raw entity data. With Postgres, we'd have to expose an API and trust that it correctly enforces what each user can see.

## What did we keep off Arkiv, and why?

- **On-chain state** (LMSR `q0`/`q1` values, USDC balances, ticket payouts): these live in Solidity contracts — Arkiv is a database, not a chain, and on-chain state is already verifiable without it.
- **Sensitive keys / signatures**: never stored in Arkiv (entities are public).
- **Large binary blobs** (ABI JSON, frontend assets): better suited for IPFS or Swarm.

## What can people do with our copy on Arkiv that they can't with the original source (the chain) today?

The chain doesn't support "give me all open markets ordered by closing time" or "give me all my pending tickets". Those require an indexer. Arkiv gives us that queryability *plus* ownership semantics *plus* expiration — in one primitive, with no indexer to run.
