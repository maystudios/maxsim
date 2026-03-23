/**
 * GitHub Labels — ensure all MaxsimCLI labels exist on a repo.
 */

import { getOctokit, getRepoInfo, withGhResult } from './client.js';
import type { GhLabel, GhResult, LabelDef, RepoInfo } from './types.js';
import { MAXSIM_LABELS } from './types.js';

/** Ensure all MaxsimCLI labels exist on the repo. Creates missing ones. */
export async function ensureLabels(repo?: RepoInfo): Promise<GhResult<{ created: string[]; existing: string[] }>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    // Get existing labels with pagination
    const existingLabels = await octokit.paginate(
      octokit.rest.issues.listLabelsForRepo,
      { owner, repo: repoName, per_page: 100 },
    );

    const existingNames = new Set(existingLabels.map((l) => l.name));
    const created: string[] = [];
    const existing: string[] = [];

    for (const label of MAXSIM_LABELS) {
      if (existingNames.has(label.name)) {
        existing.push(label.name);
        continue;
      }

      await octokit.rest.issues.createLabel({
        owner,
        repo: repoName,
        name: label.name,
        description: label.description,
        color: label.color,
      });
      created.push(label.name);
    }

    return { created, existing };
  });
}

/** Get a single label by name. */
export async function getLabel(
  labelName: string,
  repo?: RepoInfo,
): Promise<GhResult<GhLabel | null>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    try {
      const { data } = await octokit.rest.issues.getLabel({
        owner,
        repo: repoName,
        name: labelName,
      });
      return {
        id: data.id,
        nodeId: data.node_id,
        name: data.name,
        description: data.description ?? '',
        color: data.color,
      };
    } catch {
      return null;
    }
  });
}

/** Update an existing label's name, color, or description. */
export async function updateLabel(
  name: string,
  updates: { new_name?: string; color?: string; description?: string },
  repo?: RepoInfo,
): Promise<GhResult<GhLabel>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.updateLabel({
      owner,
      repo: repoName,
      name,
      new_name: updates.new_name,
      color: updates.color,
      description: updates.description,
    });
    return {
      id: data.id,
      nodeId: data.node_id,
      name: data.name,
      description: data.description ?? '',
      color: data.color,
    };
  });
}

/** Create a custom label. */
export async function createLabel(
  label: LabelDef,
  repo?: RepoInfo,
): Promise<GhResult<GhLabel>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.createLabel({
      owner,
      repo: repoName,
      name: label.name,
      description: label.description,
      color: label.color,
    });
    return {
      id: data.id,
      nodeId: data.node_id,
      name: data.name,
      description: data.description ?? '',
      color: data.color,
    };
  });
}
