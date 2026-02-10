import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

export interface UpdateInfo {
  hasGitUpdates: boolean;
  gitBehindBy?: number;
  gitAheadBy?: number;
  currentBranch?: string;
  remoteBranch?: string;
  hasNpmUpdates: boolean;
  outdatedPackages?: Array<{
    package: string;
    current: string;
    wanted: string;
    latest: string;
  }>;
  error?: string;
}

/**
 * Check for available updates from git and npm
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const result: UpdateInfo = {
    hasGitUpdates: false,
    hasNpmUpdates: false,
  };

  try {
    // Check git updates
    const gitInfo = await checkGitUpdates();
    Object.assign(result, gitInfo);

    // Check npm updates
    const npmInfo = await checkNpmUpdates();
    Object.assign(result, npmInfo);

    if (result.hasGitUpdates || result.hasNpmUpdates) {
      logger.info("updates", "Updates available", {
        git: result.hasGitUpdates,
        npm: result.hasNpmUpdates,
      });
    } else {
      logger.debug("updates", "No updates available");
    }
  } catch (err) {
    logger.error("updates", "Failed to check for updates", {
      error: (err as Error).message,
    });
    result.error = (err as Error).message;
  }

  return result;
}

/**
 * Check for git updates from remote
 */
async function checkGitUpdates(): Promise<Partial<UpdateInfo>> {
  try {
    // Fetch latest from remote
    await execAsync("git fetch origin --quiet");

    // Get current branch
    const { stdout: branchOutput } = await execAsync(
      "git rev-parse --abbrev-ref HEAD"
    );
    const currentBranch = branchOutput.trim();

    // Get remote tracking branch
    const { stdout: remoteOutput } = await execAsync(
      `git rev-parse --abbrev-ref ${currentBranch}@{upstream}`
    );
    const remoteBranch = remoteOutput.trim();

    // Check if local is behind remote
    const { stdout: behindOutput } = await execAsync(
      `git rev-list --count HEAD..${remoteBranch}`
    );
    const behindBy = parseInt(behindOutput.trim(), 10);

    // Check if local is ahead of remote
    const { stdout: aheadOutput } = await execAsync(
      `git rev-list --count ${remoteBranch}..HEAD`
    );
    const aheadBy = parseInt(aheadOutput.trim(), 10);

    logger.debug("updates", "Git status checked", {
      currentBranch,
      remoteBranch,
      behindBy,
      aheadBy,
    });

    return {
      hasGitUpdates: behindBy > 0,
      gitBehindBy: behindBy,
      gitAheadBy: aheadBy,
      currentBranch,
      remoteBranch,
    };
  } catch (err) {
    logger.warn("updates", "Failed to check git updates", {
      error: (err as Error).message,
    });
    // Not a git repo or no remote - not an error
    return { hasGitUpdates: false };
  }
}

/**
 * Check for npm package updates
 */
async function checkNpmUpdates(): Promise<Partial<UpdateInfo>> {
  try {
    // Run npm outdated with json output
    const { stdout } = await execAsync("npm outdated --json", {
      cwd: process.cwd(),
      // npm outdated exits with code 1 when updates are found, so ignore errors
      // We'll parse the json output instead
    }).catch((err) => {
      // npm outdated returns exit code 1 when updates exist
      // but still provides json output in stdout
      return { stdout: err.stdout || "{}" };
    });

    if (!stdout || stdout.trim() === "{}") {
      logger.debug("updates", "No npm updates available");
      return { hasNpmUpdates: false };
    }

    const outdated = JSON.parse(stdout);
    const packages = Object.entries(outdated).map(([pkg, info]: [string, any]) => ({
      package: pkg,
      current: info.current || "unknown",
      wanted: info.wanted || "unknown",
      latest: info.latest || "unknown",
    }));

    logger.debug("updates", "NPM updates found", {
      count: packages.length,
      packages: packages.map((p) => p.package),
    });

    return {
      hasNpmUpdates: packages.length > 0,
      outdatedPackages: packages,
    };
  } catch (err) {
    logger.warn("updates", "Failed to check npm updates", {
      error: (err as Error).message,
    });
    return { hasNpmUpdates: false };
  }
}

/**
 * Format update info as user-friendly message
 */
export function formatUpdateMessage(info: UpdateInfo): string {
  if (info.error) {
    return `❌ Failed to check for updates: ${info.error}`;
  }

  if (!info.hasGitUpdates && !info.hasNpmUpdates) {
    return "✅ Everything is up to date!";
  }

  const parts: string[] = [];

  if (info.hasGitUpdates && info.gitBehindBy) {
    parts.push(
      `🔄 **Git Updates Available**\n` +
        `Branch: ${info.currentBranch}\n` +
        `Behind remote by ${info.gitBehindBy} commit${info.gitBehindBy > 1 ? "s" : ""}\n` +
        (info.gitAheadBy && info.gitAheadBy > 0
          ? `Ahead by ${info.gitAheadBy} commit${info.gitAheadBy > 1 ? "s" : ""} (unpushed)\n`
          : "") +
        `\nRun: \`git pull\` to update`
    );
  }

  if (info.hasNpmUpdates && info.outdatedPackages && info.outdatedPackages.length > 0) {
    const pkgList = info.outdatedPackages
      .slice(0, 5) // Show max 5 packages
      .map(
        (p) => `• ${p.package}: ${p.current} → ${p.latest}`
      )
      .join("\n");

    const more =
      info.outdatedPackages.length > 5
        ? `\n...and ${info.outdatedPackages.length - 5} more`
        : "";

    parts.push(
      `📦 **NPM Updates Available** (${info.outdatedPackages.length})\n` +
        pkgList +
        more +
        `\n\nRun: \`npm update\` to update`
    );
  }

  return parts.join("\n\n");
}

/**
 * Check for updates and notify if found (for scheduled checks)
 */
export async function checkAndNotify(): Promise<{ hasUpdates: boolean; message: string }> {
  const info = await checkForUpdates();
  const hasUpdates = info.hasGitUpdates || info.hasNpmUpdates;
  const message = formatUpdateMessage(info);

  return { hasUpdates, message };
}
