import { Anchor, AppShell, Box, Group, Text } from "@mantine/core";
import { Routes, Route, Link } from "react-router-dom";
import { GITHUB_REPO_URL } from "./lib/render-links";
import RenderCtas from "./components/RenderCtas";
import ThemeToggle from "./components/ThemeToggle";
import HomePage from "./pages/HomePage";
import CorpusPage from "./pages/CorpusPage";
import InspectPage from "./pages/InspectPage";
import RunPage from "./pages/RunPage";
import ResultsPage from "./pages/ResultsPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <AppShell header={{ height: 60 }} padding={0} className="rag-shell">
      <AppShell.Header className="rag-header">
        <Group h="100%" justify="space-between" wrap="nowrap" className="rag-nav">
          <Anchor component={Link} to="/" className="rag-brand">
            <span className="rag-brand-mark">
              <img src="https://render.com/favicon.ico" alt="" width="18" height="18" />
            </span>
            <Box>
              <Text className="rag-brand-name">RAGtime</Text>
              <Text className="rag-brand-context">RAG evaluation lab</Text>
            </Box>
          </Anchor>
          <Group gap="xs" wrap="nowrap">
            <ThemeToggle />
            <RenderCtas />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main className="rag-main">
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
            Render Workflows orchestration · OpenRouter model access
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
