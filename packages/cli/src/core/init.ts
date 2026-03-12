/**
 * Init — Compound init commands for workflow bootstrapping
 *
 * Ported from maxsim/bin/lib/init.cjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  loadConfig,
  resolveModelInternal,
  findPhaseInternal,
  getRoadmapPhaseInternal,
  pathExistsInternal,
  generateSlugInternal,
  getMilestoneInfo,
  getArchivedPhaseDirs,
  debugLog,
  planningPath,
  phasesPath,
  todayISO,
  listSubDirs,
} from './core.js';

import { cmdOk, cmdErr } from './types.js';
import type {
  AgentType,
  BranchingStrategy,
  ModelResolution,
  PhaseSearchResult,
  MilestoneInfo,
  AppConfig,
  CmdResult,
  ExecutorAgentContext,
  PlannerAgentContext,
  ResearcherAgentContext,
  VerifierAgentContext,
  DebuggerAgentContext,
  CheckDriftContext,
  RealignContext,
  WorktreeMode,
  ReviewConfig,
} from './types.js';

import { loadMapping } from '../github/mapping.js';
import type { IssueMappingFile } from '../github/types.js';

// ─── GitHub context helper ───────────────────────────────────────────────────

function getGitHubContext(cwd: string): {
  github_ready: boolean;
  project_number: number | null;
  mapping: IssueMappingFile | null;
} {
  try {
    const mapping = loadMapping(cwd);
    if (!mapping || !mapping.project_number) {
      return { github_ready: false, project_number: null, mapping: null };
    }
    return { github_ready: true, project_number: mapping.project_number, mapping };
  } catch {
    return { github_ready: false, project_number: null, mapping: null };
  }
}

// ─── Init result types ──────────────────────────────────────────────────────

export type WorkflowType =
  | 'execute-phase'
  | 'plan-phase'
  | 'new-project'
  | 'new-milestone'
  | 'quick'
  | 'resume'
  | 'verify-work'
  | 'phase-op'
  | 'milestone-op'
  | 'map-codebase'
  | 'init-existing'
  | 'progress'
  | 'check-drift'
  | 'realign';

export interface ExecutePhaseContext {
  executor_model: ModelResolution;
  verifier_model: ModelResolution;
  commit_docs: boolean;
  parallelization: boolean;
  branching_strategy: BranchingStrategy;
  phase_branch_template: string;
  milestone_branch_template: string;
  verifier_enabled: boolean;
  phase_found: boolean;
  phase_dir: string | null;
  phase_number: string | null;
  phase_name: string | null;
  phase_slug: string | null;
  phase_req_ids: string | null;
  plans: string[];
  summaries: string[];
  incomplete_plans: string[];
  plan_count: number;
  incomplete_count: number;
  branch_name: string | null;
  milestone_version: string;
  milestone_name: string;
  milestone_slug: string | null;
  state_exists: boolean;
  roadmap_exists: boolean;
  config_exists: boolean;
  has_verification: boolean;
  state_path: string;
  roadmap_path: string;
  requirements_path: string;
  config_path: string;
  worktree_mode: WorktreeMode;
  max_parallel_agents: number;
  review_config: ReviewConfig;
  github_ready: boolean;
  project_number: number | null;
  phase_issue_number: number | null;
  phase_item_id: string | null;
  task_mappings: Record<string, { number: number; id: number; item_id: string; status: string }> | null;
}

export interface PlanPhaseContext {
  researcher_model: ModelResolution;
  planner_model: ModelResolution;
  checker_model: ModelResolution;
  research_enabled: boolean;
  plan_checker_enabled: boolean;
  commit_docs: boolean;
  phase_found: boolean;
  phase_dir: string | null;
  phase_number: string | null;
  phase_name: string | null;
  phase_slug: string | null;
  padded_phase: string | null;
  phase_req_ids: string | null;
  has_research: boolean;
  has_context: boolean;
  has_plans: boolean;
  plan_count: number;
  planning_exists: boolean;
  roadmap_exists: boolean;
  state_path: string;
  roadmap_path: string;
  requirements_path: string;
  conventions_path?: string;
  verification_path?: string;
  uat_path?: string;
  github_ready: boolean;
  project_number: number | null;
  phase_issue_number: number | null;
  phase_item_id: string | null;
}

export interface NewProjectContext {
  researcher_model: ModelResolution;
  synthesizer_model: ModelResolution;
  roadmapper_model: ModelResolution;
  commit_docs: boolean;
  project_exists: boolean;
  has_codebase_map: boolean;
  planning_exists: boolean;
  has_existing_code: boolean;
  has_package_file: boolean;
  is_brownfield: boolean;
  needs_codebase_map: boolean;
  has_git: boolean;
  brave_search_available: boolean;
  project_path: string;
  github_ready: boolean;
  has_github_remote: boolean;
  gh_authenticated: boolean;
}

export interface NewMilestoneContext {
  researcher_model: ModelResolution;
  synthesizer_model: ModelResolution;
  roadmapper_model: ModelResolution;
  commit_docs: boolean;
  research_enabled: boolean;
  current_milestone: string;
  current_milestone_name: string;
  project_exists: boolean;
  roadmap_exists: boolean;
  state_exists: boolean;
  project_path: string;
  roadmap_path: string;
  state_path: string;
}

export interface QuickContext {
  planner_model: ModelResolution;
  executor_model: ModelResolution;
  checker_model: ModelResolution;
  verifier_model: ModelResolution;
  commit_docs: boolean;
  next_num: number;
  slug: string | null;
  description: string | null;
  date: string;
  timestamp: string;
  quick_dir: string;
  task_dir: string | null;
  roadmap_exists: boolean;
  planning_exists: boolean;
}

export interface ResumeContext {
  state_exists: boolean;
  roadmap_exists: boolean;
  project_exists: boolean;
  planning_exists: boolean;
  state_path: string;
  roadmap_path: string;
  project_path: string;
  has_interrupted_agent: boolean;
  interrupted_agent_id: string | null;
  commit_docs: boolean;
}

export interface VerifyWorkContext {
  planner_model: ModelResolution;
  checker_model: ModelResolution;
  commit_docs: boolean;
  phase_found: boolean;
  phase_dir: string | null;
  phase_number: string | null;
  phase_name: string | null;
  has_verification: boolean;
}

export interface PhaseOpContext {
  commit_docs: boolean;
  brave_search: boolean;
  phase_found: boolean;
  phase_dir: string | null;
  phase_number: string | null;
  phase_name: string | null;
  phase_slug: string | null;
  padded_phase: string | null;
  has_research: boolean;
  has_context: boolean;
  has_plans: boolean;
  has_verification: boolean;
  plan_count: number;
  roadmap_exists: boolean;
  planning_exists: boolean;
  state_path: string;
  roadmap_path: string;
  requirements_path: string;
  conventions_path?: string;
  verification_path?: string;
  uat_path?: string;
}

export interface MilestoneOpContext {
  commit_docs: boolean;
  milestone_version: string;
  milestone_name: string;
  milestone_slug: string | null;
  phase_count: number;
  completed_phases: number;
  all_phases_complete: boolean;
  archived_milestones: string[];
  archive_count: number;
  project_exists: boolean;
  roadmap_exists: boolean;
  state_exists: boolean;
  archive_exists: boolean;
  phases_dir_exists: boolean;
}

export interface MapCodebaseContext {
  mapper_model: ModelResolution;
  commit_docs: boolean;
  search_gitignored: boolean;
  parallelization: boolean;
  codebase_dir: string;
  existing_maps: string[];
  has_maps: boolean;
  planning_exists: boolean;
  codebase_dir_exists: boolean;
}

export interface InitExistingContext {
  researcher_model: ModelResolution;
  synthesizer_model: ModelResolution;
  roadmapper_model: ModelResolution;
  mapper_model: ModelResolution;
  commit_docs: boolean;
  project_exists: boolean;
  planning_exists: boolean;
  planning_files: string[];
  has_codebase_map: boolean;
  has_existing_code: boolean;
  has_package_file: boolean;
  has_git: boolean;
  has_readme: boolean;
  conflict_detected: boolean;
  existing_file_count: number;
  brave_search_available: boolean;
  parallelization: boolean;
  project_path: string;
  codebase_dir: string;
  github_ready: boolean;
  has_github_remote: boolean;
  gh_authenticated: boolean;
}

interface ProgressPhaseInfo {
  number: string;
  name: string | null;
  directory: string;
  status: string;
  plan_count: number;
  summary_count: number;
  has_research: boolean;
}

export interface ProgressContext {
  executor_model: ModelResolution;
  planner_model: ModelResolution;
  commit_docs: boolean;
  milestone_version: string;
  milestone_name: string;
  phases: ProgressPhaseInfo[];
  phase_count: number;
  completed_count: number;
  in_progress_count: number;
  current_phase: ProgressPhaseInfo | null;
  next_phase: ProgressPhaseInfo | null;
  paused_at: string | null;
  has_work_in_progress: boolean;
  project_exists: boolean;
  roadmap_exists: boolean;
  state_exists: boolean;
  state_path: string;
  roadmap_path: string;
  project_path: string;
  config_path: string;
  github_ready: boolean;
  project_number: number | null;
  phase_mappings: Record<string, { issue_number: number; item_id: string }> | null;
}

export type InitContext =
  | ExecutePhaseContext
  | PlanPhaseContext
  | NewProjectContext
  | NewMilestoneContext
  | QuickContext
  | ResumeContext
  | VerifyWorkContext
  | PhaseOpContext
  | MilestoneOpContext
  | MapCodebaseContext
  | InitExistingContext
  | ProgressContext
  | CheckDriftContext
  | RealignContext;

// ─── Helper: extract requirement IDs from roadmap phase section ─────────────

async function extractReqIds(cwd: string, phase: string): Promise<string | null> {
  const roadmapPhase = await getRoadmapPhaseInternal(cwd, phase);
  const reqMatch = roadmapPhase?.section?.match(/^\*\*Requirements\*\*:[^\S\n]*([^\n]*)$/m);
  const reqExtracted = reqMatch ? reqMatch[1].replace(/[\[\]]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean).join(', ') : null;
  return (reqExtracted && reqExtracted !== 'TBD') ? reqExtracted : null;
}

// ─── Helper: cross-platform code file detection ─────────────────────────────

const CODE_EXTENSIONS = new Set(['.ts', '.js', '.py', '.go', '.rs', '.swift', '.java']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git']);

function findCodeFiles(dir: string, maxDepth: number = 3, limit: number = 5): string[] {
  const results: string[] = [];
  function walk(currentDir: string, depth: number): void {
    if (depth > maxDepth || results.length >= limit) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) { walk(fullPath, depth + 1); }
      else if (entry.isFile()) { const ext = path.extname(entry.name).toLowerCase(); if (CODE_EXTENSIONS.has(ext)) results.push(fullPath); }
    }
  }
  walk(dir, 1);
  return results;
}

// ─── Init commands ──────────────────────────────────────────────────────────

export async function cmdInitExecutePhase(cwd: string, phase: string | undefined): Promise<CmdResult> {
  if (!phase) return cmdErr('phase required for init execute-phase');
  const config = await loadConfig(cwd);
  const phaseInfo = await findPhaseInternal(cwd, phase!);
  const milestone = await getMilestoneInfo(cwd);
  const phase_req_ids = await extractReqIds(cwd, phase!);
  const ghCtx = getGitHubContext(cwd);
  const phaseNum = phaseInfo?.phase_number ?? phase;
  const phaseMapping = ghCtx.mapping?.phases[phaseNum] ?? null;
  const result: ExecutePhaseContext = {
    executor_model: await resolveModelInternal(cwd, 'executor'),
    verifier_model: await resolveModelInternal(cwd, 'verifier'),
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
    branching_strategy: config.branching_strategy,
    phase_branch_template: config.phase_branch_template,
    milestone_branch_template: config.milestone_branch_template,
    verifier_enabled: config.verifier,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory ?? null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    phase_slug: phaseInfo?.phase_slug ?? null,
    phase_req_ids,
    plans: phaseInfo?.plans ?? [],
    summaries: phaseInfo?.summaries ?? [],
    incomplete_plans: phaseInfo?.incomplete_plans ?? [],
    plan_count: phaseInfo?.plans?.length ?? 0,
    incomplete_count: phaseInfo?.incomplete_plans?.length ?? 0,
    branch_name: config.branching_strategy === 'phase' && phaseInfo
      ? config.phase_branch_template.replace('{phase}', phaseInfo.phase_number).replace('{slug}', phaseInfo.phase_slug || 'phase')
      : config.branching_strategy === 'milestone'
        ? config.milestone_branch_template.replace('{milestone}', milestone.version).replace('{slug}', generateSlugInternal(milestone.name) || 'milestone')
        : null,
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),
    state_exists: await pathExistsInternal(planningPath(cwd, 'STATE.md')),
    roadmap_exists: await pathExistsInternal(planningPath(cwd, 'ROADMAP.md')),
    config_exists: await pathExistsInternal(planningPath(cwd, 'config.json')),
    has_verification: phaseInfo?.has_verification ?? false,
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
    config_path: '.planning/config.json',
    worktree_mode: config.worktree_mode ?? 'auto',
    max_parallel_agents: config.max_parallel_agents ?? 10,
    review_config: config.review ?? {
      spec_review: true,
      code_review: true,
      simplify_review: true,
      retry_limit: 3,
    },
    github_ready: ghCtx.github_ready,
    project_number: ghCtx.project_number,
    phase_issue_number: phaseMapping?.tracking_issue.number ?? null,
    phase_item_id: phaseMapping?.tracking_issue.item_id ?? null,
    task_mappings: phaseMapping?.tasks
      ? Object.fromEntries(
          Object.entries(phaseMapping.tasks).map(([k, v]) => [
            k,
            { number: v.number, id: v.id, item_id: v.item_id, status: v.status },
          ]),
        )
      : null,
  };
  return cmdOk(result);
}

export async function cmdInitPlanPhase(cwd: string, phase: string | undefined): Promise<CmdResult> {
  if (!phase) return cmdErr('phase required for init plan-phase');
  const config = await loadConfig(cwd);
  const phaseInfo = await findPhaseInternal(cwd, phase!);
  const phase_req_ids = await extractReqIds(cwd, phase!);
  const ghCtx = getGitHubContext(cwd);
  const phaseNum = phaseInfo?.phase_number ?? phase;
  const phaseMapping = ghCtx.mapping?.phases[phaseNum] ?? null;
  const result: PlanPhaseContext = {
    researcher_model: await resolveModelInternal(cwd, 'researcher'),
    planner_model: await resolveModelInternal(cwd, 'planner'),
    checker_model: await resolveModelInternal(cwd, 'planner'),
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory ?? null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    phase_slug: phaseInfo?.phase_slug ?? null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') ?? null,
    phase_req_ids,
    has_research: phaseInfo?.has_research ?? false,
    has_context: phaseInfo?.has_context ?? false,
    has_plans: (phaseInfo?.plans?.length ?? 0) > 0,
    plan_count: phaseInfo?.plans?.length ?? 0,
    planning_exists: await pathExistsInternal(planningPath(cwd)),
    roadmap_exists: await pathExistsInternal(planningPath(cwd, 'ROADMAP.md')),
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
    github_ready: ghCtx.github_ready,
    project_number: ghCtx.project_number,
    phase_issue_number: phaseMapping?.tracking_issue.number ?? null,
    phase_item_id: phaseMapping?.tracking_issue.item_id ?? null,
  };
  if (await pathExistsInternal(planningPath(cwd, 'CONVENTIONS.md'))) {
    result.conventions_path = '.planning/CONVENTIONS.md';
  }
  return cmdOk(result);
}

export async function cmdInitNewProject(cwd: string): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const homedir = os.homedir();
  const braveKeyFile = path.join(homedir, '.maxsim', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));
  const hasCode = findCodeFiles(cwd).length > 0;
  const hasPackageFile = await pathExistsInternal(path.join(cwd, 'package.json')) || await pathExistsInternal(path.join(cwd, 'requirements.txt')) || await pathExistsInternal(path.join(cwd, 'Cargo.toml')) || await pathExistsInternal(path.join(cwd, 'go.mod')) || await pathExistsInternal(path.join(cwd, 'Package.swift'));
  const hasCodebaseMap = await pathExistsInternal(planningPath(cwd, 'codebase'));
  const ghCtx = getGitHubContext(cwd);
  let hasGitHubRemote = false;
  try {
    const { spawnSync } = await import('node:child_process');
    const remoteResult = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf-8' });
    hasGitHubRemote = remoteResult.status === 0 && !!remoteResult.stdout.trim();
  } catch { /* no git remote */ }
  let ghAuthenticated = false;
  try {
    const { spawnSync } = await import('node:child_process');
    const authResult = spawnSync('gh', ['auth', 'status'], { cwd, encoding: 'utf-8' });
    ghAuthenticated = authResult.status === 0;
  } catch { /* gh not installed or not authenticated */ }
  const result: NewProjectContext = {
    researcher_model: await resolveModelInternal(cwd, 'researcher'),
    synthesizer_model: await resolveModelInternal(cwd, 'researcher'),
    roadmapper_model: await resolveModelInternal(cwd, 'planner'),
    commit_docs: config.commit_docs,
    project_exists: await pathExistsInternal(planningPath(cwd, 'PROJECT.md')),
    has_codebase_map: hasCodebaseMap,
    planning_exists: await pathExistsInternal(planningPath(cwd)),
    has_existing_code: hasCode,
    has_package_file: hasPackageFile,
    is_brownfield: hasCode || hasPackageFile,
    needs_codebase_map: (hasCode || hasPackageFile) && !hasCodebaseMap,
    has_git: await pathExistsInternal(path.join(cwd, '.git')),
    brave_search_available: hasBraveSearch,
    project_path: '.planning/PROJECT.md',
    github_ready: ghCtx.github_ready,
    has_github_remote: hasGitHubRemote,
    gh_authenticated: ghAuthenticated,
  };
  return cmdOk(result);
}

export async function cmdInitNewMilestone(cwd: string): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const milestone = await getMilestoneInfo(cwd);
  const result: NewMilestoneContext = {
    researcher_model: await resolveModelInternal(cwd, 'researcher'),
    synthesizer_model: await resolveModelInternal(cwd, 'researcher'),
    roadmapper_model: await resolveModelInternal(cwd, 'planner'),
    commit_docs: config.commit_docs,
    research_enabled: config.research,
    current_milestone: milestone.version,
    current_milestone_name: milestone.name,
    project_exists: await pathExistsInternal(planningPath(cwd, 'PROJECT.md')),
    roadmap_exists: await pathExistsInternal(planningPath(cwd, 'ROADMAP.md')),
    state_exists: await pathExistsInternal(planningPath(cwd, 'STATE.md')),
    project_path: '.planning/PROJECT.md',
    roadmap_path: '.planning/ROADMAP.md',
    state_path: '.planning/STATE.md',
  };
  return cmdOk(result);
}

export async function cmdInitQuick(cwd: string, description: string | undefined): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const now = new Date();
  const slug = description ? generateSlugInternal(description)?.substring(0, 40) ?? null : null;
  const quickDir = planningPath(cwd, 'quick');
  let nextNum = 1;
  try {
    const existing = fs.readdirSync(quickDir).filter(f => /^\d+-/.test(f)).map(f => parseInt(f.split('-')[0], 10)).filter(n => !isNaN(n));
    if (existing.length > 0) nextNum = Math.max(...existing) + 1;
  } catch (e) { debugLog(e); }
  const result: QuickContext = {
    planner_model: await resolveModelInternal(cwd, 'planner'),
    executor_model: await resolveModelInternal(cwd, 'executor'),
    checker_model: await resolveModelInternal(cwd, 'planner'),
    verifier_model: await resolveModelInternal(cwd, 'verifier'),
    commit_docs: config.commit_docs,
    next_num: nextNum,
    slug,
    description: description ?? null,
    date: todayISO(),
    timestamp: now.toISOString(),
    quick_dir: '.planning/quick',
    task_dir: slug ? `.planning/quick/${nextNum}-${slug}` : null,
    roadmap_exists: await pathExistsInternal(planningPath(cwd, 'ROADMAP.md')),
    planning_exists: await pathExistsInternal(planningPath(cwd)),
  };
  return cmdOk(result);
}

export async function cmdInitResume(cwd: string): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  let interruptedAgentId: string | null = null;
  try { interruptedAgentId = fs.readFileSync(planningPath(cwd, 'current-agent-id.txt'), 'utf-8').trim(); } catch (e) { debugLog(e); }
  const result: ResumeContext = {
    state_exists: await pathExistsInternal(planningPath(cwd, 'STATE.md')),
    roadmap_exists: await pathExistsInternal(planningPath(cwd, 'ROADMAP.md')),
    project_exists: await pathExistsInternal(planningPath(cwd, 'PROJECT.md')),
    planning_exists: await pathExistsInternal(planningPath(cwd)),
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    project_path: '.planning/PROJECT.md',
    has_interrupted_agent: !!interruptedAgentId,
    interrupted_agent_id: interruptedAgentId,
    commit_docs: config.commit_docs,
  };
  return cmdOk(result);
}

export async function cmdInitVerifyWork(cwd: string, phase: string | undefined): Promise<CmdResult> {
  if (!phase) return cmdErr('phase required for init verify-work');
  const config = await loadConfig(cwd);
  const phaseInfo = await findPhaseInternal(cwd, phase!);
  const result: VerifyWorkContext = {
    planner_model: await resolveModelInternal(cwd, 'planner'),
    checker_model: await resolveModelInternal(cwd, 'planner'),
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory ?? null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    has_verification: phaseInfo?.has_verification ?? false,
  };
  return cmdOk(result);
}

export async function cmdInitPhaseOp(cwd: string, phase: string | undefined): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  let phaseInfo = await findPhaseInternal(cwd, phase ?? '');
  if (!phaseInfo) {
    const roadmapPhase = await getRoadmapPhaseInternal(cwd, phase ?? '');
    if (roadmapPhase?.found) {
      const phaseName = roadmapPhase.phase_name;
      phaseInfo = { found: true, directory: '', phase_number: roadmapPhase.phase_number, phase_name: phaseName, phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null, plans: [], summaries: [], incomplete_plans: [], has_research: false, has_context: false, has_verification: false };
    }
  }
  const result: PhaseOpContext = {
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    phase_slug: phaseInfo?.phase_slug ?? null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') ?? null,
    has_research: phaseInfo?.has_research ?? false,
    has_context: phaseInfo?.has_context ?? false,
    has_plans: (phaseInfo?.plans?.length ?? 0) > 0,
    has_verification: phaseInfo?.has_verification ?? false,
    plan_count: phaseInfo?.plans?.length ?? 0,
    roadmap_exists: await pathExistsInternal(planningPath(cwd, 'ROADMAP.md')),
    planning_exists: await pathExistsInternal(planningPath(cwd)),
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
  };
  if (await pathExistsInternal(planningPath(cwd, 'CONVENTIONS.md'))) {
    result.conventions_path = '.planning/CONVENTIONS.md';
  }
  return cmdOk(result);
}

export async function cmdInitMilestoneOp(cwd: string): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const milestone = await getMilestoneInfo(cwd);
  let phaseCount = 0;
  let completedPhases = 0;

  // Try GitHub first for phase completion data
  let ghSourced = false;
  try {
    const { getAllPhasesProgress } = await import('../github/sync.js');
    const ghResult = await getAllPhasesProgress();
    if (ghResult.ok && ghResult.data.length > 0) {
      phaseCount = ghResult.data.length;
      completedPhases = ghResult.data.filter(p => p.progress.completed === p.progress.total && p.progress.total > 0).length;
      ghSourced = true;
    }
  } catch { /* GitHub not available */ }

  // GitHub is the single source of truth for phase progress.
  // If GitHub data is unavailable, counts remain 0.
  const archiveDir = planningPath(cwd, 'archive');
  let archivedMilestones: string[] = [];
  try { archivedMilestones = await listSubDirs(archiveDir); } catch (e) { debugLog(e); }
  const result: MilestoneOpContext = {
    commit_docs: config.commit_docs,
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),
    phase_count: phaseCount,
    completed_phases: completedPhases,
    all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,
    archived_milestones: archivedMilestones,
    archive_count: archivedMilestones.length,
    project_exists: await pathExistsInternal(planningPath(cwd, 'PROJECT.md')),
    roadmap_exists: await pathExistsInternal(planningPath(cwd, 'ROADMAP.md')),
    state_exists: await pathExistsInternal(planningPath(cwd, 'STATE.md')),
    archive_exists: await pathExistsInternal(planningPath(cwd, 'archive')),
    phases_dir_exists: await pathExistsInternal(planningPath(cwd, 'phases')),
  };
  return cmdOk(result);
}

export async function cmdInitMapCodebase(cwd: string): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const codebaseDir = planningPath(cwd, 'codebase');
  let existingMaps: string[] = [];
  try { existingMaps = fs.readdirSync(codebaseDir).filter(f => f.endsWith('.md')); } catch (e) { debugLog(e); }
  const result: MapCodebaseContext = {
    mapper_model: await resolveModelInternal(cwd, 'researcher'),
    commit_docs: config.commit_docs,
    search_gitignored: config.search_gitignored,
    parallelization: config.parallelization,
    codebase_dir: '.planning/codebase',
    existing_maps: existingMaps,
    has_maps: existingMaps.length > 0,
    planning_exists: await pathExistsInternal(planningPath(cwd)),
    codebase_dir_exists: await pathExistsInternal(planningPath(cwd, 'codebase')),
  };
  return cmdOk(result);
}

export async function cmdInitExisting(cwd: string): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const homedir = os.homedir();
  const braveKeyFile = path.join(homedir, '.maxsim', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));
  const hasCode = findCodeFiles(cwd).length > 0;
  const hasPackageFile = await pathExistsInternal(path.join(cwd, 'package.json')) || await pathExistsInternal(path.join(cwd, 'requirements.txt')) || await pathExistsInternal(path.join(cwd, 'Cargo.toml')) || await pathExistsInternal(path.join(cwd, 'go.mod')) || await pathExistsInternal(path.join(cwd, 'Package.swift'));
  let planningFiles: string[] = [];
  try { const planDir = planningPath(cwd); if (fs.existsSync(planDir)) planningFiles = fs.readdirSync(planDir, { recursive: true }).map((f) => String(f)).filter((f) => !f.startsWith('.')); } catch (e) { debugLog(e); }
  const ghCtx = getGitHubContext(cwd);
  let hasGitHubRemote = false;
  try {
    const { spawnSync } = await import('node:child_process');
    const remoteResult = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf-8' });
    hasGitHubRemote = remoteResult.status === 0 && !!remoteResult.stdout.trim();
  } catch { /* no git remote */ }
  let ghAuthenticated = false;
  try {
    const { spawnSync } = await import('node:child_process');
    const authResult = spawnSync('gh', ['auth', 'status'], { cwd, encoding: 'utf-8' });
    ghAuthenticated = authResult.status === 0;
  } catch { /* gh not installed or not authenticated */ }
  const result: InitExistingContext = {
    researcher_model: await resolveModelInternal(cwd, 'researcher'),
    synthesizer_model: await resolveModelInternal(cwd, 'researcher'),
    roadmapper_model: await resolveModelInternal(cwd, 'planner'),
    mapper_model: await resolveModelInternal(cwd, 'researcher'),
    commit_docs: config.commit_docs,
    project_exists: await pathExistsInternal(planningPath(cwd, 'PROJECT.md')),
    planning_exists: await pathExistsInternal(planningPath(cwd)),
    planning_files: planningFiles,
    has_codebase_map: await pathExistsInternal(planningPath(cwd, 'codebase')),
    has_existing_code: hasCode,
    has_package_file: hasPackageFile,
    has_git: await pathExistsInternal(path.join(cwd, '.git')),
    has_readme: await pathExistsInternal(path.join(cwd, 'README.md')),
    conflict_detected: planningFiles.length > 0,
    existing_file_count: planningFiles.length,
    brave_search_available: hasBraveSearch,
    parallelization: config.parallelization,
    project_path: '.planning/PROJECT.md',
    codebase_dir: '.planning/codebase',
    github_ready: ghCtx.github_ready,
    has_github_remote: hasGitHubRemote,
    gh_authenticated: ghAuthenticated,
  };
  return cmdOk(result);
}

export async function cmdInitProgress(cwd: string): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const milestone = await getMilestoneInfo(cwd);
  const ghCtx = getGitHubContext(cwd);
  const phases: ProgressPhaseInfo[] = [];
  let currentPhase: ProgressPhaseInfo | null = null;
  let nextPhase: ProgressPhaseInfo | null = null;

  // Try GitHub first for phase progress data
  let ghSourced = false;
  try {
    const { getAllPhasesProgress } = await import('../github/sync.js');
    const ghResult = await getAllPhasesProgress();
    if (ghResult.ok && ghResult.data.length > 0) {
      for (const entry of ghResult.data) {
        const { total, completed, tasks } = entry.progress;
        const hasResearch = false; // GitHub progress doesn't track research separately
        const status = completed === total && total > 0 ? 'complete' : completed > 0 ? 'in_progress' : 'pending';
        const titleMatch = entry.title.match(/\[Phase\s+\S+\]\s*(.*)/);
        const phaseName = titleMatch ? titleMatch[1].trim() : null;
        const phaseInfoItem: ProgressPhaseInfo = { number: entry.phaseNumber, name: phaseName, directory: `.planning/phases/${entry.phaseNumber}-${phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'unknown'}`, status, plan_count: total, summary_count: completed, has_research: hasResearch };
        phases.push(phaseInfoItem);
        if (!currentPhase && (status === 'in_progress')) currentPhase = phaseInfoItem;
        if (!nextPhase && status === 'pending') nextPhase = phaseInfoItem;
      }
      ghSourced = true;
    }
  } catch { /* GitHub not available */ }

  // GitHub is the single source of truth for phase progress.
  // If GitHub data is unavailable, phases array remains empty.
  let pausedAt: string | null = null;
  try { const state = fs.readFileSync(planningPath(cwd, 'STATE.md'), 'utf-8'); const pauseMatch = state.match(/\*\*Paused At:\*\*\s*(.+)/); if (pauseMatch) pausedAt = pauseMatch[1].trim(); } catch (e) { debugLog(e); }
  const result: ProgressContext = {
    executor_model: await resolveModelInternal(cwd, 'executor'),
    planner_model: await resolveModelInternal(cwd, 'planner'),
    commit_docs: config.commit_docs,
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    phases,
    phase_count: phases.length,
    completed_count: phases.filter(p => p.status === 'complete').length,
    in_progress_count: phases.filter(p => p.status === 'in_progress').length,
    current_phase: currentPhase,
    next_phase: nextPhase,
    paused_at: pausedAt,
    has_work_in_progress: !!currentPhase,
    project_exists: await pathExistsInternal(planningPath(cwd, 'PROJECT.md')),
    roadmap_exists: await pathExistsInternal(planningPath(cwd, 'ROADMAP.md')),
    state_exists: await pathExistsInternal(planningPath(cwd, 'STATE.md')),
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    project_path: '.planning/PROJECT.md',
    config_path: '.planning/config.json',
    github_ready: ghCtx.github_ready,
    project_number: ghCtx.project_number,
    phase_mappings: ghCtx.mapping
      ? Object.fromEntries(
          Object.entries(ghCtx.mapping.phases).map(([phaseNum, phaseMap]) => [
            phaseNum,
            { issue_number: phaseMap.tracking_issue.number, item_id: phaseMap.tracking_issue.item_id },
          ]),
        )
      : null,
  };
  return cmdOk(result);
}

// ─── Helper: list codebase docs ──────────────────────────────────────────────

/**
 * Scan .planning/codebase/ for .md files and return relative paths.
 * Returns empty array if the directory does not exist.
 */
export function listCodebaseDocs(cwd: string): string[] {
  const codebaseDir = planningPath(cwd, 'codebase');
  try {
    const files = fs.readdirSync(codebaseDir).filter(f => f.endsWith('.md'));
    return files.map(f => path.join('.planning', 'codebase', f));
  } catch {
    return [];
  }
}

// ─── Agent-level init commands ───────────────────────────────────────────────

export async function cmdInitExecutor(cwd: string, phase: string | undefined): Promise<CmdResult> {
  if (!phase) return cmdErr('phase required for init executor');
  const config = await loadConfig(cwd);
  const phaseInfo = await findPhaseInternal(cwd, phase);
  const codebaseDocs = listCodebaseDocs(cwd);
  const result: ExecutorAgentContext = {
    executor_model: await resolveModelInternal(cwd, 'executor'),
    verifier_model: await resolveModelInternal(cwd, 'verifier'),
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
    branching_strategy: config.branching_strategy,
    phase_branch_template: config.phase_branch_template,
    milestone_branch_template: config.milestone_branch_template,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory ?? null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    state_path: '.planning/STATE.md',
    codebase_docs: codebaseDocs,
  };
  if (await pathExistsInternal(planningPath(cwd, 'CONVENTIONS.md'))) {
    result.conventions_path = '.planning/CONVENTIONS.md';
  }
  return cmdOk(result);
}

export async function cmdInitPlanner(cwd: string, phase: string | undefined): Promise<CmdResult> {
  if (!phase) return cmdErr('phase required for init planner');
  const config = await loadConfig(cwd);
  const phaseInfo = await findPhaseInternal(cwd, phase);
  const phase_req_ids = await extractReqIds(cwd, phase);
  const codebaseDocs = listCodebaseDocs(cwd);
  const result: PlannerAgentContext = {
    planner_model: await resolveModelInternal(cwd, 'planner'),
    checker_model: await resolveModelInternal(cwd, 'planner'),
    commit_docs: config.commit_docs,
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory ?? null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    phase_req_ids,
    has_research: phaseInfo?.has_research ?? false,
    has_context: phaseInfo?.has_context ?? false,
    has_plans: (phaseInfo?.plans?.length ?? 0) > 0,
    plan_count: phaseInfo?.plans?.length ?? 0,
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
    codebase_docs: codebaseDocs,
  };
  if (await pathExistsInternal(planningPath(cwd, 'CONVENTIONS.md'))) {
    result.conventions_path = '.planning/CONVENTIONS.md';
  }
  return cmdOk(result);
}

export async function cmdInitResearcher(cwd: string, phase: string | undefined): Promise<CmdResult> {
  if (!phase) return cmdErr('phase required for init researcher');
  const config = await loadConfig(cwd);
  const phaseInfo = await findPhaseInternal(cwd, phase);
  const phase_req_ids = await extractReqIds(cwd, phase);
  const codebaseDocs = listCodebaseDocs(cwd);
  const result: ResearcherAgentContext = {
    researcher_model: await resolveModelInternal(cwd, 'researcher'),
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory ?? null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') ?? null,
    phase_req_ids,
    has_research: phaseInfo?.has_research ?? false,
    has_context: phaseInfo?.has_context ?? false,
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
    codebase_docs: codebaseDocs,
  };
  if (await pathExistsInternal(planningPath(cwd, 'CONVENTIONS.md'))) {
    result.conventions_path = '.planning/CONVENTIONS.md';
  }
  return cmdOk(result);
}

export async function cmdInitVerifier(cwd: string, phase: string | undefined): Promise<CmdResult> {
  if (!phase) return cmdErr('phase required for init verifier');
  const config = await loadConfig(cwd);
  const phaseInfo = await findPhaseInternal(cwd, phase);
  const phase_req_ids = await extractReqIds(cwd, phase);
  const codebaseDocs = listCodebaseDocs(cwd);
  const result: VerifierAgentContext = {
    verifier_model: await resolveModelInternal(cwd, 'verifier'),
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory ?? null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    phase_req_ids,
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
    codebase_docs: codebaseDocs,
  };
  return cmdOk(result);
}

export async function cmdInitDebugger(cwd: string, phase: string | undefined): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const phaseInfo = phase ? await findPhaseInternal(cwd, phase) : null;
  const codebaseDocs = listCodebaseDocs(cwd);
  const result: DebuggerAgentContext = {
    debugger_model: await resolveModelInternal(cwd, 'debugger'),
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory ?? null,
    phase_number: phaseInfo?.phase_number ?? null,
    phase_name: phaseInfo?.phase_name ?? null,
    state_path: '.planning/STATE.md',
    codebase_docs: codebaseDocs,
  };
  if (await pathExistsInternal(planningPath(cwd, 'CONVENTIONS.md'))) {
    result.conventions_path = '.planning/CONVENTIONS.md';
  }
  return cmdOk(result);
}

// ─── Drift-related init commands ─────────────────────────────────────────────

export async function cmdInitCheckDrift(cwd: string): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const driftModel = await resolveModelInternal(cwd, 'verifier');

  const hasPlanning = await pathExistsInternal(planningPath(cwd));
  const hasRequirements = await pathExistsInternal(planningPath(cwd, 'REQUIREMENTS.md'));
  const hasRoadmap = await pathExistsInternal(planningPath(cwd, 'ROADMAP.md'));
  const hasNogos = await pathExistsInternal(planningPath(cwd, 'NO-GOS.md'));
  const hasConventions = await pathExistsInternal(planningPath(cwd, 'CONVENTIONS.md'));
  const hasPreviousReport = await pathExistsInternal(planningPath(cwd, 'DRIFT-REPORT.md'));

  // Collect spec files that exist
  const specFiles: string[] = [];
  if (hasRequirements) specFiles.push('.planning/REQUIREMENTS.md');
  if (hasRoadmap) specFiles.push('.planning/ROADMAP.md');
  if (await pathExistsInternal(planningPath(cwd, 'STATE.md'))) specFiles.push('.planning/STATE.md');
  if (hasNogos) specFiles.push('.planning/NO-GOS.md');
  if (hasConventions) specFiles.push('.planning/CONVENTIONS.md');

  // Collect active phase directories
  let phaseDirs: string[] = [];
  try {
    const dirs = await listSubDirs(phasesPath(cwd), true);
    phaseDirs = dirs.map(d => `.planning/phases/${d}`);
  } catch { /* no phases dir */ }

  // Collect archived milestone directories
  let archivedMilestoneDirs: string[] = [];
  try {
    const archived = await getArchivedPhaseDirs(cwd);
    archivedMilestoneDirs = archived.map(a => a.basePath);
    // De-duplicate
    archivedMilestoneDirs = [...new Set(archivedMilestoneDirs)];
  } catch { /* no archived dirs */ }

  const codebaseDocs = listCodebaseDocs(cwd);

  const result: CheckDriftContext = {
    drift_model: driftModel,
    commit_docs: config.commit_docs,
    has_planning: hasPlanning,
    has_requirements: hasRequirements,
    has_roadmap: hasRoadmap,
    has_nogos: hasNogos,
    has_conventions: hasConventions,
    has_previous_report: hasPreviousReport,
    previous_report_path: hasPreviousReport ? '.planning/DRIFT-REPORT.md' : null,
    spec_files: specFiles,
    phase_dirs: phaseDirs,
    archived_milestone_dirs: archivedMilestoneDirs,
    state_path: '.planning/STATE.md',
    requirements_path: '.planning/REQUIREMENTS.md',
    roadmap_path: '.planning/ROADMAP.md',
    nogos_path: hasNogos ? '.planning/NO-GOS.md' : null,
    conventions_path: hasConventions ? '.planning/CONVENTIONS.md' : null,
    codebase_docs: codebaseDocs,
  };

  return cmdOk(result);
}

export async function cmdInitRealign(cwd: string, direction: string | undefined): Promise<CmdResult> {
  const config = await loadConfig(cwd);
  const hasReport = await pathExistsInternal(planningPath(cwd, 'DRIFT-REPORT.md'));
  const hasPlanning = await pathExistsInternal(planningPath(cwd));

  // Collect active phase directories
  let phaseDirs: string[] = [];
  try {
    const dirs = await listSubDirs(phasesPath(cwd), true);
    phaseDirs = dirs.map(d => `.planning/phases/${d}`);
  } catch { /* no phases dir */ }

  const codebaseDocs = listCodebaseDocs(cwd);

  const result: RealignContext = {
    commit_docs: config.commit_docs,
    direction: direction ?? null,
    has_report: hasReport,
    report_path: '.planning/DRIFT-REPORT.md',
    has_planning: hasPlanning,
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',
    phase_dirs: phaseDirs,
    codebase_docs: codebaseDocs,
  };

  return cmdOk(result);
}
