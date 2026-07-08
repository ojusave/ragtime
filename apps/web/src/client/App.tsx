import { AppShell, Group, Anchor, Button, Title } from "@mantine/core";
import { Routes, Route, Link } from "react-router-dom";
import { renderSignupUrlWithUtms, GITHUB_REPO_URL, DEPLOY_TO_RENDER_URL } from "./lib/render-links";
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
          <Anchor component={Link} to="/" underline="never" c="dark">
            <Title order={3}>RAGtime</Title>
          </Anchor>
          <Group gap="xs" visibleFrom="sm">
            <Button
              component="a"
              href={DEPLOY_TO_RENDER_URL}
              target="_blank"
              rel="noreferrer"
              variant="filled"
              size="compact-sm"
            >
              Deploy to Render
            </Button>
            <Button
              component="a"
              href={renderSignupUrlWithUtms("navbar_button")}
              target="_blank"
              rel="noreferrer"
              variant="outline"
              size="compact-sm"
            >
              Sign up on Render
            </Button>
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
          <Anchor
            href={renderSignupUrlWithUtms("footer_link")}
            target="_blank"
            rel="noreferrer"
            size="sm"
          >
            Sign up on Render
          </Anchor>
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}
