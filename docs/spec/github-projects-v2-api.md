# GitHub Projects v2 API — Complete Technical Reference

> **Last updated:** March 2026
> **API Version:** `2022-11-28` (REST header), GraphQL endpoint `https://api.github.com/graphql`
> **Scope:** GitHub Projects v2 (ProjectV2) — REST API, GraphQL API, `gh` CLI, Sub-Issues, Milestones

---

## Table of Contents

1. [Projects v1 vs v2 — Key Differences](#1-projects-v1-vs-v2--key-differences)
2. [Authentication & Token Scopes](#2-authentication--token-scopes)
3. [Node IDs vs Numeric IDs](#3-node-ids-vs-numeric-ids)
4. [Creating a Projects v2 Board](#4-creating-a-projects-v2-board)
5. [Listing Projects v2 Boards](#5-listing-projects-v2-boards)
6. [Adding Items to a Project](#6-adding-items-to-a-project)
7. [Querying Project Items with Pagination](#7-querying-project-items-with-pagination)
8. [Moving Items Between Status Columns](#8-moving-items-between-status-columns)
9. [Managing Single-Select Field Options](#9-managing-single-select-field-options)
10. [Managing Project Fields (REST)](#10-managing-project-fields-rest)
11. [Managing Project Views (REST)](#11-managing-project-views-rest)
12. [Sub-Issues API](#12-sub-issues-api)
13. [Milestones with Projects v2](#13-milestones-with-projects-v2)
14. [Rate Limiting](#14-rate-limiting)
15. [Complete gh CLI Reference](#15-complete-gh-cli-reference)
16. [Using Octokit with Projects v2](#16-using-octokit-with-projects-v2)
17. [Common Workflows & Patterns](#17-common-workflows--patterns)

---

## 1. Projects v1 vs v2 — Key Differences

### Architecture

| Aspect | Projects v1 (Classic) | Projects v2 |
|--------|----------------------|-------------|
| API type | REST only | GraphQL primary; REST added Sept 2025 |
| Scoping | Tied to a single repository or org | Independent of repos; can span multiple repos |
| Structure | Columns containing cards | Items with fields; views group by field values |
| Fields | Fixed: To Do / In Progress / Done | Fully customizable (text, number, date, single-select, iteration, assignees, labels, milestone, etc.) |
| GraphQL object | `project` | `projectV2` |
| Node IDs | Different encoding | New global node IDs (prefixed `PVT_` for projects) |
| Title uniqueness | Must be unique | Not required to be unique |

### Sunset Timeline

- **May 23, 2024**: New classic project creation disabled; migration banners shown
- **August 23, 2024**: Classic projects on GitHub.com sunset; unmigrated projects auto-converted
- **April 1, 2025**: Classic Projects REST API sunset (`/projects`, `/repos/{owner}/{repo}/projects`, `/orgs/{org}/projects` endpoints removed)
- **June 3, 2025**: Classic projects removed from GitHub Enterprise Server 3.17+

### API Naming History

The ProjectV2 API went through several naming iterations:
- "Projects Beta" / "Projects Next" → `projectNext` GraphQL field (deprecated)
- Now: `projectV2` GraphQL field (stable)

**Migration note**: If you used the old `projectNext` query, you **must** replace it with `projectV2`. The node IDs are incompatible — you cannot use a `projectNext` ID with `projectV2` queries and vice versa. You no longer need the `GraphQL-Features: projects_next_graphql` preview header.

---

## 2. Authentication & Token Scopes

### Required Scopes

| Operation | Minimum Scope |
|-----------|--------------|
| Read projects (queries) | `read:project` |
| Create/update/delete projects (mutations) | `project` |
| Access private repo content in project items | `repo` |
| Organization-level operations | `read:org` |
| Full automation (recommended) | `project`, `read:org`, `repo` |

The `project` scope is a superset of `read:project`.

### Personal Access Token (Classic)

```bash
# Verify current scopes
gh auth status

# Add project scope interactively
gh auth refresh -s project

# Create a PAT with required scopes at:
# https://github.com/settings/tokens/new?scopes=project,read:org,repo
```

### GitHub App / Installation Token

GitHub Apps require the following permissions:
- **Projects**: Read / Read and write
- **Issues**: Read (to add issues to projects)
- **Pull requests**: Read (to add PRs to projects)
- **Members**: Read (for org-level operations)

Installation tokens are scoped to the installation's repositories by default. For organization-owned projects, the app must be installed at the organization level.

### Authorization Header

```bash
# REST API
curl -H "Authorization: Bearer ghp_yourtoken" \
     -H "X-GitHub-Api-Version: 2022-11-28" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/...

# GraphQL API
curl -H "Authorization: bearer ghp_yourtoken" \
     -H "Content-Type: application/json" \
     https://api.github.com/graphql
```

**Note**: For JWTs (GitHub App authentication), use `Authorization: Bearer`. For PATs, both `Bearer` and `token` prefixes are accepted.

---

## 3. Node IDs vs Numeric IDs

Understanding when to use each ID type is critical for Projects v2 API usage.

### Numeric IDs

- Simple integers (e.g., project number `42`, issue number `123`)
- Used in REST API URL paths
- Human-readable and stable
- Examples: `/orgs/myorg/projectsV2/42`, `/repos/owner/repo/issues/123`

### Node IDs (Global IDs)

- Base64-encoded global identifiers
- Used in ALL GraphQL operations
- Format examples:
  - Project: `PVT_kwDOBQfyVc0FoQ`
  - Issue: `I_kwDOBQfyVc5abc123`
  - User: `U_kgDOBQfyVc`
  - Organization: `O_kgDOBQfyVc`
- Also returned by REST API in the `node_id` field of response objects

### How to Get Node IDs

**From REST API response** (the `node_id` field is always present):
```bash
curl -H "Authorization: Bearer TOKEN" \
  https://api.github.com/repos/OWNER/REPO/issues/123
# Response includes: "node_id": "I_kwDOBQfyVc5abc123"
```

**Via GraphQL query**:
```graphql
query {
  organization(login: "my-org") {
    projectV2(number: 42) {
      id        # This is the node ID
      number    # This is the numeric project number
    }
  }
}
```

**Via gh CLI**:
```bash
gh project view 42 --owner my-org --format json | jq -r '.id'
```

### New Global Node IDs

GitHub migrated to new global node IDs. If you are storing IDs from older API calls, you can request new-format IDs by adding the `X-Github-Next-Global-ID: 1` header to REST requests. GraphQL always returns the new format.

---

## 4. Creating a Projects v2 Board

### Via GraphQL API (Primary Method)

Project creation is only available via GraphQL — there is no REST endpoint for creating projects.

**Step 1: Get the owner's node ID**

For an organization:
```graphql
query {
  organization(login: "my-org") {
    id
  }
}
```

For a user:
```graphql
query {
  user(login: "my-username") {
    id
  }
}
```

Or use the authenticated user:
```graphql
query {
  viewer {
    id
    login
  }
}
```

**Step 2: Create the project**

```graphql
mutation CreateProject($ownerId: ID!, $title: String!) {
  createProjectV2(input: {
    ownerId: $ownerId
    title: $title
  }) {
    projectV2 {
      id
      number
      title
      url
    }
  }
}
```

Variables:
```json
{
  "ownerId": "O_kgDOBQfyVc",
  "title": "My New Project"
}
```

**Example with curl**:
```bash
# Get org node ID
ORG_ID=$(curl -s -X POST \
  -H "Authorization: bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/graphql \
  -d '{"query": "query { organization(login: \"my-org\") { id } }"}' \
  | jq -r '.data.organization.id')

# Create project
curl -s -X POST \
  -H "Authorization: bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/graphql \
  -d "{\"query\": \"mutation { createProjectV2(input: {ownerId: \\\"$ORG_ID\\\", title: \\\"My Project\\\"}) { projectV2 { id number title } } }\"}"
```

### Via gh CLI

```bash
# Create project for current authenticated user
gh project create --title "My Project"

# Create project for an organization
gh project create --owner my-org --title "Team Roadmap"

# Create and immediately open in browser
gh project create --owner my-org --title "Sprint Board" --web
```

The CLI returns the project number and URL.

---

## 5. Listing Projects v2 Boards

### REST API

**List organization projects**:
```
GET /orgs/{org}/projectsV2
```

Parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `org` | string (path) | required | Organization login |
| `q` | string (query) | — | Filter by project type |
| `before` | string (query) | — | Cursor for backward pagination |
| `after` | string (query) | — | Cursor for forward pagination |
| `per_page` | integer (query) | 30 | Results per page (max 100) |

```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/orgs/my-org/projectsV2
```

**Get specific organization project**:
```
GET /orgs/{org}/projectsV2/{project_number}
```

```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/orgs/my-org/projectsV2/42
```

**List user projects**:
```
GET /users/{username}/projectsV2
```

**Get specific user project**:
```
GET /users/{username}/projectsV2/{project_number}
```

The REST response object for a project includes:
```json
{
  "id": 12345,
  "node_id": "PVT_kwDOBQfyVc0FoQ",
  "number": 42,
  "title": "My Project",
  "description": "...",
  "owner": { ... },
  "creator": { ... },
  "public": true,
  "closed": false,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-06-01T00:00:00Z",
  "status_updates": [ ... ]
}
```

### GraphQL API

**List organization projects** (with pagination):
```graphql
query ListOrgProjects($org: String!, $cursor: String) {
  organization(login: $org) {
    projectsV2(first: 20, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        number
        title
        url
        closed
        public
        createdAt
        updatedAt
      }
    }
  }
}
```

**Find a specific project by number**:
```graphql
query GetProject($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      id
      title
      number
      url
      shortDescription
      readme
      public
      closed
    }
  }
}
```

**List user projects**:
```graphql
query ListUserProjects($username: String!) {
  user(login: $username) {
    projectsV2(first: 20) {
      nodes {
        id
        number
        title
        url
      }
    }
  }
}
```

### gh CLI

```bash
# List projects for current user
gh project list

# List projects for an organization
gh project list --owner my-org

# List including closed projects
gh project list --owner my-org --closed

# Output as JSON (useful for scripting)
gh project list --owner my-org --format json

# Limit results
gh project list --owner my-org --limit 50
```

---

## 6. Adding Items to a Project

### REST API

**Add an issue or pull request** (org project):
```
POST /orgs/{org}/projectsV2/{project_number}/items
```

Request body:
```json
{
  "type": "Issue",
  "id": 123456789
}
```

The `id` is the **numeric** REST API issue/PR ID (from `GET /repos/{owner}/{repo}/issues/{number}` → `.id` field), not the issue number.

```bash
# Get the issue's internal ID
ISSUE_ID=$(curl -s \
  -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/my-org/my-repo/issues/42 \
  | jq -r '.id')

# Add issue to project
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/orgs/my-org/projectsV2/5/items \
  -d "{\"type\": \"Issue\", \"id\": $ISSUE_ID}"
```

Supported `type` values: `Issue`, `PullRequest`, `DraftIssue`

For user-owned projects:
```
POST /users/{username}/projectsV2/{project_number}/items
```

### GraphQL API

**Add an existing issue or PR** (using node IDs):
```graphql
mutation AddItem($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {
    projectId: $projectId
    contentId: $contentId
  }) {
    item {
      id
      content {
        ... on Issue {
          number
          title
        }
        ... on PullRequest {
          number
          title
        }
      }
    }
  }
}
```

Variables:
```json
{
  "projectId": "PVT_kwDOBQfyVc0FoQ",
  "contentId": "I_kwDOBQfyVc5abc123"
}
```

**Add a draft issue** (project-only item, not linked to a repo issue):
```graphql
mutation AddDraftIssue($projectId: ID!, $title: String!, $body: String) {
  addProjectV2DraftIssue(input: {
    projectId: $projectId
    title: $title
    body: $body
  }) {
    projectItem {
      id
    }
  }
}
```

**Important constraint**: You cannot add an item and update its fields in the same GraphQL call. You must first add the item to get its `item.id`, then call `updateProjectV2ItemFieldValue` in a separate request.

### gh CLI

```bash
# Add an issue to a project by URL
gh project item-add 5 --owner my-org --url https://github.com/my-org/my-repo/issues/42

# Add a PR to a project
gh project item-add 5 --owner my-org --url https://github.com/my-org/my-repo/pull/17

# Get the item ID from JSON output
ITEM_ID=$(gh project item-add 5 --owner my-org \
  --url https://github.com/my-org/my-repo/issues/42 \
  --format json | jq -r '.id')

# Create a new draft issue item directly in the project
gh project item-create 5 --owner my-org --title "Research task" --body "Investigate options"
```

---

## 7. Querying Project Items with Pagination

### REST API

**List items for an org project**:
```
GET /orgs/{org}/projectsV2/{project_number}/items
```

Query parameters:
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `q` | string | — | — | Search/filter query |
| `fields` | string | — | — | Comma-separated field IDs to include |
| `before` | string | — | — | Cursor for backward pagination |
| `after` | string | — | — | Cursor for forward pagination |
| `per_page` | integer | 30 | 100 | Results per page |

Response item object structure:
```json
{
  "id": 789,
  "node_id": "PVTI_lADOBQfyVc0FoQzgA",
  "content_type": "Issue",
  "content": {
    "id": 123456,
    "node_id": "I_kwDO...",
    "number": 42,
    "title": "Fix the bug",
    "state": "open",
    "url": "https://github.com/...",
    "repository": { ... }
  },
  "creator": { "login": "octocat", ... },
  "created_at": "...",
  "updated_at": "...",
  "archived_at": null,
  "fields": [
    {
      "id": 1,
      "name": "Status",
      "value": "In Progress",
      "field_type": "single_select"
    }
  ]
}
```

For user-owned projects:
```
GET /users/{username}/projectsV2/{project_number}/items
```

### GraphQL API — Full Item Query with Pagination

```graphql
query GetProjectItems($projectId: ID!, $cursor: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        totalCount
        nodes {
          id
          isArchived
          createdAt
          updatedAt

          # Field values for all custom fields
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                text
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                startDate
                duration
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldLabelValue {
                labels(first: 10) {
                  nodes {
                    id
                    name
                    color
                  }
                }
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldMilestoneValue {
                milestone {
                  id
                  number
                  title
                  dueOn
                }
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
            }
          }

          # The linked content (issue, PR, or draft issue)
          content {
            __typename
            ... on Issue {
              id
              number
              title
              state
              url
              repository {
                nameWithOwner
              }
              assignees(first: 5) {
                nodes { login }
              }
              labels(first: 10) {
                nodes { name color }
              }
              milestone {
                number
                title
              }
            }
            ... on PullRequest {
              id
              number
              title
              state
              url
              repository {
                nameWithOwner
              }
              assignees(first: 5) {
                nodes { login }
              }
            }
            ... on DraftIssue {
              id
              title
              body
            }
          }
        }
      }
    }
  }
}
```

### Implementing Cursor-Based Pagination

```javascript
async function getAllProjectItems(projectId, graphql) {
  let allItems = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await graphql(`
      query GetItems($projectId: ID!, $cursor: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                content {
                  ... on Issue { number title }
                }
              }
            }
          }
        }
      }
    `, { projectId, cursor });

    const page = result.node.items;
    allItems.push(...page.nodes);
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return allItems;
}
```

**Pagination limits**:
- Maximum items per request: `first: 100` or `last: 100`
- Maximum total nodes per query: 500,000
- Use `first`/`after` for forward pagination, `last`/`before` for backward pagination

### gh CLI

```bash
# List items with JSON output
gh project item-list 5 --owner my-org --format json

# Limit output
gh project item-list 5 --owner my-org --limit 100

# Parse with jq
gh project item-list 5 --owner my-org --format json | jq '.items[]'
```

---

## 8. Moving Items Between Status Columns

In Projects v2, there are no "columns" — instead, a single-select field (typically named "Status") defines the options that appear as columns in board view. Moving an item between columns means updating its Status field value.

### Step 1: Get the Status Field ID and Option IDs

**Via GraphQL**:
```graphql
query GetProjectFields($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
              description
              color
            }
          }
        }
      }
    }
  }
}
```

Response example:
```json
{
  "id": "PVTSSF_lADOBQfyVc0FoQzgA...",
  "name": "Status",
  "options": [
    { "id": "f75ad846", "name": "Todo" },
    { "id": "47fc9ee4", "name": "In Progress" },
    { "id": "98236657", "name": "Done" }
  ]
}
```

**Via gh CLI**:
```bash
gh project field-list 5 --owner my-org --format json | jq '.'
```

### Step 2: Update the Item's Status Field

**GraphQL mutation**:
```graphql
mutation MoveItemToColumn(
  $projectId: ID!
  $itemId: ID!
  $fieldId: ID!
  $optionId: String!
) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: {
      singleSelectOptionId: $optionId
    }
  }) {
    projectV2Item {
      id
    }
  }
}
```

Variables:
```json
{
  "projectId": "PVT_kwDOBQfyVc0FoQ",
  "itemId": "PVTI_lADOBQfyVc0FoQzgA",
  "fieldId": "PVTSSF_lADOBQfyVc0FoQzgA",
  "optionId": "47fc9ee4"
}
```

**Clearing a single-select field** (removes the status value):
```graphql
mutation ClearStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
  clearProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
  }) {
    projectV2Item {
      id
    }
  }
}
```

### Via gh CLI

```bash
# Get field and option IDs
FIELDS=$(gh project field-list 5 --owner my-org --format json)
FIELD_ID=$(echo "$FIELDS" | jq -r '.fields[] | select(.name == "Status") | .id')
OPTION_ID=$(echo "$FIELDS" | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "In Progress") | .id')

# Get the project ID
PROJECT_ID=$(gh project view 5 --owner my-org --format json | jq -r '.id')

# Update the item's status
gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$FIELD_ID" \
  --single-select-option-id "$OPTION_ID"

# Clear a field value
gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$FIELD_ID" \
  --clear
```

### Supported Field Value Types for updateProjectV2ItemFieldValue

| Field type | Value key |
|------------|-----------|
| Text | `text: "value"` |
| Number | `number: 42.0` |
| Date | `date: "2024-12-31"` |
| Single-select | `singleSelectOptionId: "optionId"` |
| Iteration | `iterationId: "iterationId"` |

**Note**: You cannot directly update Assignees, Labels, Milestone, or Repository fields via `updateProjectV2ItemFieldValue`. For those, use the underlying issue/PR mutations (`addAssigneesToAssignable`, `updateIssue`, etc.) — the project fields will reflect those changes automatically.

---

## 9. Managing Single-Select Field Options

### Adding a New Single-Select Field

```graphql
mutation CreateSingleSelectField($projectId: ID!) {
  createProjectV2Field(input: {
    projectId: $projectId
    dataType: SINGLE_SELECT
    name: "Priority"
    singleSelectOptions: [
      { name: "Critical", color: RED, description: "Must fix immediately" }
      { name: "High", color: ORANGE, description: "" }
      { name: "Medium", color: YELLOW, description: "" }
      { name: "Low", color: GREEN, description: "" }
    ]
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        id
        name
        options {
          id
          name
          color
        }
      }
    }
  }
}
```

Valid color values: `GRAY`, `BLUE`, `GREEN`, `YELLOW`, `ORANGE`, `RED`, `PINK`, `PURPLE`

### Updating All Single-Select Field Options at Once

The `updateProjectV2Field` mutation replaces all options in one call (available since December 2024):

```graphql
mutation UpdateFieldOptions($fieldId: ID!, $projectId: ID!) {
  updateProjectV2Field(input: {
    fieldId: $fieldId
    projectId: $projectId
    singleSelectOptions: [
      { name: "Backlog", color: GRAY, description: "" }
      { name: "Ready", color: BLUE, description: "" }
      { name: "In Progress", color: YELLOW, description: "" }
      { name: "In Review", color: ORANGE, description: "" }
      { name: "Done", color: GREEN, description: "" }
    ]
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        id
        name
        options {
          id
          name
          color
        }
      }
    }
  }
}
```

**Important**: This mutation **replaces** all existing options. If you want to add a new option without removing existing ones, you must include all existing options plus the new one in the `singleSelectOptions` array.

### Via REST API (Fields endpoint)

**Create a new field with single-select options**:
```
POST /orgs/{org}/projectsV2/{project_number}/fields
```

Request body:
```json
{
  "name": "Priority",
  "data_type": "single_select",
  "single_select_options": [
    { "name": "Critical", "color": "RED", "description": "Must fix immediately" },
    { "name": "High", "color": "ORANGE", "description": "" },
    { "name": "Medium", "color": "YELLOW", "description": "" },
    { "name": "Low", "color": "GREEN", "description": "" }
  ]
}
```

### Via gh CLI

```bash
# Create a single-select field
gh project field-create 5 --owner my-org \
  --name "Priority" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "Critical,High,Medium,Low"

# List all fields (to see options)
gh project field-list 5 --owner my-org --format json

# Delete a field
gh project field-delete --id FIELD_ID --project-id PROJECT_ID
```

---

## 10. Managing Project Fields (REST)

### List Fields

**Organization project**:
```
GET /orgs/{org}/projectsV2/{project_number}/fields
```

**User project**:
```
GET /users/{username}/projectsV2/{project_number}/fields
```

Both support `before`, `after`, `per_page` pagination parameters.

Response field object includes:
```json
{
  "id": 1,
  "name": "Status",
  "data_type": "single_select",
  "options": [
    { "id": "f75ad846", "name": "Todo", "color": "GRAY" },
    { "id": "47fc9ee4", "name": "In Progress", "color": "YELLOW" }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

Supported `data_type` values:
`text`, `number`, `date`, `single_select`, `iteration`, `assignees`, `linked_pull_requests`, `reviewers`, `labels`, `milestone`, `repository`, `title`, `issue_type`, `parent_issue`, `sub_issues_progress`

### Add Field

```
POST /orgs/{org}/projectsV2/{project_number}/fields
```

Request body:
```json
{
  "name": "Story Points",
  "data_type": "number"
}
```

For iteration fields, include `iteration_configuration`:
```json
{
  "name": "Sprint",
  "data_type": "iteration",
  "iteration_configuration": {
    "start_date": "2024-01-08",
    "duration": 14,
    "iterations": [
      { "title": "Sprint 1", "start_date": "2024-01-08", "duration": 14 }
    ]
  }
}
```

### Get Specific Field

```
GET /orgs/{org}/projectsV2/{project_number}/fields/{field_id}
GET /users/{username}/projectsV2/{project_number}/fields/{field_id}
```

### GraphQL Field Queries

**Get all fields with full details**:
```graphql
query GetProjectFields($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      fields(first: 50) {
        nodes {
          ... on ProjectV2Field {
            id
            name
            dataType
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            dataType
            options {
              id
              name
              color
              description
            }
          }
          ... on ProjectV2IterationField {
            id
            name
            dataType
            configuration {
              duration
              startDay
              iterations {
                id
                title
                startDate
                duration
              }
              completedIterations {
                id
                title
                startDate
                duration
              }
            }
          }
        }
      }
    }
  }
}
```

**Delete a field**:
```graphql
mutation DeleteField($fieldId: ID!) {
  deleteProjectV2Field(input: {
    fieldId: $fieldId
  }) {
    projectV2Field {
      ... on ProjectV2Field {
        id
        name
      }
    }
  }
}
```

---

## 11. Managing Project Views (REST)

Views control how items are displayed (table, board, roadmap) and which fields are visible.

### Create a View

**Organization project**:
```
POST /orgs/{org}/projectsV2/{project_number}/views
```

**User project**:
```
POST /users/{user_id}/projectsV2/{project_number}/views
```

Request body:
```json
{
  "name": "Sprint Board",
  "layout": "board",
  "filter": "is:open",
  "visible_fields": [1, 2, 3]
}
```

Layout options: `table`, `board`, `roadmap`

Response (HTTP 201):
```json
{
  "id": 1,
  "number": 2,
  "name": "Sprint Board",
  "layout": "board",
  "created_at": "...",
  "updated_at": "..."
}
```

Note: The `visible_fields` parameter is not used for `roadmap` layout.

---

## 12. Sub-Issues API

Sub-issues allow creating parent-child hierarchies between issues. This feature is in Public Preview as of 2024 and requires opt-in for some accounts.

**Limit**: 100 sub-issues per parent issue.

### REST API for Sub-Issues

All endpoints use the **parent** issue's `{issue_number}` in the path and the **child** issue's **internal numeric ID** (not the issue number) in the request body.

#### Get a Parent Issue
```
GET /repos/{owner}/{repo}/issues/{issue_number}/parent
```

Response: Parent issue object or HTTP 404 if no parent.

```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/my-org/my-repo/issues/42/parent
```

#### List Sub-Issues of a Parent
```
GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
```

Query parameters: `per_page` (default 30), `page` (default 1)

```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/my-org/my-repo/issues/10/sub_issues
```

#### Add a Sub-Issue
```
POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
```

Request body:
```json
{
  "sub_issue_id": 123456789,
  "replace_parent": false
}
```

- `sub_issue_id`: The **internal numeric ID** of the child issue (from `GET /issues/{number}` → `.id`, NOT `.number`)
- `replace_parent`: If `true`, the sub-issue will be reparented even if it already has a parent

```bash
# Get the child issue's internal ID
CHILD_ID=$(curl -s \
  -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/my-org/my-repo/issues/43 \
  | jq -r '.id')

# Add as sub-issue
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/my-org/my-repo/issues/10/sub_issues \
  -d "{\"sub_issue_id\": $CHILD_ID}"

# Shorthand via gh CLI
gh api /repos/my-org/my-repo/issues/10/sub_issues \
  -X POST \
  -F sub_issue_id=$CHILD_ID
```

#### Remove a Sub-Issue
```
DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue
```

Request body:
```json
{
  "sub_issue_id": 123456789
}
```

Note: The endpoint path is `/sub_issue` (singular), not `/sub_issues`.

```bash
curl -X DELETE \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/my-org/my-repo/issues/10/sub_issue \
  -d "{\"sub_issue_id\": $CHILD_ID}"
```

#### Reprioritize Sub-Issues
```
PATCH /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority
```

Request body (provide one of `after_id` or `before_id`):
```json
{
  "sub_issue_id": 123456789,
  "after_id": 987654321
}
```

```json
{
  "sub_issue_id": 123456789,
  "before_id": 111222333
}
```

- `after_id`: Position the sub-issue after the issue with this internal ID
- `before_id`: Position the sub-issue before the issue with this internal ID

### GraphQL API for Sub-Issues

Sub-issues via GraphQL require the `GraphQL-Features: sub_issues` header.

**Query sub-issues of a parent**:
```graphql
query GetSubIssues($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue {
      title
      number
      subIssues(first: 50) {
        totalCount
        nodes {
          id
          number
          title
          state
          url
        }
      }
      subIssuesSummary {
        total
        completed
        percentCompleted
      }
      parent {
        number
        title
        url
      }
    }
  }
}
```

**Add a sub-issue**:
```graphql
mutation AddSubIssue($issueId: ID!, $subIssueId: ID!) {
  addSubIssue(input: {
    issueId: $issueId
    subIssueId: $subIssueId
  }) {
    issue {
      id
      number
      title
    }
    subIssue {
      id
      number
      title
    }
  }
}
```

**Remove a sub-issue**:
```graphql
mutation RemoveSubIssue($issueId: ID!, $subIssueId: ID!) {
  removeSubIssue(input: {
    issueId: $issueId
    subIssueId: $subIssueId
  }) {
    issue {
      id
      number
    }
    subIssue {
      id
      number
    }
  }
}
```

**Reprioritize a sub-issue**:
```graphql
mutation ReprioritizeSubIssue($issueId: ID!, $subIssueId: ID!, $afterId: ID) {
  reprioritizeSubIssue(input: {
    issueId: $issueId
    subIssueId: $subIssueId
    afterId: $afterId
  }) {
    issue {
      id
      subIssues(first: 50) {
        nodes { number title }
      }
    }
  }
}
```

**Required header for GraphQL sub-issue operations**:
```bash
curl -X POST \
  -H "Authorization: bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "GraphQL-Features: sub_issues" \
  https://api.github.com/graphql \
  -d '{"query": "..."}'

# Via gh CLI
gh api graphql -H "GraphQL-Features: sub_issues" -f query='...'
```

### Sub-Issues Inherit Project and Milestone Settings

When sub-issues are added to a parent issue, they automatically inherit the parent's:
- Project membership (added to the same Projects v2 boards)
- Milestone assignment

This behavior (as of late 2024) means you don't need to separately add each sub-issue to a project if the parent is already in it.

---

## 13. Milestones with Projects v2

Milestones are repository-scoped features (each repo has its own numbered milestones). They integrate with Projects v2 as a built-in field type.

### REST API for Milestones

#### List Milestones
```
GET /repos/{owner}/{repo}/milestones
```

Query parameters:
| Parameter | Values | Default |
|-----------|--------|---------|
| `state` | `open`, `closed`, `all` | `open` |
| `sort` | `due_on`, `completeness` | `due_on` |
| `direction` | `asc`, `desc` | `asc` |
| `per_page` | 1-100 | 30 |
| `page` | integer | 1 |

#### Create Milestone
```
POST /repos/{owner}/{repo}/milestones
```

Request body:
```json
{
  "title": "v1.0 Release",
  "state": "open",
  "description": "Everything for the initial release",
  "due_on": "2024-12-31T00:00:00Z"
}
```

Response (HTTP 201) includes `id`, `number`, `title`, `state`, `open_issues`, `closed_issues`, `due_on`, `created_at`, `updated_at`.

#### Get, Update, Delete Milestones
```
GET    /repos/{owner}/{repo}/milestones/{milestone_number}
PATCH  /repos/{owner}/{repo}/milestones/{milestone_number}
DELETE /repos/{owner}/{repo}/milestones/{milestone_number}
```

PATCH body accepts any combination of: `title`, `state`, `description`, `due_on`.

### Assigning Milestones to Issues/PRs

Via REST:
```bash
curl -X PATCH \
  -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/my-org/my-repo/issues/42 \
  -d '{"milestone": 3}'
```

Via GraphQL:
```graphql
mutation AssignMilestone($issueId: ID!, $milestoneId: ID!) {
  updateIssue(input: {
    id: $issueId
    milestoneId: $milestoneId
  }) {
    issue {
      number
      milestone {
        number
        title
      }
    }
  }
}
```

### Using Milestones in Projects v2 Context

Projects v2 includes a `Milestone` field type that reflects the milestone assigned to each issue/PR. You can:

1. **Filter project views** by milestone using the filter query syntax
2. **Query milestone values** on project items via the `ProjectV2ItemFieldMilestoneValue` fragment
3. **Group by milestone** in table/board views

**Querying items with their milestone in a project**:
```graphql
query ProjectItemsWithMilestone($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          id
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldMilestoneValue {
                milestone {
                  id
                  number
                  title
                  dueOn
                  state
                }
                field {
                  ... on ProjectV2FieldCommon { name }
                }
              }
            }
          }
          content {
            ... on Issue { number title }
          }
        }
      }
    }
  }
}
```

**Setting a milestone via the project item field** (via `clearProjectV2ItemFieldValue` or through the issue itself):
```graphql
# Milestones are set on the issue, not the project item directly.
# Use updateIssue to change an issue's milestone:
mutation SetMilestone($issueId: ID!, $milestoneId: ID!) {
  updateIssue(input: {
    id: $issueId
    milestoneId: $milestoneId
  }) {
    issue {
      number
      milestone { title }
    }
  }
}
```

**Limitation**: Milestones are repo-scoped. A Projects v2 board that spans multiple repositories will show each issue's own repo milestone, but you cannot create a single "cross-repository milestone" natively.

---

## 14. Rate Limiting

### GraphQL API Rate Limits

| Account type | Points per hour | Points per minute |
|--------------|-----------------|-------------------|
| User account (standard) | 5,000 | 2,000 |
| Enterprise Cloud user | 10,000 | 2,000 |
| GitHub App installation (standard) | 5,000 | 2,000 |
| GitHub App installation (with bonuses) | Up to 12,500 | 2,000 |
| Enterprise Cloud GitHub App | 10,000 | 2,000 |
| GitHub Actions GITHUB_TOKEN | 1,000/hour/repo | 2,000 |
| Enterprise GitHub Actions GITHUB_TOKEN | 15,000/hour/repo | 2,000 |

**Concurrent request limit**: 100 requests maximum (shared across REST + GraphQL).

**CPU time limit**: 60 seconds per 60 seconds of real time; max 60 seconds per individual GraphQL query.

**Query cost**:
- Mutations: 5 points each
- Non-mutation queries: 1 point each (for secondary/per-minute calculations)

**Node limit**: Each call cannot exceed 500,000 total nodes.

### Reading Rate Limit Status

**From response headers**:
```
x-ratelimit-limit: 5000
x-ratelimit-remaining: 4750
x-ratelimit-used: 250
x-ratelimit-reset: 1717200000
```

**Via GraphQL rateLimit object** (append to any query):
```graphql
query {
  rateLimit {
    limit
    remaining
    used
    resetAt
    nodeCount
  }
  # ... your actual query
}
```

### REST API Rate Limits

- Primary: 5,000 requests per hour (per authenticated user)
- Secondary: 900 requests per minute per endpoint
- Unauthenticated: 60 requests per hour per IP

### Best Practices

1. **Use GitHub Apps** for production integrations — they provide higher rate limits and fine-grained permissions.
2. **Batch operations**: Combine multiple field reads into one GraphQL query rather than making separate calls.
3. **Cache node IDs**: Project node IDs and field IDs are stable; cache them rather than fetching on every operation.
4. **Check rate limit headers** before large batch operations.
5. **Limit `first`/`last` appropriately**: Request only as many nodes as needed. Very large pages (100 items with many field values) can be slow and complex.
6. **Avoid N+1 queries**: Fetch related data in a single query using nested fields rather than separate queries per item.

---

## 15. Complete gh CLI Reference

### Authentication

```bash
# Login and request project scope
gh auth login
gh auth refresh -s project

# Check current scopes
gh auth status

# Login with specific scopes non-interactively
gh auth login --with-token <<< "$GH_TOKEN"
```

### Project Management Commands

#### `gh project create`
```bash
gh project create \
  --owner OWNER \        # GitHub username or org login (required)
  --title "TITLE"        # Project title (required)
  --format json          # Output as JSON
  --web                  # Open in browser after creating
```

#### `gh project list`
```bash
gh project list \
  --owner OWNER \        # Filter by owner (user or org login)
  --limit 30 \           # Number of results (default: 30)
  --closed \             # Include closed projects
  --format json \        # Output as JSON
  -q '.projects[]'       # jq filter on JSON output
```

#### `gh project view`
```bash
gh project view NUMBER \
  --owner OWNER \        # Owner of the project
  --web \                # Open in browser
  --format json          # JSON output
```

#### `gh project edit`
```bash
gh project edit NUMBER \
  --owner OWNER \
  --title "New Title" \
  --description "New description" \
  --readme "# New README" \
  --visibility public    # or private
```

#### `gh project close`
```bash
gh project close NUMBER --owner OWNER
```

#### `gh project delete`
```bash
gh project delete NUMBER --owner OWNER
```

#### `gh project copy`
```bash
gh project copy NUMBER \
  --source-owner SOURCE_OWNER \
  --target-owner TARGET_OWNER \
  --title "Copy of Project" \
  --drafts                # Include draft issues
```

#### `gh project mark-template`
```bash
gh project mark-template NUMBER --owner OWNER --undo
```

### Field Commands

#### `gh project field-list`
```bash
gh project field-list NUMBER \
  --owner OWNER \
  --limit 100 \
  --format json
```

#### `gh project field-create`
```bash
gh project field-create NUMBER \
  --owner OWNER \
  --name "Priority" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "Low,Medium,High,Critical"

# Available data types:
# TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION
```

#### `gh project field-delete`
```bash
gh project field-delete \
  --id FIELD_NODE_ID \
  --project-id PROJECT_NODE_ID
```

### Item Commands

#### `gh project item-list`
```bash
gh project item-list NUMBER \
  --owner OWNER \
  --limit 100 \
  --format json \
  -q '.items[]'           # jq filter
```

#### `gh project item-add`
```bash
# Add an issue or PR by URL
gh project item-add NUMBER \
  --owner OWNER \
  --url ISSUE_OR_PR_URL \
  --format json

# Common pattern: get the item ID back
ITEM_ID=$(gh project item-add 5 --owner my-org \
  --url "https://github.com/my-org/my-repo/issues/42" \
  --format json | jq -r '.id')
```

#### `gh project item-create`
```bash
# Create a new draft issue in the project
gh project item-create NUMBER \
  --owner OWNER \
  --title "New Task" \
  --body "Description of the task" \
  --format json
```

#### `gh project item-edit`
```bash
# Update a text field
gh project item-edit \
  --id ITEM_NODE_ID \
  --project-id PROJECT_NODE_ID \
  --field-id FIELD_NODE_ID \
  --text "Updated value"

# Update a number field
gh project item-edit --id ID --project-id PID --field-id FID --number 42

# Update a date field
gh project item-edit --id ID --project-id PID --field-id FID --date "2024-12-31"

# Update a single-select field (move to column)
gh project item-edit \
  --id ITEM_NODE_ID \
  --project-id PROJECT_NODE_ID \
  --field-id STATUS_FIELD_ID \
  --single-select-option-id OPTION_ID

# Update an iteration field
gh project item-edit --id ID --project-id PID --field-id FID --iteration-id ITER_ID

# Clear a field value
gh project item-edit --id ID --project-id PID --field-id FID --clear

# Update a draft issue's title/body
gh project item-edit --id ITEM_ID --title "New Title" --body "New Body"
```

#### `gh project item-archive`
```bash
gh project item-archive NUMBER \
  --owner OWNER \
  --id ITEM_NODE_ID

# Unarchive
gh project item-archive NUMBER \
  --owner OWNER \
  --id ITEM_NODE_ID \
  --undo
```

#### `gh project item-delete`
```bash
gh project item-delete NUMBER \
  --owner OWNER \
  --id ITEM_NODE_ID
```

### Linking Commands

```bash
# Link a repository to a project
gh project link NUMBER --owner OWNER --repo OWNER/REPO

# Unlink a repository from a project
gh project unlink NUMBER --owner OWNER --repo OWNER/REPO
```

### gh CLI Output Formatting

All commands that support `--format json` also support:
- `-q <jq-expression>`: Filter JSON output with jq
- `-t <go-template>`: Format output using Go templates

```bash
# Get just the project ID
gh project view 5 --owner my-org --format json | jq -r '.id'

# Get all field IDs and names
gh project field-list 5 --owner my-org --format json \
  | jq -r '.fields[] | "\(.name): \(.id)"'

# Get Status field option IDs
gh project field-list 5 --owner my-org --format json \
  | jq -r '.fields[] | select(.name == "Status") | .options[] | "\(.name): \(.id)"'
```

---

## 16. Using Octokit with Projects v2

### Installation

```bash
npm install @octokit/graphql
# or for REST + GraphQL:
npm install octokit
```

### Authentication and Setup

```javascript
import { graphql } from "@octokit/graphql";

// Personal Access Token
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GH_TOKEN}`,
  },
});

// GitHub App authentication
import { createAppAuth } from "@octokit/auth-app";
const auth = createAppAuth({
  appId: APP_ID,
  privateKey: PRIVATE_KEY,
  installationId: INSTALLATION_ID,
});
const graphqlWithAuth = graphql.defaults({
  request: { hook: auth.hook },
});
```

### Basic Query Example

```javascript
const { organization } = await graphqlWithAuth(`
  query GetProject($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        id
        title
        number
      }
    }
  }
`, {
  org: "my-org",
  number: 5,
});

console.log(organization.projectV2.id);
```

### Mutation Example

```javascript
const { addProjectV2ItemById } = await graphqlWithAuth(`
  mutation AddItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
`, {
  projectId: "PVT_kwDOBQfyVc0FoQ",
  contentId: "I_kwDOBQfyVc5abc123",
});

console.log("Added item:", addProjectV2ItemById.item.id);
```

### Error Handling

```javascript
import { GraphqlResponseError } from "@octokit/graphql";

try {
  const result = await graphqlWithAuth(query, variables);
} catch (error) {
  if (error instanceof GraphqlResponseError) {
    console.error("GraphQL errors:", error.errors);
    console.error("Partial data:", error.data);
    // error.request contains the original query and variables
  } else {
    throw error;
  }
}
```

### TypeScript Types

```typescript
import type { GraphQlQueryResponseData } from "@octokit/graphql";

interface ProjectItem {
  id: string;
  content: {
    __typename: string;
    number: number;
    title: string;
  };
}

const result = await graphqlWithAuth<{
  node: {
    items: {
      nodes: ProjectItem[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
    };
  };
}>(query, variables);
```

### REST API with Octokit

```javascript
import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GH_TOKEN });

// List org projects
const { data: projects } = await octokit.request(
  "GET /orgs/{org}/projectsV2",
  {
    org: "my-org",
    headers: { "X-GitHub-Api-Version": "2022-11-28" },
  }
);

// Add item to project
const { data: item } = await octokit.request(
  "POST /orgs/{org}/projectsV2/{project_number}/items",
  {
    org: "my-org",
    project_number: 5,
    type: "Issue",
    id: 123456789,
    headers: { "X-GitHub-Api-Version": "2022-11-28" },
  }
);
```

---

## 17. Common Workflows & Patterns

### Pattern 1: Automatically Add New Issues to a Project

Complete GitHub Actions workflow:

```yaml
name: Add Issues to Project
on:
  issues:
    types: [opened]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - name: Add issue to project
        env:
          GH_TOKEN: ${{ secrets.PROJECT_PAT }}
          ISSUE_URL: ${{ github.event.issue.html_url }}
        run: |
          # Add issue and capture item ID
          ITEM_ID=$(gh project item-add 5 \
            --owner my-org \
            --url "$ISSUE_URL" \
            --format json | jq -r '.id')

          # Get project and field IDs
          PROJECT_ID=$(gh project view 5 --owner my-org --format json | jq -r '.id')
          FIELDS=$(gh project field-list 5 --owner my-org --format json)
          STATUS_FIELD_ID=$(echo "$FIELDS" | jq -r '.fields[] | select(.name == "Status") | .id')
          TODO_OPTION_ID=$(echo "$FIELDS" | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "Todo") | .id')

          # Set status to Todo
          gh project item-edit \
            --id "$ITEM_ID" \
            --project-id "$PROJECT_ID" \
            --field-id "$STATUS_FIELD_ID" \
            --single-select-option-id "$TODO_OPTION_ID"
```

### Pattern 2: Full GraphQL Workflow — Add Issue and Set Status

```bash
GH_TOKEN="your-token"
ORG="my-org"
PROJECT_NUM=5
REPO="my-repo"
ISSUE_NUM=42

# Step 1: Get all required node IDs in one query
QUERY='
query GetProjectInfo($org: String!, $projectNum: Int!, $repo: String!, $issueNum: Int!) {
  organization(login: $org) {
    projectV2(number: $projectNum) {
      id
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
    repository(name: $repo) {
      issue(number: $issueNum) {
        id
      }
    }
  }
}'

RESULT=$(curl -s -X POST \
  -H "Authorization: bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/graphql \
  -d "$(jq -n --arg query "$QUERY" --argjson vars '{"org":"my-org","projectNum":5,"repo":"my-repo","issueNum":42}' '{query: $query, variables: $vars}')")

PROJECT_ID=$(echo "$RESULT" | jq -r '.data.organization.projectV2.id')
ISSUE_ID=$(echo "$RESULT" | jq -r '.data.organization.repository.issue.id')
STATUS_FIELD_ID=$(echo "$RESULT" | jq -r '.data.organization.projectV2.fields.nodes[] | select(.name == "Status") | .id')
IN_PROGRESS_ID=$(echo "$RESULT" | jq -r '.data.organization.projectV2.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "In Progress") | .id')

# Step 2: Add issue to project
ITEM_ID=$(curl -s -X POST \
  -H "Authorization: bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/graphql \
  -d "{\"query\": \"mutation { addProjectV2ItemById(input: {projectId: \\\"$PROJECT_ID\\\", contentId: \\\"$ISSUE_ID\\\"}) { item { id } } }\"}" \
  | jq -r '.data.addProjectV2ItemById.item.id')

# Step 3: Set status field
curl -s -X POST \
  -H "Authorization: bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/graphql \
  -d "{\"query\": \"mutation { updateProjectV2ItemFieldValue(input: {projectId: \\\"$PROJECT_ID\\\", itemId: \\\"$ITEM_ID\\\", fieldId: \\\"$STATUS_FIELD_ID\\\", value: {singleSelectOptionId: \\\"$IN_PROGRESS_ID\\\"}}) { projectV2Item { id } } }\"}"
```

### Pattern 3: Bulk Add Issues from a Repo to a Project

```bash
#!/bin/bash
OWNER="my-org"
REPO="my-repo"
PROJECT_NUM=5

# Get all open issues from the repo
ISSUES=$(gh issue list --repo "$OWNER/$REPO" --state open --json url --jq '.[].url')

# Add each issue to the project
while IFS= read -r url; do
  echo "Adding: $url"
  gh project item-add "$PROJECT_NUM" --owner "$OWNER" --url "$url"
done <<< "$ISSUES"
```

### Pattern 4: Archive Done Items

```graphql
# First query all Done items
query GetDoneItems($projectId: ID!, $statusFieldId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          id
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2FieldCommon { id }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

Then archive each Done item:
```graphql
mutation ArchiveItem($projectId: ID!, $itemId: ID!) {
  archiveProjectV2Item(input: {
    projectId: $projectId
    itemId: $itemId
  }) {
    item {
      id
      isArchived
    }
  }
}
```

### Pattern 5: Create Issue Hierarchy with Sub-Issues

```bash
#!/bin/bash
OWNER="my-org"
REPO="my-repo"
GH_TOKEN="your-token"

# Create parent epic issue
PARENT_NUM=$(gh issue create \
  --repo "$OWNER/$REPO" \
  --title "Epic: Implement Feature X" \
  --body "Parent epic for Feature X" \
  --label "epic" \
  --json number --jq '.number')

# Get parent's internal ID
PARENT_ID=$(gh api /repos/$OWNER/$REPO/issues/$PARENT_NUM --jq '.id')

# Create sub-issues
TASKS=("Design the UI" "Implement backend" "Write tests" "Write documentation")

for task in "${TASKS[@]}"; do
  CHILD_NUM=$(gh issue create \
    --repo "$OWNER/$REPO" \
    --title "$task" \
    --body "Sub-issue of Epic #$PARENT_NUM" \
    --json number --jq '.number')

  CHILD_ID=$(gh api /repos/$OWNER/$REPO/issues/$CHILD_NUM --jq '.id')

  # Add as sub-issue
  gh api /repos/$OWNER/$REPO/issues/$PARENT_NUM/sub_issues \
    -X POST \
    -F sub_issue_id="$CHILD_ID"

  echo "Added '#$CHILD_NUM: $task' as sub-issue of #$PARENT_NUM"
done
```

### Pattern 6: Update Project Settings

```graphql
mutation UpdateProject($projectId: ID!) {
  updateProjectV2(input: {
    projectId: $projectId
    title: "Updated Project Title"
    public: true
    readme: "# Project README\n\nDetailed description here."
    shortDescription: "Short one-liner description"
    closed: false
  }) {
    projectV2 {
      id
      title
      public
      readme
      shortDescription
    }
  }
}
```

### Pattern 7: Delete a Project

```graphql
mutation DeleteProject($projectId: ID!) {
  deleteProjectV2(input: {
    projectId: $projectId
  }) {
    projectV2 {
      id
      title
    }
  }
}
```

---

## Quick Reference

### GraphQL Endpoint
```
POST https://api.github.com/graphql
```

### REST Base URL
```
https://api.github.com
```

### Key REST Endpoints (Projects v2)

| Operation | Method | Path |
|-----------|--------|------|
| List org projects | GET | `/orgs/{org}/projectsV2` |
| Get org project | GET | `/orgs/{org}/projectsV2/{number}` |
| List user projects | GET | `/users/{username}/projectsV2` |
| Get user project | GET | `/users/{username}/projectsV2/{number}` |
| List project items | GET | `/orgs/{org}/projectsV2/{number}/items` |
| Add item to project | POST | `/orgs/{org}/projectsV2/{number}/items` |
| Update project item | PATCH | `/orgs/{org}/projectsV2/{number}/items/{item_id}` |
| List project fields | GET | `/orgs/{org}/projectsV2/{number}/fields` |
| Add project field | POST | `/orgs/{org}/projectsV2/{number}/fields` |
| Get project field | GET | `/orgs/{org}/projectsV2/{number}/fields/{field_id}` |
| Create project view | POST | `/orgs/{org}/projectsV2/{number}/views` |
| List sub-issues | GET | `/repos/{owner}/{repo}/issues/{number}/sub_issues` |
| Add sub-issue | POST | `/repos/{owner}/{repo}/issues/{number}/sub_issues` |
| Remove sub-issue | DELETE | `/repos/{owner}/{repo}/issues/{number}/sub_issue` |
| Get parent issue | GET | `/repos/{owner}/{repo}/issues/{number}/parent` |
| Reprioritize sub-issue | PATCH | `/repos/{owner}/{repo}/issues/{number}/sub_issues/priority` |
| List milestones | GET | `/repos/{owner}/{repo}/milestones` |
| Create milestone | POST | `/repos/{owner}/{repo}/milestones` |

### Key GraphQL Mutations (Projects v2)

| Mutation | Purpose |
|----------|---------|
| `createProjectV2` | Create a new project |
| `updateProjectV2` | Update project settings |
| `deleteProjectV2` | Delete a project |
| `addProjectV2ItemById` | Add issue/PR to project |
| `addProjectV2DraftIssue` | Add a draft issue to project |
| `updateProjectV2ItemFieldValue` | Update a field value on an item |
| `clearProjectV2ItemFieldValue` | Clear a field value on an item |
| `archiveProjectV2Item` | Archive a project item |
| `unarchiveProjectV2Item` | Unarchive a project item |
| `deleteProjectV2Item` | Remove an item from the project |
| `createProjectV2Field` | Create a new custom field |
| `updateProjectV2Field` | Update field options (e.g., all single-select options) |
| `deleteProjectV2Field` | Delete a custom field |
| `addSubIssue` | Add a sub-issue (needs `GraphQL-Features: sub_issues` header) |
| `removeSubIssue` | Remove a sub-issue |
| `reprioritizeSubIssue` | Reorder sub-issues |

### Token Scope Quick Reference

```bash
# Minimum for reading
read:project

# Minimum for full CRUD on projects
project

# Recommended for full automation
project read:org repo
```

---

## Sources

- [REST API endpoints for Projects - GitHub Docs](https://docs.github.com/en/rest/projects/projects)
- [REST API endpoints for Project items - GitHub Docs](https://docs.github.com/en/rest/projects/items)
- [REST API endpoints for Project fields - GitHub Docs](https://docs.github.com/en/rest/projects/fields)
- [REST API endpoints for Project views - GitHub Enterprise Cloud Docs](https://docs.github.com/en/enterprise-cloud@latest/rest/projects/views)
- [Using the API to manage Projects - GitHub Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [GraphQL Mutations Reference - GitHub Docs](https://docs.github.com/en/graphql/reference/mutations)
- [Rate limits and query limits for the GraphQL API - GitHub Docs](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- [Using pagination in the GraphQL API - GitHub Docs](https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api)
- [REST API endpoints for sub-issues - GitHub Docs](https://docs.github.com/en/rest/issues/sub-issues?apiVersion=2022-11-28)
- [REST API endpoints for milestones - GitHub Docs](https://docs.github.com/en/rest/issues/milestones?apiVersion=2022-11-28)
- [gh project CLI manual](https://cli.github.com/manual/gh_project)
- [gh project item-edit manual](https://cli.github.com/manual/gh_project_item-edit)
- [A REST API for GitHub Projects - GitHub Changelog (Sept 2025)](https://github.blog/changelog/2025-09-11-a-rest-api-for-github-projects-sub-issues-improvements-and-more/)
- [REST API for sub-issues launch - GitHub Changelog (Dec 2024)](https://github.blog/changelog/2024-12-12-github-issues-projects-close-issue-as-a-duplicate-rest-api-for-sub-issues-and-more/)
- [Sunset Notice - Projects Classic - GitHub Changelog](https://github.blog/changelog/2024-05-23-sunset-notice-projects-classic/)
- [@octokit/graphql README](https://github.com/octokit/graphql.js/blob/main/README.md)
- [Notes about the ProjectV2 API - richkuz (GitHub Gist)](https://gist.github.com/richkuz/e8842fce354edbd4e12dcbfa9ca40ff6)
- [Create GitHub issue hierarchy using the API - Jesse Houwing](https://jessehouwing.net/create-github-issue-hierarchy-using-the-api/)
- [Using GitHub CLI with GitHub Actions for Project automation - Thomas Thornton](https://thomasthornton.cloud/2024/11/14/using-github-cli-with-github-actions-for-github-project-automation/)
