/**
 * GitHub Issues — CRUD, sub-issues, comments.
 * Uses correct API: node_id for GraphQL, internal .id for REST bodies.
 */

import { getOctokit, getRepoInfo, withGhResult } from './client.js';
import type { GhIssue, GhComment, GhIssueRelation, GhResult, RepoInfo, EscalationPayload } from './types.js';
import { formatCommentHeader } from './comments.js';

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

/** List issues in the repository with optional filtering. */
export async function listIssues(
  params: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    milestone?: number;
  } = {},
  repo?: RepoInfo,
): Promise<GhResult<GhIssue[]>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner,
      repo: repoName,
      state: params.state ?? 'open',
      labels: params.labels,
      milestone: params.milestone !== undefined ? String(params.milestone) : undefined,
      per_page: 100,
    });

    return issues.map((i) => mapIssue(i as unknown as Record<string, unknown>));
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
    const { stateReason, ...rest } = params;
    const { data } = await octokit.rest.issues.update({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      ...rest,
      state_reason: stateReason,
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

/** Update an existing comment on an issue. */
export async function updateComment(
  commentId: number,
  body: string,
  repo?: RepoInfo,
): Promise<GhResult<GhComment>> {
  return withGhResult(async () => {
    const octokit = getOctokit();
    const { owner, repo: repoName } = repo ?? getRepoInfo();
    const { data } = await octokit.rest.issues.updateComment({
      owner,
      repo: repoName,
      comment_id: commentId,
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

/** Delete a comment on an issue. */
export async function deleteComment(
  commentId: number,
  repo?: RepoInfo,
): Promise<GhResult<void>> {
  return withGhResult(async () => {
    const octokit = getOctokit();
    const { owner, repo: repoName } = repo ?? getRepoInfo();
    await octokit.rest.issues.deleteComment({
      owner,
      repo: repoName,
      comment_id: commentId,
    });
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

    // biome-ignore lint/suspicious/noExplicitAny: Octokit types do not yet include sub-issues endpoints
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues' as any, {
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
    // biome-ignore lint/suspicious/noExplicitAny: Octokit types do not yet include sub-issues endpoints
    const subIssues = await octokit.paginate('GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues' as any, {
      owner,
      repo: repoName,
      issue_number: parentNumber,
      per_page: 100,
    });

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

// Maps our public relation type to the GitHub GraphQL enum value.
const RELATION_TYPE_MAP: Record<'blocked_by' | 'blocking', string> = {
  blocking: 'BLOCKS',
  blocked_by: 'IS_BLOCKED_BY',
};

/** Resolve the GraphQL node IDs for two issues in parallel. */
async function resolveIssueNodeIds(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repoName: string,
  issueNumber: number,
  relatedIssueNumber: number,
): Promise<[string, string]> {
  const [issueRes, relatedRes] = await Promise.all([
    octokit.rest.issues.get({ owner, repo: repoName, issue_number: issueNumber }),
    octokit.rest.issues.get({ owner, repo: repoName, issue_number: relatedIssueNumber }),
  ]);
  return [issueRes.data.node_id, relatedRes.data.node_id];
}

/**
 * Add a relation between two issues using the GitHub GraphQL API.
 *
 * GitHub's native "linked issues" are managed via the `addLinkedIssue` mutation.
 * Accepted relation types include BLOCKS, IS_BLOCKED_BY, DUPLICATES, etc.
 */
export async function addIssueRelation(
  issueNumber: number,
  relatedIssueNumber: number,
  type: 'blocked_by' | 'blocking',
  repo?: RepoInfo,
): Promise<GhResult<void>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const [issueNodeId, relatedNodeId] = await resolveIssueNodeIds(
      octokit, owner, repoName, issueNumber, relatedIssueNumber,
    );

    const mutation = `
      mutation AddLinkedIssue($issueId: ID!, $relatedId: ID!, $relationType: LinkedIssueRelationType!) {
        addLinkedIssue(input: { issueId: $issueId, relatedIssueId: $relatedId, relationType: $relationType }) {
          issue { number }
        }
      }
    `;

    // biome-ignore lint/suspicious/noExplicitAny: Octokit REST type lacks .graphql(); cast required
    await (octokit as any).graphql(mutation, {
      issueId: issueNodeId,
      relatedId: relatedNodeId,
      relationType: RELATION_TYPE_MAP[type],
    });
  });
}

/** Remove a relation between two issues using the GitHub GraphQL API. */
export async function removeIssueRelation(
  issueNumber: number,
  relatedIssueNumber: number,
  type: 'blocked_by' | 'blocking',
  repo?: RepoInfo,
): Promise<GhResult<void>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const [issueNodeId, relatedNodeId] = await resolveIssueNodeIds(
      octokit, owner, repoName, issueNumber, relatedIssueNumber,
    );

    const mutation = `
      mutation RemoveLinkedIssue($issueId: ID!, $relatedId: ID!, $relationType: LinkedIssueRelationType!) {
        removeLinkedIssue(input: { issueId: $issueId, relatedIssueId: $relatedId, relationType: $relationType }) {
          issue { number }
        }
      }
    `;

    // biome-ignore lint/suspicious/noExplicitAny: Octokit REST type lacks .graphql(); cast required
    await (octokit as any).graphql(mutation, {
      issueId: issueNodeId,
      relatedId: relatedNodeId,
      relationType: RELATION_TYPE_MAP[type],
    });
  });
}

/** List all relations for an issue using the GitHub GraphQL `linkedIssues` field. */
export async function listIssueRelations(
  issueNumber: number,
  repo?: RepoInfo,
): Promise<GhResult<GhIssueRelation[]>> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const octokit = getOctokit();

  return withGhResult(async () => {
    const query = `
      query ListLinkedIssues($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            blockedBy: linkedIssues(first: 50, type: IS_BLOCKED_BY) {
              nodes { number }
            }
            blocking: linkedIssues(first: 50, type: BLOCKS) {
              nodes { number }
            }
            related: linkedIssues(first: 50, type: RELATED) {
              nodes { number }
            }
          }
        }
      }
    `;

    interface LinkedIssueNodes {
      nodes: Array<{ number: number }>;
    }
    interface GraphQLResponse {
      repository: {
        issue: {
          blockedBy: LinkedIssueNodes;
          blocking: LinkedIssueNodes;
          related: LinkedIssueNodes;
        } | null;
      };
    }

    // biome-ignore lint/suspicious/noExplicitAny: Octokit REST type lacks .graphql(); cast required
    const data: GraphQLResponse = await (octokit as any).graphql(query, {
      owner,
      repo: repoName,
      number: issueNumber,
    });

    const issue = data?.repository?.issue;
    if (!issue) return [];

    const toRelations = (
      nodes: Array<{ number: number }>,
      type: GhIssueRelation['type'],
    ): GhIssueRelation[] =>
      nodes.map((node) => ({ issueNumber, relatedIssueNumber: node.number, type }));

    return [
      ...toRelations(issue.blockedBy?.nodes ?? [], 'blocked_by'),
      ...toRelations(issue.blocking?.nodes ?? [], 'blocking'),
      ...toRelations(issue.related?.nodes ?? [], 'related'),
    ];
  });
}

/** Create a structured escalation issue from a payload. */
export async function createEscalationIssue(
  payload: EscalationPayload,
  repo?: RepoInfo,
): Promise<GhResult<GhIssue>> {
  const header = formatCommentHeader({
    type: 'escalation',
    phase: payload.phaseNumber,
    task: payload.taskNumber,
  });

  const attemptsSummary = payload.attempts
    .map(
      (a) =>
        `### Attempt ${a.attemptNumber}\n- **Summary:** ${a.summary}\n- **Failed gate:** ${a.failedGate}\n- **Error output:**\n\`\`\`\n${a.errorOutput}\n\`\`\``,
    )
    .join('\n\n');

  const body = [
    header,
    '',
    '## Original Spec',
    '',
    `> ${payload.taskSpec.split('\n').join('\n> ')}`,
    '',
    '## Attempt Summaries',
    '',
    attemptsSummary,
    '',
    '## Root Cause',
    '',
    `**${payload.rootCause}**`,
    '',
    '## Proposed Next Step',
    '',
    payload.proposedNextStep,
  ].join('\n');

  const result = await createIssue(
    {
      title: `[Escalation] ${payload.taskTitle}`,
      body,
      labels: ['type:bug', 'maxsim:auto'],
    },
    repo,
  );

  // Add cross-reference comment on the parent issue if provided
  if (result.ok && payload.parentIssueNumber) {
    await addComment(
      payload.parentIssueNumber,
      `Escalation issue created: #${result.data.number}`,
      repo,
    );
  }

  return result;
}
