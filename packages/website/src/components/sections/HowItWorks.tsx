import { motion } from "motion/react";

const steps = [
  {
    number: "01",
    title: "Install",
    description: "One command installs MaxsimCLI into your AI runtime. Commands, workflows, and agents land in your config directories.",
    code: "npx maxsimcli@latest",
  },
  {
    number: "02",
    title: "Initialize",
    description: "Starts a project with deep context gathering. Creates a GitHub Project Board, Issues labels, and Milestones to track all state.",
    code: "/maxsim:init",
  },
  {
    number: "03",
    title: "Plan",
    description: "Researches, plans, and verifies each phase before you execute. Dedicated agents handle the research, task breakdown, and plan checking.",
    code: "/maxsim:plan",
  },
  {
    number: "04",
    title: "Execute",
    description: "Executor agents implement your plan with atomic commits, parallel waves, and automatic state tracking.",
    code: "/maxsim:execute",
  },
];

const stepVariants = {
  hidden: { opacity: 0, x: -24 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, delay: i * 0.12, ease: "easeOut" as const },
  }),
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-background py-24 px-6 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <div className="mb-16">
          <p className="text-xs uppercase tracking-widest text-muted font-medium mb-4">
            Getting started
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            How It Works
          </h2>
          <p className="mt-4 text-muted text-lg max-w-xl">
            Four steps from install to shipping features. No ceremony, no boilerplate.
          </p>
        </div>

        <div className="relative">
          {/* Animated gradient timeline line */}
          <motion.div
            className="absolute left-[20px] top-10 bottom-10 w-px"
            style={{
              background: "linear-gradient(to bottom, var(--color-accent), var(--color-border))",
            }}
            initial={{ scaleY: 0, originY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          <div className="flex flex-col gap-0">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                custom={i}
                variants={stepVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                className="relative flex gap-8 pb-12 last:pb-0"
              >
                {/* Timeline node */}
                <div className="relative z-10 shrink-0 flex items-start pt-1">
                  <div className="w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center group-hover:border-accent transition-colors">
                    <span className="text-xs font-mono text-accent font-bold">
                      {step.number}
                    </span>
                  </div>
                </div>

                {/* Horizontal connector line from timeline to card */}
                <div className="absolute left-[40px] top-[20px] w-[17px] h-px bg-gradient-to-r from-border to-accent/30 hidden md:block" />

                {/* Step card */}
                <div className="relative flex-1">
                  <div className="relative bg-surface border border-border rounded-lg p-6 overflow-hidden">
                    {/* Large watermark step number */}
                    <span className="absolute right-2 top-2 text-7xl font-bold font-mono text-accent/10 select-none pointer-events-none leading-none">
                      {step.number}
                    </span>

                    <h3 className="relative text-foreground font-bold text-xl tracking-tight mb-2">
                      {step.title}
                    </h3>
                    <p className="relative text-muted text-sm leading-relaxed mb-4 max-w-lg">
                      {step.description}
                    </p>

                    {/* Terminal-style code block */}
                    <div className="relative inline-flex items-center gap-3 bg-background border border-border px-4 py-2.5 rounded-md">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-accent font-mono text-xs select-none">$</span>
                      <code className="font-mono text-xs text-foreground/90 whitespace-nowrap">
                        {step.code}
                      </code>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
