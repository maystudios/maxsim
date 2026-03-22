# Wave-Based Task Execution and Dependency-Aware Scheduling
## Design Specification for AI Agent Orchestration

**Version:** 1.0
**Date:** 2026-03-22
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Concepts](#2-core-concepts)
3. [Dependency Specification](#3-dependency-specification)
4. [Wave Formation Algorithm](#4-wave-formation-algorithm)
5. [File Conflict Detection](#5-file-conflict-detection)
6. [Wave Execution](#6-wave-execution)
7. [Adaptive Wave Optimization](#7-adaptive-wave-optimization)
8. [Progress Tracking](#8-progress-tracking)
9. [Integration with Competitive Implementation](#9-integration-with-competitive-implementation)
10. [Error Recovery Per Wave](#10-error-recovery-per-wave)
11. [Data Structures and Interfaces](#11-data-structures-and-interfaces)
12. [Implementation Guidance](#12-implementation-guidance)

---

## 1. Overview

Wave-based task execution is a scheduling strategy that groups interdependent tasks into sequential "waves," where each wave contains tasks that can run fully in parallel. Wave N+1 does not begin until all tasks in Wave N have completed (or failed and been handled). This model derives from classical parallel scheduling research — specifically the decentralized "wave scheduling" model described by the IEEE in 1984 for multicomputer systems — and aligns with modern AI agent orchestration patterns used by systems such as Apache Airflow (DAG-based), LangGraph, and CrewAI.

The primary goals of this design are:

- **Maximize parallelism** by identifying the maximum set of tasks that share no dependency relationship and touch no conflicting files.
- **Maintain correctness** by ensuring no task runs before its declared or implicitly detected dependencies are satisfied.
- **Support recovery** by confining the blast radius of failures to individual waves, preventing unnecessary cascade cancellations.
- **Enable competition** by allowing multiple agent slots to attempt the same task within a wave, with the best result selected before the next wave begins.

---

## 2. Core Concepts

### 2.1 Directed Acyclic Graph (DAG) Model

All tasks and their dependencies are modeled as a Directed Acyclic Graph (DAG). Each node is a task; each directed edge `A → B` means "task A must complete before task B may begin." A topological ordering of this DAG is a linear arrangement of nodes such that for every edge `u → v`, node `u` appears before `v`.

A topological ordering is only possible if the graph contains no directed cycles. If a cycle exists, the dependencies are contradictory and must be resolved before scheduling can proceed.

### 2.2 Wave (Level) Definition

A **wave** is a set of tasks at the same "depth level" in the DAG. Depth is defined as the length of the longest dependency chain leading to a task from any root task (a task with no dependencies). Tasks at the same depth level have no dependency relationship with each other and can therefore execute concurrently.

```
Wave 0 (roots): Tasks with no dependencies
Wave 1:         Tasks whose only dependencies are in Wave 0
Wave 2:         Tasks whose dependencies are all in Wave 0 or Wave 1
...
Wave N:         Tasks whose all dependencies are in waves 0 through N-1
```

### 2.3 Critical Path

The **critical path** is the longest chain of dependent tasks in the DAG. It determines the minimum total execution time — no scheduling optimization can reduce total time below the sum of durations along the critical path. Tasks on the critical path have zero scheduling flexibility (zero "float"); all other tasks have positive float and can tolerate delays without affecting the end date.

Understanding the critical path informs:
- Which tasks to prioritize (or parallelize most aggressively)
- Where to apply competitive implementation (running redundant agents on critical-path tasks)
- Where dynamic wave splitting will have the greatest impact

---

## 3. Dependency Specification

### 3.1 Explicit Dependencies — GitHub Issue References

Tasks declared as GitHub Issues can express dependencies using GitHub's native issue dependency API (available since August 2025). Two relationship types exist:

- **"Blocked by"**: This task cannot start until the referenced issue is resolved.
- **"Blocking"**: This task blocks another issue from starting.

In the wave scheduler's task manifest (typically `tasks.json` or embedded in issue metadata), explicit dependencies are specified as:

```json
{
  "task_id": "T-42",
  "github_issue": 42,
  "depends_on": [38, 39, 41],
  "description": "Implement authentication middleware"
}
```

The `depends_on` array lists GitHub issue numbers that must be in a completed state before `T-42` may be scheduled. The wave scheduler reads this metadata to construct the initial dependency graph.

### 3.2 Explicit Dependencies — File-Based Specification

For local or non-GitHub workflows, tasks declare dependencies in a manifest file:

```json
{
  "tasks": [
    {
      "id": "build-schema",
      "depends_on": [],
      "outputs": ["src/schema.ts"],
      "description": "Generate database schema types"
    },
    {
      "id": "build-api",
      "depends_on": ["build-schema"],
      "inputs": ["src/schema.ts"],
      "outputs": ["src/api/routes.ts"],
      "description": "Generate API route handlers"
    }
  ]
}
```

The `depends_on` list is the canonical source of explicit dependency edges. The `inputs` and `outputs` fields are used by the implicit dependency detector (see Section 3.3).

### 3.3 Implicit Dependencies via Static Analysis

Two tasks that modify the same file share an **implicit dependency** even if neither declares the other in `depends_on`. Before wave formation, the scheduler runs an implicit dependency detection pass.

**Detection algorithm:**

1. For each task, collect the set of files it is expected to read (`reads`) and write (`writes`). This information comes from:
   - Declared `inputs`/`outputs` in the task manifest.
   - Static analysis of the task's code or command (e.g., scanning import statements, Makefile targets, build scripts).
   - Historical execution logs from prior runs.

2. Build a **file-access matrix**: a map from file path to `{readers: Set<TaskId>, writers: Set<TaskId>}`.

3. Apply the following rules to infer dependency edges:
   - **Write-After-Write (WAW):** If tasks A and B both write to the same file, one must precede the other. Without further information, mark this as a conflict (see Section 5) rather than a dependency.
   - **Read-After-Write (RAW):** If task A writes a file and task B reads it, add the edge `A → B` (A is a dependency of B).
   - **Write-After-Read (WAR):** If task A reads a file and task B writes it, add the edge `A → B` to ensure A reads the original content before B overwrites it.

4. Add all inferred edges to the dependency graph before running the topological sort.

**Static analysis techniques** used to extract file access:
- AST parsing: identify import/require/open/write calls.
- Command scanning: parse shell commands for redirection operators and argument patterns.
- Annotation extraction: read structured comments or decorators that declare I/O contracts.

**Dynamic analysis fallback:** When static analysis cannot determine file access with confidence, a dry-run or sandboxed preview execution can record actual file system calls (using `strace` on Linux, Detours on Windows, or `DYLD_INSERT_LIBRARIES` on macOS) to produce a ground-truth access log.

---

## 4. Wave Formation Algorithm

### 4.1 Input

- A set of tasks `T = {t1, t2, ..., tn}`.
- A set of explicit dependency edges `E_explicit` derived from `depends_on` declarations.
- A set of implicit dependency edges `E_implicit` derived from static analysis (Section 3.3).
- The combined edge set `E = E_explicit ∪ E_implicit`.

### 4.2 Cycle Detection

Before sorting, the algorithm must verify the graph is acyclic. Cycles represent contradictory dependencies (e.g., A depends on B which depends on A).

**Algorithm: DFS-based cycle detection**

```
function detect_cycles(tasks, edges):
    state = {}  // UNVISITED | IN_STACK | DONE
    cycles = []

    for each task t in tasks:
        if state[t] == UNVISITED:
            path = []
            dfs_detect(t, edges, state, path, cycles)

    return cycles

function dfs_detect(t, edges, state, path, cycles):
    state[t] = IN_STACK
    path.push(t)

    for each neighbor n of t (t → n in edges):
        if state[n] == IN_STACK:
            // Found a cycle: extract the cycle from path
            cycle_start = path.index(n)
            cycles.append(path[cycle_start:] + [n])
        elif state[n] == UNVISITED:
            dfs_detect(n, edges, state, path, cycles)

    path.pop()
    state[t] = DONE
```

Alternatively, **Kahn's algorithm** naturally detects cycles: if, after processing all zero-in-degree nodes, some nodes remain in the graph (their in-degree never reached zero), those nodes form one or more cycles.

### 4.3 Circular Dependency Resolution

When cycles are detected, the scheduler must not silently ignore them. The resolution strategy is:

1. **Report clearly.** Emit a structured error identifying all tasks involved in each cycle and the dependency path that forms the cycle.

2. **Attempt automatic resolution** using one of three strategies (in priority order):

   a. **Edge removal by confidence score.** Implicit edges have a confidence score (0.0–1.0) based on how certain the static analysis was. When an implicit edge participates in a cycle, remove the lowest-confidence edge in the cycle and re-run cycle detection.

   b. **Introduce a serialization point.** If both edges in a cycle are explicit (user-declared), insert a synthetic "merge task" that both tasks in the cycle must complete before the scheduler proceeds. This surfaced to the user as a warning requiring confirmation.

   c. **Topological tie-breaking.** For WAW conflicts promoted to cycles, apply a deterministic ordering rule (e.g., alphabetical task ID, or declared priority field) to break the tie by converting the undirected conflict into a directed edge.

3. **Escalate to the user** if automatic resolution is not possible. Do not proceed with scheduling until all cycles are resolved.

### 4.4 Topological Sort with Wave Assignment

Once the graph is confirmed acyclic, assign each task to a wave using a BFS-based level computation (an extension of Kahn's algorithm):

```
function build_waves(tasks, edges):
    // Compute in-degree for each task
    in_degree = {t: 0 for t in tasks}
    for each edge (u → v) in edges:
        in_degree[v] += 1

    // Wave 0: all tasks with no dependencies
    current_wave = []
    for each task t in tasks:
        if in_degree[t] == 0:
            current_wave.append(t)

    waves = []
    while current_wave is not empty:
        waves.append(current_wave)
        next_wave_candidates = {}

        for each task t in current_wave:
            for each successor s of t (t → s in edges):
                in_degree[s] -= 1
                if in_degree[s] == 0:
                    next_wave_candidates[s] = true

        current_wave = list(next_wave_candidates.keys())

    if sum(len(w) for w in waves) < len(tasks):
        raise CycleDetectedError("Not all tasks were assigned to waves")

    return waves
```

**Key property:** All tasks within the same wave have no dependency relationship with each other (direct or transitive). This is what makes parallel execution within a wave safe — subject to file conflict resolution (Section 5).

### 4.5 Wave Assignment Example

Given tasks A, B, C, D, E with edges `A→C`, `B→C`, `C→D`, `C→E`:

```
Wave 0: [A, B]        (no dependencies)
Wave 1: [C]           (depends on A and B)
Wave 2: [D, E]        (depend on C)
```

Critical path: `A → C → D` (or `→ E`). Length = 3 waves.

---

## 5. File Conflict Detection

### 5.1 Purpose

Two tasks in the same wave may independently attempt to write the same file. Unlike a dependency conflict (which is resolved before scheduling), a **file conflict** is a race condition: if both tasks in Wave N write `src/config.ts`, the final file content is undefined and the next wave may receive corrupted input.

File conflict detection runs as a pre-flight check before each wave begins execution.

### 5.2 Detection Algorithm

```
function detect_file_conflicts(wave: Task[]):
    write_map = {}  // file_path → [TaskId]

    for each task t in wave:
        for each file f in t.writes:
            if f not in write_map:
                write_map[f] = []
            write_map[f].append(t.id)

    conflicts = {}
    for each (file, writers) in write_map:
        if len(writers) > 1:
            conflicts[file] = writers

    return conflicts
```

### 5.3 Conflict Resolution — Wave Promotion

When a conflict is detected, the scheduler resolves it by **promoting** one of the conflicting tasks to a later wave:

1. Identify which conflicting task has the highest number of dependents (i.e., the most downstream work waiting on it). Keep this task in the current wave to minimize total schedule delay.

2. Promote the remaining conflicting tasks to a new wave inserted between the current wave and the next wave.

3. Add a dependency edge from the kept task to each promoted task (so the promoted tasks execute after the kept task has written the file).

4. Re-run the wave formation algorithm from Step 4.4 on the modified graph.

**Example:**
Wave 2 contains tasks `X` and `Y`, both writing `src/shared.ts`.
- `X` has 5 dependents; `Y` has 1.
- Keep `X` in Wave 2; promote `Y` to new Wave 3.
- Insert original Wave 3 tasks as new Wave 4.
- Add edge `X → Y`.

### 5.4 Read Conflict Policy

Tasks in the same wave that both *read* the same file (with no writer in the wave) are not conflicting — concurrent reads are safe. No action is required.

---

## 6. Wave Execution

### 6.1 Execution Model

Each wave executes as a concurrent batch:

```
for each wave W in waves:
    pre_flight_check(W)           // File conflict detection (Section 5)
    results = execute_parallel(W) // Launch all tasks simultaneously
    handle_results(W, results)    // Collect outcomes
    if not can_proceed(results):
        run_error_recovery(W, results)  // Section 10
    // Wave N+1 does not start until this loop iteration completes
```

**Wave N+1 never begins until Wave N is fully resolved** — either all tasks completed, or the error recovery process for Wave N has reached a stable state (succeeded, skipped, or escalated).

### 6.2 Parallel Execution Within a Wave

All tasks in a wave are dispatched simultaneously. The execution substrate (thread pool, async event loop, process pool, or remote agent pool) determines the actual parallelism. The scheduler does not impose artificial sequencing within a wave.

Each task execution produces a **TaskResult**:

```typescript
interface TaskResult {
  task_id: string;
  status: "success" | "failed" | "timeout" | "skipped";
  started_at: number;       // Unix timestamp ms
  completed_at: number;
  duration_ms: number;
  output: unknown;
  error?: string;
  files_modified: string[];  // Actual files written (for post-wave analysis)
  retry_count: number;
}
```

### 6.3 Wave Completion Gate

A wave is considered "complete" when every task slot in the wave has a terminal status (`success`, `failed`, `skipped`). Tasks in a `timeout` state are transitioned to `failed` before the gate is evaluated.

The scheduler waits for the last task in the wave to reach a terminal state before advancing. There is no mechanism to allow Wave N+1 to "steal" tasks from Wave N early — this preserves the correctness guarantee.

### 6.4 Partial Wave Failure Handling

When Wave N completes with a mix of successes and failures:

1. **Identify successful tasks.** Their outputs are committed and available to Wave N+1.
2. **Identify failed tasks.** Apply retry logic (Section 10.1).
3. **Evaluate the dependency graph forward.** Determine which Wave N+1 tasks depend *exclusively* on successful Wave N tasks versus those that depend on at least one failed Wave N task.
4. **Split Wave N+1 if possible:**
   - Sub-wave N+1a: tasks that depend only on successful tasks. May proceed immediately.
   - Sub-wave N+1b: tasks blocked by at least one failed Wave N task. Held pending error resolution.
5. **This split is itself a new wave formation** — run Section 4.4 on the subset.

---

## 7. Adaptive Wave Optimization

### 7.1 Post-Wave Re-Analysis

After each wave completes, the scheduler re-analyzes the remaining dependency graph using information that only became available at runtime:

- **Actual files modified** (from `TaskResult.files_modified`): may differ from declared `outputs`.
- **New tasks discovered** (a completed task may spawn sub-tasks — dynamic DAG expansion).
- **Updated duration estimates**: actual wave durations refine the time model.
- **Dependency conditions that became false**: a task may declare a conditional dependency ("depends on X only if X produces file Y"). If X succeeded but did not produce Y, the conditional edge is dropped.

The re-analysis runs the wave formation algorithm (Section 4.4) on the remaining tasks plus any new tasks, producing a revised wave schedule for the remainder of the run.

### 7.2 Dynamic Wave Splitting

A single slow task can hold up an entire wave, blocking all of Wave N+1 even if N+1's other prerequisites are already satisfied by other completed Wave N tasks. Dynamic wave splitting addresses this.

**Detection condition:** A task `T` in Wave N is still running after a configurable threshold (e.g., 2× the median duration of completed tasks in Wave N). Call `T` a "straggler."

**Splitting procedure:**

1. Partition the Wave N+1 task set into two groups:
   - `Ready`: tasks whose only unmet dependency is `T`.
   - `Blocked_by_T`: tasks that additionally depend on `T`'s output.

   Wait — this is the same split described in Section 6.4. Wave splitting is the proactive version of that split, applied before `T` officially fails.

2. Promote `Blocked_by_T` tasks into a new Wave N+2 (or later).
3. Allow Wave N+1 (the `Ready` subset) to begin immediately, in parallel with the still-running `T`.
4. When `T` eventually completes, schedule `Blocked_by_T` tasks into the earliest available wave where their dependencies are satisfied.

**Concurrency invariant:** The splitting procedure must never cause a task to start before its dependencies are satisfied. The scheduler re-validates the full dependency graph after each split.

### 7.3 Critical Path Re-Computation

After each wave, re-compute the critical path of the remaining DAG using the **longest path algorithm**:

```
function compute_critical_path(remaining_tasks, edges, duration_estimates):
    // Assign each task a "longest path" length from itself to any terminal task
    longest = {t: duration_estimates[t] for t in remaining_tasks}

    for each task t in reverse_topological_order(remaining_tasks, edges):
        for each predecessor p of t:
            longest[p] = max(longest[p], duration_estimates[p] + longest[t])

    critical_path_length = max(longest.values())
    critical_tasks = [t for t in remaining_tasks if longest[t] == critical_path_length]
    return critical_path_length, critical_tasks
```

Tasks identified as critical receive priority scheduling (placed in the smallest possible wave number) and are candidates for competitive implementation (Section 9).

---

## 8. Progress Tracking

### 8.1 Wave-Level Status

The scheduler maintains a global execution state object:

```typescript
interface ExecutionState {
  total_waves: number;
  current_wave_index: number;
  waves: WaveState[];
  started_at: number;
  estimated_completion_at: number;
  critical_path_remaining_ms: number;
}

interface WaveState {
  wave_index: number;
  status: "pending" | "running" | "complete" | "partial_failure" | "failed";
  tasks: TaskState[];
  started_at?: number;
  completed_at?: number;
  duration_ms?: number;
}
```

### 8.2 Per-Task Status Within a Wave

```typescript
interface TaskState {
  task_id: string;
  wave_index: number;
  status: "pending" | "queued" | "running" | "success" | "failed" | "retrying" | "skipped";
  agent_slot?: string;           // Which agent slot is executing this task
  retry_count: number;
  started_at?: number;
  completed_at?: number;
  progress_pct?: number;         // 0–100, if the task reports incremental progress
  last_heartbeat?: number;       // For timeout detection
}
```

### 8.3 Estimated Completion Time

The scheduler estimates remaining time using a rolling model:

```
function estimate_remaining(state: ExecutionState):
    // Compute average wave duration from completed waves
    completed_durations = [w.duration_ms for w in state.waves if w.status == "complete"]
    if len(completed_durations) == 0:
        return UNKNOWN

    avg_wave_duration = mean(completed_durations)

    // Remaining waves = total - completed
    remaining_wave_count = state.total_waves - state.current_wave_index

    // Adjust for critical path
    estimated_remaining = max(
        avg_wave_duration * remaining_wave_count,
        state.critical_path_remaining_ms
    )
    return now() + estimated_remaining
```

This estimate is re-computed after each wave completes and each adaptive re-analysis cycle.

### 8.4 Progress Events

The scheduler emits structured progress events for consumption by UIs, logs, and monitoring systems:

```
WAVE_STARTED    { wave_index, task_count, wave_tasks[] }
TASK_STARTED    { wave_index, task_id, agent_slot }
TASK_PROGRESS   { wave_index, task_id, progress_pct }
TASK_COMPLETED  { wave_index, task_id, status, duration_ms }
WAVE_COMPLETED  { wave_index, status, duration_ms, failed_task_ids[] }
WAVE_RETRY      { wave_index, task_id, retry_count, reason }
EXECUTION_DONE  { total_duration_ms, wave_count, failed_tasks[] }
```

---

## 9. Integration with Competitive Implementation

### 9.1 Concept

In competitive implementation, the same logical task is assigned to multiple **agent slots** within the same wave. Each slot executes independently and produces a candidate result. After the wave completes (all slots have reached a terminal state), a **winner selection** step picks the best candidate before Wave N+1 begins.

This pattern mirrors the multi-agent parallelism strategy used by systems such as Verdent AI (which achieved 76.1% on SWE-bench by running multiple mid-sized models in parallel) and is analogous to ensemble methods in machine learning.

### 9.2 Slot Assignment

A task marked `competitive: true` in the manifest receives `N` agent slots (default: 2, configurable per task):

```json
{
  "id": "implement-auth",
  "depends_on": ["build-schema"],
  "competitive": true,
  "slots": 3,
  "winner_selection": "test_pass_rate"
}
```

Within the wave, each slot is treated as a separate execution unit but shares the same task identity for dependency purposes. All slots for a task must complete before winner selection can run.

### 9.3 Winner Selection Strategies

| Strategy | Mechanism |
|---|---|
| `test_pass_rate` | Run the task's associated test suite against each candidate; select the candidate with the highest pass rate. |
| `lint_score` | Run a linter; select the candidate with fewest violations. |
| `llm_review` | An evaluator LLM scores each candidate on correctness, style, and completeness; select highest score. |
| `voting` | If N ≥ 3, compare outputs pairwise; select the candidate chosen by majority. |
| `human` | Pause the wave gate and prompt a human reviewer to select. |
| `first_success` | Select the first slot that reaches `success` status (reduces latency for non-competitive tasks). |

### 9.4 Wave Gate with Winner Selection

The wave gate for a competitive task is extended:

```
function wave_gate_competitive(wave):
    // Wait for all slots of all tasks to complete
    await all_slots_terminal(wave)

    // For each competitive task, run winner selection
    for each task t in wave where t.competitive == true:
        winner = run_winner_selection(t, t.slot_results, t.winner_selection)
        commit_winner_output(winner)        // Write winner's files to shared workspace
        discard_losers(t.slot_results - winner)

    // Non-competitive tasks: their results are already committed
    advance_to_next_wave()
```

### 9.5 Failure Modes in Competitive Tasks

- **All slots fail:** Treat as a task failure; apply error recovery (Section 10).
- **Some slots fail, some succeed:** Winner selection proceeds among successful slots; failed slots are logged but do not block progression.
- **Winner selection itself fails:** Fall back to `first_success` strategy; if that also fails, escalate to human review.

---

## 10. Error Recovery Per Wave

### 10.1 Task-Level Retry Within a Wave

When a task fails, the scheduler attempts retry **within the same wave** before escalating:

```
function handle_task_failure(task, error):
    if task.retry_count < task.max_retries:
        task.retry_count += 1
        backoff = exponential_backoff(task.retry_count, base=1s, max=60s)
        schedule_retry(task, after=backoff)
        emit(WAVE_RETRY, task)
    else:
        task.status = "failed"
        emit(TASK_COMPLETED, task, status="failed")
```

Default retry policy:
- Maximum retries: 2 (configurable per task).
- Backoff: exponential with jitter, starting at 1 second, capped at 60 seconds.
- Retry on: transient errors (network, timeout, resource unavailability).
- Do not retry on: permanent errors (assertion failures, schema violations, explicit `NO_RETRY` signals from the task).

This mirrors best practices from Argo Workflows, Temporal, and AWS Step Functions, which all recommend retrying only failed activities (not entire workflows) with exponential backoff.

### 10.2 Partial Wave Failure Resolution

When a wave completes with mixed success/failure after all retries are exhausted:

**Phase 1: Triage**

```
successful_tasks  = [t for t in wave if t.status == "success"]
failed_tasks      = [t for t in wave if t.status == "failed"]
```

**Phase 2: Forward impact analysis**

For each failed task, compute its **downstream fan-out**: all tasks in future waves that (transitively) depend on it. This is the set of tasks that *cannot* proceed if the failure is not resolved.

**Phase 3: Resolution options (applied in order)**

1. **Skip and continue** (if the task is marked `optional: true`): Mark the task as `skipped`; remove its outgoing edges from the graph; continue to the next wave. Downstream tasks that depended only on this task (and no other failed tasks) are promoted to the earliest eligible wave.

2. **Substitute a fallback task**: If the task manifest defines a `fallback_task_id`, execute the fallback task immediately as a mini-wave before advancing. This is equivalent to inserting a new Wave N.5 containing only the fallback.

3. **Partial advance**: Allow tasks in Wave N+1 that do not (transitively) depend on any failed task to proceed. Hold tasks that do depend on failed tasks in a suspended state.

4. **Escalate to human**: If none of the above apply, pause the entire execution and surface the failure with full context to the operator.

### 10.3 Cascade Prevention

The naive response to a wave failure is to cancel all downstream waves immediately. This is almost always wrong, because:

- Some tasks in Wave N+1 may not depend on any failed task and should proceed.
- The failed task may be retried or substituted, making cancellation premature.
- Downstream tasks carry their own value and should not be discarded without evidence they cannot succeed.

**Cascade prevention rules:**

1. Never cancel a downstream task until the failure of its specific dependencies is confirmed and all retry/fallback options are exhausted.
2. Maintain an explicit `blocked_by` set for each task. A task enters `suspended` state only when at least one member of its `blocked_by` set is in `failed` state.
3. When a failed task is recovered (via retry or fallback), immediately unsuspend all tasks in its downstream fan-out and re-evaluate their wave membership.
4. Only mark a downstream task as `cancelled` after a human operator or explicit policy confirms that the blocking failure is permanent and irrecoverable.

### 10.4 Wave Failure Classification

| Scenario | Wave Status | Action |
|---|---|---|
| All tasks succeeded | `complete` | Advance to next wave |
| All tasks failed | `failed` | Apply recovery; may halt or escalate |
| Some tasks failed, all failures are optional | `complete_with_warnings` | Advance; log warnings |
| Some tasks failed, at least one is required | `partial_failure` | Partial advance (Section 10.2, Phase 3) |
| Failure in a competitive task (all slots failed) | `partial_failure` | Same as required task failure |

---

## 11. Data Structures and Interfaces

### 11.1 Task Manifest Schema

```typescript
interface TaskManifest {
  version: "1.0";
  tasks: TaskDefinition[];
}

interface TaskDefinition {
  id: string;
  description: string;
  command?: string;              // Shell command or agent instruction
  github_issue?: number;
  depends_on: string[];          // Explicit dependency IDs
  inputs?: string[];             // Files this task reads
  outputs?: string[];            // Files this task writes
  optional?: boolean;            // Can be skipped on failure
  competitive?: boolean;
  slots?: number;                // Number of agent slots if competitive
  winner_selection?: WinnerStrategy;
  max_retries?: number;          // Default: 2
  timeout_ms?: number;
  fallback_task_id?: string;
  priority?: number;             // Higher = prefer earlier wave placement on tie
  tags?: string[];
}

type WinnerStrategy =
  | "test_pass_rate"
  | "lint_score"
  | "llm_review"
  | "voting"
  | "human"
  | "first_success";
```

### 11.2 Wave Plan Schema

```typescript
interface WavePlan {
  generated_at: number;
  task_count: number;
  wave_count: number;
  critical_path_task_ids: string[];
  estimated_duration_ms: number;
  waves: WaveDefinition[];
  dependency_graph: DependencyEdge[];
  implicit_edges_added: DependencyEdge[];  // Edges detected via static analysis
  cycles_detected: CycleReport[];
  file_conflicts_resolved: FileConflictReport[];
}

interface WaveDefinition {
  wave_index: number;
  tasks: string[];               // Task IDs
  estimated_duration_ms: number; // Based on longest task in wave
}

interface DependencyEdge {
  from: string;
  to: string;
  type: "explicit" | "implicit_raw" | "implicit_war" | "implicit_waw" | "conflict_promotion";
  confidence?: number;           // For implicit edges
}

interface CycleReport {
  cycle_path: string[];
  resolution: "edge_removed" | "serialization_point" | "user_required";
  removed_edge?: DependencyEdge;
}

interface FileConflictReport {
  file_path: string;
  conflicting_tasks: string[];
  kept_in_wave: string;
  promoted_to_wave: number;
}
```

### 11.3 Scheduler Runtime API

```typescript
interface WaveScheduler {
  // Planning
  buildWavePlan(manifest: TaskManifest): WavePlan;
  validatePlan(plan: WavePlan): ValidationResult;

  // Execution
  execute(plan: WavePlan): Promise<ExecutionResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  abort(reason: string): Promise<void>;

  // Observation
  getState(): ExecutionState;
  onEvent(handler: (event: SchedulerEvent) => void): Unsubscribe;

  // Adaptive control
  replan(remaining_tasks: string[], new_tasks?: TaskDefinition[]): WavePlan;
  splitWave(wave_index: number, straggler_task_id: string): void;
}
```

---

## 12. Implementation Guidance

### 12.1 Algorithm Selection Summary

| Problem | Recommended Algorithm | Rationale |
|---|---|---|
| Topological ordering | Kahn's Algorithm (BFS-based) | Naturally produces wave levels; built-in cycle detection |
| Cycle detection | DFS with recursion stack | Simple; produces the cycle path for reporting |
| Critical path | Longest path on DAG | Guides prioritization and competitive implementation |
| File conflict detection | Hash-map scan | O(n) per wave; fast pre-flight check |
| Strongly connected components | Tarjan's algorithm | Identifies all tasks in a cycle simultaneously |

### 12.2 Complexity Analysis

- **Wave formation:** O(V + E) where V = task count, E = dependency edge count.
- **Cycle detection:** O(V + E).
- **File conflict detection:** O(T × F) where T = tasks in wave, F = max files per task.
- **Critical path computation:** O(V + E) on the remaining DAG.
- **Winner selection:** O(S × evaluation_cost) where S = number of slots per competitive task.

### 12.3 Handling Large Task Graphs

For very large task graphs (V > 1,000):

- Use incremental topological sort: only re-sort the subgraph affected by new dependency edges rather than re-running on the full graph.
- Cache the file-access matrix between runs; invalidate only tasks whose manifests changed.
- Parallelize the static analysis pass itself (analyze each task's files concurrently).
- Store the wave plan as a serialized artifact (`wave-plan.json`) so execution can resume from any completed wave without re-planning.

### 12.4 Persistence and Resumability

The execution state must be persisted durably after each task completion so that a crashed scheduler can resume from the last consistent state:

```
[Task T completes]
  → Write TaskResult to durable store
  → Update ExecutionState.waves[N].tasks[T].status
  → Flush ExecutionState to disk/database
  → Only then: evaluate wave gate; potentially launch Wave N+1
```

This "checkpoint after each task" approach mirrors the AWS Step Functions redrive model, which allows re-driving a failed workflow execution from its exact point of failure rather than restarting from the beginning.

### 12.5 Integration Points

The wave scheduler integrates with the broader agent orchestration system at the following boundaries:

| Boundary | Interface |
|---|---|
| Task invocation | `execute(task: TaskDefinition): Promise<TaskResult>` — delegates to agent runner |
| File workspace | Shared read/write layer (local fs, S3, git worktree); scheduler does not directly write files |
| GitHub Issues | REST/GraphQL API for reading `depends_on` relationships; webhooks for status updates |
| Winner selection | Evaluation service receives candidate outputs and returns scored ranking |
| Human escalation | Notification channel (Slack, email, dashboard) with a callback URL to resume |
| Progress display | Event stream consumed by CLI output, web dashboard, or CI/CD status API |

---

## Sources

Research consulted during the preparation of this specification:

- [Topological sorting - Wikipedia](https://en.wikipedia.org/wiki/Topological_sorting)
- [Scheduling Tasks with Topological Sorting - Bruno Scheufler](https://brunoscheufler.com/blog/2021-11-27-scheduling-tasks-with-topological-sorting)
- [Topological Sorting Explained: A Step-by-Step Guide for Dependency Resolution - Amit Kumar, Medium](https://medium.com/@amit.anjani89/topological-sorting-explained-a-step-by-step-guide-for-dependency-resolution-1a6af382b065)
- [Topological Sorting - GeeksforGeeks](https://www.geeksforgeeks.org/dsa/topological-sorting/)
- [Parallel Execution With Kahn's Algorithm - HeyCoach](https://heycoach.in/blog/parallel-execution-with-kahns-algorithm/)
- [Wave Scheduling—Decentralized Scheduling of Task Forces in Multicomputers - IEEE](https://ieeexplore.ieee.org/document/1676500/)
- [Wave scheduler - ACM, 11th Job Scheduling Strategies for Parallel Processing](https://dl.acm.org/doi/10.1007/11605300_10)
- [Parallel task scheduling - Wikipedia](https://en.wikipedia.org/wiki/Parallel_task_scheduling)
- [Critical path method - Wikipedia](https://en.wikipedia.org/wiki/Critical_path_method)
- [Critical Path Method (CPM) in Project Management - ProjectManager](https://www.projectmanager.com/guides/critical-path-method)
- [AI Agent Orchestration Patterns - Azure Architecture Center, Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [AI Agent Orchestration in 2026 - Kanerika](https://kanerika.com/blogs/ai-agent-orchestration/)
- [Workflow Orchestration: Building Complex AI Pipelines - Omar Aly, Medium](https://medium.com/@omark.k.aly/workflow-orchestration-building-complex-ai-pipelines-c8504ab8306f)
- [Task Dependency Resolution and Scheduling - jdx/mise DeepWiki](https://deepwiki.com/jdx/mise/5.2-task-execution-and-dependency-resolution)
- [Parallelizing Tasks with Dependencies - DZone](https://dzone.com/articles/parallelizing-tasks-with-dependencies-design-your)
- [Circular dependency - Grokipedia](https://grokipedia.com/page/Circular_dependency)
- [How to Handle Circular Dependencies: A Comprehensive Guide - AlgoCademy](https://algocademy.com/blog/how-to-handle-circular-dependencies-a-comprehensive-guide/)
- [Dependency Resolving Algorithm - Electric Monk](https://www.electricmonk.nl/docs/dependency_resolving_algorithm/dependency_resolving_algorithm.html)
- [Adaptive multiple-workflow scheduling with task rearrangement - Springer Nature](https://link.springer.com/article/10.1007/s11227-014-1361-0)
- [Dynamic Replanning: A New Way to Schedule Workflows - Automata](https://www.automata.tech/blog/dynamic-replanning-a-new-way-to-schedule-workflows-and-why-it-matters)
- [Implicit Dependency - ScienceDirect Topics](https://www.sciencedirect.com/topics/computer-science/implicit-dependency)
- [Creating issue dependencies - GitHub Docs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies)
- [Dependencies on issues - GitHub Changelog](https://github.blog/changelog/2025-08-21-dependencies-on-issues/)
- [Retrying Failed or Errored Steps - Argo Workflows](https://argo-workflows.readthedocs.io/en/latest/walk-through/retrying-failed-or-errored-steps/)
- [Retry logic in Workflows: Best practices - Temporal](https://temporal.io/blog/failure-handling-in-practice)
- [Introducing AWS Step Functions redrive - AWS Blog](https://aws.amazon.com/blogs/compute/introducing-aws-step-functions-redrive-a-new-way-to-restart-workflows/)
- [Multi-Agent Parallel Execution: Running Multiple AI Agents Simultaneously - Skywork](https://skywork.ai/blog/agent/multi-agent-parallel-execution-running-multiple-ai-agents-simultaneously/)
- [Multi-Agent Parallel Execution Outperforms Single Models on SWE-bench - Verdent AI 76.1%](https://jangwook.net/en/blog/en/multi-agent-swe-bench-verdent/)
- [Parallelization — Agentic Design Pattern Series - Data Learning Science](https://datalearningscience.com/p/3-parallelization-agentic-design)
