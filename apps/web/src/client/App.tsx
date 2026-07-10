import { Anchor, AppShell, Box, Group, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import { Route, Routes, Link } from "react-router-dom";
import { GITHUB_REPO_URL } from "./lib/render-links";
import RenderCtas from "./components/RenderCtas";
import ThemeToggle from "./components/ThemeToggle";
import HowItWorksModal from "./components/workspace/HowItWorksModal";
import WorkspacePage from "./pages/WorkspacePage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  const [showHow, setShowHow] = useState(false);

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
          <Group gap="xs" wrap="nowrap" className="rag-utility-nav">
            <UnstyledButton className="rag-footer-link" onClick={() => setShowHow(true)}>
              How it works
            </UnstyledButton>
            <ThemeToggle />
            <span className="rag-nav-divider" aria-hidden="true" />
            <RenderCtas />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main className="rag-main rag-main--workspace">
        <Routes>
          <Route path="/" element={<WorkspacePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell.Main>
      <Box component="footer" className="rag-footer">
        <Group justify="space-between" wrap="wrap" className="rag-footer-inner">
          <span className="rag-footer-status">Runs on Render Workflows with models from OpenRouter</span>
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
      <HowItWorksModal opened={showHow} onClose={() => setShowHow(false)} />
    </AppShell>
  );
}
