#!/usr/bin/env bash
# CRE simulation helper for Parlay Markets
#
# Step 1: Emit SettlementRequested on Sepolia
# Step 2: Run CRE simulation with the tx hash
#
# Prerequisites:
#   - cast (Foundry) installed
#   - cre CLI installed: npm i -g @chainlink/cre-cli
#   - PRIVATE_KEY and RPC_URL set in environment (or in cre/.env)
#
# Usage:
#   cd cre
#   PRIVATE_KEY=0x... RPC_URL=https://... bash simulate.sh

set -e

PRIVATE_KEY="${PRIVATE_KEY:?Set PRIVATE_KEY env var}"
# Default to public Sepolia RPC; override with your own for reliability
RPC_URL="${RPC_URL:-https://rpc.sepolia.org}"

MARKET_RESOLVER="0xC26c4E298Ec899b5f764827046F8EEBc6F7a5358"
MARKET_A="0x83b102EefF5EBbd8D6Cbaf92Dbb69606197afcFd"   # Man City vs Arsenal  (EPL_MCI_ARS_2026)
MARKET_B="0x1eb5d0a0fA1f5a218C207F515f57E280C6b92355"   # Real Madrid vs Barcelona (UCL_RMA_BAR_2026)

# Match IDs (keccak256 of the string IDs used in deploy)
MATCH_ID_A=$(cast keccak "EPL_MCI_ARS_2026")
MATCH_ID_B=$(cast keccak "UCL_RMA_BAR_2026")

echo "=== Parlay Markets — CRE Simulation ==="
echo ""
echo "Market A: Man City vs Arsenal"
echo "  address:  $MARKET_A"
echo "  matchId:  $MATCH_ID_A"
echo ""
echo "Market B: Real Madrid vs Barcelona"
echo "  address:  $MARKET_B"
echo "  matchId:  $MATCH_ID_B"
echo ""

# Pick which market to settle (default A)
MATCH_ID="${MATCH_ID_A}"
MARKET="${MARKET_A}"

echo "--- Step 1: Emitting SettlementRequested for Market A ---"
echo "Calling MarketResolver.requestSettlement($MATCH_ID, $MARKET)"
echo ""

TX_HASH=$(cast send "$MARKET_RESOLVER" \
  "requestSettlement(bytes32,address)" \
  "$MATCH_ID" "$MARKET" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --json | jq -r '.transactionHash')

echo "Transaction hash: $TX_HASH"
echo ""

if [ -z "$TX_HASH" ] || [ "$TX_HASH" = "null" ]; then
  echo "ERROR: Transaction failed — check RPC_URL and PRIVATE_KEY"
  exit 1
fi

echo "--- Step 2: Running CRE simulation ---"
echo ""
echo "Command:"
echo "  cre workflow simulate market-resolver \\"
echo "    --target staging-settings \\"
echo "    --non-interactive \\"
echo "    --trigger-index 0 \\"
echo "    --evm-tx-hash $TX_HASH \\"
echo "    --evm-event-index 0"
echo ""

cd "$(dirname "$0")/market-resolver" || exit 1

cre workflow simulate market-resolver \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --evm-tx-hash "$TX_HASH" \
  --evm-event-index 0

echo ""
echo "=== Done. If simulation succeeds, add --broadcast to the command above to resolve on-chain. ==="
