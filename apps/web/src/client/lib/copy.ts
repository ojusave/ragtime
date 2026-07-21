/** User-facing copy (single source of truth). */

export const FLOW_STEPS = [
  { label: "Choose a question", description: "SciFact sample or your own text" },
  { label: "Select models", description: "Embedding, rerank, and generation models" },
  { label: "Run the matrix", description: "Each combination runs as a Render Workflow task" },
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
  const line = `${setups} setup${setups === 1 ? "" : "s"} × ${args.questionCount} question = ${trialCount} trial${trialCount === 1 ? "" : "s"}. Budget $${args.budgetUsd.toFixed(2)}.`;
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
    subtitle: "RAG model evaluation",
    zones: { inputs: "Inputs", run: "Run", detail: "Trial detail" },
    welcomeTitle: "Compare RAG models on SciFact",
    welcomeBody:
      "Run one question through multiple embedding, rerank, and generation models. Each model setup is a separate trial.",
    questionSection: "Question",
    modelsSection: "Models",
    sampleQuestions: "Sample questions",
    promptPlaceholder: "What does the evidence say about…?",
    yourQuestion: "Question text",
    embedLabel: "Embedding",
    rerankLabel: "Rerank",
    noRerankLabel: "Include runs without rerank",
    genLabel: "Generation",
    suggested: "Suggested",
    starterPreset: "Suggested models",
    advanced: "Retrieval settings",
    retrieveLabel: "Retrieve K",
    finalKLabel: "Final K",
    budgetLabel: "Budget (USD)",
    runButton: "Run",
    runningButton: "Running…",
    loadDemo: "Load SciFact corpus",
    loadingDemo: "Loading SciFact corpus…",
    canvasIdleTitle: "No run in progress",
    canvasIdleBody: "Select models in Inputs and click Run.",
    inspectorEmpty: "Select a trial row to view retrieved passages and the generated answer.",
    runAgain: "New run",
    cancel: "Cancel run",
    progress: (done: number, total: number) => `${done} of ${total} complete`,
    spend: (spent: string, budget: string) => `$${spent} / $${budget}`,
    elapsed: (sec: number) => `${sec.toFixed(1)}s`,
    bestScore: "Best score",
    trials: "Trials",
    eventLog: "Event log",
    howItWorks: "How it works",
    githubLink: "GitHub",
    footerStatus: (gatewayLabel: string) => `Render Workflows + ${gatewayLabel}`,
    gatewayDocs: (gatewayLabel: string) => `${gatewayLabel} docs`,
  },
  /** @deprecated Use COPY.app — kept for gradual migration */
  playground: {
    badge: "Playground",
    kicker: "",
    zones: { setup: "Inputs", arena: "Run", peek: "Trial detail" },
    welcomeTitle: "Compare RAG models on SciFact",
    welcomeBody:
      "Run one question through multiple embedding, rerank, and generation models. Each model setup is a separate trial.",
    questionLab: "Question",
    modelMixer: "Models",
    sampleChips: "Sample questions",
    promptPlaceholder: "What does the evidence say about…?",
    yourQuestion: "Question text",
    embedLabel: "Embedding",
    rerankLabel: "Rerank",
    noRerankLabel: "Include runs without rerank",
    genLabel: "Generation",
    quickPicks: "Suggested",
    starterPreset: "Suggested models",
    advanced: "Retrieval settings",
    retrieveLabel: "Retrieve K",
    finalKLabel: "Final K",
    budgetLabel: "Budget (USD)",
    launchButton: "Run",
    launchRunning: "Running…",
    loadDemo: "Load SciFact corpus",
    loadingDemo: "Loading SciFact corpus…",
    canvasIdleTitle: "No run in progress",
    canvasIdleBody: "Select models in Inputs and click Run.",
    inspectorEmpty: "Select a trial row to view retrieved passages and the generated answer.",
    runAgain: "New run",
    cancel: "Cancel run",
    progress: (done: number, total: number) => `${done} of ${total} complete`,
    spend: (spent: string, budget: string) => `$${spent} / $${budget}`,
    elapsed: (sec: number) => `${sec.toFixed(1)}s`,
    bestScore: "Best score",
    combos: "Trials",
  },
  workspace: {
    title: "Compare RAG models on SciFact",
    subtitle: "One question, multiple model setups.",
    promptLabel: "Question",
    promptPlaceholder: "What does the evidence say about…?",
    sampleLabel: "Sample questions",
    customPrompt: "Question text",
    modelsHeading: "Models",
    embedLabel: "Embedding",
    rerankLabel: "Rerank",
    noRerankLabel: "Include runs without rerank",
    genLabel: "Generation",
    starterPreset: "Suggested models",
    advanced: "Retrieval settings",
    retrieveLabel: "Retrieve K",
    finalKLabel: "Final K",
    budgetLabel: "Budget (USD)",
    runButton: "Run",
    runningButton: "Running…",
    loadDemo: "Load SciFact corpus",
    loadingDemo: "Loading SciFact corpus…",
    demoMissing: "SciFact corpus not loaded.",
    canvasIdle: "Select models and click Run.",
    inspectorEmpty: "Select a trial row to view passages and answers.",
    runAgain: "New run",
    cancel: "Cancel run",
    progress: (done: number, total: number) => `${done} of ${total} complete`,
    spend: (spent: string, budget: string) => `$${spent} / $${budget}`,
    elapsed: (sec: number) => `${sec.toFixed(1)}s`,
    bestScore: "Best score",
    combos: "Trials",
  },
  howItWorks: {
    title: "How a comparison runs",
    steps: [
      {
        title: "Question",
        body: "The same question is sent to every selected model setup.",
      },
      {
        title: "Model matrix",
        body: "You pick embedding, rerank, and generation models. Each combination is one trial.",
      },
      {
        title: "Render Workflows",
        body: "Trials run in parallel. Open a row to inspect retrieval, generation, and judge scores.",
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
    demoLoaded: "SciFact corpus loaded",
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
