import { motion } from "motion/react";
import { Brain, Layers, FileText, Users, Gauge, GitBranch, Zap, Puzzle } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Meta-Prompting",
    description:
      "Commands load workflows that spawn focused subagents. Each one gets fresh context and a single job.",
  },
  {
    icon: Layers,
    title: "Context Engineering",
    description:
      "Offloads work to fresh-context subagents so your main session stays clean. No more lost project state.",
  },
  {
    icon: FileText,
    title: "Spec-Driven Development",
    description:
      "Phases, research, verification, and UAT. Every step lands in markdown and survives across sessions.",
  },
  {
    icon: Users,
    title: "4 Generic Agents",
    description:
      "Executor, planner, researcher, verifier. Four agents cover every workflow. 21 skills give each task the specialization it needs.",
  },
  {
    icon: Puzzle,
    title: "21 Skills & 23 Workflows",
    description:
      "Covers the full development lifecycle with extensible skills and workflows. Build your own to fit MaxsimCLI to your project.",
  },
  {
    icon: Gauge,
    title: "4 Model Profiles",
    description:
      "Quality, balanced, budget, and tokenburner. Orchestrators use lean models, planners and executors get powerful ones. Override per agent and project.",
  },
  {
    icon: Zap,
    title: "Wave-Based Parallelization",
    description:
      "Tasks get grouped into dependency waves and run in parallel. Each wave uses isolated subagents, commits land atomically.",
  },
  {
    icon: GitBranch,
    title: "Branching Strategies",
    description:
      "Creates git branches per phase or milestone automatically. Templates like maxsim/phase-{N}-{slug} keep your repo tidy.",
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

export function Features() {
  return (
    <section id="features" className="bg-background py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-xs uppercase tracking-widest text-muted font-medium mb-4">
            What's included
          </p>
          <div className="flex items-center gap-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight shrink-0">
              Features
            </h2>
            <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent" />
          </div>
          <p className="mt-4 text-muted text-lg max-w-xl">
            Structured, agent-driven development that keeps your context clean.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {features.map(({ icon: Icon, title, description }) => (
            <motion.div
              key={title}
              variants={cardVariants}
              className="relative bg-background p-8 group overflow-hidden"
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              {/* Top-edge gradient line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Hover border highlight */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
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
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
