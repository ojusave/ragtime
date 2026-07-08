import { AppShell, Group, Anchor, Title } from "@mantine/core";
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
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Anchor component={Link} to="/" underline="never" c="inherit">
            <Title order={3}>RAGtime</Title>
          </Anchor>
          <Group gap="xs" wrap="nowrap">
            <ThemeToggle />
            <RenderCtas />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/corpus/:id" element={<CorpusPage />} />
          <Route path="/corpus/:id/inspect" element={<InspectPage />} />
          <Route path="/run/:id" element={<RunPage />} />
          <Route path="/run/:id/results" element={<ResultsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell.Main>
      <AppShell.Footer p="sm">
        <Group justify="center">
          <Anchor href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" size="sm">
            GitHub repository
          </Anchor>
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}
