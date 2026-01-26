#!/bin/bash
# Generate AI comparison evaluations for curated categories
# Uses Claude Code CLI with haiku model, restricted to WebSearch only

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$SCRIPT_DIR/evaluations"
PROMPT_FILE="$SCRIPT_DIR/evaluation-prompt.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Check if prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
  echo -e "${RED}Error: Prompt file not found at $PROMPT_FILE${NC}"
  exit 1
fi

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
  echo -e "${RED}Error: claude CLI not found. Please install Claude Code CLI.${NC}"
  exit 1
fi

# Get category metadata from types.ts
get_category_label() {
  local category=$1
  node -e "
    const fs = require('fs');
    const content = fs.readFileSync('$PROJECT_ROOT/src/lib/types.ts', 'utf8');
    const match = content.match(new RegExp(\"'$category':\\\\s*{\\\\s*label:\\\\s*'([^']+)'\"));
    console.log(match ? match[1] : '$category');
  "
}

# Get repo scores from local D1 database
# Returns JSON with scores for each repo in the category
get_category_scores() {
  local category=$1

  # Query local D1 for repo data
  # Note: Uses wrangler d1 execute with --remote flag for production data
  node -e "
    const { execSync } = require('child_process');

    try {
      // Get repos for this category from curated-repos.json
      const curatedRepos = require('$PROJECT_ROOT/src/config/curated-repos.json');
      const categoryRepos = curatedRepos.repos
        .filter(r => r.category === '$category')
        .map(r => r.owner + '/' + r.name);

      console.error('[DEBUG] Fetching data for category: $category');
      console.error('[DEBUG] Expected repos:', categoryRepos.join(', '));

      // Try to get data from remote D1 (production data)
      const cmd = 'npx wrangler d1 execute DB --remote --json --command \"SELECT full_name, data FROM repos WHERE category = ' + \"'$category'\" + '\"';
      console.error('[DEBUG] Command:', cmd);
      const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], cwd: '$PROJECT_ROOT' });

      console.error('[DEBUG] Raw wrangler output length:', result.length);

      const parsed = JSON.parse(result);
      if (parsed[0] && parsed[0].results && parsed[0].results.length > 0) {
        console.error('[DEBUG] Found', parsed[0].results.length, 'repos in DB');

        const scores = parsed[0].results.map(row => {
          const data = JSON.parse(row.data);
          // Use first available LLM scores (e.g., gpt-5.2-codex)
          const llmId = Object.keys(data.scores)[0];
          const llmScores = data.scores[llmId];
          console.error('[DEBUG] Repo:', row.full_name, 'Overall:', llmScores?.overall || 0);
          return {
            repo: row.full_name,
            overall: llmScores?.overall || 0,
            grade: llmScores?.grade || 'F',
            coverage: llmScores?.coverage?.score || 0,
            aiReadiness: llmScores?.aiReadiness?.score || 0,
            documentation: llmScores?.documentation?.score || 0,
            adoption: llmScores?.adoption?.score || 0,
            momentum: llmScores?.momentum?.score || 0,
            maintenance: llmScores?.maintenance?.score || 0,
            stars: data.repo?.stars || 0,
            description: data.repo?.description || ''
          };
        });
        console.log(JSON.stringify(scores, null, 2));
      } else {
        console.error('[DEBUG] No results from DB, using fallback');
        // Fallback: just output repo names without scores
        console.log(JSON.stringify(categoryRepos.map(r => ({ repo: r, overall: 0 }))));
      }
    } catch (e) {
      console.error('[DEBUG] Error:', e.message);
      // Fallback if wrangler fails
      const curatedRepos = require('$PROJECT_ROOT/src/config/curated-repos.json');
      const repos = curatedRepos.repos
        .filter(r => r.category === '$category')
        .map(r => ({ repo: r.owner + '/' + r.name, overall: 0, note: 'scores not available' }));
      console.log(JSON.stringify(repos, null, 2));
    }
  "
}

# Process a single category or specific categories passed as arguments
process_category() {
  local CATEGORY=$1

  echo -e "${CYAN}=== Processing: $CATEGORY ===${NC}"

  OUTPUT_FILE="$OUTPUT_DIR/$CATEGORY.json"

  # Skip if file exists and --force not specified
  if [ -f "$OUTPUT_FILE" ] && [ "$FORCE" != "true" ]; then
    echo -e "  ${YELLOW}Skipping (already exists). Use --force to regenerate.${NC}"
    return 0
  fi

  CATEGORY_LABEL=$(get_category_label "$CATEGORY")

  # Get repos for this category
  REPOS=$(node -e "
    const data = require('$PROJECT_ROOT/src/config/curated-repos.json');
    const repos = data.repos
      .filter(r => r.category === '$CATEGORY')
      .map(r => r.owner + '/' + r.name);
    console.log(repos.join(', '));
  ")

  # Get scores data
  SCORES_DATA=$(get_category_scores "$CATEGORY")

  echo "  Category: $CATEGORY_LABEL"
  echo "  Repos: $REPOS"

  # Build the full prompt with actual data
  FULL_PROMPT="$(cat "$PROMPT_FILE")

---

## 本次评估数据

**Category ID:** $CATEGORY
**Category Label:** $CATEGORY_LABEL
**Repositories:** $REPOS

### 各库的实际评分数据（基于 GPT-5.2 Codex 模型）：

\`\`\`json
$SCORES_DATA
\`\`\`

请基于以上数据生成 ComparisonEvaluation JSON。

**重要：**
- dimensionInsights 中的 score 必须使用上面提供的实际分数
- rankings 按 overall 分数排序
- 可以用 WebSearch 了解库的特点，但不要改变我们的评分数据"

  # Call Claude Code CLI with WebSearch only
  echo "  Calling Claude CLI..."

  if claude --model haiku \
    --print \
    --allowedTools "WebSearch" \
    --dangerously-skip-permissions \
    -p "$FULL_PROMPT" > "$OUTPUT_FILE.tmp" 2>/dev/null; then

    # Validate JSON
    if node -e "JSON.parse(require('fs').readFileSync('$OUTPUT_FILE.tmp', 'utf8'))" 2>/dev/null; then
      mv "$OUTPUT_FILE.tmp" "$OUTPUT_FILE"
      echo -e "  ${GREEN}✓ Generated: $OUTPUT_FILE${NC}"
      return 0
    else
      echo -e "  ${RED}✗ Invalid JSON output${NC}"
      # Show first 500 chars for debugging
      head -c 500 "$OUTPUT_FILE.tmp"
      rm -f "$OUTPUT_FILE.tmp"
      return 1
    fi
  else
    echo -e "  ${RED}✗ Claude CLI failed${NC}"
    rm -f "$OUTPUT_FILE.tmp"
    return 1
  fi
}

# Parse arguments
FORCE="false"
CATEGORIES_ARG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE="true"
      shift
      ;;
    *)
      CATEGORIES_ARG="$CATEGORIES_ARG $1"
      shift
      ;;
  esac
done

# Get categories to process
if [ -n "$CATEGORIES_ARG" ]; then
  # Use specified categories
  CATEGORIES=$(echo $CATEGORIES_ARG | tr ' ' '\n' | grep -v '^$')
  echo "Processing specified categories: $CATEGORIES_ARG"
else
  # Get all categories from curated-repos.json
  CATEGORIES=$(node -e "
    const data = require('$PROJECT_ROOT/src/config/curated-repos.json');
    const categories = [...new Set(data.repos.map(r => r.category))];
    console.log(categories.join('\n'));
  ")
  CATEGORY_COUNT=$(echo "$CATEGORIES" | wc -l | tr -d ' ')
  echo "Found $CATEGORY_COUNT categories to process"
fi

echo ""

PROCESSED=0
SKIPPED=0
ERRORS=0

for CATEGORY in $CATEGORIES; do
  if process_category "$CATEGORY"; then
    PROCESSED=$((PROCESSED + 1))
  else
    ERRORS=$((ERRORS + 1))
  fi

  # Rate limiting - wait between API calls
  sleep 2
done

echo ""
echo "=== Generation Complete ==="
echo -e "Processed: ${GREEN}$PROCESSED${NC}"
echo -e "Errors: ${RED}$ERRORS${NC}"
echo ""
echo "Output files in: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "  1. Review generated JSON files"
echo "  2. Run: npx tsx scripts/import-evaluations.ts"
