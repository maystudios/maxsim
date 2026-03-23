/**
 * GitHub Milestones — CRUD with pagination.
 */

import { getOctokit, getRepoInfo, withGhResult } from './client.js';
import type { GhMilestone, GhResult, RepoInfo } from './types.js';

/** Create a new milestone. */
export async function createMilestone(
  params: {
    title: string;
    description?: string;
    dueOn?: string; // ISO 8601 date
  },
  repo?: RepoInfo,
): Promise<GhResult<GhMilestone>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.createMilestone({
      owner,
      repo: repoName,
      title: params.title,
      description: params.description,
      due_on: params.dueOn,
    });

    return {
      number: data.number,
      id: data.id,
      nodeId: data.node_id,
      title: data.title,
      description: data.description ?? '',
      state: data.state as 'open' | 'closed',
      openIssues: data.open_issues,
      closedIssues: data.closed_issues,
      dueOn: data.due_on,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  });
}

/** List all milestones with pagination. */
export async function listMilestones(
  state: 'open' | 'closed' | 'all' = 'all',
  repo?: RepoInfo,
): Promise<GhResult<GhMilestone[]>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const milestones = await octokit.paginate(
      octokit.rest.issues.listMilestones,
      {
        owner,
        repo: repoName,
        state,
        per_page: 100,
      },
    );

    return milestones.map((m) => ({
      number: m.number,
      id: m.id,
      nodeId: m.node_id,
      title: m.title,
      description: m.description ?? '',
      state: m.state as 'open' | 'closed',
      openIssues: m.open_issues,
      closedIssues: m.closed_issues,
      dueOn: m.due_on,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));
  });
}

/** Find a milestone by title. */
export async function findMilestone(
  title: string,
  repo?: RepoInfo,
): Promise<GhResult<GhMilestone | null>> {
  const result = await listMilestones('all', repo);
  if (!result.ok) return result;

  const found = result.data.find((m) => m.title === title) ?? null;
  return { ok: true, data: found };
}

/** Find or create a milestone by title. */
export async function ensureMilestone(
  params: {
    title: string;
    description?: string;
    dueOn?: string;
  },
  repo?: RepoInfo,
): Promise<GhResult<GhMilestone>> {
  const findResult = await findMilestone(params.title, repo);
  if (!findResult.ok) return findResult;

  if (findResult.data) {
    return { ok: true, data: findResult.data };
  }

  return createMilestone(params, repo);
}

/** Delete a milestone by its number. */
export async function deleteMilestone(
  milestoneNumber: number,
  repo?: RepoInfo,
): Promise<GhResult<void>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    await octokit.rest.issues.deleteMilestone({
      owner,
      repo: repoName,
      milestone_number: milestoneNumber,
    });
  });
}

/** Update a milestone. */
export async function updateMilestone(
  milestoneNumber: number,
  params: {
    title?: string;
    description?: string;
    state?: 'open' | 'closed';
    dueOn?: string | null;
  },
  repo?: RepoInfo,
): Promise<GhResult<GhMilestone>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.updateMilestone({
      owner,
      repo: repoName,
      milestone_number: milestoneNumber,
      title: params.title,
      description: params.description,
      state: params.state,
      due_on: params.dueOn ?? undefined,
    });

    return {
      number: data.number,
      id: data.id,
      nodeId: data.node_id,
      title: data.title,
      description: data.description ?? '',
      state: data.state as 'open' | 'closed',
      openIssues: data.open_issues,
      closedIssues: data.closed_issues,
      dueOn: data.due_on,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  });
}
