/** User-facing copy (single source of truth). */

export const FLOW_STEPS = [
  { label: "Write a question", description: "Pick a sample or type your own" },
  { label: "Pick models", description: "Search, rerank, and answer models" },
  { label: "Watch it run", description: "Every setup runs in parallel" },
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
  const line = `${setups} setup${setups === 1 ? "" : "s"} × ${args.questionCount} question = ${testCount} test${testCount === 1 ? "" : "s"}. Budget: $${args.budgetUsd.toFixed(2)}.`;
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
  workspace: {
    title: "Run one question through every model setup",
    subtitle: "Pick a prompt, choose models, and watch each combination run on Render Workflows.",
    promptLabel: "Question",
    promptPlaceholder: "What does the evidence say about…?",
    sampleLabel: "Sample questions",
    customPrompt: "Or write your own",
    modelsHeading: "Models to compare",
    embedLabel: "Search models",
    rerankLabel: "Rerank models",
    noRerankLabel: "Include a run without reranking",
    genLabel: "Answer models",
    starterPreset: "Use starter models",
    advanced: "Advanced settings",
    retrieveLabel: "Passages to fetch",
    finalKLabel: "Passages to keep",
    budgetLabel: "Budget (USD)",
    runButton: "Run comparison",
    runningButton: "Running…",
    loadDemo: "Load sample data",
    loadingDemo: "Loading sample data…",
    demoMissing: "Sample corpus is not loaded yet.",
    canvasIdle: "Press Run to start. Each model setup runs in parallel.",
    inspectorEmpty: "Click a row to see retrieved passages and the generated answer.",
    runAgain: "Run again",
    cancel: "Stop run",
    progress: (done: number, total: number) => `${done} of ${total} setups done`,
    spend: (spent: string, budget: string) => `$${spent} of $${budget}`,
    elapsed: (sec: number) => `${sec.toFixed(1)}s elapsed`,
    bestScore: "Best score so far",
    combos: "Model setups",
  },
  howItWorks: {
    title: "How a comparison runs",
    steps: [
      {
        title: "Write or pick a question",
        body: "The same question is sent to every model setup.",
      },
      {
        title: "Choose model setups",
        body: "Pick search, rerank, and answer models. Each combination becomes one row.",
      },
      {
        title: "Watch and compare",
        body: "Render Workflows runs them in parallel. Click a row to inspect passages, answers, and scores.",
      },
    ],
    footnote: "Your runs are private to this browser session.",
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
    comparisonStarted: "Comparison started",
    comparisonStopped: "Comparison stopped",
    demoLoaded: "Sample data loaded",
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
