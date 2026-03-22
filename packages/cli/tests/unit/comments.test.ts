import { describe, it, expect } from 'vitest';
import {
  parseIssueMeta,
  parseIssueState,
  parseCommentMeta,
  formatIssueMeta,
  formatIssueState,
  formatCommentHeader,
  buildIssueBody,
} from '../../src/github/comments.js';

describe('parseIssueMeta', () => {
  it('extracts metadata from issue body', () => {
    const body = `<!-- maxsim:meta
type: phase
phase: 3
status: planning
estimate: null
wave: null
created_at: 2026-03-22T10:00:00Z
created_by: maxsim-init
-->

# Phase 3: Authentication

Implement OAuth2 flow.

<!-- maxsim:state
task_ids: [13, 14, 15]
planned_at: null
-->`;

    const meta = parseIssueMeta(body);
    expect(meta).not.toBeNull();
    expect(meta?.type).toBe('phase');
    expect(meta?.phase).toBe(3);
    expect(meta?.status).toBe('planning');
    expect(meta?.createdBy).toBe('maxsim-init');
  });

  it('returns null when no meta block exists', () => {
    expect(parseIssueMeta('Just a plain issue body')).toBeNull();
  });

  it('parses task metadata with parent issue', () => {
    const body = `<!-- maxsim:meta
type: task
phase: 1
task: 3
parent_issue: 42
status: in_progress
estimate: 5
wave: 2
created_at: 2026-03-22T10:00:00Z
created_by: maxsim-plan
-->`;

    const meta = parseIssueMeta(body);
    expect(meta?.type).toBe('task');
    expect(meta?.task).toBe(3);
    expect(meta?.parentIssue).toBe(42);
    expect(meta?.estimate).toBe(5);
    expect(meta?.wave).toBe(2);
  });
});

describe('parseIssueState', () => {
  it('extracts state from issue body', () => {
    const body = `Some content

<!-- maxsim:state
task_ids: [13, 14, 15]
planned_at: 2026-03-22T10:15:00Z
executed_at: null
verified_at: null
executor_branches: ["maxsim/phase-1-task-1", "maxsim/phase-1-task-2"]
worktree_branch: null
verification_passed: true
retry_count: 1
-->`;

    const state = parseIssueState(body);
    expect(state).not.toBeNull();
    expect(state?.taskIds).toEqual([13, 14, 15]);
    expect(state?.plannedAt).toBe('2026-03-22T10:15:00Z');
    expect(state?.executedAt).toBeNull();
    expect(state?.executorBranches).toEqual(['maxsim/phase-1-task-1', 'maxsim/phase-1-task-2']);
    expect(state?.verificationPassed).toBe(true);
    expect(state?.retryCount).toBe(1);
  });

  it('returns null when no state block exists', () => {
    expect(parseIssueState('No state here')).toBeNull();
  });
});

describe('parseCommentMeta', () => {
  it('extracts comment type and attributes', () => {
    const body = `<!-- maxsim:type=plan phase=1 version=1 approved_at=2026-03-22T10:15:00Z -->

## Plan for Phase 1
...`;

    const meta = parseCommentMeta(body);
    expect(meta).not.toBeNull();
    expect(meta?.type).toBe('plan');
    expect(meta?.phase).toBe(1);
    expect(meta?.version).toBe(1);
  });

  it('handles verification comments', () => {
    const body = `<!-- maxsim:type=verification task=3 verdict=PASS retries=0 -->`;
    const meta = parseCommentMeta(body);
    expect(meta?.type).toBe('verification');
    expect(meta?.task).toBe(3);
    expect(meta?.verdict).toBe('PASS');
    expect(meta?.retries).toBe(0);
  });

  it('returns null for non-maxsim comments', () => {
    expect(parseCommentMeta('Just a normal comment')).toBeNull();
  });
});

describe('formatIssueMeta', () => {
  it('generates HTML comment with metadata', () => {
    const meta = {
      type: 'phase' as const,
      phase: 1,
      task: null,
      parentIssue: null,
      status: 'planning',
      estimate: null,
      wave: null,
      createdAt: '2026-03-22T10:00:00Z',
      createdBy: 'maxsim-init',
    };

    const result = formatIssueMeta(meta);
    expect(result).toContain('<!-- maxsim:meta');
    expect(result).toContain('type: phase');
    expect(result).toContain('phase: 1');
    expect(result).toContain('status: planning');
    expect(result).toContain('-->');
  });
});

describe('formatIssueState', () => {
  it('generates HTML comment with state', () => {
    const state = {
      taskIds: [1, 2, 3],
      plannedAt: '2026-03-22T10:00:00Z',
      executedAt: null,
      verifiedAt: null,
      executorBranches: [],
      worktreeBranch: null,
      verificationPassed: null,
      retryCount: 0,
    };

    const result = formatIssueState(state);
    expect(result).toContain('<!-- maxsim:state');
    expect(result).toContain('task_ids: [1,2,3]');
    expect(result).toContain('planned_at: 2026-03-22T10:00:00Z');
    expect(result).toContain('retry_count: 0');
    expect(result).toContain('-->');
  });
});

describe('formatCommentHeader', () => {
  it('generates single-line HTML comment', () => {
    const result = formatCommentHeader({ type: 'plan', phase: 1, version: 2 });
    expect(result).toBe('<!-- maxsim:type=plan phase=1 version=2 -->');
  });

  it('handles type-only comments', () => {
    const result = formatCommentHeader({ type: 'summary' });
    expect(result).toBe('<!-- maxsim:type=summary -->');
  });
});

describe('buildIssueBody', () => {
  it('combines meta, content, and state', () => {
    const meta = {
      type: 'phase' as const,
      phase: 1,
      task: null,
      parentIssue: null,
      status: 'planning',
      estimate: null,
      wave: null,
      createdAt: '2026-03-22T10:00:00Z',
      createdBy: 'maxsim-init',
    };
    const state = {
      taskIds: [],
      plannedAt: null,
      executedAt: null,
      verifiedAt: null,
      executorBranches: [],
      worktreeBranch: null,
      verificationPassed: null,
      retryCount: 0,
    };

    const body = buildIssueBody(meta, '# Phase 1\n\nDo the thing.', state);
    expect(body).toContain('<!-- maxsim:meta');
    expect(body).toContain('# Phase 1');
    expect(body).toContain('<!-- maxsim:state');
  });
});

describe('roundtrip: format → parse', () => {
  it('meta survives roundtrip', () => {
    const original = {
      type: 'task' as const,
      phase: 2,
      task: 5,
      parentIssue: 10,
      status: 'in_progress',
      estimate: 8,
      wave: 3,
      createdAt: '2026-03-22T10:00:00Z',
      createdBy: 'maxsim-execute',
    };

    const formatted = formatIssueMeta(original);
    const parsed = parseIssueMeta(formatted);

    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe(original.type);
    expect(parsed?.phase).toBe(original.phase);
    expect(parsed?.task).toBe(original.task);
    expect(parsed?.parentIssue).toBe(original.parentIssue);
    expect(parsed?.estimate).toBe(original.estimate);
    expect(parsed?.wave).toBe(original.wave);
  });

  it('state survives roundtrip', () => {
    const original = {
      taskIds: [10, 20, 30],
      plannedAt: '2026-03-22T10:00:00Z',
      executedAt: '2026-03-22T11:00:00Z',
      verifiedAt: null,
      executorBranches: ['maxsim/branch-1'],
      worktreeBranch: 'maxsim/wt-1',
      verificationPassed: false,
      retryCount: 2,
    };

    const formatted = formatIssueState(original);
    const parsed = parseIssueState(formatted);

    expect(parsed).not.toBeNull();
    expect(parsed?.taskIds).toEqual(original.taskIds);
    expect(parsed?.plannedAt).toBe(original.plannedAt);
    expect(parsed?.verificationPassed).toBe(false);
    expect(parsed?.retryCount).toBe(2);
  });
});
