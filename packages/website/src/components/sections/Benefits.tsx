import { motion } from "motion/react";
import { RefreshCcw, LayoutDashboard, ShieldCheck, TrendingUp } from "lucide-react";

const benefits = [
  {
    icon: RefreshCcw,
    title: "Context Preservation",
    description:
      "Your project's goals, decisions, and progress survive across sessions. GitHub Issues are the single source of truth \u2014 nothing is lost to context window limits.",
    contrast: "vs. forgetting everything between sessions",
  },
  {
    icon: LayoutDashboard,
    title: "Structured Development",
    description:
      "Every project follows Plan \u2192 Execute \u2192 Verify. Phased milestones, task breakdowns, and wave-based execution replace ad-hoc coding with traceable progress.",
    contrast: "vs. ad-hoc, untracked coding",
  },
  {
    icon: ShieldCheck,
    title: "Quality Enforcement",
    description:
      "Verification agents check every change against spec, tests, lint, and build gates. Code review happens automatically \u2014 nothing ships unchecked.",
    contrast: "vs. unchecked code going to production",
  },
  {
    icon: TrendingUp,
    title: "Measurable Improvement",
    description:
      "The self-improvement loop captures learnings from every session. Autoresearch measures metrics, keeps wins, and discards regressions \u2014 your AI assistant gets better over time.",
    contrast: "vs. repeating the same mistakes",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function Benefits() {
  return (
    <section id="benefits" className="bg-background py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-xs uppercase tracking-widest text-muted font-medium mb-4">
            Why MaxsimCLI
          </p>
          <div className="flex items-center gap-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight shrink-0">
              Benefits
            </h2>
            <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent" />
          </div>
          <p className="mt-4 text-muted text-lg max-w-xl">
            What changes when you add structure to AI-assisted development.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {benefits.map(({ icon: Icon, title, description, contrast }) => (
            <motion.div
              key={title}
              variants={cardVariants}
              className="relative bg-surface rounded-lg border border-border p-8 group overflow-hidden"
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              {/* Top-edge gradient line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Hover border highlight */}
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-lg"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                  boxShadow: "inset 0 0 0 1px #3b82f6",
                }}
              />

              {/* Circular icon container with gradient background */}
              <div className="mb-5 inline-flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-accent group-hover:rotate-6 transition-transform duration-300">
                <Icon size={20} strokeWidth={1.5} />
              </div>

              <h3 className="text-foreground font-bold text-lg mb-2 tracking-tight">
                {title}
              </h3>
              <p className="text-muted text-sm leading-relaxed">{description}</p>
              <p className="mt-3 text-muted/60 text-xs italic">{contrast}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
