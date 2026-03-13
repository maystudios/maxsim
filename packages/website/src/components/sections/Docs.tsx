import { useState, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Copy, Check, Terminal, Settings, Users, FolderTree, ArrowRight } from "lucide-react";

type TabId = "getting-started" | "commands" | "architecture" | "configuration" | "agents";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-light transition-colors"
      aria-label="Copy code"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
          >
            <Check size={14} className="text-accent" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
          >
            <Copy size={14} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** Minimal syntax highlighter for code blocks */
function highlightCode(code: string, language: string): ReactNode[] {
  if (language === "text") {
    return [code];
  }

  const lines = code.split("\n");
  const result: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) result.push("\n");
    const line = lines[i];

    // Full-line comment
    if (/^\s*#/.test(line) || /^\s*\/\//.test(line)) {
      result.push(<span key={`comment-${i}`} className="syntax-comment">{line}</span>);
      continue;
    }

    // Tokenize the line
    const tokens = tokenizeLine(line, language);
    tokens.forEach((tok, j) => {
      const key = `${i}-${j}`;
      if (tok.type === "comment") {
        result.push(<span key={key} className="syntax-comment">{tok.text}</span>);
      } else if (tok.type === "string") {
        result.push(<span key={key} className="syntax-string">{tok.text}</span>);
      } else if (tok.type === "keyword") {
        result.push(<span key={key} className="syntax-keyword">{tok.text}</span>);
      } else {
        result.push(tok.text);
      }
    });
  }
  return result;
}

type Token = { type: "plain" | "comment" | "string" | "keyword"; text: string };

const JSON_KEYWORDS = /^(true|false|null)$/;
const BASH_KEYWORDS = /^(npx|npm|cd|node|git)$/;

function tokenizeLine(line: string, language: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Inline comment (# ...)
    const commentMatch = remaining.match(/^(#.*)$/);
    if (commentMatch) {
      tokens.push({ type: "comment", text: commentMatch[1] });
      remaining = "";
      continue;
    }

    // Double-quoted string
    const dqMatch = remaining.match(/^"([^"\\]|\\.)*"/);
    if (dqMatch) {
      tokens.push({ type: "string", text: dqMatch[0] });
      remaining = remaining.slice(dqMatch[0].length);
      continue;
    }

    // Single-quoted string
    const sqMatch = remaining.match(/^'([^'\\]|\\.)*'/);
    if (sqMatch) {
      tokens.push({ type: "string", text: sqMatch[0] });
      remaining = remaining.slice(sqMatch[0].length);
      continue;
    }

    // Word boundary — check for keywords
    const wordMatch = remaining.match(/^[a-zA-Z_]\w*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const isKeyword =
        (language === "json" && JSON_KEYWORDS.test(word)) ||
        (language === "bash" && BASH_KEYWORDS.test(word));
      tokens.push({ type: isKeyword ? "keyword" : "plain", text: word });
      remaining = remaining.slice(word.length);
      continue;
    }

    // Default: consume run of non-special characters
    const plainMatch = remaining.match(/^[^#"'a-zA-Z_]+/);
    const len = plainMatch ? plainMatch[0].length : 1;
    tokens.push({ type: "plain", text: remaining.slice(0, len) });
    remaining = remaining.slice(len);
  }
  return tokens;
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-surface-light px-4 py-2 rounded-t border border-border border-b-0">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">{language}</span>
        <CopyButton text={code.trim()} />
      </div>
      <pre className="bg-surface rounded-b border border-border overflow-x-auto p-4 text-sm font-mono leading-relaxed">
        <code className="text-zinc-300 whitespace-pre">{highlightCode(code.trim(), language)}</code>
      </pre>
    </div>
  );
}

function DocHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-foreground font-bold text-xl tracking-tight mb-4">{children}</h3>
  );
}

function DocSubheading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-foreground font-semibold text-base tracking-tight mb-3 mt-6">{children}</h4>
  );
}

function DocText({ children }: { children: ReactNode }) {
  return <p className="text-muted text-sm leading-relaxed mb-4">{children}</p>;
}

// ─── Tab: Getting Started ─────────────────────────────────────────────────────

function GettingStarted() {
  return (
    <div className="space-y-8">
      <div>
        <DocHeading>Installation</DocHeading>
        <DocText>
          Needs Node.js 22 or newer. MaxsimCLI installs markdown files into your
          AI runtime's config directories. No global binary required.
        </DocText>
      </div>

      <div>
        <DocSubheading>Quick Install (recommended)</DocSubheading>
        <CodeBlock
          language="bash"
          code={`npx maxsimcli@latest`}
        />
      </div>

      <div>
        <DocSubheading>What gets installed</DocSubheading>
        <DocText>
          Commands, workflows, and agent definitions go into your AI runtime's
          config directory. For Claude Code that's ~/.claude/.
        </DocText>
        <CodeBlock
          language="text"
          code={`~/.claude/
├── commands/maxsim/   # 9 user-facing commands (/maxsim:*)
├── agents/            # 4 specialized agent prompts
└── hooks/             # Pre/post hooks for automation`}
        />
      </div>

      <div>
        <DocSubheading>Start a new project</DocSubheading>
        <DocText>
          Kicks off a project with deep context gathering. Creates .planning/
          with PROJECT.md, REQUIREMENTS.md, and ROADMAP.md.
        </DocText>
        <CodeBlock
          language="bash"
          code={`# In your project directory, use the slash command:
/maxsim:init`}
        />
      </div>
    </div>
  );
}

// ─── Tab: Commands ────────────────────────────────────────────────────────────

interface CommandDef {
  name: string;
  signature: string;
  description: string;
  flags?: string[];
  example: string;
}

const commands: CommandDef[] = [
  {
    name: "debug",
    signature: "/maxsim:debug",
    description: "Starts a structured debugging session. State persists across context resets.",
    example: `/maxsim:debug "auth token not refreshing"`,
  },
  {
    name: "execute",
    signature: "/maxsim:execute",
    description: "Runs a phase plan with parallel agents, atomic commits per task, and goal-backward verification.",
    example: `/maxsim:execute 1`,
  },
  {
    name: "go",
    signature: "/maxsim:go",
    description: "Detects your project state and picks the right workflow automatically.",
    example: `/maxsim:go`,
  },
  {
    name: "help",
    signature: "/maxsim:help",
    description: "Lists all available commands with usage info.",
    example: `/maxsim:help`,
  },
  {
    name: "init",
    signature: "/maxsim:init",
    description: "Sets up a new project, onboards an existing one, or manages milestones.",
    example: `/maxsim:init`,
  },
  {
    name: "plan",
    signature: "/maxsim:plan",
    description: "Plans a phase through discussion, research, and planning stages.",
    example: `/maxsim:plan 1`,
  },
  {
    name: "progress",
    signature: "/maxsim:progress",
    description: "Shows current phase and milestone progress at a glance.",
    example: `/maxsim:progress`,
  },
  {
    name: "quick",
    signature: "/maxsim:quick",
    description: "Runs a quick standalone task outside the phase workflow.",
    example: `/maxsim:quick`,
  },
  {
    name: "settings",
    signature: "/maxsim:settings",
    description: "Opens MaxsimCLI configuration. Change model profile, workflow toggles, and more.",
    example: `/maxsim:settings`,
  },
];

function Commands() {
  return (
    <div className="space-y-10">
      {commands.map((cmd) => (
        <div key={cmd.name} className="border-l-2 border-accent pl-6">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <code className="text-accent font-mono font-semibold text-base">{cmd.signature}</code>
          </div>
          <DocText>{cmd.description}</DocText>

          {cmd.flags && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-muted font-medium mb-2">Flags</p>
              <div className="flex flex-wrap gap-2">
                {cmd.flags.map((f) => (
                  <span
                    key={f}
                    className="font-mono text-xs px-2 py-0.5 rounded bg-surface border border-border text-zinc-400"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          <CodeBlock language="bash" code={cmd.example} />
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Architecture ────────────────────────────────────────────────────────

function Architecture() {
  return (
    <div className="space-y-8">
      <div>
        <DocHeading>Three-Layer Structure</DocHeading>
        <DocText>
          Commands are markdown prompts, not executable code. The AI is the runtime.
          Commands load workflows, workflows spawn agents.
        </DocText>
        <CodeBlock
          language="text"
          code={`commands/maxsim/*.md       # User-facing command specs (9 files)
maxsim/workflows/*.md      # Implementation workflows
agents/*.md                # Specialized subagent prompts (4 agents)`}
        />
      </div>

      <div>
        <DocSubheading>Data Structure in User Projects</DocSubheading>
        <DocText>
          Creates a .planning/ directory in your project to track all state.
        </DocText>
        <CodeBlock
          language="text"
          code={`.planning/
├── config.json            # model_profile, workflow flags
├── PROJECT.md             # Vision (always loaded)
├── REQUIREMENTS.md        # v1/v2/out-of-scope requirements
├── ROADMAP.md             # Phase structure
├── STATE.md               # Memory: decisions, blockers, metrics
├── phases/
│   └── 01-Foundation/
│       ├── 01-CONTEXT.md        # User decisions
│       ├── 01-RESEARCH.md       # Phase findings
│       ├── 01-01-PLAN.md        # Task plan
│       ├── 01-01-SUMMARY.md     # Completion record
│       ├── 01-VERIFICATION.md   # Verification results
│       └── 01-UAT.md            # User acceptance tests
└── todos/pending/ & todos/completed/`}
        />
      </div>

      <div>
        <DocSubheading>Tools Layer</DocSubheading>
        <DocText>
          cli.cjs routes all tool calls to core modules: state management, phase lifecycle,
          roadmap parsing, verification. Large outputs go to a tmpfile and return as
          @file:/path to avoid buffer overflow.
        </DocText>
      </div>
    </div>
  );
}

// ─── Tab: Configuration ───────────────────────────────────────────────────────

const configJson = `{
  "model_profile": "balanced",
  "commit_docs": true,
  "search_gitignored": false,
  "branching_strategy": "none",
  "phase_branch_template": "maxsim/phase-{phase}-{slug}",
  "milestone_branch_template": "maxsim/{milestone}-{slug}",
  "workflow": { "research": true, "plan_checker": true, "verifier": true },
  "parallelization": true,
  "brave_search": false,
  "worktree_mode": "auto",
  "max_parallel_agents": 10,
  "review": { "spec_review": true, "code_review": true, "simplify_review": true, "retry_limit": 3 },
  "model_overrides": {}
}`;

function Configuration() {
  return (
    <div className="space-y-6">
      <div>
        <DocHeading>.planning/config.json</DocHeading>
        <DocText>
          Drop config.json into your .planning/ directory to adjust behavior.
          All values ship with sensible defaults.
        </DocText>
      </div>
      <CodeBlock language="json" code={configJson} />

      <div>
        <DocSubheading>Model Profiles</DocSubheading>
        <DocText>
          Four tiers control which Claude model each agent gets.
        </DocText>
        <CodeBlock
          language="text"
          code={`quality      → Opus for executor/planner/researcher, Sonnet for verifier/debugger
balanced     → Sonnet for executor/researcher, Opus for planner, Sonnet for verifier/debugger  (default)
budget       → Sonnet for executor/planner, Haiku for researcher/verifier/debugger
tokenburner  → Opus for all agents`}
        />
      </div>

      <div>
        <DocSubheading>Change profile</DocSubheading>
        <CodeBlock
          language="bash"
          code={`/maxsim:settings`}
        />
      </div>

      <div>
        <DocSubheading>Per-agent overrides</DocSubheading>
        <DocText>
          Override individual agents, no matter which profile is active:
        </DocText>
        <CodeBlock
          language="json"
          code={`{
  "model_profile": "balanced",
  "model_overrides": {
    "maxsim-planner": "opus",
    "maxsim-executor": "opus"
  }
}`}
        />
      </div>

      <div>
        <DocSubheading>Workflow Toggles</DocSubheading>
        <DocText>
          Toggle optional agents on or off. Trade thoroughness for speed:
        </DocText>
        <CodeBlock
          language="text"
          code={`research       → Phase researcher agent before planning   (default: true)
plan_checker   → Plan-checker agent before execution         (default: true)
verifier       → Verifier agent after execution              (default: true)
parallelization→ Wave-based parallel plan execution          (default: true)
brave_search   → Brave Search API in research agents         (default: false)`}
        />
      </div>
    </div>
  );
}

// ─── Tab: Agents ──────────────────────────────────────────────────────────────

const agents = [
  { name: "executor", description: "Implements code changes from the phase plan. Skills: tool-priority-guide, commit-conventions, verification-before-completion" },
  { name: "planner", description: "Builds detailed phase plans from research findings. Skills: brainstorming, sdd, roadmap-writing" },
  { name: "researcher", description: "Investigates the codebase and collects context for planning. Skills: research-methodology, evidence-collection" },
  { name: "verifier", description: "Checks completed work against spec and quality gates. Skills: code-review, verification-gates, input-validation" },
];

function Agents() {
  return (
    <div className="space-y-6">
      <div>
        <DocHeading>Specialized Agents</DocHeading>
        <DocText>
          Spawns specialized subagents, each with fresh context and one job.
          Agents live as markdown prompts in the agents/ directory.
        </DocText>
      </div>

      <div className="hidden md:block overflow-hidden border border-border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted font-medium w-48">Agent</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted font-medium">Responsibility</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, i) => (
              <motion.tr
                key={agent.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="border-b border-border last:border-0 hover:bg-surface transition-colors"
              >
                <td className="px-4 py-3">
                  <code className="font-mono text-accent text-xs">{agent.name}</code>
                </td>
                <td className="px-4 py-3 text-muted">{agent.description}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {agents.map((agent, i) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="border border-border rounded p-4 bg-surface"
          >
            <code className="font-mono text-accent text-sm font-semibold">{agent.name}</code>
            <p className="text-muted text-sm mt-1">{agent.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const tabs: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "getting-started", label: "Getting Started", Icon: Terminal },
  { id: "commands", label: "Commands", Icon: Terminal },
  { id: "architecture", label: "Architecture", Icon: FolderTree },
  { id: "configuration", label: "Configuration", Icon: Settings },
  { id: "agents", label: "Agents", Icon: Users },
];

function tabContent(id: TabId) {
  switch (id) {
    case "getting-started": return <GettingStarted />;
    case "commands": return <Commands />;
    case "architecture": return <Architecture />;
    case "configuration": return <Configuration />;
    case "agents": return <Agents />;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Docs() {
  const [activeTab, setActiveTab] = useState<TabId>("getting-started");
  const tabRefs = useRef<Map<TabId, HTMLButtonElement>>(new Map());

  return (
    <section id="docs" className="bg-background py-24 px-6">
      <div className="max-w-6xl mx-auto">

        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-widest text-muted font-medium mb-4">
            Reference
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            Documentation
          </h2>
          <p className="mt-4 text-muted text-lg max-w-xl">
            Installation, commands, agents, configuration. All in one place.
          </p>
        </motion.div>

        {/* Pill-style tab bar: vertical on mobile, horizontal on md+ */}
        <div className="relative mb-0">
          <div className="flex flex-col md:flex-row md:flex-wrap gap-2 p-1.5 bg-surface rounded-t border border-border border-b-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  ref={(el) => { if (el) tabRefs.current.set(tab.id, el); }}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "relative px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-sm",
                    "flex items-center gap-2",
                    isActive
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "text-muted hover:text-foreground hover:bg-surface-light border border-transparent",
                  ].join(" ")}
                >
                  <Icon size={14} className={isActive ? "text-accent" : "text-muted"} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border border-t-0 border-border rounded-b bg-surface">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-6 md:p-10"
            >
              {tabContent(activeTab)}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-border rounded bg-surface/40 px-6 py-5"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div>
            <p className="text-sm font-medium text-foreground mb-0.5">
              Looking for the complete reference?
            </p>
            <p className="text-xs text-muted">
              Covers every command, agent, config option, and advanced workflow.
            </p>
          </div>
          <a
            href="/docs"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, "", "/docs");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            className="docs-cta-link group flex-shrink-0 inline-flex items-center gap-2.5 text-sm font-semibold bg-accent text-white hover:bg-accent-light px-5 py-2.5 rounded transition-colors duration-200 cursor-pointer"
          >
            Full Documentation
            <ArrowRight size={16} className="docs-cta-arrow transition-transform duration-200 group-hover:translate-x-1" />
          </a>
        </motion.div>

      </div>
    </section>
  );
}
