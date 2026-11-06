# Reach — Parlay Markets on Arkiv

## Who uses it today?

Parlay Markets is a new project built at ETHGlobal Mumbai 2026. The on-chain contracts are deployed to Sepolia (Phase 1 complete, 12/12 tests passing). The Arkiv integration is live on the Rabdi testnet.

## Who would use this after Mumbai?

**Bettors:** Every user who places a parlay gets a wallet-owned `parlay.tickets` entity on Arkiv. Their ticket history is portable — any front-end can show it without calling our API, just by querying Arkiv with their wallet address.

**LP/market makers:** They write `parlay.markets` and `parlay.liveodds`. Any aggregator site can query the open markets without integration work.

**Third-party UIs:** A mobile app or Telegram bot can query `status = str('open') ORDER BY closesAt:dec ASC` to build a live markets page, with no API key from us.

**Indexers / data pipelines:** The expiration model means they don't need to filter stale odds — Arkiv does that for them.

## Will it ship after Mumbai?

Yes. The Arkiv writes are wired into the frontend's API routes. As soon as we deploy to mainnet (or a supported testnet where Aqua + Arkiv are both live), the data layer is production-ready.
