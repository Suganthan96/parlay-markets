#!/usr/bin/env bash
# Deploy CCIP Parlay contracts on Ethereum Sepolia + Base Sepolia
# Run from: contracts/
#
# Usage:
#   PRIVATE_KEY=0x... \
#   SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
#   BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY \
#   bash script/deploy-ccip.sh

set -e

FORGE=~/.foundry/bin/forge

PRIVATE_KEY="${PRIVATE_KEY:?Set PRIVATE_KEY}"
SEPOLIA_RPC="${SEPOLIA_RPC:?Set SEPOLIA_RPC (e.g. Alchemy Ethereum Sepolia)}"
BASE_SEPOLIA_RPC="${BASE_SEPOLIA_RPC:?Set BASE_SEPOLIA_RPC (e.g. Alchemy Base Sepolia)}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " STEP 1 — Deploy CCIPParlayReceiver on Sepolia"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RECEIVER_OUTPUT=$(PRIVATE_KEY="$PRIVATE_KEY" $FORGE script script/DeployCCIPReceiver.s.sol:DeployCCIPReceiver \
  --rpc-url "$SEPOLIA_RPC" \
  --broadcast \
  --verify \
  2>&1)

echo "$RECEIVER_OUTPUT"

# Extract CCIPParlayReceiver address from forge output
RECEIVER_ADDR=$(echo "$RECEIVER_OUTPUT" | grep "CCIPParlayReceiver:" | awk '{print $NF}')
echo ""
echo "✓ CCIPParlayReceiver deployed at: $RECEIVER_ADDR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " STEP 2 — Deploy CCIPParlayGateway on Base Sepolia"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

GATEWAY_OUTPUT=$(PRIVATE_KEY="$PRIVATE_KEY" SEPOLIA_RECEIVER_ADDRESS="$RECEIVER_ADDR" \
  $FORGE script script/DeployCCIPGateway.s.sol:DeployCCIPGateway \
  --rpc-url "$BASE_SEPOLIA_RPC" \
  --broadcast \
  2>&1)

echo "$GATEWAY_OUTPUT"

GATEWAY_ADDR=$(echo "$GATEWAY_OUTPUT" | grep "CCIPParlayGateway:" | awk '{print $NF}')
BASE_USDC_ADDR=0x036CbD53842c5426634e7929541eC2318f3dCF7e
echo ""
echo "✓ CCIPParlayGateway deployed at: $GATEWAY_ADDR"
echo "✓ Circle USDC (Base Sepolia):   $BASE_USDC_ADDR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " STEP 3 — Wire gateway address into Receiver on Sepolia"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

~/.foundry/bin/cast send "$RECEIVER_ADDR" \
  "setGateway(address)" "$GATEWAY_ADDR" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$SEPOLIA_RPC"

echo "✓ Receiver.setGateway($GATEWAY_ADDR) called"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CCIPParlayReceiver (Sepolia):       $RECEIVER_ADDR"
echo "CCIPParlayGateway (Base Sepolia):   $GATEWAY_ADDR"
echo "Circle USDC (Base Sepolia):         $BASE_USDC_ADDR"
echo ""
echo "Add to frontend/.env.local:"
echo "NEXT_PUBLIC_CCIP_RECEIVER=$RECEIVER_ADDR"
echo "NEXT_PUBLIC_CCIP_GATEWAY=$GATEWAY_ADDR"
echo "NEXT_PUBLIC_BASE_USDC=$BASE_USDC_ADDR"
