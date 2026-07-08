/** User-facing copy and vocabulary (single source of truth). */

export const APP_NAME = "RAGtime";

/** Canonical terms — use these everywhere in the UI. */
export const TERMS = {
  dataset: "dataset",
  datasets: "datasets",
  testQuestion: "test question",
  testQuestions: "test questions",
  expectedAnswer: "expected answer",
  modelSetup: "model setup",
  modelSetups: "model setups",
  comparison: "comparison",
  test: "test",
  tests: "tests",
  passage: "passage",
  passages: "passages",
  qualityScore: "quality score",
} as const;

export const FLOW_STEPS = [
  { label: "Prepare", description: "Documents and test questions" },
  { label: "Choose models", description: "Search, rerank, and answer models" },
  { label: "Compare", description: "Run all tests live" },
  { label: "Review", description: "Scores, cost, and speed" },
] as const;

export const RUN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ingesting: "Preparing documents",
  running: "Running tests",
  aggregating: "Adding up results",
  complete: "Complete",
  failed: "Failed",
  canceled: "Canceled",
  budget_exceeded: "Stopped — budget reached",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  ingesting: "Indexing",
  ready: "Ready",
  failed: "Failed",
};

export const TEST_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  running: "In progress",
  complete: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

/** @deprecated Use TEST_STATUS_LABEL */
export const TRIAL_STATUS_LABEL = TEST_STATUS_LABEL;

export const QUESTION_SOURCE_LABEL: Record<string, string> = {
  manual: "Added by you",
  csv: "Imported from file",
  generated: "Auto-generated",
};

export const PIPELINE_STAGE_LABEL: Record<string, string> = {
  embed: "Prepare question",
  retrieve: "Find passages",
  rerank: "Re-order passages",
  generate: "Write answer",
  judge: "Rate answer",
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
  const line = `${setups} model setup${setups === 1 ? "" : "s"} × ${args.questionCount} ${args.questionCount === 1 ? TERMS.testQuestion : TERMS.testQuestions} = ${testCount} ${testCount === 1 ? TERMS.test : TERMS.tests}. Budget: $${args.budgetUsd.toFixed(2)}. Limit: ${args.maxTrials} tests per run.`;
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
    return "Could not start the comparison. Check that the deployment is configured correctly.";
  }
  if (msg.includes("402") || msg.includes("Insufficient credits")) {
    return "OpenRouter credits are low. Add credits at openrouter.ai/settings/credits.";
  }
  if (msg.includes("matrix would run") || msg.includes("max ")) {
    return msg
      .replace(/This matrix would run (\d+) trials/gi, "This comparison would run $1 tests")
      .replace(/evaluations?/gi, "tests")
      .replace(/trials/gi, "tests")
      .replace(/model stack/gi, "model setup")
      .replace(/embedding, rerank, or generation models/gi, "search, rerank, or answer models");
  }
  if (msg.includes("Not found")) {
    return "That item was not found. It may have been deleted.";
  }
  return msg;
}

export const COPY = {
  home: {
    title: "Compare RAG setups side by side",
    subtitle:
      "Run the same test questions through different search, rerank, and answer models. See quality, cost, and speed in one place.",
    platformNote: "Hosted on Render · Models via OpenRouter",
    datasetsHeading: "Your datasets",
    emptyDatasets:
      "Create a dataset below. After deploy, you can also load the built-in SciFact demo from the dashboard.",
    createLabel: "Dataset name",
    createDescription: "A dataset is a folder of documents plus test questions you want to compare.",
    createPlaceholder: "e.g. Product help docs",
    createButton: "Create dataset",
  },
  corpus: {
    description: "Add documents and test questions, then pick which models to compare.",
    documentsHeading: "Documents",
    dropzone: "Drop a .txt or .md file here",
    dropzoneLoading: "Uploading…",
    questionsHeading: (n: number) => `Test questions (${n})`,
    questionLabel: "Test question",
    questionPlaceholder: "What does the evidence say about…?",
    expectedAnswerLabel: TERMS.expectedAnswer,
    expectedAnswerPlaceholder: "What a good answer should say",
    addQuestion: "Add test question",
    configureHeading: "Set up comparison",
    suggestedPreset: "Use quick 2×2 preset",
    runNameLabel: "Comparison name",
    runNameDescription: "Shown while the comparison runs and on the results page.",
    embedLabel: "Search models",
    embedDescription: "Turn text into vectors so relevant passages can be found.",
    noRerankLabel: "Include a run without reranking",
    rerankLabel: "Rerank models",
    rerankDescription: "Optional: re-score passages so the best ones rise to the top.",
    genLabel: "Answer models",
    genDescription: "Chat models that write the final answer from retrieved passages.",
    retrieveLabel: "Passages to fetch",
    finalKLabel: "Passages to keep after rerank",
    thresholdLabel: "Minimum rerank score (optional)",
    budgetLabel: "Budget for this run (USD)",
    tryOneQuestion: "Try one question first",
    startButton: "Start comparison",
    confirmTitle: "Start this comparison?",
    confirmNote:
      "OpenRouter charges apply. The comparison runs on Render and may take several minutes.",
    emptyDocs: "No documents yet",
    emptyDocsHint: "Upload a .txt or .md file, or paste a URL above.",
    emptyQuestions: "No test questions yet",
    emptyQuestionsHint: "Add a question and expected answer above, or load the SciFact demo dataset.",
    needQuestionsTitle: "Add test questions first",
    needQuestions: "You need at least one test question with an expected answer.",
    tooManyTests: "Too many tests for one run",
    tooManyTestsBody:
      "Use fewer search, rerank, or answer models. Large comparisons can overload the database on starter plans.",
    recentRuns: "Past comparisons",
  },
  run: {
    description: "Live progress. Click any cell to see how one model setup answered one question.",
    viewResults: "See results",
    cancel: "Stop comparison",
    cancelTitle: "Stop this comparison?",
    cancelBody: "Tests in progress will stop. Money already spent is not refunded.",
    cancelConfirm: "Stop comparison",
    cancelKeep: "Keep running",
    stayOnPage: "Stay on this page (don't open results automatically)",
    spend: (spent: string, budget: string) => `Spent: $${spent} of $${budget} budget`,
    progress: (done: number, total: number) => `${done} of ${total} tests done`,
    docsIndexed: (ready: number, total: number) => `Documents ready: ${ready} of ${total}`,
    embeddings: (model: string, done: number, total: number) =>
      `Indexing (${model.split("/").pop()}): ${done} of ${total}`,
    incompleteTitle: "Marked complete, but some tests are still running",
    incompleteBody: (done: number, total: number, pending: number) =>
      `${done} of ${total} tests finished. ${pending} still waiting or in progress. Results may be incomplete.`,
    failedTitle: "Comparison failed",
    failedBody: "Something went wrong during the comparison. Check the service logs for details.",
    detailTitle: "Test detail",
    gridLegend:
      "Each cell is one model setup on one question. Darker blue means a higher quality score.",
  },
  results: {
    titleSuffix: "results",
    description: "Which model setups scored best, cost least, and responded fastest.",
    exportCsv: "Download CSV",
    backToRun: "Back to live view",
    backToDataset: "Back to dataset",
    leaderboard: "Results by model setup",
    chartTitle: "Cost vs quality",
    empty: "No results yet",
    emptyHint: "Tests may still be running. Check the live comparison page.",
    failedTitle: "Comparison did not finish",
    failedBody: "Some results may be missing. Open the live view for details.",
    selfJudgedTooltip: "The same model scored its own answer. Treat scores as approximate.",
    selfJudgedBadge: "self-scored",
    columns: {
      setup: "Model setup",
      quality: "Quality",
      cost: "Cost per question",
      p50: "Typical speed",
      p95: "Slowest 5%",
      failures: "Failed tests",
    },
  },
  inspect: {
    title: "Try one question",
    description: "Walk through each step on a single question before running a full comparison.",
    runButton: "Run test",
    useRerankLabel: "Use reranking",
    failedTitle: "Test failed",
    emptyHint: "Enter a question and run the test to inspect each step.",
    queryEmbedding: "Prepared for search",
    dimensions: (n: number) => `${n} dimensions`,
  },
  history: {
    empty: "No comparisons yet",
    emptyHint: "Pick models below and start your first comparison.",
    open: "Open",
    results: "Results",
    started: "Started",
    spend: "Spent",
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
    kept: (n: number) => `Keeping ${n} ${n === 1 ? TERMS.passage : TERMS.passages}`,
    writeAnswer: "Write answer",
    rateAnswer: (model: string) => `Rate answer (${model})`,
    costLatency: "Time and cost",
    passageLabel: (idx: number) => `Passage ${idx}`,
    scores: (f: number, c: number, comp: number) =>
      `Grounded in sources ${f} · Correct ${c} · Complete ${comp}`,
  },
  notify: {
    docUploaded: "Document uploaded",
    urlAdded: "Link added",
    questionAdded: "Test question added",
    comparisonStarted: "Comparison started",
    comparisonStopped: "Comparison stopped",
    datasetCreated: "Dataset created",
  },
  common: {
    loading: "Loading…",
    tryAgain: "Try again",
    notFound: "Not found",
    notFoundBody: "This page does not exist or was removed.",
    loadFailed: "Could not load data",
    cancel: "Cancel",
    confirm: "Confirm",
  },
} as const;
