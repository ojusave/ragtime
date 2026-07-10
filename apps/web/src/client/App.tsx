import { Anchor, AppShell, Box, Group, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import { Route, Routes, Link } from "react-router-dom";
import { GITHUB_REPO_URL } from "./lib/render-links";
import RenderCtas from "./components/RenderCtas";
import ThemeToggle from "./components/ThemeToggle";
import HowItWorksModal from "./components/workspace/HowItWorksModal";
import WorkspacePage from "./pages/WorkspacePage";
import NotFoundPage from "./pages/NotFoundPage";
import { COPY } from "./lib/copy";

export default function App() {
  const [showHow, setShowHow] = useState(false);

  return (
    <AppShell header={{ height: 56 }} padding={0} className="pg-shell">
      <AppShell.Header className="pg-header">
        <Group h="100%" justify="space-between" wrap="nowrap" className="pg-nav">
          <Anchor component={Link} to="/" className="pg-brand">
            <span className="pg-brand-mark">
              <img src="/favicon.svg" alt="" width="18" height="18" />
            </span>
            <Box className="pg-brand-copy">
              <Group gap={8} wrap="nowrap">
                <Text className="pg-brand-name">RAGtime</Text>
                <span className="pg-brand-badge">{COPY.playground.badge}</span>
              </Group>
            </Box>
          </Anchor>

          <Text className="pg-kicker" visibleFrom="md">
            {COPY.playground.kicker}
          </Text>

          <Group gap="xs" wrap="nowrap" className="rag-utility-nav">
            <UnstyledButton className="pg-footer-link" onClick={() => setShowHow(true)}>
              How it works
            </UnstyledButton>
            <ThemeToggle />
            <span className="rag-nav-divider" aria-hidden="true" />
            <RenderCtas />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main className="pg-main">
        <Routes>
          <Route path="/" element={<WorkspacePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell.Main>

      <Box component="footer" className="pg-footer">
        <Group justify="space-between" wrap="wrap" className="pg-footer-inner">
          <span className="pg-footer-status">Render Workflows + OpenRouter models</span>
          <Group gap="lg">
            <Anchor
              className="pg-footer-link"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </Anchor>
            <Anchor
              className="pg-footer-link"
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
