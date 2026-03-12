/**
 * @maxsim/core — Shared utilities, constants, and type definitions
 */

// Type-only exports
export type {
  CmdResult,
  BranchingStrategy,
  PhaseNumber,
  PhasePath,
  PhaseSlug,
  Result,
  ModelTier,
  ModelProfileName,
  ModelResolution,
  ModelProfileEntry,
  AgentType,
  ModelProfiles,
  PhaseSearchResult,
  RoadmapPhaseInfo,
  ArchivedPhaseDir,
  GitResult,
  MilestoneInfo,
  AppConfig,
  FrontmatterData,
  FrontmatterValue,
  FrontmatterParseResult,
  FrontmatterValidationResult,
  FrontmatterSchema,
  PlanningConfig,
  WorkflowConfig,
  StateSection,
  Decision,
  Blocker,
  PerformanceMetric,
  StateData,
  StatePatchResult,
  StateSessionOptions,
  StateMetricOptions,
  StateDecisionOptions,
  StateBlockerOptions,
  StateSnapshot,
  PhaseStatus,
  RoadmapPhase,
  RoadmapMilestone,
  RoadmapAnalysis,
  RoadmapPhaseDetail,
  RoadmapPhaseNotFound,
  RoadmapGetPhaseResult,
  MilestoneCompleteOptions,
  MilestoneResult,
  ArchiveResult,
  HistoryDigest,
  HistoryPhaseDigest,
  SlugResult,
  WebSearchOptions,
  WebSearchResult,
  ScaffoldOptions,
  TimestampFormat,
  PhaseAddResult,
  PhaseInsertResult,
  PhaseRemoveResult,
  PhaseCompleteResult,
  PhasePlanIndexResult,
  PhasesListOptions,
  ArchivePreview,
  ExecutorAgentContext,
  PlannerAgentContext,
  ResearcherAgentContext,
  VerifierAgentContext,
  DebuggerAgentContext,
  CheckDriftContext,
  RealignContext,
  DriftReportFrontmatter,
  DriftStatus,
  DriftSeverity,
  DriftDirection,
  DriftItemStatus,
  WorktreeState,
  WorktreeMode,
  ExecutionMode,
  WorktreeInfo,
  WorktreeAssignment,
  ParallelExecutionConfig,
  ReviewConfig,
  ReviewGateResult,
  WaveExecutionResult,
} from './types.js';

// Runtime value exports from types
export {
  phaseNumber,
  phasePath,
  phaseSlug,
  ok,
  err,
  cmdOk,
  cmdErr,
  PLANNING_CONFIG_DEFAULTS,
} from './types.js';

// Runtime exports from core
export {
  MODEL_PROFILES,
  output,
  error,
  CliOutput,
  CliError,
  rethrowCliSignals,
  writeOutput,
  safeReadFile,
  loadConfig,
  isGitIgnored,
  execGit,
  normalizePhaseName,
  comparePhaseNum,
  getPhasePattern,
  findPhaseInternal,
  getArchivedPhaseDirs,
  getRoadmapPhaseInternal,
  resolveModelInternal,
  pathExistsInternal,
  generateSlugInternal,
  getMilestoneInfo,
  listSubDirs,
  archivePath,
} from './core.js';

// Frontmatter exports
export {
  extractFrontmatter,
  reconstructFrontmatter,
  spliceFrontmatter,
  parseMustHavesBlock,
  FRONTMATTER_SCHEMAS,
  cmdFrontmatterGet,
  cmdFrontmatterSet,
  cmdFrontmatterMerge,
  cmdFrontmatterValidate,
} from './frontmatter.js';

// Config exports
export {
  cmdConfigEnsureSection,
  cmdConfigSet,
  cmdConfigGet,
} from './config.js';

// State exports
export {
  stateExtractField,
  stateReplaceField,
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
  cmdDetectStaleContext,
} from './state.js';

// Roadmap exports
export {
  cmdRoadmapGetPhase,
  cmdRoadmapAnalyze,
  cmdRoadmapUpdatePlanProgress,
} from './roadmap.js';

// Milestone exports
export {
  cmdRequirementsMarkComplete,
  cmdMilestoneComplete,
} from './milestone.js';

// Commands exports
export {
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
} from './commands.js';

// Verify exports
export type {
  ValidationError,
  ValidationWarning,
  TaskInfo,
  VerificationResult,
  PlanStructureResult,
  PhaseCompletenessResult,
  ReferencesResult,
  CommitsResult,
  ArtifactCheck,
  ArtifactsResult,
  KeyLinkCheck,
  KeyLinksResult,
  ConsistencyResult,
  HealthResult,
  RequirementExistenceResult,
  RequirementStatusResult,
  EvidenceCompletenessResult,
} from './verify.js';

export {
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
  validateRequirementExistence,
  validateRequirementStatus,
  validateEvidenceCompleteness,
} from './verify.js';

// Drift exports
export {
  cmdDriftReadReport,
  cmdDriftWriteReport,
  cmdDriftExtractRequirements,
  cmdDriftExtractNoGos,
  cmdDriftExtractConventions,
  cmdDriftPreviousHash,
} from './drift.js';

// Phase exports
export {
  cmdPhasesList,
  cmdPhaseNextDecimal,
  cmdFindPhase,
  cmdPhasePlanIndex,
  cmdPhaseAdd,
  cmdPhaseInsert,
  cmdPhaseRemove,
  cmdPhaseComplete,
  archivePhasePreview,
  archivePhaseExecute,
  cmdGetArchivedPhase,
} from './phase.js';

// Template exports
export type {
  TemplateSelectResult,
  TemplateFillOptions,
  TemplateFillResult,
} from './template.js';

export {
  cmdTemplateSelect,
  cmdTemplateFill,
} from './template.js';

// Artefakte exports
export {
  cmdArtefakteRead,
  cmdArtefakteWrite,
  cmdArtefakteAppend,
  cmdArtefakteList,
} from './artefakte.js';

// Context loader exports
export type {
  ContextFile,
  ContextLoadResult,
} from './context-loader.js';

export {
  cmdContextLoad,
} from './context-loader.js';

// Skills exports
export {
  cmdSkillList,
  cmdSkillInstall,
  cmdSkillUpdate,
} from './skills.js';

// Init exports
export type {
  WorkflowType,
  InitContext,
  ExecutePhaseContext,
  PlanPhaseContext,
  NewProjectContext,
  NewMilestoneContext,
  QuickContext,
  ResumeContext,
  VerifyWorkContext,
  PhaseOpContext,
  MilestoneOpContext,
  MapCodebaseContext,
  InitExistingContext,
  ProgressContext,
} from './init.js';

export {
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
  cmdInitCheckDrift,
  cmdInitRealign,
  listCodebaseDocs,
} from './init.js';

// Worktree exports
export {
  createWorktree,
  listWorktrees,
  cleanupWorktree,
  cleanupAllWorktrees,
  assignPlansToWorktrees,
  decideExecutionMode,
  validatePlanIndependence,
  cmdWorktreeCreate,
  cmdWorktreeList,
  cmdWorktreeCleanup,
  cmdDecideExecutionMode,
  cmdValidatePlanIndependence,
} from './worktree.js';
