import { Anchor, AppShell, Box, Group, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Route, Routes, Link } from "react-router-dom";
import { GITHUB_REPO_URL } from "./lib/render-links";
import { api } from "./lib/api";
import RenderCtas from "./components/RenderCtas";
import ThemeToggle from "./components/ThemeToggle";
import HowItWorksModal from "./components/workspace/HowItWorksModal";
import WorkspacePage from "./pages/WorkspacePage";
import NotFoundPage from "./pages/NotFoundPage";
import { COPY } from "./lib/copy";
import type { Catalog } from "./hooks/types";

export default function App() {
  const [showHow, setShowHow] = useState(false);
  const { data: catalog } = useQuery({
    queryKey: ["models"],
    queryFn: () => api<Catalog>("/api/models"),
  });
  const gateway = catalog?.gateway;
  const gatewayLabel = gateway?.label ?? "";

  return (
    <AppShell header={{ height: 56 }} padding={0} className="pg-shell">
      <AppShell.Header className="pg-header">
        <Group h="100%" justify="space-between" wrap="nowrap" className="pg-nav">
          <Anchor component={Link} to="/" className="pg-brand">
            <span className="pg-brand-mark">
              <img src="/favicon.svg" alt="" width="18" height="18" />
            </span>
            <Box className="pg-brand-copy">
              <Text className="pg-brand-name">RAGtime</Text>
              <Text className="pg-brand-subtitle">{COPY.app.subtitle}</Text>
            </Box>
          </Anchor>

          <Group gap="xs" wrap="nowrap" className="rag-utility-nav">
            <UnstyledButton className="pg-footer-link" onClick={() => setShowHow(true)}>
              {COPY.app.howItWorks}
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
          <span className="pg-footer-status">
            {gatewayLabel ? COPY.app.footerStatus(gatewayLabel) : ""}
          </span>
          <Group gap="lg">
            <Anchor
              className="pg-footer-link"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              {COPY.app.githubLink}
            </Anchor>
            {gateway?.docsUrl ? (
              <Anchor
                className="pg-footer-link"
                href={gateway.docsUrl}
                target="_blank"
                rel="noreferrer"
              >
                {COPY.app.gatewayDocs(gatewayLabel)}
              </Anchor>
            ) : null}
          </Group>
        </Group>
      </Box>

      <HowItWorksModal opened={showHow} onClose={() => setShowHow(false)} />
    </AppShell>
  );
}
