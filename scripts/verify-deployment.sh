#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -f "${ROOT_DIR}/.env" ]; then
    set -a
    . "${ROOT_DIR}/.env"
    set +a
fi

# Deployment verification script
# Usage: ./scripts/verify-deployment.sh [domain]
# Example: ./scripts/verify-deployment.sh aierastack.pages.dev

DOMAIN="${1:-${DEPLOY_DOMAIN:-aierastack.pages.dev}}"
BASE_URL="https://${DOMAIN}"

echo "🔍 Verifying deployment: ${BASE_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Color definitions
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL=0
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected_pattern=$3
    
    TOTAL=$((TOTAL + 1))
    echo -n "[$TOTAL] ${name}... "
    
    response=$(curl -s -w "\n%{http_code}" "${url}")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        if [ -z "$expected_pattern" ] || echo "$body" | grep -q "$expected_pattern"; then
            echo -e "${GREEN}✓ PASS${NC}"
            PASSED=$((PASSED + 1))
            return 0
        else
            echo -e "${RED}✗ FAIL${NC} (content mismatch)"
            echo "  Expected pattern: $expected_pattern"
            FAILED=$((FAILED + 1))
            return 1
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# 1. Test pages
echo "📄 Testing pages"
test_endpoint "Homepage" "${BASE_URL}/" "AI Era Stack"
test_endpoint "Repository detail page" "${BASE_URL}/repo/facebook/react" "React"

echo ""

# 2. Test API
echo "🔌 Testing API"
test_endpoint "API - facebook/react" "${BASE_URL}/api/repo?owner=facebook&name=react" "\"owner\":\"facebook\""
test_endpoint "API - error handling" "${BASE_URL}/api/repo?owner=invalid" "error"

echo ""

# 3. Test Badge API
echo "🏷️  Testing Badge API"
test_endpoint "Badge - facebook/react" "${BASE_URL}/badge/facebook/react.svg" "<svg"
test_endpoint "Badge - custom LLM" "${BASE_URL}/badge/facebook/react.svg?llm=claude-4.5-sonnet" "<svg"

echo ""

# 4. Test static assets
echo "📦 Testing static assets"
test_endpoint "Favicon" "${BASE_URL}/favicon.svg" "<svg"
test_endpoint "OG Image" "${BASE_URL}/og-image.svg" "<svg"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Deployment successful!${NC}"
    exit 0
else
    echo -e "${RED}❌ ${FAILED} test(s) failed${NC}"
    echo ""
    echo "💡 Troubleshooting tips:"
    echo "  1. Check Cloudflare Pages Functions logs"
    echo "  2. Verify R2 binding: DATA_BUCKET → aierastack-data"
    echo "  3. Verify index.json and repos/ files exist in R2"
    echo "  4. Run Update Data workflow to refresh data"
    exit 1
fi
