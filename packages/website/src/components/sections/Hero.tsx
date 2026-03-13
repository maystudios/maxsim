import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

const FLIP_WORDS = ["Engineering", "Prompting", "Development", "Orchestration"];

const TERMINAL_LINES = [
  { prompt: true, text: "/maxsim:plan", delay: 0 },
  { prompt: false, text: "Planning phase 02-Auth-System...", delay: 0.6 },
  { prompt: false, text: "Spawning researcher agent (claude-sonnet-4-20250514)", delay: 1.0 },
  { prompt: false, text: "Research complete. 4 decisions captured.", delay: 1.6 },
  { prompt: false, text: "Generating 02-01-PLAN.md (12 tasks)", delay: 2.1 },
  { prompt: false, text: "Phase plan verified. Ready to execute.", delay: 2.7, accent: true },
];

function AuroraMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Grid */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(39,39,42,0.5) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(39,39,42,0.4) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
        }}
      />
      {/* Aurora gradient mesh — very subtle at ~5% opacity */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(59,130,246,0.05) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 30%, rgba(139,92,246,0.04) 0%, transparent 70%),
            radial-gradient(ellipse 70% 60% at 50% 80%, rgba(59,130,246,0.03) 0%, transparent 70%)
          `,
        }}
      />
      {/* Top radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59,130,246,0.05) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

function WordFlipper() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % FLIP_WORDS.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="relative inline-flex overflow-hidden" style={{ minWidth: "14ch" }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={FLIP_WORDS[index]}
          className="text-accent inline-block"
          initial={{ y: "110%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-110%", opacity: 0 }}
          transition={{ duration: 0.38, ease: [0.32, 0, 0.67, 0] }}
        >
          {FLIP_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function TerminalMockup() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    TERMINAL_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleLines(i + 1);
        }, line.delay * 1000 + 1200)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setShowCursor((p) => !p), 530);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto rounded-lg overflow-hidden border border-border bg-surface"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.8 }}
    >
      {/* Title bar with colored dots */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-light border-b border-border">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-xs text-muted font-mono tracking-wide">
          maxsim workflow
        </span>
      </div>
      {/* Terminal content */}
      <div className="px-5 py-4 font-mono text-sm leading-relaxed min-h-[180px]">
        {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "whitespace-nowrap overflow-hidden",
              line.accent ? "text-accent" : "text-foreground/80"
            )}
          >
            {line.prompt && (
              <span className="text-accent mr-2 select-none">$</span>
            )}
            {!line.prompt && (
              <span className="text-muted mr-2 select-none">{">"}</span>
            )}
            {line.text}
          </motion.div>
        ))}
        {/* Blinking cursor */}
        <span
          className={cn(
            "inline-block w-2 h-4 bg-accent mt-1 transition-opacity duration-100",
            showCursor ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </motion.div>
  );
}

function InstallBlock() {
  const [copied, setCopied] = useState(false);
  const command = "npx maxsimcli@latest";

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <motion.div
      className="w-full max-w-xl mx-auto lg:mx-0 rounded-lg overflow-hidden border border-border bg-surface"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 1.0 }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 gap-4">
        <pre className="font-mono text-sm md:text-base text-foreground/90 select-all whitespace-nowrap overflow-x-auto">
          <span className="text-accent mr-2 select-none">$</span>
          <span>{command}</span>
        </pre>
        <button
          onClick={handleCopy}
          aria-label="Copy command"
          className={cn(
            "shrink-0 text-xs font-mono px-2.5 py-1 rounded border transition-colors duration-200",
            copied
              ? "border-accent/60 text-accent bg-accent/10"
              : "border-border text-muted hover:border-accent/50 hover:text-foreground"
          )}
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>
    </motion.div>
  );
}

function ScrollIndicator() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 2.0 }}
    >
      <motion.svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="text-muted"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  );
}

export default function Hero() {
  return (
    <section id="home" className="relative min-h-screen flex items-center bg-background overflow-hidden">
      <AuroraMeshBackground />

      <motion.div
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />

      <div className="relative w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-24 lg:py-32">
        <div className="flex flex-col items-center text-center gap-8">

          {/* Badge */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="block w-6 h-px bg-accent" />
            <span className="text-xs font-mono uppercase tracking-widest text-accent">
              CLI Tool
            </span>
            <span className="block w-6 h-px bg-accent" />
          </motion.div>

          {/* Headline with gradient text */}
          <motion.div
            className="flex flex-col gap-2"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h1
              className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-none bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(to bottom, #ffffff 30%, #3b82f6 100%)",
              }}
            >
              MAXSIM
            </h1>
            <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-muted leading-tight mt-2">
              AI-Powered Context{" "}
              <WordFlipper />
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            className="max-w-2xl text-base md:text-lg text-muted leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            A meta-prompting, context engineering, and spec-driven development
            system for Claude Code &mdash;
            solving context rot with fresh-context subagents.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <a
              href="#docs"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-md bg-accent text-white font-semibold text-sm tracking-wide hover:bg-accent-light transition-colors duration-200 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            >
              Get Started
            </a>
            <a
              href="https://github.com/maystudios/maxsimcli"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-md border border-border text-foreground font-semibold text-sm tracking-wide hover:border-accent/60 hover:text-accent transition-colors duration-200"
            >
              GitHub
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className="translate-y-px"
              >
                <path
                  d="M2 7h10M7 2l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </motion.div>

          {/* Install command */}
          <InstallBlock />

          {/* Terminal mockup */}
          <TerminalMockup />

          {/* Version tag */}
          <motion.span
            className="text-xs font-mono text-muted tracking-widest uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.4 }}
          >
            v{__MAXSIM_VERSION__}
          </motion.span>
        </div>
      </div>

      {/* Scroll indicator */}
      <ScrollIndicator />

      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-border/50"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
      />
    </section>
  );
}
