/** User-facing copy (single source of truth). */

export const FLOW_STEPS = [
  { label: "Choose a question", description: "Pick a sample or write your own" },
  {
    label: "Compose setups",
    description:
      "Each setup combines an embedding, an optional rerank, and a generation model",
  },
  {
    label: "Run and compare",
    description: "Setups run in parallel as Render Workflow tasks",
  },
] as const;

export const RUN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ingesting: "Indexing documents",
  running: "Running",
  aggregating: "Aggregating",
  complete: "Complete",
  failed: "Failed",
  canceled: "Canceled",
  budget_exceeded: "Budget exceeded",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export const TEST_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  complete: "Complete",
  failed: "Failed",
  skipped: "Skipped",
};

export const PIPELINE_STAGE_LABEL: Record<string, string> = {
  embed: "Embed query",
  retrieve: "Retrieve",
  rerank: "Rerank",
  generate: "Generate",
  judge: "Judge",
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
  const trialCount = setups * args.questionCount;
  const overLimit = trialCount > args.maxTrials;
  const line = `${setups} setup${setups === 1 ? "" : "s"} × ${args.questionCount} question${args.questionCount === 1 ? "" : "s"} = ${trialCount} answer${trialCount === 1 ? "" : "s"}. Budget $${args.budgetUsd.toFixed(2)}.`;
  return { line, trialCount, overLimit };
}

/** Summary line for explicit-setup mode, counting one answer per setup per question. */
export function formatSetupSummary(args: {
  setupCount: number;
  questionCount: number;
  budgetUsd: number;
  maxTrials: number;
}): { line: string; trialCount: number; overLimit: boolean } {
  const trialCount = args.setupCount * args.questionCount;
  const overLimit = trialCount > args.maxTrials;
  const line = `${args.setupCount} setup${args.setupCount === 1 ? "" : "s"} × ${args.questionCount} question${args.questionCount === 1 ? "" : "s"} = ${trialCount} answer${trialCount === 1 ? "" : "s"}. Budget $${args.budgetUsd.toFixed(2)}.`;
  return { line, trialCount, overLimit };
}

export type FriendlyErrorMeta = {
  /** Machine-readable provider error code, mapped before any string heuristics. */
  code?: string;
  /** Adapter-supplied link that helps the user resolve the error. */
  helpUrl?: string;
};

/** Maps provider error codes to plain-language messages. Falls back to string heuristics. */
export function friendlyError(raw: string, meta?: FriendlyErrorMeta): string {
  switch (meta?.code) {
    case "insufficient_credits":
      return meta.helpUrl
        ? `Credits are low. Add more credits: ${meta.helpUrl}`
        : "Credits are low. Add more credits to your model gateway account.";
    case "rate_limited":
      return "The model gateway is rate limiting requests. Wait a moment and try again.";
    case "auth":
      return "The model gateway rejected the request. Check the API key configuration.";
    case "invalid_model":
      return "One of the selected models is not available on the model gateway.";
    case "provider_unavailable":
      return "The model gateway is temporarily unavailable. Try again shortly.";
    default:
      break;
  }

  const msg = raw.trim();
  if (!msg || msg === "Unknown error") {
    return "Request failed. Try fewer models or check the service logs.";
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("CONNECT_TIMEOUT") || msg.includes("5432")) {
    return "Database unavailable. Wait a minute and try again.";
  }
  if (msg.includes("403") || msg.includes("forbidden") || msg.includes("RENDER_API_KEY")) {
    return "Run did not start. Check deployment configuration.";
  }
  if (msg.includes("402") || msg.includes("Insufficient credits")) {
    return "Credits are low. Add more credits to your model gateway account.";
  }
  if (msg.includes("matrix would run") || msg.includes("max ")) {
    return msg.replace(/model stack/gi, "model setup");
  }
  if (msg.includes("Not found")) {
    return "Run not found. It may belong to another browser session.";
  }
  return msg;
}

export const COPY = {
  app: {
    subtitle: "Compare AI model combinations",
    zones: { inputs: "Inputs", run: "Run", detail: "Setup detail" },
    welcomeTitle: "Same question. Different models. Compare the answers.",
    welcomeBody:
      "A RAG pipeline uses three models: one finds relevant passages, one reorders them, and one writes the answer. Pick a few combinations and see which ones get it right.",
    questionSection: "Question",
    modelsSection: "Setups",
    sampleQuestions: "Sample questions",
    promptPlaceholder: "What does the evidence say about…?",
    yourQuestion: "Question text",
    embedLabel: "Embedding",
    embedHint: "Finds candidate passages",
    rerankLabel: "Rerank (optional)",
    rerankHint: "Reorders passages before answering",
    noRerankLabel: "Include runs without rerank",
    genLabel: "Generation",
    genHint: "Writes the answer",
    noneOption: "None",
    suggested: "Suggested",
    starterPreset: "Suggested setups",
    addSetup: "Add setup",
    removeSetup: "Remove setup",
    setupNumber: (n: number) => `Setup ${n}`,
    emptySetups: "Add a setup to compose your first pipeline.",
    matrixMode: "Matrix mode (cross every model)",
    matrixModeHint:
      "Pick models per stage and run every combination. Expanding fills the setup list above.",
    expandMatrix: "Expand into setups",
    advanced: "Retrieval settings",
    retrieveLabel: "Retrieve K",
    finalKLabel: "Final K",
    budgetLabel: "Budget (USD)",
    runButton: "Run",
    runningButton: "Running…",
    loadDemo: "Load demo library (100 medical abstracts)",
    loadingDemo: "Loading demo library…",
    demoLoadFailed: "Demo library failed to load",
    canvasIdleTitle: "No run in progress",
    canvasIdleBody:
      "Pick your setups on the left and press Run. Answers appear here side by side.",
    inspectorEmpty:
      "Select an answer to view its retrieved passages and the generated answer.",
    inspectorScoreAria: "Selected setup score",
    resizeAria: "Resize run and detail panes",
    runAgain: "New run",
    cancel: "Cancel run",
    progress: (done: number, total: number) => `${done} of ${total} complete`,
    spend: (spent: string, budget: string) => `$${spent} / $${budget}`,
    elapsed: (sec: number) => `${sec.toFixed(1)}s`,
    bestScore: "Best score",
    setups: "Setups",
    setupCount: (n: number) => `${n} setup${n === 1 ? "" : "s"}`,
    setupsScored: (scored: number, total: number) =>
      `${scored} of ${total} setup${total === 1 ? "" : "s"} scored`,
    awaitingScores: "Waiting for scored setups",
    arenaHint: "Select a setup to inspect its evidence.",
    judgeScore: "Judge score",
    judgeScoreTooltip:
      "A judge model rates faithfulness, correctness, and completeness from the retrieved passages.",
    judgeScoreAxis: "Judge score (0-100)",
    eventLog: "Event log",
    howItWorks: "How it works",
    githubLink: "GitHub",
    footerStatus: (gatewayLabel: string) => `Render Workflows + ${gatewayLabel}`,
    gatewayDocs: (gatewayLabel: string) => `${gatewayLabel} docs`,
  },
  howItWorks: {
    title: "How a comparison runs",
    steps: [
      {
        title: "One question",
        body: "Your question goes to every setup.",
      },
      {
        title: "One setup, three models",
        body: "Each setup is one combination of the three models.",
      },
      {
        title: "Render Workflows",
        body: "Setups run in parallel as Render Workflow tasks. Click any answer to see the passages and scores behind it.",
      },
    ],
    footnote: "Runs are scoped to this browser session.",
  },
  results: {
    leaderboard: "Results",
    chartTitle: "Cost vs score",
    exportCsv: "Download CSV",
    columns: {
      setup: "Setup",
      quality: "Score",
      cost: "Cost",
      p50: "p50 latency",
      p95: "p95 latency",
      failures: "Failed",
    },
    selfJudgedTooltip: "The answer model scored its own output.",
    selfJudgedBadge: "self-judged",
  },
  grid: {
    legendPending: "Pending",
    legendRunning: "Running",
    legendHigh: "Complete",
    legendFailed: "Failed",
  },
  stages: {
    findPassages: (n: number) => `Retrieve (${n} passages)`,
    rerank: "Rerank",
    kept: (n: number) => `${n} passage${n === 1 ? "" : "s"} kept`,
    writeAnswer: "Generate",
    rateAnswer: (model: string) => `Judge (${model})`,
    costLatency: "Cost and latency",
    passageLabel: (idx: number) => `Passage ${idx}`,
    scores: (f: number, c: number, comp: number) =>
      `Faithfulness ${f} · Correctness ${c} · Completeness ${comp}`,
  },
  notify: {
    comparisonStarted: "Run started",
    comparisonStopped: "Run canceled",
    demoLoaded: "Demo library loaded",
  },
  common: {
    loading: "Loading…",
    tryAgain: "Retry",
    cancel: "Cancel",
    confirm: "Confirm",
    close: "Close",
    notFound: "Not found",
    notFoundBody: "This page does not exist.",
    loadFailed: "Load failed",
  },
} as const;
