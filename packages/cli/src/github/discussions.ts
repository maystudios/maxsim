/**
 * GitHub Discussions — create, list, and get discussions via GraphQL API.
 * Uses `gh api graphql` through the ghJson/ghExec client wrappers.
 */

import { getRepoInfo, ghJson, ghExec } from './client.js';
import type { GhDiscussion, GhResult, RepoInfo } from './types.js';

// ── Internal GraphQL response shapes ──────────────────────────────────

interface RawDiscussionCategory {
  id: string;
  slug: string;
}

interface RawDiscussion {
  number: number;
  id: string;
  title: string;
  body: string;
  category: { name: string };
  url: string;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function mapDiscussion(raw: RawDiscussion): GhDiscussion {
  return {
    number: raw.number,
    nodeId: raw.id,
    title: raw.title,
    body: raw.body,
    categoryName: raw.category?.name ?? '',
    url: raw.url,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function getCategoryId(
  owner: string,
  repo: string,
  categorySlug: string,
): GhResult<string> {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        discussionCategories(first: 25) {
          nodes {
            id
            slug
          }
        }
      }
    }
  `.trim();

  const result = ghJson<{
    data: {
      repository: {
        discussionCategories: { nodes: RawDiscussionCategory[] };
      };
    };
  }>([
    'api', 'graphql',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `repo=${repo}`,
  ]);

  if (!result.ok) return result;

  const nodes = result.data?.data?.repository?.discussionCategories?.nodes ?? [];
  const category = nodes.find((n) => n.slug === categorySlug);

  if (!category) {
    return {
      ok: false,
      error: `Discussion category with slug "${categorySlug}" not found`,
      code: 'NOT_FOUND',
    };
  }

  return { ok: true, data: category.id };
}

// ── Public API ─────────────────────────────────────────────────────────

export function createDiscussion(
  params: {
    title: string;
    body: string;
    categorySlug: string;
  },
  repo?: RepoInfo,
): GhResult<GhDiscussion> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();

  const nodeIdResult = ghExec(['api', `repos/${owner}/${repoName}`, '-q', '.node_id']);
  if (!nodeIdResult.ok) return nodeIdResult;

  const categoryResult = getCategoryId(owner, repoName, params.categorySlug);
  if (!categoryResult.ok) return categoryResult;

  const mutation = `
    mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
      createDiscussion(input: {
        repositoryId: $repositoryId
        categoryId: $categoryId
        title: $title
        body: $body
      }) {
        discussion {
          number
          id
          title
          body
          category { name }
          url
          createdAt
          updatedAt
        }
      }
    }
  `.trim();

  const result = ghJson<{
    data: { createDiscussion: { discussion: RawDiscussion } };
  }>([
    'api', 'graphql',
    '-f', `query=${mutation}`,
    '-f', `repositoryId=${nodeIdResult.data}`,
    '-f', `categoryId=${categoryResult.data}`,
    '-f', `title=${params.title}`,
    '-f', `body=${params.body}`,
  ]);

  if (!result.ok) return result;

  const discussion = result.data?.data?.createDiscussion?.discussion;
  if (!discussion) {
    return { ok: false, error: 'createDiscussion mutation returned no discussion', code: 'UNKNOWN' };
  }

  return { ok: true, data: mapDiscussion(discussion) };
}

export function listDiscussions(
  params: { categorySlug?: string; first?: number } = {},
  repo?: RepoInfo,
): GhResult<GhDiscussion[]> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const first = params.first ?? 20;

  let categoryId: string | undefined;
  if (params.categorySlug) {
    const categoryResult = getCategoryId(owner, repoName, params.categorySlug);
    if (!categoryResult.ok) return categoryResult;
    categoryId = categoryResult.data;
  }

  const hasCategory = categoryId !== undefined;

  const allNodes: RawDiscussion[] = [];
  let hasNextPage = true;
  let endCursor: string | null = null;

  while (hasNextPage) {
    const afterClause = endCursor ? `, after: $after` : '';
    const afterVar = endCursor ? ', $after: String!' : '';

    const query = `
    query($owner: String!, $repo: String!, $first: Int!${hasCategory ? ', $categoryId: ID!' : ''}${afterVar}) {
      repository(owner: $owner, name: $repo) {
        discussions(first: $first${hasCategory ? ', categoryId: $categoryId' : ''}${afterClause}) {
          nodes {
            number
            id
            title
            body
            category { name }
            url
            createdAt
            updatedAt
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `.trim();

    const args = [
      'api', 'graphql',
      '-f', `query=${query}`,
      '-f', `owner=${owner}`,
      '-f', `repo=${repoName}`,
      '-F', `first=${first}`,
    ];

    if (hasCategory) {
      args.push('-f', `categoryId=${categoryId}`);
    }

    if (endCursor) {
      args.push('-f', `after=${endCursor}`);
    }

    const result = ghJson<{
      data: {
        repository: {
          discussions: {
            nodes: RawDiscussion[];
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        };
      };
    }>(args);

    if (!result.ok) return result;

    const discussions = result.data?.data?.repository?.discussions;
    const nodes = discussions?.nodes ?? [];
    allNodes.push(...nodes);

    const pageInfo = discussions?.pageInfo;
    hasNextPage = pageInfo?.hasNextPage ?? false;
    endCursor = pageInfo?.endCursor ?? null;
  }

  return { ok: true, data: allNodes.map(mapDiscussion) };
}

export function getDiscussion(
  discussionNumber: number,
  repo?: RepoInfo,
): GhResult<GhDiscussion> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();

  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        discussion(number: $number) {
          number
          id
          title
          body
          category { name }
          url
          createdAt
          updatedAt
        }
      }
    }
  `.trim();

  const result = ghJson<{
    data: { repository: { discussion: RawDiscussion | null } };
  }>([
    'api', 'graphql',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `repo=${repoName}`,
    '-F', `number=${discussionNumber}`,
  ]);

  if (!result.ok) return result;

  const discussion = result.data?.data?.repository?.discussion;
  if (!discussion) {
    return {
      ok: false,
      error: `Discussion #${discussionNumber} not found`,
      code: 'NOT_FOUND',
    };
  }

  return { ok: true, data: mapDiscussion(discussion) };
}

export function updateDiscussion(
  id: string,
  opts: { title?: string; body?: string },
): GhResult<GhDiscussion> {
  const mutation = `
    mutation($discussionId: ID!, $title: String, $body: String) {
      updateDiscussion(input: {
        discussionId: $discussionId
        title: $title
        body: $body
      }) {
        discussion {
          number
          id
          title
          body
          category { name }
          url
          createdAt
          updatedAt
        }
      }
    }
  `.trim();

  const args = [
    'api', 'graphql',
    '-f', `query=${mutation}`,
    '-f', `discussionId=${id}`,
  ];

  if (opts.title !== undefined) {
    args.push('-f', `title=${opts.title}`);
  }

  if (opts.body !== undefined) {
    args.push('-f', `body=${opts.body}`);
  }

  const result = ghJson<{
    data: { updateDiscussion: { discussion: RawDiscussion } };
  }>(args);

  if (!result.ok) return result;

  const discussion = result.data?.data?.updateDiscussion?.discussion;
  if (!discussion) {
    return { ok: false, error: 'updateDiscussion mutation returned no discussion', code: 'UNKNOWN' };
  }

  return { ok: true, data: mapDiscussion(discussion) };
}

export function deleteDiscussion(id: string): GhResult<void> {
  const mutation = `
    mutation($id: ID!) {
      deleteDiscussion(input: { id: $id }) {
        clientMutationId
      }
    }
  `.trim();

  const result = ghJson<unknown>([
    'api', 'graphql',
    '-f', `query=${mutation}`,
    '-f', `id=${id}`,
  ]);

  if (!result.ok) return result;

  return { ok: true, data: undefined };
}

export function addDiscussionReply(
  discussionId: string,
  body: string,
): GhResult<{ id: string }> {
  const mutation = `
    mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: {
        discussionId: $discussionId
        body: $body
      }) {
        comment {
          id
        }
      }
    }
  `.trim();

  const result = ghJson<{
    data: { addDiscussionComment: { comment: { id: string } | null } };
  }>([
    'api', 'graphql',
    '-f', `query=${mutation}`,
    '-f', `discussionId=${discussionId}`,
    '-f', `body=${body}`,
  ]);

  if (!result.ok) return result;

  const comment = result.data?.data?.addDiscussionComment?.comment;
  if (!comment) {
    return { ok: false, error: 'addDiscussionComment mutation returned no comment', code: 'UNKNOWN' };
  }

  return { ok: true, data: { id: comment.id } };
}
