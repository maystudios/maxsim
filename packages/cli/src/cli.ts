/**
 * MAXSIM Tools — CLI utility for MAXSIM workflow operations
 *
 * Usage: node maxsim-tools.cjs <command> [args] [--raw]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TimestampFormat, CmdResult } from './core/index.js';

import {
  cmdGitHubSetup,
  cmdGitHubCreatePhase,
  cmdGitHubCreateTask,
  cmdGitHubBatchCreateTasks,
  cmdGitHubPostPlanComment,
  cmdGitHubPostComment,
  cmdGitHubPostCompletion,
  cmdGitHubGetIssue,
  cmdGitHubListSubIssues,
  cmdGitHubCloseIssue,
  cmdGitHubReopenIssue,
  cmdGitHubBounceIssue,
  cmdGitHubMoveIssue,
  cmdGitHubDetectExternalEdits,
  cmdGitHubQueryBoard,
  cmdGitHubAddToBoard,
  cmdGitHubSearchIssues,
  cmdGitHubSyncCheck,
  cmdGitHubPhaseProgress,
  cmdGitHubAllProgress,
  cmdGitHubDetectInterrupted,
  cmdGitHubStatus,
  cmdGitHubSync,
  cmdGitHubOverview,
} from './github/commands.js';

import {
  output,
  error,
  CliOutput,
  CliError,
  writeOutput,
  cmdFrontmatterGet,
  cmdFrontmatterSet,
  cmdFrontmatterMerge,
  cmdFrontmatterValidate,
  cmdConfigEnsureSection,
  cmdConfigSet,
  cmdConfigGet,
  cmdGenerateSlug,
  cmdCurrentTimestamp,
  cmdVerifyPathExists,
  cmdHistoryDigest,
  cmdResolveModel,
  cmdCommit,
  cmdSummaryExtract,
  cmdWebsearch,
  cmdProgressRender,
  cmdScaffold,
  cmdStateLoad,
  cmdStateGet,
  cmdStatePatch,
  cmdStateUpdate,
  cmdStateAdvancePlan,
  cmdStateRecordMetric,
  cmdStateUpdateProgress,
  cmdStateAddDecision,
  cmdStateAddBlocker,
  cmdStateResolveBlocker,
  cmdStateRecordSession,
  cmdStateSnapshot,
  cmdRoadmapGetPhase,
  cmdRoadmapAnalyze,
  cmdRoadmapUpdatePlanProgress,
  cmdRequirementsMarkComplete,
  cmdMilestoneComplete,
  cmdVerifySummary,
  cmdVerifyPlanStructure,
  cmdVerifyPhaseCompleteness,
  cmdVerifyReferences,
  cmdVerifyCommits,
  cmdVerifyArtifacts,
  cmdVerifyKeyLinks,
  cmdValidateRequirementExistence,
  cmdValidateRequirementStatus,
  cmdValidateEvidenceCompleteness,
  cmdValidateConsistency,
  cmdValidateHealth,
  cmdPhasesList,
  cmdPhaseNextDecimal,
  cmdFindPhase,
  cmdPhasePlanIndex,
  cmdPhaseAdd,
  cmdPhaseInsert,
  cmdPhaseRemove,
  cmdPhaseComplete,
  cmdTemplateSelect,
  cmdTemplateFill,
  cmdInitExecutePhase,
  cmdInitPlanPhase,
  cmdInitNewProject,
  cmdInitNewMilestone,
  cmdInitQuick,
  cmdInitResume,
  cmdInitVerifyWork,
  cmdInitPhaseOp,
  cmdInitMilestoneOp,
  cmdInitMapCodebase,
  cmdInitExisting,
  cmdInitProgress,
  cmdInitExecutor,
  cmdInitPlanner,
  cmdInitResearcher,
  cmdInitVerifier,
  cmdInitDebugger,
  cmdArtefakteRead,
  cmdArtefakteWrite,
  cmdArtefakteAppend,
  cmdArtefakteList,
  cmdContextLoad,
  cmdSkillList,
  cmdSkillInstall,
  cmdSkillUpdate,
  archivePhasePreview,
  archivePhaseExecute,
  cmdGetArchivedPhase,
  cmdDetectStaleContext,
  cmdDriftReadReport,
  cmdDriftWriteReport,
  cmdDriftExtractRequirements,
  cmdDriftExtractNoGos,
  cmdDriftExtractConventions,
  cmdDriftPreviousHash,
  cmdInitCheckDrift,
  cmdInitRealign,
  cmdWorktreeCreate,
  cmdWorktreeList,
  cmdWorktreeCleanup,
  cmdDecideExecutionMode,
  cmdValidatePlanIndependence,
} from './core/index.js';

// ─── Arg parsing utilities ───────────────────────────────────────────────────

/** Extract a single named flag's value from args */
function getFlag(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] ?? null : null;
}

/** Extract multiple named flags at once. Keys are flag names without -- prefix. */
function getFlags(args: string[], ...flags: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const flag of flags) {
    const idx = args.indexOf(`--${flag}`);
    result[flag] = idx !== -1 ? args[idx + 1] ?? null : null;
  }
  return result;
}

/** Check if a boolean flag is present */
function hasFlag(args: string[], flag: string): boolean {
  return args.includes(`--${flag}`);
}

// ─── Result dispatcher ───────────────────────────────────────────────────────

/** Convert a CmdResult into the appropriate output()/error() call. */
function handleResult(r: CmdResult, raw: boolean): never {
  if (r.ok) output(r.result, raw, r.rawValue);
  else error(r.error);
}

// ─── Command handler type ────────────────────────────────────────────────────

type Handler = (args: string[], cwd: string, raw: boolean) => void | Promise<void>;

// ─── Subcommand handlers ─────────────────────────────────────────────────────

const handleState: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  const handlers: Record<string, () => CmdResult | Promise<CmdResult>> = {
    'update': () => cmdStateUpdate(cwd, args[2], args[3]),
    'get': () => cmdStateGet(cwd, args[2], raw),
    'patch': () => {
      const patches: Record<string, string> = {};
      for (let i = 2; i < args.length; i += 2) {
        const key = args[i].replace(/^--/, '');
        const value = args[i + 1];
        if (key && value !== undefined) patches[key] = value;
      }
      return cmdStatePatch(cwd, patches, raw);
    },
    'advance-plan': () => cmdStateAdvancePlan(cwd, raw),
    'record-metric': () => {
      const f = getFlags(args, 'phase', 'plan', 'duration', 'tasks', 'files');
      return cmdStateRecordMetric(cwd, {
        phase: f.phase ?? '', plan: f.plan ?? '', duration: f.duration ?? '',
        tasks: f.tasks ?? undefined, files: f.files ?? undefined,
      }, raw);
    },
    'update-progress': () => cmdStateUpdateProgress(cwd, raw),
    'add-decision': () => {
      const f = getFlags(args, 'phase', 'summary', 'summary-file', 'rationale', 'rationale-file');
      return cmdStateAddDecision(cwd, {
        phase: f.phase ?? undefined, summary: f.summary ?? undefined,
        summary_file: f['summary-file'] ?? undefined,
        rationale: f.rationale ?? '', rationale_file: f['rationale-file'] ?? undefined,
      }, raw);
    },
    'add-blocker': () => {
      const f = getFlags(args, 'text', 'text-file');
      return cmdStateAddBlocker(cwd, { text: f.text ?? undefined, text_file: f['text-file'] ?? undefined }, raw);
    },
    'resolve-blocker': () => cmdStateResolveBlocker(cwd, getFlag(args, '--text'), raw),
    'record-session': () => {
      const f = getFlags(args, 'stopped-at', 'resume-file');
      return cmdStateRecordSession(cwd, {
        stopped_at: f['stopped-at'] ?? undefined,
        resume_file: f['resume-file'] ?? 'None',
      }, raw);
    },
  };

  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handleResult(await handler(), raw);
  return handleResult(await cmdStateLoad(cwd, raw), raw);
};

const handleTemplate: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  if (sub === 'select') {
    handleResult(cmdTemplateSelect(cwd, args[2]), raw);
  } else if (sub === 'fill') {
    const f = getFlags(args, 'phase', 'plan', 'name', 'type', 'wave', 'fields');
    handleResult(await cmdTemplateFill(cwd, args[2], {
      phase: f.phase ?? '', plan: f.plan ?? undefined, name: f.name ?? undefined,
      type: f.type ?? 'execute', wave: f.wave ?? '1',
      fields: f.fields ? JSON.parse(f.fields) : {},
    }), raw);
  } else {
    error('Unknown template subcommand. Available: select, fill');
  }
};

const handleFrontmatter: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  const file = args[2];
  const handlers: Record<string, () => void | Promise<void>> = {
    'get': async () => handleResult(await cmdFrontmatterGet(cwd, file, getFlag(args, '--field')), raw),
    'set': () => handleResult(cmdFrontmatterSet(cwd, file, getFlag(args, '--field'), getFlag(args, '--value') ?? undefined), raw),
    'merge': () => handleResult(cmdFrontmatterMerge(cwd, file, getFlag(args, '--data')), raw),
    'validate': async () => handleResult(await cmdFrontmatterValidate(cwd, file, getFlag(args, '--schema')), raw),
  };
  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handler();
  error('Unknown frontmatter subcommand. Available: get, set, merge, validate');
};

const handleVerify: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  const handlers: Record<string, () => void | Promise<void>> = {
    'plan-structure': async () => handleResult(await cmdVerifyPlanStructure(cwd, args[2]), raw),
    'phase-completeness': async () => handleResult(await cmdVerifyPhaseCompleteness(cwd, args[2]), raw),
    'references': async () => handleResult(await cmdVerifyReferences(cwd, args[2]), raw),
    'commits': async () => handleResult(await cmdVerifyCommits(cwd, args.slice(2)), raw),
    'artifacts': async () => handleResult(await cmdVerifyArtifacts(cwd, args[2]), raw),
    'key-links': async () => handleResult(await cmdVerifyKeyLinks(cwd, args[2]), raw),
    'requirement-existence': async () => handleResult(await cmdValidateRequirementExistence(cwd, args.slice(2)), raw),
    'requirement-status': async () => handleResult(await cmdValidateRequirementStatus(cwd, args.slice(2)), raw),
    'evidence-completeness': async () => handleResult(await cmdValidateEvidenceCompleteness(cwd, args[2], args.slice(3)), raw),
  };
  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handler();
  error('Unknown verify subcommand. Available: plan-structure, phase-completeness, references, commits, artifacts, key-links, requirement-existence, requirement-status, evidence-completeness');
};

const handlePhases: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  if (sub === 'list') {
    const f = getFlags(args, 'type', 'phase', 'offset', 'limit');
    handleResult(await cmdPhasesList(cwd, {
      type: f.type,
      phase: f.phase,
      includeArchived: hasFlag(args, 'include-archived'),
      offset: f.offset !== null ? parseInt(f.offset, 10) : undefined,
      limit: f.limit !== null ? parseInt(f.limit, 10) : undefined,
    }), raw);
  } else {
    error('Unknown phases subcommand. Available: list');
  }
};

const handleRoadmap: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  const handlers: Record<string, () => CmdResult | Promise<CmdResult>> = {
    'get-phase': () => cmdRoadmapGetPhase(cwd, args[2]),
    'analyze': () => cmdRoadmapAnalyze(cwd),
    'update-plan-progress': () => cmdRoadmapUpdatePlanProgress(cwd, args[2]),
  };
  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handleResult(await handler(), raw);
  error('Unknown roadmap subcommand. Available: get-phase, analyze, update-plan-progress');
};

const handlePhase: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  const handlers: Record<string, () => Promise<CmdResult>> = {
    'next-decimal': () => cmdPhaseNextDecimal(cwd, args[2]),
    'add': () => cmdPhaseAdd(cwd, args.slice(2).join(' ')),
    'insert': () => cmdPhaseInsert(cwd, args[2], args.slice(3).join(' ')),
    'remove': () => cmdPhaseRemove(cwd, args[2], { force: hasFlag(args, 'force') }),
    'complete': () => cmdPhaseComplete(cwd, args[2]),
    'archive-preview': () => archivePhasePreview(cwd, args[2], args.slice(3).join(' ')),
    'archive-execute': () => archivePhaseExecute(cwd, args[2], args.slice(3).join(' ')),
  };
  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handleResult(await handler(), raw);
  error('Unknown phase subcommand. Available: next-decimal, add, insert, remove, complete, archive-preview, archive-execute');
};

const handleMilestone: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  if (sub === 'complete') {
    const nameIndex = args.indexOf('--name');
    let milestoneName: string | null = null;
    if (nameIndex !== -1) {
      const nameArgs: string[] = [];
      for (let i = nameIndex + 1; i < args.length; i++) {
        if (args[i].startsWith('--')) break;
        nameArgs.push(args[i]);
      }
      milestoneName = nameArgs.join(' ') || null;
    }
    handleResult(await cmdMilestoneComplete(cwd, args[2], {
      name: milestoneName ?? undefined,
      archivePhases: hasFlag(args, 'archive-phases'),
    }), raw);
  } else {
    error('Unknown milestone subcommand. Available: complete');
  }
};

const handleValidate: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  const handlers: Record<string, () => Promise<void>> = {
    'consistency': async () => handleResult(await cmdValidateConsistency(cwd), raw),
    'health': async () => handleResult(await cmdValidateHealth(cwd, { repair: hasFlag(args, 'repair') }), raw),
  };
  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handler();
  error('Unknown validate subcommand. Available: consistency, health');
};

const handleDrift: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  const handlers: Record<string, () => Promise<CmdResult>> = {
    'read-report': () => cmdDriftReadReport(cwd),
    'extract-requirements': () => cmdDriftExtractRequirements(cwd),
    'extract-nogos': () => cmdDriftExtractNoGos(cwd),
    'extract-conventions': () => cmdDriftExtractConventions(cwd),
    'write-report': () => cmdDriftWriteReport(cwd, getFlag(args, '--content'), getFlag(args, '--content-file')),
    'previous-hash': () => cmdDriftPreviousHash(cwd),
  };
  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handleResult(await handler(), raw);
  error('Unknown drift subcommand. Available: read-report, extract-requirements, extract-nogos, extract-conventions, write-report, previous-hash');
};

const handleWorktree: Handler = async (args, cwd, raw) => {
  const sub = args[1];
  const handlers: Record<string, () => CmdResult | Promise<CmdResult>> = {
    'create': () => cmdWorktreeCreate(cwd, args[2], args[3], args[4]),
    'list': () => cmdWorktreeList(cwd),
    'cleanup': () => cmdWorktreeCleanup(cwd, args[2], hasFlag(args, 'all')),
  };
  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handleResult(await handler(), raw);
  error('Unknown worktree subcommand. Available: create, list, cleanup');
};

const handleInit: Handler = async (args, cwd, raw) => {
  const workflow = args[1];
  const handlers: Record<string, () => CmdResult | Promise<CmdResult>> = {
    'execute-phase': () => cmdInitExecutePhase(cwd, args[2]),
    'plan-phase': () => cmdInitPlanPhase(cwd, args[2]),
    'new-project': () => cmdInitNewProject(cwd),
    'new-milestone': () => cmdInitNewMilestone(cwd),
    'quick': () => cmdInitQuick(cwd, args.slice(2).join(' ')),
    'resume': () => cmdInitResume(cwd),
    'verify-work': () => cmdInitVerifyWork(cwd, args[2]),
    'phase-op': () => cmdInitPhaseOp(cwd, args[2]),
    'milestone-op': () => cmdInitMilestoneOp(cwd),
    'map-codebase': () => cmdInitMapCodebase(cwd),
    'init-existing': () => cmdInitExisting(cwd),
    'progress': () => cmdInitProgress(cwd),
    // Agent-level inits
    'executor': () => cmdInitExecutor(cwd, args[2]),
    'planner': () => cmdInitPlanner(cwd, args[2]),
    'researcher': () => cmdInitResearcher(cwd, args[2]),
    'verifier': () => cmdInitVerifier(cwd, args[2]),
    'debugger': () => cmdInitDebugger(cwd, args[2]),
    // Drift-related inits
    'check-drift': () => cmdInitCheckDrift(cwd),
    'realign': () => cmdInitRealign(cwd, args[2]),
  };
  const handler = workflow ? handlers[workflow] : undefined;
  if (handler) return handleResult(await handler(), raw);
  error(`Unknown init workflow: ${workflow}\nAvailable: execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, milestone-op, map-codebase, init-existing, progress, executor, planner, researcher, verifier, debugger, check-drift, realign`);
};

const handleGitHub: Handler = async (args, cwd, raw) => {
  const sub = args[1];

  /**
   * Read content from --flag or --flag-file variant.
   * If --flag-file is provided, read file contents. Otherwise use --flag value.
   */
  const getFlagOrFile = (flagName: string): string | null => {
    const direct = getFlag(args, `--${flagName}`);
    if (direct !== null) return direct;
    const filePath = getFlag(args, `--${flagName}-file`);
    if (filePath) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  };

  const handlers: Record<string, () => CmdResult | Promise<CmdResult>> = {
    'setup': () => cmdGitHubSetup(cwd, getFlag(args, '--milestone-title')),
    'create-phase': () => {
      const f = getFlags(args, 'phase-number', 'phase-name', 'goal', 'requirements', 'success-criteria');
      return cmdGitHubCreatePhase(cwd,
        f['phase-number'] ?? '',
        f['phase-name'] ?? '',
        f.goal ?? '',
        f.requirements ? f.requirements.split(',') : [],
        f['success-criteria'] ? f['success-criteria'].split(',') : [],
      );
    },
    'create-task': () => {
      const f = getFlags(args, 'phase-number', 'task-id', 'title', 'parent-issue-number');
      const body = getFlagOrFile('body') ?? '';
      return cmdGitHubCreateTask(cwd,
        f['phase-number'] ?? '',
        f['task-id'] ?? '',
        f.title ?? '',
        body,
        parseInt(f['parent-issue-number'] ?? '0', 10),
      );
    },
    'batch-create-tasks': () => {
      const f = getFlags(args, 'phase-number', 'parent-issue-number', 'tasks');
      const tasksFile = getFlag(args, '--tasks-file');
      let tasksJson: Array<{ task_id: string; title: string; body: string }>;
      if (tasksFile) {
        tasksJson = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
      } else {
        tasksJson = JSON.parse(f.tasks ?? '[]');
      }
      return cmdGitHubBatchCreateTasks(cwd,
        f['phase-number'] ?? '',
        parseInt(f['parent-issue-number'] ?? '0', 10),
        tasksJson,
      );
    },
    'post-plan-comment': () => {
      const f = getFlags(args, 'phase-issue-number', 'plan-number');
      const planContent = getFlagOrFile('plan-content') ?? '';
      return cmdGitHubPostPlanComment(
        parseInt(f['phase-issue-number'] ?? '0', 10),
        f['plan-number'] ?? '',
        planContent,
      );
    },
    'post-comment': () => {
      const f = getFlags(args, 'issue-number', 'type');
      const body = getFlagOrFile('body') ?? '';
      return cmdGitHubPostComment(
        parseInt(f['issue-number'] ?? '0', 10),
        body,
        f.type,
      );
    },
    'post-completion': () => {
      const f = getFlags(args, 'issue-number', 'commit-sha', 'files-changed');
      const files = f['files-changed'] ? f['files-changed'].split(',') : [];
      return cmdGitHubPostCompletion(
        parseInt(f['issue-number'] ?? '0', 10),
        f['commit-sha'] ?? '',
        files,
      );
    },
    'get-issue': () => {
      const f = getFlags(args, 'issue-number');
      return cmdGitHubGetIssue(
        parseInt(f['issue-number'] ?? '0', 10),
        hasFlag(args, 'include-comments'),
      );
    },
    'list-sub-issues': () => {
      const f = getFlags(args, 'phase-issue-number');
      return cmdGitHubListSubIssues(
        parseInt(f['phase-issue-number'] ?? '0', 10),
      );
    },
    'close-issue': () => {
      const f = getFlags(args, 'issue-number', 'reason', 'state-reason');
      return cmdGitHubCloseIssue(
        parseInt(f['issue-number'] ?? '0', 10),
        f.reason,
        f['state-reason'],
      );
    },
    'reopen-issue': () => {
      const f = getFlags(args, 'issue-number');
      return cmdGitHubReopenIssue(
        parseInt(f['issue-number'] ?? '0', 10),
      );
    },
    'bounce-issue': () => {
      const f = getFlags(args, 'issue-number');
      const reason = getFlagOrFile('reason') ?? '';
      return cmdGitHubBounceIssue(cwd,
        parseInt(f['issue-number'] ?? '0', 10),
        reason,
      );
    },
    'move-issue': () => {
      const f = getFlags(args, 'issue-number', 'status');
      return cmdGitHubMoveIssue(
        cwd,
        parseInt(f['issue-number'] ?? '0', 10),
        f.status ?? '',
      );
    },
    'detect-external-edits': () => {
      const f = getFlags(args, 'phase-number');
      return cmdGitHubDetectExternalEdits(cwd, f['phase-number'] ?? '');
    },
    'query-board': () => {
      const f = getFlags(args, 'project-number', 'status', 'phase');
      return cmdGitHubQueryBoard(
        parseInt(f['project-number'] ?? '0', 10),
        f.status,
        f.phase,
      );
    },
    'add-to-board': () => {
      const f = getFlags(args, 'project-number', 'issue-number');
      return cmdGitHubAddToBoard(
        parseInt(f['project-number'] ?? '0', 10),
        parseInt(f['issue-number'] ?? '0', 10),
      );
    },
    'search-issues': () => {
      const f = getFlags(args, 'labels', 'state', 'query');
      return cmdGitHubSearchIssues(
        f.labels ? f.labels.split(',') : null,
        f.state,
        f.query,
      );
    },
    'sync-check': () => cmdGitHubSyncCheck(cwd),
    'phase-progress': () => {
      const f = getFlags(args, 'phase-issue-number');
      return cmdGitHubPhaseProgress(
        parseInt(f['phase-issue-number'] ?? '0', 10),
      );
    },
    'all-progress': () => cmdGitHubAllProgress(),
    'detect-interrupted': () => {
      const f = getFlags(args, 'phase-issue-number');
      return cmdGitHubDetectInterrupted(
        parseInt(f['phase-issue-number'] ?? '0', 10),
      );
    },
    'status': () => cmdGitHubStatus(cwd),
    'sync': () => cmdGitHubSync(cwd),
    'overview': () => cmdGitHubOverview(cwd),
  };

  const handler = sub ? handlers[sub] : undefined;
  if (handler) return handleResult(await handler(), raw);
  error(`Unknown github subcommand: ${sub ?? '(none)'}\nAvailable: ${Object.keys(handlers).join(', ')}`);
};

// ─── Command registry ────────────────────────────────────────────────────────

const COMMANDS: Record<string, Handler> = {
  'state': handleState,
  'resolve-model': async (args, cwd, raw) => handleResult(await cmdResolveModel(cwd, args[1], raw), raw),
  'find-phase': async (args, cwd, raw) => handleResult(await cmdFindPhase(cwd, args[1]), raw),
  'commit': async (args, cwd, raw) => {
    const files = args.indexOf('--files') !== -1
      ? args.slice(args.indexOf('--files') + 1).filter(a => !a.startsWith('--'))
      : [];
    handleResult(await cmdCommit(cwd, args[1], files, raw, hasFlag(args, 'amend')), raw);
  },
  'verify-summary': async (args, cwd, raw) => {
    const countIndex = args.indexOf('--check-count');
    const checkCount = countIndex !== -1 ? parseInt(args[countIndex + 1], 10) : 2;
    handleResult(await cmdVerifySummary(cwd, args[1], checkCount), raw);
  },
  'template': handleTemplate,
  'frontmatter': handleFrontmatter,
  'verify': handleVerify,
  'generate-slug': (args, _cwd, raw) => handleResult(cmdGenerateSlug(args[1], raw), raw),
  'current-timestamp': (args, _cwd, raw) => handleResult(cmdCurrentTimestamp((args[1] || 'full') as TimestampFormat, raw), raw),
  'verify-path-exists': (args, cwd, raw) => handleResult(cmdVerifyPathExists(cwd, args[1], raw), raw),
  'config-ensure-section': (_args, cwd, raw) => handleResult(cmdConfigEnsureSection(cwd, raw), raw),
  'config-set': (args, cwd, raw) => handleResult(cmdConfigSet(cwd, args[1], args[2], raw), raw),
  'config-get': (args, cwd, raw) => handleResult(cmdConfigGet(cwd, args[1], raw), raw),
  'history-digest': async (_args, cwd, raw) => handleResult(await cmdHistoryDigest(cwd, raw), raw),
  'phases': handlePhases,
  'roadmap': handleRoadmap,
  'requirements': (args, cwd, raw) => {
    if (args[1] === 'mark-complete') handleResult(cmdRequirementsMarkComplete(cwd, args.slice(2)), raw);
    else error('Unknown requirements subcommand. Available: mark-complete');
  },
  'phase': handlePhase,
  'milestone': handleMilestone,
  'validate': handleValidate,
  'drift': handleDrift,
  'worktree': handleWorktree,
  'decide-execution-mode': (args, _cwd, raw) => {
    const f = getFlags(args, 'worktree-mode', 'flag-override');
    handleResult(cmdDecideExecutionMode(args[1], args[2], f['worktree-mode'] ?? undefined, f['flag-override'] ?? undefined), raw);
  },
  'validate-plan-independence': (args, _cwd, raw) => handleResult(cmdValidatePlanIndependence(args[1]), raw),
  'progress': async (args, cwd, raw) => handleResult(await cmdProgressRender(cwd, args[1] || 'json', raw), raw),
  'scaffold': async (args, cwd, raw) => {
    const f = getFlags(args, 'phase', 'name');
    handleResult(await cmdScaffold(cwd, args[1], { phase: f.phase, name: f.name ? args.slice(args.indexOf('--name') + 1).join(' ') : null }, raw), raw);
  },
  'init': handleInit,
  'github': handleGitHub,
  'detect-stale-context': async (_args, cwd, raw) => handleResult(await cmdDetectStaleContext(cwd), raw),
  'get-archived-phase': async (args, cwd, raw) => handleResult(await cmdGetArchivedPhase(cwd, args[1]), raw),
  'phase-plan-index': async (args, cwd, raw) => handleResult(await cmdPhasePlanIndex(cwd, args[1]), raw),
  'state-snapshot': async (_args, cwd, raw) => handleResult(await cmdStateSnapshot(cwd, raw), raw),
  'summary-extract': (args, cwd, raw) => {
    const fieldsIndex = args.indexOf('--fields');
    const fields = fieldsIndex !== -1 ? args[fieldsIndex + 1].split(',') : null;
    handleResult(cmdSummaryExtract(cwd, args[1], fields, raw), raw);
  },
  'websearch': async (args, _cwd, raw) => {
    const f = getFlags(args, 'limit', 'freshness');
    handleResult(await cmdWebsearch(args[1], {
      limit: f.limit ? parseInt(f.limit, 10) : 10,
      freshness: f.freshness ?? undefined,
    }, raw), raw);
  },
  'artefakte-read': async (args, cwd, raw) => handleResult(await cmdArtefakteRead(cwd, args[1], getFlag(args, '--phase') ?? undefined, raw), raw),
  'artefakte-write': async (args, cwd, raw) => handleResult(await cmdArtefakteWrite(cwd, args[1], getFlag(args, '--content') ?? undefined, getFlag(args, '--phase') ?? undefined, raw), raw),
  'artefakte-append': async (args, cwd, raw) => handleResult(await cmdArtefakteAppend(cwd, args[1], getFlag(args, '--entry') ?? undefined, getFlag(args, '--phase') ?? undefined, raw), raw),
  'artefakte-list': async (args, cwd, raw) => handleResult(await cmdArtefakteList(cwd, getFlag(args, '--phase') ?? undefined, raw), raw),
  'context-load': async (args, cwd, raw) => handleResult(await cmdContextLoad(cwd, getFlag(args, '--phase') ?? undefined, getFlag(args, '--topic') ?? undefined, hasFlag(args, 'include-history')), raw),
  'skill-list': async (_args, cwd, raw) => handleResult(await cmdSkillList(cwd), raw),
  'skill-install': (args, cwd, raw) => handleResult(cmdSkillInstall(cwd, args[1]), raw),
  'skill-update': (args, cwd, raw) => handleResult(cmdSkillUpdate(cwd, args[1]), raw),
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    const args: string[] = process.argv.slice(2);

    // Optional cwd override for sandboxed subagents running outside project root.
    let cwd: string = process.cwd();
    const cwdEqArg = args.find(arg => arg.startsWith('--cwd='));
    const cwdIdx = args.indexOf('--cwd');
    if (cwdEqArg) {
      const value = cwdEqArg.slice('--cwd='.length).trim();
      if (!value) error('Missing value for --cwd');
      args.splice(args.indexOf(cwdEqArg), 1);
      cwd = path.resolve(value);
    } else if (cwdIdx !== -1) {
      const value = args[cwdIdx + 1];
      if (!value || value.startsWith('--')) error('Missing value for --cwd');
      args.splice(cwdIdx, 2);
      cwd = path.resolve(value);
    }

    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      error(`Invalid --cwd: ${cwd}`);
    }

    const rawIndex = args.indexOf('--raw');
    const raw: boolean = rawIndex !== -1;
    if (rawIndex !== -1) args.splice(rawIndex, 1);

    const command: string | undefined = args[0];

    if (!command) {
      error(`Usage: maxsim-tools <command> [args] [--raw] [--cwd <path>]\nCommands: ${Object.keys(COMMANDS).join(', ')}`);
    }

    const handler = COMMANDS[command];
    if (!handler) {
      error(`Unknown command: ${command}`);
    }

    await handler(args, cwd, raw);
  } catch (thrown: unknown) {
    if (thrown instanceof CliOutput) {
      writeOutput(thrown);
      process.exit(0);
    }
    if (thrown instanceof CliError) {
      process.stderr.write('Error: ' + thrown.message + '\n');
      process.exit(1);
    }
    // Re-throw unexpected errors
    throw thrown;
  }
}

main();
