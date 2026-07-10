/** User-facing copy (single source of truth). */

export const FLOW_STEPS = [
  { label: "Pick a question", description: "Try a sample chip or type your own" },
  { label: "Mix models", description: "Toggle search, rerank, and answer models" },
  { label: "Launch and watch", description: "Every combo runs in parallel on Render Workflows" },
] as const;

export const RUN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ingesting: "Indexing documents",
  running: "Running",
  aggregating: "Summing up",
  complete: "Complete",
  failed: "Failed",
  canceled: "Stopped",
  budget_exceeded: "Budget reached",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export const TEST_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  running: "Running",
  complete: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

export const PIPELINE_STAGE_LABEL: Record<string, string> = {
  embed: "Prepare question",
  retrieve: "Find passages",
  rerank: "Re-order passages",
  generate: "Write answer",
  judge: "Score answer",
};

export function stageLabel(stage: string): string {
  return PIPELINE_STAGE_LABEL[stage] ?? stage.replace(/_/g, " ");
}

export function formatMatrixSummary(args: {
  embedCount: number;
  rerankCount: number;
  genCount: number;
  questionCount: number;
  budgetUsd: number;
  maxTrials: number;
}): { line: string; trialCount: number; overLimit: boolean } {
  const setups = args.embedCount * args.rerankCount * args.genCount;
  const testCount = setups * args.questionCount;
  const overLimit = testCount > args.maxTrials;
  const line = `${setups} combo${setups === 1 ? "" : "s"} × ${args.questionCount} question = ${testCount} experiment${testCount === 1 ? "" : "s"}. Budget: $${args.budgetUsd.toFixed(2)}.`;
  return { line, trialCount: testCount, overLimit };
}

export function friendlyError(raw: string): string {
  const msg = raw.trim();
  if (!msg || msg === "Unknown error") {
    return "Something went wrong. Try fewer models or check the service logs.";
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("CONNECT_TIMEOUT") || msg.includes("5432")) {
    return "The database is temporarily unavailable. Wait a minute and try again.";
  }
  if (msg.includes("403") || msg.includes("forbidden") || msg.includes("RENDER_API_KEY")) {
    return "Could not start the run. Check that the deployment is configured correctly.";
  }
  if (msg.includes("402") || msg.includes("Insufficient credits")) {
    return "OpenRouter credits are low. Add credits at openrouter.ai/settings/credits.";
  }
  if (msg.includes("matrix would run") || msg.includes("max ")) {
    return msg.replace(/trials/gi, "tests").replace(/model stack/gi, "model setup");
  }
  if (msg.includes("Not found")) {
    return "That run was not found. It may belong to another browser session.";
  }
  return msg;
}

export const COPY = {
  playground: {
    badge: "Playground",
    kicker: "Mix models · Watch live · Compare results",
    zones: { setup: "Setup", arena: "Arena", peek: "Peek" },
    welcomeTitle: "A sandbox for RAG model combos",
    welcomeBody:
      "Ask one SciFact question, mix embedding and answer models, and watch every combination run in parallel.",
    questionLab: "Question lab",
    modelMixer: "Model mixer",
    sampleChips: "Try a sample",
    promptPlaceholder: "What does the evidence say about…?",
    yourQuestion: "Your question",
    embedLabel: "Search models",
    rerankLabel: "Rerank models",
    noRerankLabel: "Also run without reranking",
    genLabel: "Answer models",
    quickPicks: "Quick picks",
    starterPreset: "Starter combo",
    advanced: "Tweak knobs",
    retrieveLabel: "Passages to fetch",
    finalKLabel: "Passages to keep",
    budgetLabel: "Budget (USD)",
    launchButton: "Launch playground",
    launchRunning: "Running…",
    loadDemo: "Open playground",
    loadingDemo: "Setting up playground…",
    canvasIdleTitle: "Nothing running yet",
    canvasIdleBody:
      "Pick models in Setup and hit Launch. Each combo gets its own row in the arena.",
    inspectorEmpty: "Click a row in the arena to peek at passages, answers, and scores.",
    runAgain: "Try another combo",
    cancel: "Stop run",
    progress: (done: number, total: number) => `${done} of ${total} combos done`,
    spend: (spent: string, budget: string) => `$${spent} of $${budget}`,
    elapsed: (sec: number) => `${sec.toFixed(1)}s elapsed`,
    bestScore: "Best score",
    combos: "Live combos",
  },
  workspace: {
    title: "Ask one question. Try every model combo.",
    subtitle: "Mix models on the left, watch them run in the arena, peek into any row.",
    promptLabel: "Question",
    promptPlaceholder: "What does the evidence say about…?",
    sampleLabel: "Sample questions",
    customPrompt: "Your question",
    modelsHeading: "Model mixer",
    embedLabel: "Search models",
    rerankLabel: "Rerank models",
    noRerankLabel: "Also run without reranking",
    genLabel: "Answer models",
    starterPreset: "Starter combo",
    advanced: "Tweak knobs",
    retrieveLabel: "Passages to fetch",
    finalKLabel: "Passages to keep",
    budgetLabel: "Budget (USD)",
    runButton: "Launch playground",
    runningButton: "Running…",
    loadDemo: "Open playground",
    loadingDemo: "Setting up playground…",
    demoMissing: "Playground is not ready yet.",
    canvasIdle: "Launch to start. Every combo runs in parallel.",
    inspectorEmpty: "Click a row to peek at passages, answers, and scores.",
    runAgain: "Try another combo",
    cancel: "Stop run",
    progress: (done: number, total: number) => `${done} of ${total} combos done`,
    spend: (spent: string, budget: string) => `$${spent} of $${budget}`,
    elapsed: (sec: number) => `${sec.toFixed(1)}s elapsed`,
    bestScore: "Best score",
    combos: "Live combos",
  },
  howItWorks: {
    title: "How the playground works",
    steps: [
      {
        title: "Pick or write a question",
        body: "The same question goes to every model combo you select.",
      },
      {
        title: "Mix your models",
        body: "Toggle search, rerank, and answer models. Each combination becomes one arena row.",
      },
      {
        title: "Launch and peek",
        body: "Render Workflows runs them in parallel. Click any row to inspect what it retrieved and answered.",
      },
    ],
    footnote: "Your experiments stay private to this browser session.",
  },
  results: {
    leaderboard: "Results by setup",
    chartTitle: "Cost vs quality",
    exportCsv: "Download CSV",
    columns: {
      setup: "Setup",
      quality: "Quality",
      cost: "Cost",
      p50: "Typical speed",
      p95: "Slowest 5%",
      failures: "Failed",
    },
    selfJudgedTooltip: "The answer model scored its own output. Treat scores as approximate.",
    selfJudgedBadge: "self-scored",
  },
  grid: {
    legendPending: "Waiting",
    legendRunning: "Running",
    legendHigh: "High score",
    legendFailed: "Failed",
  },
  stages: {
    findPassages: (n: number) => `Find passages (${n} found)`,
    rerank: "Re-order passages",
    kept: (n: number) => `Keeping ${n} passage${n === 1 ? "" : "s"}`,
    writeAnswer: "Write answer",
    rateAnswer: (model: string) => `Score answer (${model})`,
    costLatency: "Time and cost",
    passageLabel: (idx: number) => `Passage ${idx}`,
    scores: (f: number, c: number, comp: number) =>
      `Grounded ${f} · Correct ${c} · Complete ${comp}`,
  },
  notify: {
    comparisonStarted: "Playground launched",
    comparisonStopped: "Run stopped",
    demoLoaded: "Playground ready",
  },
  common: {
    loading: "Loading…",
    tryAgain: "Try again",
    cancel: "Cancel",
    confirm: "Confirm",
    close: "Close",
    notFound: "Not found",
    notFoundBody: "This page does not exist or was removed.",
    loadFailed: "Could not load data",
  },
} as const;
