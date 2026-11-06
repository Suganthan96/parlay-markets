# Arkiv Feedback — Parlay Markets

## What should be improved today?

1. **No `updateEntity` example in docs.** The tutorial covers `createEntity` and `.from().where().fetch()`, but updating an existing entity (changing `status` from `"pending"` to `"won"`) wasn't documented at the URLs I found. I expected a `walletClient.updateEntity(schema, entityKey, patch)` call; had to infer from context.

2. **`ExpirationTime.fromMinutes` unclear.** The docs show `ExpirationTime.fromDays(1)` but don't document `fromMinutes`, `fromHours`, or the underlying format. For `liveodds` (5-minute TTL) I had to guess the method name.

3. **No `.limit(n)` shown in query builder docs.** When fetching the latest odds entry I wanted `.orderBy(...).limit(1)`. Not sure if `limit` is a method on the query builder or must be done in a `.where` clause. I included it in the code but didn't confirm it compiles.

4. **Testnet-only SDK.** The `rabdi` chain helper only targets the Rabdi testnet. It would be useful to have a mainnet chain export alongside it, so the same code works in production without swapping imports.

## When something broke, what did you expect vs what happened?

- Expected: `str().indexed()` would work for filtering with `str('open')` comparisons.
- Happened: Couldn't verify at hackathon time since the SDK install wasn't run against a live Arkiv node. No runtime error confirmed, but documentation for filter expressions uses raw string syntax (`status = str('open')`) rather than a type-safe builder, which risks typos at runtime.

- Expected: Entity owner = the wallet that called `createEntity`.
- Happened: (Assumed correct — docs say owner = caller.)
