/**
 * Init command handlers for the CLI.
 * Namespace: `init <subcommand> [args]`
 *
 * Resolves phase context (config + GitHub) into JSON for workflow scripts.
 * Output is written directly to stdout with process.stdout.write() so callers
 * receive clean JSON without any surrounding whitespace or newlines.
 */

import { cmdOk, cmdErr, AgentType } from '../core/types.js';
import { loadConfig, resolveModel } from '../core/config.js';
import { listIssues, listSubIssues, listComments } from '../github/issues.js';
import { parseCommentMeta } from '../github/comments.js';
import { getPositionalArg, type CommandRegistry } from './types.js';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Derive a URL-safe slug from a phrase. */
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Find the phase issue number from a phase name string like "Phase 1: …" or
 * a title that starts with "Phase <N>" (case-insensitive).
 */
function extractPhaseNameFromTitle(title: string): string {
  // Title format: "Phase 1: CLI Dispatcher & GitHub Integration"
  // Strip the "Phase N: " prefix to get just the name.
  const match = title.match(/^Phase\s+\d+[:\s-]+(.+)$/i);
  return match ? match[1].trim() : title.trim();
}

/**
 * Parse a task number from an issue title.
 * Titles follow the pattern: "[Phase 1 Task 1.1] Some description"
 * Returns null if the title doesn't match.
 */
function parseTaskNumber(title: string): string | null {
  const match = title.match(/\[Phase\s+\d+\s+Task\s+([\d.]+)\]/i);
  return match ? match[1] : null;
}

/**
 * Derive the plan number from a task ID.
 * Task "1.1" → plan 1, task "3.2" → plan 3.
 */
function planNumberFromTaskId(taskId: string): number {
  return parseInt(taskId.split('.')[0], 10);
}

// ── INIT_COMMANDS ────────────────────────────────────────────────────────

export const INIT_COMMANDS: CommandRegistry = {

  // ── Task 4.1: plan-phase ───────────────────────────────────────────────

  'plan-phase': {
    name: 'plan-phase',
    description: 'Resolve planner context for a phase. Usage: plan-phase <phase-number>',
    async handler(args) {
      const phaseArg = getPositionalArg(args, 0);
      if (!phaseArg) return cmdErr('Missing required argument: phase-number');

      const phaseNumber = parseInt(phaseArg, 10);
      if (Number.isNaN(phaseNumber)) return cmdErr('phase-number must be an integer');

      const projectDir = process.cwd();
      const config = loadConfig(projectDir);
      const profile = config.execution.model_profile;
      const overrides = config.execution.model_overrides;

      const plannerModel = resolveModel(profile, AgentType.PLANNER, overrides);
      const researcherModel = resolveModel(profile, AgentType.RESEARCHER, overrides);

      // Find the phase issue
      const issuesResult = await listIssues({ labels: 'type:phase', state: 'open' });
      if (!issuesResult.ok) {
        // Try all states if open search fails
        const allIssuesResult = await listIssues({ labels: 'type:phase', state: 'all' });
        if (!allIssuesResult.ok) {
          process.stdout.write(JSON.stringify({ phase_found: false, phase_number: phaseNumber }));
          return cmdOk(null);
        }
        const phaseIssue = allIssuesResult.data.find((i) =>
          /^Phase\s+\d+/i.test(i.title) && (() => {
            const m = i.title.match(/^Phase\s+(\d+)/i);
            return m ? parseInt(m[1], 10) === phaseNumber : false;
          })(),
        );
        if (!phaseIssue) {
          process.stdout.write(JSON.stringify({ phase_found: false, phase_number: phaseNumber }));
          return cmdOk(null);
        }

        await buildAndWritePlanPhaseResult(
          phaseIssue, phaseNumber, plannerModel, researcherModel, config,
        );
        return cmdOk(null);
      }

      let phaseIssue = issuesResult.data.find((i) => {
        const m = i.title.match(/^Phase\s+(\d+)/i);
        return m ? parseInt(m[1], 10) === phaseNumber : false;
      });

      // Retry with all states if not found among open issues
      if (!phaseIssue) {
        const allIssuesResult = await listIssues({ labels: 'type:phase', state: 'all' });
        if (allIssuesResult.ok) {
          phaseIssue = allIssuesResult.data.find((i) => {
            const m = i.title.match(/^Phase\s+(\d+)/i);
            return m ? parseInt(m[1], 10) === phaseNumber : false;
          });
        }
      }

      if (!phaseIssue) {
        process.stdout.write(JSON.stringify({ phase_found: false, phase_number: phaseNumber }));
        return cmdOk(null);
      }

      await buildAndWritePlanPhaseResult(
        phaseIssue, phaseNumber, plannerModel, researcherModel, config,
      );
      return cmdOk(null);
    },
  },

  // ── Task 4.2a: execute-phase ───────────────────────────────────────────

  'execute-phase': {
    name: 'execute-phase',
    description: 'Resolve executor context for a phase. Usage: execute-phase <phase-number>',
    async handler(args) {
      const phaseArg = getPositionalArg(args, 0);
      if (!phaseArg) return cmdErr('Missing required argument: phase-number');

      const phaseNumber = parseInt(phaseArg, 10);
      if (Number.isNaN(phaseNumber)) return cmdErr('phase-number must be an integer');

      const projectDir = process.cwd();
      const config = loadConfig(projectDir);
      const profile = config.execution.model_profile;
      const overrides = config.execution.model_overrides;

      const executorModel = resolveModel(profile, AgentType.EXECUTOR, overrides);
      const verifierModel = resolveModel(profile, AgentType.VERIFIER, overrides);

      // Find phase issue (open first, then all)
      const phaseIssue = await findPhaseIssue(phaseNumber);
      if (!phaseIssue) {
        process.stdout.write(JSON.stringify({ phase_found: false, phase_number: phaseNumber }));
        return cmdOk(null);
      }

      const phaseName = extractPhaseNameFromTitle(phaseIssue.title);
      const phaseSlug = toSlug(phaseName);

      // Get comments for plan detection and verification check
      const commentsResult = await listComments(phaseIssue.number);
      const comments = commentsResult.ok ? commentsResult.data : [];

      // Parse plan comments
      const planComments = comments
        .map((c) => ({ comment: c, meta: parseCommentMeta(c.body) }))
        .filter(({ meta }) => meta?.type === 'plan');

      // Determine unique plan numbers from comments
      const planNumbersWithContent = new Set<number>();
      for (const { meta } of planComments) {
        if (meta && typeof (meta as Record<string, unknown>).plan === 'number') {
          planNumbersWithContent.add((meta as Record<string, unknown>).plan as number);
        }
      }

      // Check for verification comment
      const hasVerification = comments.some((c) => parseCommentMeta(c.body)?.type === 'verification');

      // Get sub-issues for task mappings
      const subIssuesResult = await listSubIssues(phaseIssue.number);
      const subIssues = subIssuesResult.ok ? subIssuesResult.data : [];

      // Build task mappings from sub-issue titles
      const taskMappings: Array<{ task_id: string; issue_number: number; plan_number: number }> = [];
      for (const sub of subIssues) {
        const taskId = parseTaskNumber(sub.title);
        if (taskId) {
          taskMappings.push({
            task_id: taskId,
            issue_number: sub.number,
            plan_number: planNumberFromTaskId(taskId),
          });
        }
      }

      // Build plan list: plans with comments have content
      const allPlanNumbers = taskMappings.map((t) => t.plan_number);
      const uniquePlanNumbers = [...new Set(allPlanNumbers)].sort((a, b) => a - b);
      const planCount = uniquePlanNumbers.length || planComments.length;

      const plans = uniquePlanNumbers.map((n) => ({
        plan_number: n,
        has_content: planNumbersWithContent.has(n),
      }));

      // Incomplete plans: plans where any sub-issue is still open
      const openTaskPlanNumbers = taskMappings
        .filter((t) => {
          const sub = subIssues.find((s) => s.number === t.issue_number);
          return sub?.state === 'open';
        })
        .map((t) => t.plan_number);
      const incompletePlans = [...new Set(openTaskPlanNumbers)].sort((a, b) => a - b);

      const result = {
        phase_found: true,
        phase_number: phaseNumber,
        phase_name: phaseName,
        phase_slug: phaseSlug,
        phase_dir: '',
        phase_issue_number: phaseIssue.number,
        executor_model: executorModel,
        verifier_model: verifierModel,
        parallelization: {
          max_agents_per_wave: config.execution.parallelism.max_agents_per_wave,
          max_retries: config.execution.parallelism.max_retries,
        },
        plans,
        incomplete_plans: incompletePlans,
        plan_count: planCount,
        incomplete_count: incompletePlans.length,
        has_verification: hasVerification,
        task_mappings: taskMappings,
      };

      process.stdout.write(JSON.stringify(result));
      return cmdOk(null);
    },
  },

  // ── Task 4.2b: phase-op ────────────────────────────────────────────────

  'phase-op': {
    name: 'phase-op',
    description: 'Resolve minimal verification context for a phase. Usage: phase-op <phase-number>',
    async handler(args) {
      const phaseArg = getPositionalArg(args, 0);
      if (!phaseArg) return cmdErr('Missing required argument: phase-number');

      const phaseNumber = parseInt(phaseArg, 10);
      if (Number.isNaN(phaseNumber)) return cmdErr('phase-number must be an integer');

      const projectDir = process.cwd();
      const config = loadConfig(projectDir);
      const profile = config.execution.model_profile;
      const overrides = config.execution.model_overrides;

      const verifierModel = resolveModel(profile, AgentType.VERIFIER, overrides);

      const phaseIssue = await findPhaseIssue(phaseNumber);
      if (!phaseIssue) {
        process.stdout.write(JSON.stringify({ phase_found: false, phase_number: phaseNumber }));
        return cmdOk(null);
      }

      const phaseName = extractPhaseNameFromTitle(phaseIssue.title);

      const result = {
        phase_found: true,
        phase_number: phaseNumber,
        phase_name: phaseName,
        phase_issue_number: phaseIssue.number,
        verifier_model: verifierModel,
      };

      process.stdout.write(JSON.stringify(result));
      return cmdOk(null);
    },
  },
};

// ── Private Helpers ──────────────────────────────────────────────────────

/** Find a phase issue by number, searching open issues first then all. */
async function findPhaseIssue(phaseNumber: number) {
  const openResult = await listIssues({ labels: 'type:phase', state: 'open' });
  if (openResult.ok) {
    const found = openResult.data.find((i) => {
      const m = i.title.match(/^Phase\s+(\d+)/i);
      return m ? parseInt(m[1], 10) === phaseNumber : false;
    });
    if (found) return found;
  }

  const allResult = await listIssues({ labels: 'type:phase', state: 'all' });
  if (!allResult.ok) return null;

  return allResult.data.find((i) => {
    const m = i.title.match(/^Phase\s+(\d+)/i);
    return m ? parseInt(m[1], 10) === phaseNumber : false;
  }) ?? null;
}

/** Build and write the plan-phase JSON result to stdout. */
async function buildAndWritePlanPhaseResult(
  phaseIssue: { number: number; title: string; body: string },
  phaseNumber: number,
  plannerModel: string,
  researcherModel: string,
  config: ReturnType<typeof loadConfig>,
) {
  const phaseName = extractPhaseNameFromTitle(phaseIssue.title);
  const phaseSlug = toSlug(phaseName);

  const commentsResult = await listComments(phaseIssue.number);
  const comments = commentsResult.ok ? commentsResult.data : [];

  const planComments = comments.filter((c) => parseCommentMeta(c.body)?.type === 'plan');
  const researchComments = comments.filter((c) => parseCommentMeta(c.body)?.type === 'research');

  const result = {
    phase_found: true,
    phase_number: phaseNumber,
    phase_name: phaseName,
    phase_slug: phaseSlug,
    phase_issue_number: phaseIssue.number,
    phase_dir: '',
    planner_model: plannerModel,
    researcher_model: researcherModel,
    parallelization: {
      max_agents_per_wave: config.execution.parallelism.max_agents_per_wave,
      max_retries: config.execution.parallelism.max_retries,
    },
    has_plans: planComments.length > 0,
    plan_count: planComments.length,
    has_research: researchComments.length > 0,
  };

  process.stdout.write(JSON.stringify(result));
}
