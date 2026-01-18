import { LLM_CONFIGS, type LLMConfig } from './llm-configs';
import type { RepoInfo, ReleaseInfo } from './github';
import type { NpmPackageInfo } from './npm';
import type { DocSignals, ActivitySignals } from './types';

export interface DimensionScore {
  score: number;
  details: Record<string, number | string | boolean>;
}

interface SemverVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse semver from a release tag (e.g., "v1.2.3" or "1.2.3")
 * Returns null if not a valid semver tag
 */
export function parseSemverTag(tagName: string): SemverVersion | null {
  const match = tagName.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
  };
}

/**
 * Filter releases to only stable major versions (x.0.0)
 * Used for coverage calculation
 */
export function filterStableMajorReleases(releases: ReleaseInfo[]): ReleaseInfo[] {
  return releases.filter(r => {
    if (r.isPrerelease) return false;
    const semver = parseSemverTag(r.tagName);
    return semver && semver.minor === 0 && semver.patch === 0;
  });
}

/**
 * Filter releases to stable minor/major versions (x.y.0)
 * Used for release frequency calculation
 */
export function filterStableMinorReleases(releases: ReleaseInfo[]): ReleaseInfo[] {
  return releases.filter(r => {
    if (r.isPrerelease) return false;
    const semver = parseSemverTag(r.tagName);
    return semver && semver.patch === 0;
  });
}

export interface RepoScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  coverage: DimensionScore;
  adoption: DimensionScore;
  documentation: DimensionScore;
  aiReadiness: DimensionScore;
  momentum: DimensionScore;
  maintenance: DimensionScore;
}

export interface AllLLMScores {
  [llmId: string]: RepoScore;
}

const WEIGHTS = {
  coverage: 0.25,      // LLM training coverage (was timeliness)
  adoption: 0.20,      // Stars/downloads (was popularity, reduced weight)
  documentation: 0.15, // README/docs quality (new)
  aiReadiness: 0.15,   // TypeScript/llms.txt (was aiFriendliness)
  momentum: 0.15,      // Recent activity/releases (new)
  maintenance: 0.10,   // PR/issue health (was community)
};

export function calculateScores(
  repo: RepoInfo,
  releases: ReleaseInfo[],
  npmInfo: NpmPackageInfo | null,
  hasLlmsTxt: boolean,
  docSignals: DocSignals,
  activitySignals: ActivitySignals
): AllLLMScores {
  const scores: AllLLMScores = {};

  for (const llm of LLM_CONFIGS) {
    scores[llm.id] = calculateScoreForLLM(repo, releases, npmInfo, hasLlmsTxt, docSignals, activitySignals, llm);
  }

  return scores;
}

function calculateScoreForLLM(
  repo: RepoInfo,
  releases: ReleaseInfo[],
  npmInfo: NpmPackageInfo | null,
  hasLlmsTxt: boolean,
  docSignals: DocSignals,
  activitySignals: ActivitySignals,
  llm: LLMConfig
): RepoScore {
  const coverage = calculateCoverage(repo, releases, llm);
  const adoption = calculateAdoption(repo, npmInfo);
  const documentation = calculateDocumentation(docSignals);
  const aiReadiness = calculateAIReadiness(repo, npmInfo, hasLlmsTxt);
  const momentum = calculateMomentum(activitySignals, releases);
  const maintenance = calculateMaintenance(repo, activitySignals);

  const overall =
    coverage.score * WEIGHTS.coverage +
    adoption.score * WEIGHTS.adoption +
    documentation.score * WEIGHTS.documentation +
    aiReadiness.score * WEIGHTS.aiReadiness +
    momentum.score * WEIGHTS.momentum +
    maintenance.score * WEIGHTS.maintenance;

  return {
    overall: Math.round(overall),
    grade: getGrade(overall),
    coverage,
    adoption,
    documentation,
    aiReadiness,
    momentum,
    maintenance,
  };
}

// Coverage: How well is this repo covered in LLM training data?
function calculateCoverage(
  repo: RepoInfo,
  releases: ReleaseInfo[],
  llm: LLMConfig
): DimensionScore {
  const cutoff = new Date(llm.knowledgeCutoff);
  // Only consider stable major releases (x.0.0) for coverage
  const stableMajorReleases = filterStableMajorReleases(releases);
  const latestRelease = stableMajorReleases[0] || null;
  const latestReleaseDate = latestRelease ? new Date(latestRelease.publishedAt) : null;
  const lastPush = new Date(repo.pushedAt);
  const createdAt = new Date(repo.createdAt);

  let releaseScore = 100;
  if (latestReleaseDate) {
    if (latestReleaseDate <= cutoff) {
      releaseScore = 100;
    } else {
      const daysBeyond = Math.floor((latestReleaseDate.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));
      releaseScore = Math.max(20, 100 - daysBeyond * 0.5);
    }
  }

  let activityScore = 100;
  if (lastPush > cutoff) {
    const daysBeyond = Math.floor((lastPush.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));
    activityScore = Math.max(30, 100 - daysBeyond * 0.3);
  }

  const maturityScore = createdAt < cutoff ? 100 : 50;

  const score = releaseScore * 0.5 + activityScore * 0.3 + maturityScore * 0.2;

  return {
    score: Math.round(score),
    details: {
      releaseScore: Math.round(releaseScore),
      activityScore: Math.round(activityScore),
      maturityScore: Math.round(maturityScore),
      latestRelease: latestRelease?.tagName || 'N/A',
      releaseCovered: latestReleaseDate ? latestReleaseDate <= cutoff : true,
    },
  };
}

// Adoption: How widely adopted is this project?
function calculateAdoption(repo: RepoInfo, npmInfo: NpmPackageInfo | null): DimensionScore {
  const starScore = Math.min(100, Math.log10(repo.stars + 1) * 20);
  const forkScore = Math.min(100, Math.log10(repo.forks + 1) * 25);

  let downloadScore = 50;
  if (npmInfo && npmInfo.weeklyDownloads > 0) {
    downloadScore = Math.min(100, Math.log10(npmInfo.weeklyDownloads + 1) * 14.3);
  }

  const score = starScore * 0.4 + downloadScore * 0.4 + forkScore * 0.2;

  return {
    score: Math.round(score),
    details: {
      starScore: Math.round(starScore),
      downloadScore: Math.round(downloadScore),
      forkScore: Math.round(forkScore),
      stars: repo.stars,
      forks: repo.forks,
      weeklyDownloads: npmInfo?.weeklyDownloads || 0,
    },
  };
}

// Documentation: How well documented is this project?
function calculateDocumentation(docSignals: DocSignals): DimensionScore {
  let score = 0;

  // README size (0-40 points)
  if (docSignals.readmeSize > 10000) {
    score += 40;
  } else if (docSignals.readmeSize > 5000) {
    score += 30;
  } else if (docSignals.readmeSize > 2000) {
    score += 20;
  } else if (docSignals.readmeSize > 500) {
    score += 10;
  }

  // Docs directory (25 points)
  if (docSignals.hasDocsDir) {
    score += 25;
  }

  // Examples directory (20 points)
  if (docSignals.hasExamplesDir) {
    score += 20;
  }

  // Changelog (15 points)
  if (docSignals.hasChangelog) {
    score += 15;
  }

  return {
    score: Math.min(100, score),
    details: {
      readmeSize: docSignals.readmeSize,
      hasDocsDir: docSignals.hasDocsDir,
      hasExamplesDir: docSignals.hasExamplesDir,
      hasChangelog: docSignals.hasChangelog,
    },
  };
}

// AI Readiness: How AI-friendly is this codebase?
function calculateAIReadiness(
  repo: RepoInfo,
  npmInfo: NpmPackageInfo | null,
  hasLlmsTxt: boolean
): DimensionScore {
  let score = 0;

  const hasTypescript = repo.hasTypescript || repo.language === 'TypeScript';
  const hasNpmTypes = npmInfo?.hasTypes === 'bundled' || npmInfo?.hasTypes === 'definitelyTyped';

  if (hasTypescript || hasNpmTypes) {
    score += 40;
  }

  if (hasLlmsTxt) {
    score += 30;
  }

  const hasGoodTopics = repo.topics.length >= 3;
  if (hasGoodTopics) {
    score += 15;
  }

  const hasLicense = !!repo.license;
  if (hasLicense) {
    score += 15;
  }

  return {
    score: Math.min(100, score),
    details: {
      hasTypescript: hasTypescript || hasNpmTypes,
      hasLlmsTxt,
      hasGoodTopics,
      hasLicense,
    },
  };
}

// Momentum: How active is recent development?
function calculateMomentum(activitySignals: ActivitySignals, releases: ReleaseInfo[]): DimensionScore {
  let score = 0;

  // Commit frequency (0-40 points)
  if (activitySignals.commitFrequency > 10) {
    score += 40;
  } else if (activitySignals.commitFrequency > 5) {
    score += 30;
  } else if (activitySignals.commitFrequency > 2) {
    score += 20;
  } else if (activitySignals.commitFrequency > 0.5) {
    score += 10;
  }

  // Release frequency (0-35 points)
  if (activitySignals.avgDaysBetweenReleases > 0) {
    if (activitySignals.avgDaysBetweenReleases < 30) {
      score += 35;
    } else if (activitySignals.avgDaysBetweenReleases < 60) {
      score += 25;
    } else if (activitySignals.avgDaysBetweenReleases < 120) {
      score += 15;
    } else if (activitySignals.avgDaysBetweenReleases < 180) {
      score += 5;
    }
  }

  // Recent commits count (0-25 points)
  if (activitySignals.recentCommitsCount >= 30) {
    score += 25;
  } else if (activitySignals.recentCommitsCount >= 20) {
    score += 20;
  } else if (activitySignals.recentCommitsCount >= 10) {
    score += 15;
  } else if (activitySignals.recentCommitsCount >= 5) {
    score += 10;
  }

  return {
    score: Math.min(100, score),
    details: {
      commitFrequency: Math.round(activitySignals.commitFrequency * 10) / 10,
      avgDaysBetweenReleases: Math.round(activitySignals.avgDaysBetweenReleases),
      recentCommitsCount: activitySignals.recentCommitsCount,
    },
  };
}

// Maintenance: How well maintained is this project?
function calculateMaintenance(repo: RepoInfo, activitySignals: ActivitySignals): DimensionScore {
  let score = 50; // Base score

  // Issue health (0-30 points)
  const issueRatio = repo.openIssues / Math.max(1, repo.stars);
  if (issueRatio < 0.02) {
    score += 30;
  } else if (issueRatio < 0.05) {
    score += 20;
  } else if (issueRatio < 0.1) {
    score += 10;
  }

  // PR close time (0-20 points)
  if (activitySignals.avgPRCloseTimeHours > 0) {
    if (activitySignals.avgPRCloseTimeHours < 24) {
      score += 20;
    } else if (activitySignals.avgPRCloseTimeHours < 72) {
      score += 15;
    } else if (activitySignals.avgPRCloseTimeHours < 168) {
      score += 10;
    } else if (activitySignals.avgPRCloseTimeHours < 720) {
      score += 5;
    }
  }

  return {
    score: Math.min(100, score),
    details: {
      openIssues: repo.openIssues,
      issueRatio: Math.round(issueRatio * 1000) / 1000,
      avgPRCloseTimeHours: Math.round(activitySignals.avgPRCloseTimeHours),
      recentClosedPRsCount: activitySignals.recentClosedPRsCount,
    },
  };
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function getBestLLM(scores: AllLLMScores): string {
  let bestId = '';
  let bestScore = -1;

  for (const [id, score] of Object.entries(scores)) {
    if (score.overall > bestScore) {
      bestScore = score.overall;
      bestId = id;
    }
  }

  return bestId;
}
