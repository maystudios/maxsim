/**
 * GitHub Issues — CRUD, sub-issues, comments.
 * Uses correct API: node_id for GraphQL, internal .id for REST bodies.
 */

import { getOctokit, getRepoInfo, withGhResult } from './client.js';
import type { GhIssue, GhComment, GhResult, IssueIds, RepoInfo } from './types.js';

/** Map Octokit issue response to our GhIssue type. */
function mapIssue(raw: Record<string, unknown>): GhIssue {
  return {
    number: raw.number as number,
    id: raw.id as number,
    nodeId: (raw.node_id ?? '') as string,
    title: (raw.title ?? '') as string,
    body: (raw.body ?? '') as string,
    state: (raw.state ?? 'open') as 'open' | 'closed',
    stateReason: (raw.state_reason ?? null) as GhIssue['stateReason'],
    labels: Array.isArray(raw.labels)
      ? raw.labels.map((l: Record<string, unknown>) => ({
          id: (l.id ?? 0) as number,
          nodeId: (l.node_id ?? '') as string,
          name: (l.name ?? '') as string,
          description: (l.description ?? '') as string,
          color: (l.color ?? '') as string,
        }))
      : [],
    milestone: raw.milestone
      ? {
          number: (raw.milestone as Record<string, unknown>).number as number,
          id: (raw.milestone as Record<string, unknown>).id as number,
          nodeId: ((raw.milestone as Record<string, unknown>).node_id ?? '') as string,
          title: ((raw.milestone as Record<string, unknown>).title ?? '') as string,
          description: ((raw.milestone as Record<string, unknown>).description ?? '') as string,
          state: ((raw.milestone as Record<string, unknown>).state ?? 'open') as 'open' | 'closed',
          openIssues: ((raw.milestone as Record<string, unknown>).open_issues ?? 0) as number,
          closedIssues: ((raw.milestone as Record<string, unknown>).closed_issues ?? 0) as number,
          dueOn: ((raw.milestone as Record<string, unknown>).due_on ?? null) as string | null,
          createdAt: ((raw.milestone as Record<string, unknown>).created_at ?? '') as string,
          updatedAt: ((raw.milestone as Record<string, unknown>).updated_at ?? '') as string,
        }
      : null,
    assignees: Array.isArray(raw.assignees)
      ? raw.assignees.map((a: Record<string, unknown>) => ({
          login: (a.login ?? '') as string,
          id: (a.id ?? 0) as number,
          nodeId: (a.node_id ?? '') as string,
          type: (a.type ?? 'User') as 'User' | 'Organization',
        }))
      : [],
    createdAt: (raw.created_at ?? '') as string,
    updatedAt: (raw.updated_at ?? '') as string,
    htmlUrl: (raw.html_url ?? '') as string,
  };
}

/** Get all three ID forms for an issue. */
export async function getIssueIds(issueNumber: number, repo?: RepoInfo): Promise<GhResult<IssueIds>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.get({
      owner,
      repo: repoName,
      issue_number: issueNumber,
    });
    return {
      number: data.number,
      id: data.id,
      nodeId: data.node_id,
    };
  });
}

/** Create a new issue. */
export async function createIssue(params: {
  title: string;
  body: string;
  labels?: string[];
  milestone?: number;
  assignees?: string[];
}, repo?: RepoInfo): Promise<GhResult<GhIssue>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.create({
      owner,
      repo: repoName,
      title: params.title,
      body: params.body,
      labels: params.labels,
      milestone: params.milestone,
      assignees: params.assignees,
    });
    return mapIssue(data as unknown as Record<string, unknown>);
  });
}

/** Get a single issue by number. */
export async function getIssue(issueNumber: number, repo?: RepoInfo): Promise<GhResult<GhIssue>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.get({
      owner,
      repo: repoName,
      issue_number: issueNumber,
    });
    return mapIssue(data as unknown as Record<string, unknown>);
  });
}

/** Update an issue. */
export async function updateIssue(
  issueNumber: number,
  params: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    stateReason?: 'completed' | 'not_planned';
    labels?: string[];
    milestone?: number | null;
    assignees?: string[];
  },
  repo?: RepoInfo,
): Promise<GhResult<GhIssue>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.update({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      ...params,
      state_reason: params.stateReason,
    });
    return mapIssue(data as unknown as Record<string, unknown>);
  });
}

/** List comments on an issue with pagination. */
export async function listComments(
  issueNumber: number,
  repo?: RepoInfo,
): Promise<GhResult<GhComment[]>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo: repoName,
      issue_number: issueNumber,
      per_page: 100,
    });

    return comments.map((c) => ({
      id: c.id,
      nodeId: c.node_id,
      body: c.body ?? '',
      user: {
        login: c.user?.login ?? '',
        id: c.user?.id ?? 0,
        nodeId: c.user?.node_id ?? '',
        type: (c.user?.type ?? 'User') as 'User' | 'Organization',
      },
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      htmlUrl: c.html_url,
    }));
  });
}

/** Add a comment to an issue. */
export async function addComment(
  issueNumber: number,
  body: string,
  repo?: RepoInfo,
): Promise<GhResult<GhComment>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const { data } = await octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      body,
    });
    return {
      id: data.id,
      nodeId: data.node_id,
      body: data.body ?? '',
      user: {
        login: data.user?.login ?? '',
        id: data.user?.id ?? 0,
        nodeId: data.user?.node_id ?? '',
        type: (data.user?.type ?? 'User') as 'User' | 'Organization',
      },
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      htmlUrl: data.html_url,
    };
  });
}

/** Add a sub-issue to a parent issue. Uses internal numeric IDs. */
export async function addSubIssue(
  parentNumber: number,
  childNumber: number,
  repo?: RepoInfo,
): Promise<GhResult<void>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    // Get the child's internal numeric ID (NOT the issue number)
    const childResult = await octokit.rest.issues.get({
      owner,
      repo: repoName,
      issue_number: childNumber,
    });
    const childInternalId = childResult.data.id;

    // Add as sub-issue using the internal ID
await (octokit.rest.issues as Record<string, (...args: never[]) => Promise<unknown>>).addSubIssue({
      owner,
      repo: repoName,
      issue_number: parentNumber,
      sub_issue_id: childInternalId,
    });
  });
}

/** List sub-issues of a parent issue with pagination. */
export async function listSubIssues(
  parentNumber: number,
  repo?: RepoInfo,
): Promise<GhResult<GhIssue[]>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const subIssues = await octokit.paginate(
    (octokit.rest.issues as Record<string, (...args: never[]) => Promise<unknown>>).listSubIssues as Parameters<typeof octokit.paginate>[0],
      {
        owner,
        repo: repoName,
        issue_number: parentNumber,
        per_page: 100,
      },
    );

    return (subIssues as Record<string, unknown>[]).map(mapIssue);
  });
}

/** Close an issue with a reason. */
export async function closeIssue(
  issueNumber: number,
  reason: 'completed' | 'not_planned' = 'completed',
  repo?: RepoInfo,
): Promise<GhResult<GhIssue>> {
  return updateIssue(issueNumber, { state: 'closed', stateReason: reason }, repo);
}
