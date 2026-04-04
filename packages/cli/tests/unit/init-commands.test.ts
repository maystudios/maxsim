/**
 * Unit tests for INIT_COMMANDS handlers in commands/init.ts.
 *
 * Tests the following commands:
 *   - plan-phase: resolve planner context for a phase
 *   - execute-phase: resolve executor context for a phase
 *   - phase-op: resolve minimal verification context for a phase
 *
 * Strategy: mock the github module (issues, comments), config, and
 * spy on process.stdout.write to capture JSON output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────
// vi.mock() factories are hoisted by Vitest. Variables used inside them must
// be created via vi.hoisted() so they are initialised before the factory runs.

const {
  mockListIssues,
  mockListSubIssues,
  mockListComments,
  mockLoadConfig,
  mockResolveModel,
  stdoutWriteSpy,
} = vi.hoisted(() => ({
  mockListIssues: vi.fn(),
  mockListSubIssues: vi.fn(),
  mockListComments: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockResolveModel: vi.fn(),
  stdoutWriteSpy: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/github/issues.js', () => ({
  listIssues: mockListIssues,
  listSubIssues: mockListSubIssues,
  listComments: mockListComments,
}));

vi.mock('../../src/github/comments.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/github/comments.js')>();
  return { ...actual };
});

vi.mock('../../src/core/config.js', () => ({
  loadConfig: mockLoadConfig,
  resolveModel: mockResolveModel,
}));

// Import after mocks are established.
import { INIT_COMMANDS } from '../../src/commands/init.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Default config returned by loadConfig mock. */
const DEFAULT_TEST_CONFIG = {
  execution: {
    model_profile: 'balanced',
    model_overrides: undefined,
    parallelism: {
      max_agents_per_wave: 3,
      max_retries: 3,
      competition_strategy: 'standard',
    },
    verification: {
      strict_mode: true,
      gates: [],
      require_code_review: true,
      auto_resolve_conflicts: true,
    },
  },
  github: {
    projectName: 'Test Project',
    project_number: 7,
    milestone_number: 1,
    auto_push: true,
  },
};

/** Create a fake GhIssue with the given title and number. */
function fakeIssue(number: number, title: string, state: 'open' | 'closed' = 'open') {
  return {
    number,
    id: number * 100,
    nodeId: `MDExOklzc3Vl${number}`,
    title,
    body: '',
    state,
    stateReason: null,
    labels: [],
    milestone: null,
    assignees: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    htmlUrl: `https://github.com/test/test/issues/${number}`,
  };
}

/** Create a fake GhComment. */
function fakeComment(id: number, body: string) {
  return {
    id,
    nodeId: `MDExOkNvbW1lbnQ${id}`,
    body,
    user: { login: 'bot', id: 0, nodeId: '', type: 'User' as const },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    htmlUrl: `https://github.com/test/test/issues/comments/${id}`,
  };
}

/** Parse the JSON written to stdout by the last call. */
function parseCapturedOutput(): Record<string, unknown> {
  const calls = stdoutWriteSpy.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const lastCall = calls[calls.length - 1][0] as string;
  return JSON.parse(lastCall) as Record<string, unknown>;
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

let originalWrite: typeof process.stdout.write;

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadConfig.mockReturnValue(structuredClone(DEFAULT_TEST_CONFIG));
  mockResolveModel.mockImplementation(
    (_profile: string, agentType: string) => `mock-${agentType}-model`,
  );

  // Spy on process.stdout.write
  originalWrite = process.stdout.write;
  process.stdout.write = stdoutWriteSpy as unknown as typeof process.stdout.write;
});

afterEach(() => {
  process.stdout.write = originalWrite;
});

// ═══════════════════════════════════════════════════════════════════════════════
// plan-phase
// ═══════════════════════════════════════════════════════════════════════════════

describe('plan-phase handler', () => {
  it('happy path: finds phase among open issues and writes correct JSON', async () => {
    const phaseIssue = fakeIssue(100, 'Phase 3: Test Coverage & Error Hardening');
    mockListIssues.mockResolvedValue({ ok: true, data: [phaseIssue] });
    mockListComments.mockResolvedValue({ ok: true, data: [] });

    const result = await INIT_COMMANDS['plan-phase'].handler(['3']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.phase_found).toBe(true);
    expect(output.phase_number).toBe(3);
    expect(output.phase_name).toBe('Test Coverage & Error Hardening');
    expect(output.phase_slug).toBe('test-coverage-error-hardening');
    expect(output.phase_issue_number).toBe(100);
    expect(output.planner_model).toBe('mock-planner-model');
    expect(output.researcher_model).toBe('mock-researcher-model');
    expect(output.parallelization).toEqual({
      max_agents_per_wave: 3,
      max_retries: 3,
    });
    expect(output.has_plans).toBe(false);
    expect(output.plan_count).toBe(0);
    expect(output.has_research).toBe(false);
  });

  it('returns phase_found:false when phase is not found in any issues', async () => {
    mockListIssues.mockResolvedValue({ ok: true, data: [] });

    const result = await INIT_COMMANDS['plan-phase'].handler(['99']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.phase_found).toBe(false);
    expect(output.phase_number).toBe(99);
  });

  it('returns error when argument is NaN', async () => {
    const result = await INIT_COMMANDS['plan-phase'].handler(['abc']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });

  it('returns error when argument is missing', async () => {
    const result = await INIT_COMMANDS['plan-phase'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Missing');
  });

  it('falls back to all-state search when open search returns the wrong phases', async () => {
    const wrongPhase = fakeIssue(50, 'Phase 1: Setup');
    const targetPhase = fakeIssue(60, 'Phase 2: Core', 'closed');

    // First call (open): returns only phase 1
    // Second call (all): returns both
    mockListIssues
      .mockResolvedValueOnce({ ok: true, data: [wrongPhase] })
      .mockResolvedValueOnce({ ok: true, data: [wrongPhase, targetPhase] });
    mockListComments.mockResolvedValue({ ok: true, data: [] });

    const result = await INIT_COMMANDS['plan-phase'].handler(['2']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.phase_found).toBe(true);
    expect(output.phase_number).toBe(2);
    expect(output.phase_issue_number).toBe(60);
  });

  it('falls back to all-state search when open search fails entirely', async () => {
    const targetPhase = fakeIssue(70, 'Phase 5: Final');

    // First call (open): fails
    // Second call (all): succeeds
    mockListIssues
      .mockResolvedValueOnce({ ok: false, error: 'rate limited', code: 'RATE_LIMITED' })
      .mockResolvedValueOnce({ ok: true, data: [targetPhase] });
    mockListComments.mockResolvedValue({ ok: true, data: [] });

    const result = await INIT_COMMANDS['plan-phase'].handler(['5']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.phase_found).toBe(true);
    expect(output.phase_number).toBe(5);
    expect(output.phase_issue_number).toBe(70);
  });

  it('includes plan and research comment counts when they exist', async () => {
    const phaseIssue = fakeIssue(100, 'Phase 1: Init');
    mockListIssues.mockResolvedValue({ ok: true, data: [phaseIssue] });
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        fakeComment(1, '<!-- maxsim:type=plan plan=1 -->\nPlan content'),
        fakeComment(2, '<!-- maxsim:type=plan plan=2 -->\nPlan 2 content'),
        fakeComment(3, '<!-- maxsim:type=research -->\nResearch content'),
        fakeComment(4, 'Regular comment with no metadata'),
      ],
    });

    const result = await INIT_COMMANDS['plan-phase'].handler(['1']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.has_plans).toBe(true);
    expect(output.plan_count).toBe(2);
    expect(output.has_research).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// execute-phase
// ═══════════════════════════════════════════════════════════════════════════════

describe('execute-phase handler', () => {
  it('happy path: finds phase, resolves tasks and plans, writes correct JSON', async () => {
    const phaseIssue = fakeIssue(200, 'Phase 4: Test Coverage & Error Hardening');

    // findPhaseIssue: open search succeeds
    mockListIssues.mockResolvedValue({ ok: true, data: [phaseIssue] });

    // Comments with plan metadata
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        fakeComment(1, '<!-- maxsim:type=plan plan=1 -->\nPlan 1'),
        fakeComment(2, '<!-- maxsim:type=plan plan=2 -->\nPlan 2'),
      ],
    });

    // Sub-issues with task IDs
    mockListSubIssues.mockResolvedValue({
      ok: true,
      data: [
        fakeIssue(301, '[Phase 4 Task 1.1] First task'),
        fakeIssue(302, '[Phase 4 Task 1.2] Second task'),
        fakeIssue(303, '[Phase 4 Task 2.1] Third task', 'closed'),
      ],
    });

    const result = await INIT_COMMANDS['execute-phase'].handler(['4']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.phase_found).toBe(true);
    expect(output.phase_number).toBe(4);
    expect(output.phase_name).toBe('Test Coverage & Error Hardening');
    expect(output.phase_slug).toBe('test-coverage-error-hardening');
    expect(output.phase_issue_number).toBe(200);
    expect(output.executor_model).toBe('mock-executor-model');
    expect(output.verifier_model).toBe('mock-verifier-model');
    expect(output.parallelization).toEqual({
      max_agents_per_wave: 3,
      max_retries: 3,
    });

    // Plan detection
    const plans = output.plans as Array<{ plan_number: number; has_content: boolean }>;
    expect(plans).toHaveLength(2);
    expect(plans[0]).toEqual({ plan_number: 1, has_content: true });
    expect(plans[1]).toEqual({ plan_number: 2, has_content: true });
    expect(output.plan_count).toBe(2);

    // Task mappings
    const taskMappings = output.task_mappings as Array<{
      task_id: string;
      issue_number: number;
      plan_number: number;
    }>;
    expect(taskMappings).toHaveLength(3);
    expect(taskMappings[0]).toEqual({ task_id: '1.1', issue_number: 301, plan_number: 1 });
    expect(taskMappings[1]).toEqual({ task_id: '1.2', issue_number: 302, plan_number: 1 });
    expect(taskMappings[2]).toEqual({ task_id: '2.1', issue_number: 303, plan_number: 2 });

    // Incomplete plans (only plan 1 has open tasks: 301 and 302)
    expect(output.incomplete_plans).toEqual([1]);
    expect(output.incomplete_count).toBe(1);

    // Verification
    expect(output.has_verification).toBe(false);
  });

  it('returns phase_found:false when phase is not found', async () => {
    // findPhaseIssue: open search returns no matching phase, all search also empty
    mockListIssues
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [] });

    const result = await INIT_COMMANDS['execute-phase'].handler(['99']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.phase_found).toBe(false);
    expect(output.phase_number).toBe(99);
  });

  it('detects plan comments and reports which plans have content', async () => {
    const phaseIssue = fakeIssue(200, 'Phase 1: Setup');
    mockListIssues.mockResolvedValue({ ok: true, data: [phaseIssue] });

    // Plan 1 has content comment, plan 2 does not
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        fakeComment(1, '<!-- maxsim:type=plan plan=1 -->\nPlan 1'),
      ],
    });

    mockListSubIssues.mockResolvedValue({
      ok: true,
      data: [
        fakeIssue(401, '[Phase 1 Task 1.1] Task A'),
        fakeIssue(402, '[Phase 1 Task 2.1] Task B'),
      ],
    });

    const result = await INIT_COMMANDS['execute-phase'].handler(['1']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    const plans = output.plans as Array<{ plan_number: number; has_content: boolean }>;
    expect(plans).toHaveLength(2);
    expect(plans.find((p) => p.plan_number === 1)?.has_content).toBe(true);
    expect(plans.find((p) => p.plan_number === 2)?.has_content).toBe(false);
  });

  it('builds task mappings from sub-issue titles', async () => {
    const phaseIssue = fakeIssue(200, 'Phase 2: Build');
    mockListIssues.mockResolvedValue({ ok: true, data: [phaseIssue] });
    mockListComments.mockResolvedValue({ ok: true, data: [] });

    mockListSubIssues.mockResolvedValue({
      ok: true,
      data: [
        fakeIssue(501, '[Phase 2 Task 3.1] Some task'),
        fakeIssue(502, 'Non-standard title without task'),
        fakeIssue(503, '[Phase 2 Task 3.2] Another task'),
      ],
    });

    const result = await INIT_COMMANDS['execute-phase'].handler(['2']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    const taskMappings = output.task_mappings as Array<{
      task_id: string;
      issue_number: number;
      plan_number: number;
    }>;
    // Only 2 tasks match the pattern (502 has non-standard title)
    expect(taskMappings).toHaveLength(2);
    expect(taskMappings[0]).toEqual({ task_id: '3.1', issue_number: 501, plan_number: 3 });
    expect(taskMappings[1]).toEqual({ task_id: '3.2', issue_number: 503, plan_number: 3 });
  });

  it('returns error when argument is missing', async () => {
    const result = await INIT_COMMANDS['execute-phase'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Missing');
  });

  it('returns error when argument is NaN', async () => {
    const result = await INIT_COMMANDS['execute-phase'].handler(['xyz']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });

  it('detects verification comment', async () => {
    const phaseIssue = fakeIssue(200, 'Phase 1: Setup');
    mockListIssues.mockResolvedValue({ ok: true, data: [phaseIssue] });

    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        fakeComment(1, '<!-- maxsim:type=verification -->\nVerification result'),
      ],
    });

    mockListSubIssues.mockResolvedValue({ ok: true, data: [] });

    const result = await INIT_COMMANDS['execute-phase'].handler(['1']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.has_verification).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// phase-op
// ═══════════════════════════════════════════════════════════════════════════════

describe('phase-op handler', () => {
  it('happy path: finds phase and writes minimal context JSON', async () => {
    const phaseIssue = fakeIssue(300, 'Phase 2: Core Implementation');

    // findPhaseIssue: open search succeeds
    mockListIssues.mockResolvedValue({ ok: true, data: [phaseIssue] });

    const result = await INIT_COMMANDS['phase-op'].handler(['2']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.phase_found).toBe(true);
    expect(output.phase_number).toBe(2);
    expect(output.phase_name).toBe('Core Implementation');
    expect(output.phase_issue_number).toBe(300);
    expect(output.verifier_model).toBe('mock-verifier-model');

    // phase-op should NOT include plan-phase or execute-phase fields
    expect(output).not.toHaveProperty('planner_model');
    expect(output).not.toHaveProperty('executor_model');
    expect(output).not.toHaveProperty('parallelization');
    expect(output).not.toHaveProperty('task_mappings');
  });

  it('returns phase_found:false when phase is not found', async () => {
    // findPhaseIssue: open empty, all empty
    mockListIssues
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [] });

    const result = await INIT_COMMANDS['phase-op'].handler(['99']);

    expect(result.ok).toBe(true);

    const output = parseCapturedOutput();
    expect(output.phase_found).toBe(false);
    expect(output.phase_number).toBe(99);
  });

  it('returns error when argument is missing', async () => {
    const result = await INIT_COMMANDS['phase-op'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Missing');
  });
});
