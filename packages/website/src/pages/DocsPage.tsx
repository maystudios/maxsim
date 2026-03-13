import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, ChevronRight, Github } from "lucide-react";
import { Footer } from "../components/sections/Footer";
import { navigate } from "../App.tsx";
import Markdoc from "@markdoc/markdoc";
import React from "react";

import { parseDoc, type ParsedDoc } from "../markdoc/loader.ts";
import { componentMap } from "../markdoc/components.tsx";

// ── Raw markdown imports ───────────────────────────────────────────────────

import whatIsMaxsimMd from "../content/docs/what-is-maxsim.md?raw";
import installationMd from "../content/docs/installation.md?raw";
import quickStartMd from "../content/docs/quick-start.md?raw";
import contextRotMd from "../content/docs/context-rot.md?raw";
import planningDirectoryMd from "../content/docs/planning-directory.md?raw";
import phasesMd from "../content/docs/phases.md?raw";
import projectStateMd from "../content/docs/project-state.md?raw";
import newProjectMd from "../content/docs/new-project.md?raw";
import discussPhaseMd from "../content/docs/discuss-phase.md?raw";
import planPhaseMd from "../content/docs/plan-phase.md?raw";
import executePhaseMd from "../content/docs/execute-phase.md?raw";
import verifyWorkMd from "../content/docs/verify-work.md?raw";
import milestonesMd from "../content/docs/milestones.md?raw";
import dashboardOverviewMd from "../content/docs/dashboard-overview.md?raw";
import dashboardFeaturesMd from "../content/docs/dashboard-features.md?raw";
import dashboardNetworkMd from "../content/docs/dashboard-network.md?raw";
import commandsCoreMd from "../content/docs/commands-core.md?raw";
import commandsPhasesMd from "../content/docs/commands-phases.md?raw";
import commandsMilestoneMd from "../content/docs/commands-milestone.md?raw";
import commandsTodosMd from "../content/docs/commands-todos.md?raw";
import commandsUtilsMd from "../content/docs/commands-utils.md?raw";
import configReferenceMd from "../content/docs/config-reference.md?raw";
import modelProfilesMd from "../content/docs/model-profiles.md?raw";
import workflowTogglesMd from "../content/docs/workflow-toggles.md?raw";
import branchingStrategiesMd from "../content/docs/branching-strategies.md?raw";
import agentsOverviewMd from "../content/docs/agents-overview.md?raw";
import agentsReferenceMd from "../content/docs/agents-reference.md?raw";
import quickTasksMd from "../content/docs/quick-tasks.md?raw";
import debugSessionsMd from "../content/docs/debug-sessions.md?raw";
import gapClosureMd from "../content/docs/gap-closure.md?raw";
import codebaseMappingMd from "../content/docs/codebase-mapping.md?raw";
import hookSystemMd from "../content/docs/hook-system.md?raw";
import modelOverridesMd from "../content/docs/model-overrides.md?raw";

// ── Types ──────────────────────────────────────────────────────────────────

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface SidebarItem {
  id: string;
  label: string;
}

// ── Parse all docs ─────────────────────────────────────────────────────────

const PARSED_DOCS: ParsedDoc[] = [
  whatIsMaxsimMd,
  installationMd,
  quickStartMd,
  contextRotMd,
  planningDirectoryMd,
  phasesMd,
  projectStateMd,
  newProjectMd,
  discussPhaseMd,
  planPhaseMd,
  executePhaseMd,
  verifyWorkMd,
  milestonesMd,
  dashboardOverviewMd,
  dashboardFeaturesMd,
  dashboardNetworkMd,
  commandsCoreMd,
  commandsPhasesMd,
  commandsMilestoneMd,
  commandsTodosMd,
  commandsUtilsMd,
  configReferenceMd,
  modelProfilesMd,
  workflowTogglesMd,
  branchingStrategiesMd,
  agentsOverviewMd,
  agentsReferenceMd,
  quickTasksMd,
  debugSessionsMd,
  gapClosureMd,
  codebaseMappingMd,
  hookSystemMd,
  modelOverridesMd,
].map(parseDoc);

// ── Build sidebar from frontmatter ─────────────────────────────────────────

const GROUP_ORDER = [
  "Introduction",
  "Core Concepts",
  "Workflow",
  "Commands Reference",
  "Configuration",
  "Agents",
  "Advanced",
];

function buildSidebar(docs: ParsedDoc[]): SidebarGroup[] {
  const groups = new Map<string, SidebarItem[]>();
  for (const doc of docs) {
    const g = doc.frontmatter.group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ id: doc.frontmatter.id, label: doc.frontmatter.title });
  }
  return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
    label: g,
    items: groups.get(g)!,
  }));
}

const SIDEBAR: SidebarGroup[] = buildSidebar(PARSED_DOCS);

// ── Sidebar Component ──────────────────────────────────────────────────────

function Sidebar({
  activeId,
  onNavigate,
}: {
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className="flex flex-col gap-7">
      {SIDEBAR.map((group) => (
        <div key={group.label}>
          <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-600 mb-2.5 px-3">
            {group.label}
          </p>
          <div className="flex flex-col gap-px">
            {group.items.map((item) => {
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`text-left text-[13px] px-3 py-1.5 rounded-md transition-colors duration-150 cursor-pointer ${
                    active
                      ? "text-zinc-100 bg-blue-500/10 font-medium"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {active && (
                      <motion.span
                        layoutId="sidebar-active-dot"
                        className="block w-1 h-1 rounded-full bg-blue-500 flex-shrink-0"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ── Docs Navbar ────────────────────────────────────────────────────────────

function DocsNavbar({
  onMobileMenuToggle,
  mobileOpen,
}: {
  onMobileMenuToggle: () => void;
  mobileOpen: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleHome = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate("/");
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        scrolled
          ? "bg-[#09090b]/90 backdrop-blur-lg border-zinc-800"
          : "bg-[#09090b]/80 backdrop-blur-md border-zinc-800/60"
      }`}
    >
      <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <a
            href="/"
            onClick={handleHome}
            className="text-base font-bold tracking-tight text-zinc-100"
          >
            MAXSIM
          </a>
          <ChevronRight size={14} className="text-zinc-600" />
          <span className="text-sm text-zinc-500">Docs</span>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <a
            href="/"
            onClick={handleHome}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Back to Home
          </a>
          <a
            href="https://github.com/maystudios/maxsimcli"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <Github size={14} />
            GitHub
          </a>
        </div>

        <button
          className="md:hidden text-zinc-500 hover:text-zinc-300"
          onClick={onMobileMenuToggle}
          aria-label="Toggle mobile menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </motion.header>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function DocSection({ doc }: { doc: ParsedDoc }) {
  const rendered = useMemo(
    () => Markdoc.renderers.react(doc.content, React, { components: componentMap }),
    [doc.content],
  );

  return (
    <section className="pt-16 pb-10 border-b border-zinc-800/60 last:border-0">
      <h2
        id={doc.frontmatter.id}
        data-section={doc.frontmatter.id}
        className="text-2xl font-bold text-zinc-100 tracking-tight border-l-2 border-blue-500 pl-4 mb-6"
      >
        {doc.frontmatter.title}
      </h2>
      {rendered}
    </section>
  );
}

// ── Main DocsPage Component ────────────────────────────────────────────────

export default function DocsPage() {
  const [activeId, setActiveId] = useState("what-is-maxsim");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isScrollingRef = useRef(false);

  const allSectionIds = useMemo(
    () => SIDEBAR.flatMap((g) => g.items.map((i) => i.id)),
    [],
  );

  // Scrollspy via scroll event
  useEffect(() => {
    const onScroll = () => {
      if (isScrollingRef.current) return;
      const threshold = 140;
      for (let i = allSectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(allSectionIds[i]);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold) {
          setActiveId(allSectionIds[i]);
          return;
        }
      }
      setActiveId(allSectionIds[0]);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [allSectionIds]);

  const navigateTo = useCallback((id: string) => {
    setActiveId(id);
    setMobileOpen(false);
    isScrollingRef.current = true;
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 800);
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>Documentation — MAXSIM</title>
        <meta
          name="description"
          content="Complete documentation for MAXSIM: installation, commands, workflows, phases, milestones, and the planning directory structure. Get started with AI-powered spec-driven development."
        />
        <link rel="canonical" href="https://maxsimcli.dev/docs" />
        <meta property="og:url" content="https://maxsimcli.dev/docs" />
        <meta property="og:title" content="Documentation — MAXSIM" />
        <meta
          property="og:description"
          content="Complete documentation for MAXSIM: installation, commands, workflows, phases, milestones, and the planning directory structure."
        />
        <meta name="twitter:url" content="https://maxsimcli.dev/docs" />
        <meta name="twitter:title" content="Documentation — MAXSIM" />
        <meta
          name="twitter:description"
          content="Complete documentation for MAXSIM: installation, commands, workflows, phases, milestones, and the planning directory structure."
        />
      </Helmet>
      <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased">
        <DocsNavbar
          onMobileMenuToggle={() => setMobileOpen((v) => !v)}
          mobileOpen={mobileOpen}
        />

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-[#09090b]/95 backdrop-blur-lg pt-14 overflow-y-auto md:hidden"
            >
              <div className="px-6 py-6">
                <Sidebar activeId={activeId} onNavigate={navigateTo} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-screen-xl mx-auto flex pt-14">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 flex-shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto py-8 px-4 border-r border-zinc-800/60">
            <Sidebar activeId={activeId} onNavigate={navigateTo} />
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 px-6 md:px-12 lg:px-16 py-8 max-w-3xl">
            {PARSED_DOCS.map((doc) => (
              <DocSection key={doc.frontmatter.id} doc={doc} />
            ))}
          </main>
        </div>

        <Footer />
      </div>
    </>
  );
}
