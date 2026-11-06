# Arkiv Schema — Parlay Markets

## Entities

### `parlay.markets`
One entity per LMSR prediction market created on-chain.

| Field | Type | Indexed | Description |
|---|---|---|---|
| `matchId` | `str` | ✓ | ESPN event ID (e.g. `"401559012"`) |
| `teamA` | `str` | ✓ | Home team name |
| `teamB` | `str` | ✓ | Away team name |
| `marketAddress` | `addr` | ✓ | LmsrMarket contract address on Sepolia |
| `closesAt` | `dec` | ✓ | Unix timestamp when betting closes |
| `status` | `str` | ✓ | `"open"` or `"resolved"` |
| `outcome` | `str` | — | `"home"`, `"away"`, or `"draw"` (set after resolution) |

**Owner:** LP/deployer wallet  
**Expiry:** 7 days after the match's closing timestamp (so resolved markets stay queryable)

**Sample query:**
```
status = str('open') ORDER BY closesAt:dec ASC
```

---

### `parlay.tickets`
One entity per parlay bet placed through ParlayRouter.

| Field | Type | Indexed | Description |
|---|---|---|---|
| `ticketId` | `dec` | ✓ | On-chain ticket ID from ParlayVault |
| `owner` | `addr` | ✓ | Bettor's wallet address |
| `stake` | `dec` | ✓ | Stake in USDC micro-units (6 decimals) |
| `payout` | `dec` | — | Potential payout in USDC micro-units |
| `legCount` | `dec` | ✓ | Number of legs in this parlay |
| `status` | `str` | ✓ | `"pending"`, `"won"`, `"lost"`, `"cashedout"` |
| `legsJson` | `bytes` | — | JSON array of `{market, teamA, teamB, outcome, price}` |

**Owner:** The bettor's wallet (only they can update their ticket status)  
**Expiry:** 30 days from creation

**Sample query (user's tickets):**
```
owner = addr(0xYOUR_WALLET) ORDER BY $expiresAt DESC
```

**Sample query (pending tickets for all users):**
```
status = str('pending')
```

---

### `parlay.liveodds`
Ephemeral LMSR price snapshot for each market. Expires in 5 minutes — stale entries vanish automatically, keeping queries fresh without deletion.

| Field | Type | Indexed | Description |
|---|---|---|---|
| `marketAddress` | `addr` | ✓ | LmsrMarket contract address |
| `priceHome` | `dec` | ✓ | LMSR marginal price for Home (0–1) |
| `priceAway` | `dec` | ✓ | LMSR marginal price for Away (0–1) |
| `impliedOddsA` | `dec` | — | 1/priceHome (e.g. 1.92 means ~2:1) |
| `impliedOddsB` | `dec` | — | 1/priceAway |

**Owner:** LP wallet  
**Expiry:** 5 minutes

**Sample query:**
```
marketAddress = addr(0xMARKET_ADDRESS) ORDER BY $expiresAt DESC
```
