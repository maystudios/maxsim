import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "./components/sections/Navbar";
import Hero from "./components/sections/Hero";
import { Features } from "./components/sections/Features";
import { HowItWorks } from "./components/sections/HowItWorks";
import { TechStack } from "./components/sections/TechStack";
import { Docs } from "./components/sections/Docs";
import { Footer } from "./components/sections/Footer";
import DocsPage from "./pages/DocsPage";

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function usePath() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return path;
}

export default function App() {
  const path = usePath();
  const isDocsPage = path.startsWith("/docs");

  if (isDocsPage) {
    return <DocsPage />;
  }

  return (
    <>
      <Helmet>
        <title>MaxsimCLI: Meta-Prompting and Context Engineering for AI Coding Agents</title>
        <meta name="description" content="MaxsimCLI brings spec-driven development to Claude Code. Fresh-context subagents and structured planning keep your projects on track." />
        <link rel="canonical" href="https://maxsimcli.dev/" />
        <meta property="og:url" content="https://maxsimcli.dev/" />
        <meta property="og:title" content="MaxsimCLI: Meta-Prompting and Context Engineering for AI Coding Agents" />
        <meta property="og:description" content="MaxsimCLI brings spec-driven development to Claude Code. Fresh-context subagents and structured planning keep your projects on track." />
        <meta name="twitter:url" content="https://maxsimcli.dev/" />
        <meta name="twitter:title" content="MaxsimCLI: Meta-Prompting and Context Engineering for AI Coding Agents" />
        <meta name="twitter:description" content="MaxsimCLI brings spec-driven development to Claude Code. Fresh-context subagents and structured planning keep your projects on track." />
      </Helmet>
      <main className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Navbar />
        <Hero />
        <Features />
        <HowItWorks />
        <TechStack />
        <Docs />
        <Footer />
      </main>
    </>
  );
}
