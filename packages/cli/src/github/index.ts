// Types
export type {
  GhUser, GhLabel, GhMilestone, GhIssue, GhComment,
  GhDiscussion,
  GhProject, GhProjectField, GhFieldOption, GhProjectItem,
  MaxsimIssueMeta, MaxsimIssueState, MaxsimCommentMeta,
  LabelDef, RepoInfo, GhResult, GhResultCode,
  GhIssueRelation,
  GhWikiPage,
} from './types.js';
export { MAXSIM_LABELS, BOARD_COLUMNS } from './types.js';

// Client
export { getOctokit, getRepoInfo, ghJson, ghExec, withGhResult, resetClient } from './client.js';

// Comments
export {
  parseIssueMeta, parseIssueState, parseCommentMeta,
  formatIssueMeta, formatIssueState, formatCommentHeader, buildIssueBody,
} from './comments.js';

// Issues
export {
  listIssues, createIssue, getIssue, updateIssue,
  listComments, addComment, addSubIssue, listSubIssues, closeIssue,
  addIssueRelation, removeIssueRelation, listIssueRelations,
} from './issues.js';

// Projects
export {
  createProject, listProjects, findProject,
  listProjectFields, getStatusField, getFieldOptionId,
  addItemToProject, moveItemToStatus,
  ensureProjectBoard,
} from './projects.js';

// Milestones
export {
  createMilestone, listMilestones, findMilestone,
  ensureMilestone, updateMilestone,
} from './milestones.js';

// Labels
export { ensureLabels, getLabel, createLabel } from './labels.js';

// Discussions
export { createDiscussion, listDiscussions, getDiscussion } from './discussions.js';

// Wiki
export { checkWikiEnabled, getWikiPage, createOrUpdateWikiPage, listWikiPages, deleteWikiPage } from './wiki.js';
