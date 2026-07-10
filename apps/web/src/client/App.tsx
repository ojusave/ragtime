import { Anchor, AppShell, Box, Group, Text } from "@mantine/core";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { FLOW_STEPS } from "./lib/copy";
import { GITHUB_REPO_URL } from "./lib/render-links";
import RenderCtas from "./components/RenderCtas";
import ThemeToggle from "./components/ThemeToggle";
import HomePage from "./pages/HomePage";
import CorpusPage from "./pages/CorpusPage";
import InspectPage from "./pages/InspectPage";
import RunPage from "./pages/RunPage";
import ResultsPage from "./pages/ResultsPage";
import NotFoundPage from "./pages/NotFoundPage";

function routeContext(pathname: string, search: string): { section: string; step: number } {
  if (pathname.includes("/results")) return { section: "Results", step: 3 };
  if (pathname.startsWith("/run/")) return { section: "Live comparison", step: 2 };
  if (pathname.includes("/inspect")) return { section: "Query inspector", step: 1 };
  if (pathname.startsWith("/corpus/")) {
    const choosingModels = new URLSearchParams(search).get("tab") === "compare";
    return choosingModels
      ? { section: "Choose models", step: 1 }
      : { section: "Dataset setup", step: 0 };
  }
  return { section: "Datasets", step: 0 };
}

export default function App() {
  const { pathname, search } = useLocation();
  const context = routeContext(pathname, search);

  return (
    <AppShell header={{ height: 60 }} padding={0} className="rag-shell">
      <AppShell.Header className="rag-header">
        <Group h="100%" justify="space-between" wrap="nowrap" className="rag-nav">
          <Anchor component={Link} to="/" className="rag-brand">
            <span className="rag-brand-mark">
              <img src="https://render.com/favicon.ico" alt="" width="18" height="18" />
            </span>
            <Box className="rag-brand-copy">
              <Text className="rag-brand-name">RAGtime</Text>
              <Text className="rag-brand-context">Model comparison</Text>
            </Box>
          </Anchor>
          <Text className="rag-current-section">{context.section}</Text>
          <Group gap="xs" wrap="nowrap" className="rag-utility-nav">
            <ThemeToggle />
            <span className="rag-nav-divider" aria-hidden="true" />
            <RenderCtas />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main className="rag-main">
        <Box component="nav" className="rag-journey" aria-label="Evaluation progress">
          {FLOW_STEPS.map((step, index) => (
            <Box
              className={`rag-journey-step${index === context.step ? " is-active" : ""}${
                index < context.step ? " is-complete" : ""
              }`}
              aria-current={index === context.step ? "step" : undefined}
              key={step.label}
            >
              <Text className="rag-journey-number">0{index + 1}</Text>
              <Box>
                <Text size="sm" fw={600}>
                  {step.label}
                </Text>
                <Text size="xs" c="dimmed" className="rag-journey-description">
                  {step.description}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/corpus/:id" element={<CorpusPage />} />
          <Route path="/corpus/:id/inspect" element={<InspectPage />} />
          <Route path="/run/:id" element={<RunPage />} />
          <Route path="/run/:id/results" element={<ResultsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell.Main>
      <Box component="footer" className="rag-footer">
        <Group justify="space-between" wrap="wrap" className="rag-footer-inner">
          <span className="rag-footer-status">
            Runs on Render Workflows with models from OpenRouter
          </span>
          <Group gap="lg">
            <Anchor
              className="rag-footer-link"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </Anchor>
            <Anchor
              className="rag-footer-link"
              href="https://openrouter.ai/docs"
              target="_blank"
              rel="noreferrer"
            >
              OpenRouter docs
            </Anchor>
          </Group>
        </Group>
      </Box>
    </AppShell>
  );
}
