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
  const query = `
    query($owner: String!, $repo: String!, $first: Int!${hasCategory ? ', $categoryId: ID!' : ''}) {
      repository(owner: $owner, name: $repo) {
        discussions(first: $first${hasCategory ? ', categoryId: $categoryId' : ''}) {
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

  const result = ghJson<{
    data: { repository: { discussions: { nodes: RawDiscussion[] } } };
  }>(args);

  if (!result.ok) return result;

  const nodes = result.data?.data?.repository?.discussions?.nodes ?? [];
  return { ok: true, data: nodes.map(mapDiscussion) };
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
