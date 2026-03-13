import {
  FileText,
  Hash,
  Terminal,
  Workflow,
  Bot,
  Hexagon,
  Code,
  Hammer,
  Box,
  FolderGit2,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";

const commandLayer = [
  { name: "Markdown Prompts", Icon: FileText },
  { name: "YAML Frontmatter", Icon: Hash },
  { name: "Slash Commands", Icon: Terminal },
  { name: "Workflow Specs", Icon: Workflow },
  { name: "Agent Definitions", Icon: Bot },
];

const toolchainStack = [
  { name: "Node.js", Icon: Hexagon },
  { name: "TypeScript", Icon: Code },
  { name: "tsdown", Icon: Hammer },
  { name: "CJS Modules", Icon: Box },
  { name: "npm workspaces", Icon: FolderGit2 },
];

const commandMarquee = Array.from({ length: 8 }, () => commandLayer).flat();
const toolchainMarquee = Array.from({ length: 8 }, () => toolchainStack).flat();

function Badge({ name, Icon }: { name: string; Icon: ElementType }) {
  return (
    <div className="shrink-0 inline-flex items-center gap-2 px-4 py-2 border border-border bg-surface rounded-sm mx-3">
      <Icon size={14} className="text-accent shrink-0" />
      <span className="font-mono text-sm text-foreground/80 whitespace-nowrap">{name}</span>
    </div>
  );
}

function CategoryLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs font-mono uppercase tracking-widest text-muted">
        {label}
      </span>
      <span className="h-px flex-1 max-w-16 bg-border" />
    </div>
  );
}

function MarqueeRow({ children }: { children: ReactNode }) {
  return (
    <div className="marquee-wrapper relative">
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      {children}
    </div>
  );
}

export function TechStack() {
  return (
    <section className="techstack-stripes bg-background py-24 border-t border-border overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-12">
        <p className="text-xs uppercase tracking-widest text-muted font-medium mb-4">
          Technology
        </p>
        <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
          Built With
        </h2>
        <p className="mt-4 text-muted text-lg max-w-xl">
          Markdown-first commands on top of a Node.js toolchain and monorepo setup.
        </p>
      </div>

      {/* Row 1 — Command Layer */}
      <div className="max-w-6xl mx-auto px-6">
        <CategoryLabel label="Command Layer" />
      </div>
      <MarqueeRow>
        <div className="marquee flex will-change-transform">
          {commandMarquee.map((item, i) => (
            <Badge key={`cmd-${item.name}-${i}`} name={item.name} Icon={item.Icon} />
          ))}
        </div>
      </MarqueeRow>

      {/* Row 2 — Toolchain */}
      <div className="max-w-6xl mx-auto px-6 mt-6">
        <CategoryLabel label="Toolchain" />
      </div>
      <MarqueeRow>
        <div className="marquee-reverse flex will-change-transform">
          {toolchainMarquee.map((item, i) => (
            <Badge key={`tc-${item.name}-${i}`} name={item.name} Icon={item.Icon} />
          ))}
        </div>
      </MarqueeRow>
    </section>
  );
}
