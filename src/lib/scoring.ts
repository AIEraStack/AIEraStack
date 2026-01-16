import { LLM_CONFIGS, type LLMConfig } from './llm-configs';
import type { RepoInfo, ReleaseInfo } from './github';
import type { NpmPackageInfo } from './npm';

export interface DimensionScore {
  score: number;
  details: Record<string, number | string | boolean>;
}

export interface RepoScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  timeliness: DimensionScore;
  popularity: DimensionScore;
  aiFriendliness: DimensionScore;
  community: DimensionScore;
}

export interface AllLLMScores {
  [llmId: string]: RepoScore;
}

const WEIGHTS = {
  timeliness: 0.35,
  popularity: 0.30,
  aiFriendliness: 0.20,
  community: 0.15,
};

export function calculateScores(
  repo: RepoInfo,
  releases: ReleaseInfo[],
  npmInfo: NpmPackageInfo | null,
  hasLlmsTxt: boolean
): AllLLMScores {
  const scores: AllLLMScores = {};

  for (const llm of LLM_CONFIGS) {
    scores[llm.id] = calculateScoreForLLM(repo, releases, npmInfo, hasLlmsTxt, llm);
  }

  return scores;
}

function calculateScoreForLLM(
  repo: RepoInfo,
  releases: ReleaseInfo[],
  npmInfo: NpmPackageInfo | null,
  hasLlmsTxt: boolean,
  llm: LLMConfig
): RepoScore {
  const timeliness = calculateTimeliness(repo, releases, llm);
  const popularity = calculatePopularity(repo, npmInfo);
  const aiFriendliness = calculateAIFriendliness(repo, npmInfo, hasLlmsTxt);
  const community = calculateCommunity(repo);

  const overall =
    timeliness.score * WEIGHTS.timeliness +
    popularity.score * WEIGHTS.popularity +
    aiFriendliness.score * WEIGHTS.aiFriendliness +
    community.score * WEIGHTS.community;

  return {
    overall: Math.round(overall),
    grade: getGrade(overall),
    timeliness,
    popularity,
    aiFriendliness,
    community,
  };
}

function calculateTimeliness(
  repo: RepoInfo,
  releases: ReleaseInfo[],
  llm: LLMConfig
): DimensionScore {
  const cutoff = new Date(llm.knowledgeCutoff);
  const latestRelease = releases.find((r) => !r.isPrerelease);
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

function calculatePopularity(repo: RepoInfo, npmInfo: NpmPackageInfo | null): DimensionScore {
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

function calculateAIFriendliness(
  repo: RepoInfo,
  npmInfo: NpmPackageInfo | null,
  hasLlmsTxt: boolean
): DimensionScore {
  let score = 0;

  const hasTypescript = repo.hasTypescript || repo.language === 'TypeScript';
  const hasNpmTypes = npmInfo?.hasTypes === 'bundled' || npmInfo?.hasTypes === 'definitelyTyped';

  if (hasTypescript || hasNpmTypes) {
    score += 35;
  }

  if (hasLlmsTxt) {
    score += 25;
  }

  const hasGoodTopics = repo.topics.length >= 3;
  if (hasGoodTopics) {
    score += 15;
  }

  const isWellMaintained = new Date(repo.pushedAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  if (isWellMaintained) {
    score += 15;
  }

  const hasLicense = !!repo.license;
  if (hasLicense) {
    score += 10;
  }

  return {
    score: Math.min(100, score),
    details: {
      hasTypescript: hasTypescript || hasNpmTypes,
      hasLlmsTxt,
      hasGoodTopics,
      isWellMaintained,
      hasLicense,
    },
  };
}

function calculateCommunity(repo: RepoInfo): DimensionScore {
  const issueRatio = repo.openIssues / Math.max(1, repo.stars);
  const healthyIssueRatio = issueRatio < 0.05;

  let score = 50;

  if (healthyIssueRatio) {
    score += 25;
  }

  if (repo.forks > 100) {
    score += 15;
  }

  if (repo.topics.length > 0) {
    score += 10;
  }

  return {
    score: Math.min(100, score),
    details: {
      openIssues: repo.openIssues,
      issueRatio: Math.round(issueRatio * 1000) / 1000,
      healthyIssueRatio,
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
