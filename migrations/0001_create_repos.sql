-- D1 Migration: Create repos table
-- Replaces R2 object storage with SQL database

CREATE TABLE IF NOT EXISTS repos (
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  category TEXT NOT NULL,
  featured INTEGER DEFAULT 0,
  
  -- Index fields for fast queries (no need to parse JSON)
  stars INTEGER DEFAULT 0,
  language TEXT,
  description TEXT,
  best_score REAL DEFAULT 0,
  best_grade TEXT DEFAULT 'F',
  scores_by_llm TEXT,  -- JSON string: {"gpt-5.2-codex": {"overall": 70, "grade": "C"}, ...}
  
  updated_at TEXT,
  fetched_at TEXT,
  data_version INTEGER DEFAULT 1,
  
  -- Full CachedRepoData as JSON
  data TEXT NOT NULL,
  
  PRIMARY KEY (owner, name)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_repos_category ON repos(category);
CREATE INDEX IF NOT EXISTS idx_repos_best_score ON repos(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_repos_featured ON repos(featured);
CREATE INDEX IF NOT EXISTS idx_repos_stars ON repos(stars DESC);
