-- D1 Migration: Create comparison_evaluations table
-- Stores AI-generated evaluations for curated library comparisons

CREATE TABLE IF NOT EXISTS comparison_evaluations (
  id TEXT PRIMARY KEY,                -- SHA256(sorted repo slugs) truncated to 16 chars
  repos TEXT NOT NULL,                -- JSON array: ["facebook/react", "vuejs/core", ...]
  repos_count INTEGER NOT NULL,       -- Number of repos for easy filtering
  category TEXT,                      -- Category ID if this is a category comparison

  -- Evaluation content (JSON)
  evaluation TEXT NOT NULL,

  -- Metadata
  model_used TEXT,                    -- Model used to generate (e.g., "claude-haiku")
  generated_at TEXT NOT NULL,         -- ISO timestamp when generated
  expires_at TEXT,                    -- Optional expiration time

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for looking up by repos (though we'll primarily use id)
CREATE INDEX IF NOT EXISTS idx_eval_repos ON comparison_evaluations(repos);

-- Index for category-based lookups
CREATE INDEX IF NOT EXISTS idx_eval_category ON comparison_evaluations(category);

-- Index for finding expired evaluations
CREATE INDEX IF NOT EXISTS idx_eval_expires ON comparison_evaluations(expires_at);

-- Index for repos_count (for queries like "all 3-way comparisons")
CREATE INDEX IF NOT EXISTS idx_eval_repos_count ON comparison_evaluations(repos_count);
