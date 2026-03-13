import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Github } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "#home", section: "home" },
  { label: "Features", href: "#features", section: "features" },
  { label: "How It Works", href: "#how-it-works", section: "how-it-works" },
  { label: "Docs", href: "#docs", section: "docs" },
];

function navigateToDocsPage(e: React.MouseEvent) {
  e.preventDefault();
  window.history.pushState({}, "", "/docs");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function smoothScrollTo(sectionId: string, duration = 700, onDone?: () => void) {
  const target =
    sectionId === "home"
      ? 0
      : (() => {
          const el = document.getElementById(sectionId);
          if (!el) return null;
          return el.getBoundingClientRect().top + window.pageYOffset - 64;
        })();

  if (target === null) return;

  const start = window.scrollY;
  const distance = target - start;
  if (Math.abs(distance) < 2) {
    onDone?.();
    return;
  }

  const startTime = performance.now();
  const step = (now: number) => {
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("home");
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const sectionIds = navLinks.map((l) => l.section);
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.reduce((a, b) =>
          a.intersectionRatio > b.intersectionRatio ? a : b
        );
        setActiveSection(top.target.id);
      },
      { threshold: [0.2, 0.5], rootMargin: "-64px 0px -30% 0px" }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const handleNavClick = (
    e: React.MouseEvent,
    section: string,
    closeMobile = false
  ) => {
    e.preventDefault();
    if (closeMobile) setMobileOpen(false);
    setActiveSection(section);
    isScrollingRef.current = true;
    smoothScrollTo(section, 700, () => {
      isScrollingRef.current = false;
    });
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-lg"
          : "bg-transparent"
      )}
    >
      {/* Gradient bottom border */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 h-px transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-0"
        )}
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(59,130,246,0.4), transparent)",
        }}
      />

      <nav
        className={cn(
          "max-w-6xl mx-auto px-6 flex items-center justify-between transition-all duration-300",
          scrolled ? "h-14" : "h-16"
        )}
      >
        {/* Stylized logo with accent bracket prefix */}
        <a
          href="#home"
          onClick={(e) => handleNavClick(e, "home")}
          className="text-lg font-bold tracking-tight text-foreground flex items-center"
        >
          <span className="text-accent font-mono">/</span>
          <span>MaxsimCLI</span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const active = activeSection === link.section;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.section)}
                className={cn(
                  "relative text-sm py-1 transition-colors duration-200 cursor-pointer",
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                )}
              >
                {link.label}
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute -bottom-1 left-0 right-0 block h-0.5 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            );
          })}
          <a
            href="/docs"
            onClick={navigateToDocsPage}
            className={cn(
              "relative text-sm py-1 transition-colors duration-200 cursor-pointer",
              window.location.pathname.startsWith("/docs")
                ? "text-foreground"
                : "text-muted hover:text-foreground"
            )}
          >
            Full Docs
            {window.location.pathname.startsWith("/docs") && (
              <motion.span
                layoutId="nav-active-pill"
                className="absolute -bottom-1 left-0 right-0 block h-0.5 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </a>

          {/* GitHub icon button */}
          <a
            href="https://github.com/maystudios/maxsimcli"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted hover:text-foreground hover:border-accent/50 transition-colors duration-200"
            aria-label="GitHub repository"
          >
            <Github size={16} />
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-foreground relative z-50"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Full-screen Mobile Overlay Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 md:hidden bg-background/98 backdrop-blur-xl flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center gap-8">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.section, true)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className={cn(
                    "text-2xl font-semibold transition-colors cursor-pointer",
                    activeSection === link.section
                      ? "text-accent"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  {link.label}
                </motion.a>
              ))}
              <motion.a
                href="/docs"
                onClick={(e) => {
                  navigateToDocsPage(e);
                  setMobileOpen(false);
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: navLinks.length * 0.06 }}
                className="text-2xl font-semibold text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                Full Docs
              </motion.a>
              <motion.a
                href="https://github.com/maystudios/maxsimcli"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, delay: (navLinks.length + 1) * 0.06 }}
                className="flex items-center gap-3 text-xl font-semibold text-muted hover:text-foreground transition-colors"
              >
                <Github size={20} />
                GitHub
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
