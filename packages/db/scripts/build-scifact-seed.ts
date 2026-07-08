/**
 * Regenerate packages/db/src/datasets/scifact-seed.json from the BEIR SciFact release.
 * Usage: pnpm --filter @ragtime/db build:scifact-seed
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";

const BEIR_URL =
  "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/scifact.zip";
const DOC_COUNT = 100;
const QUESTION_COUNT = 12;

type JsonlRow = Record<string, string>;

async function main() {
  const res = await fetch(BEIR_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));

  const corpus = parseJsonl(strFromU8(zip["scifact/corpus.jsonl"]!));
  const queries = parseJsonl(strFromU8(zip["scifact/queries.jsonl"]!));
  const qrels = parseQrels(strFromU8(zip["scifact/qrels/test.tsv"]!));

  const selected = Object.keys(qrels)
    .sort((a, b) => Number(a) - Number(b))
    .slice(0, QUESTION_COUNT);

  const goldIds = new Set<string>();
  for (const qid of selected) {
    for (const did of qrels[qid] ?? []) goldIds.add(did);
  }

  const filler = Object.keys(corpus).filter((id) => !goldIds.has(id));
  shuffle(filler);
  const docIds = [...goldIds, ...filler.slice(0, Math.max(0, DOC_COUNT - goldIds.size))];

  const documents = docIds.map((id) => {
    const row = corpus[id]!;
    const title = row.title?.trim() || `Document ${id}`;
    return {
      title: title.slice(0, 120),
      filename: `${id}.txt`,
      content: `# ${title}\n\n${row.text}`,
    };
  });

  const questions = selected.map((qid) => {
    const goldId = [...(qrels[qid] ?? [])][0]!;
    const ref = corpus[goldId]!.text;
    const referenceAnswer =
      ref.length > 400 ? ref.slice(0, 400).replace(/[^.]*$/, "").trim() : ref.trim();
    return {
      text: queries[qid]!.text,
      referenceAnswer: referenceAnswer || ref.slice(0, 300).trim(),
    };
  });

  questions.push({
    text: "Exposure to cosmic radiation during commercial airline flights causes immediate DNA strand breaks in passengers.",
    referenceAnswer:
      "The provided abstracts do not support this claim. No document in the corpus addresses cosmic radiation effects on airline passengers.",
  });

  const payload = {
    corpusName: "SciFact (BEIR)",
    description:
      "Scientific claim verification from the BEIR benchmark: 100 PubMed abstracts and 12 gold test claims plus one unanswerable claim. Chunking produces many vectors so top-k retrieval differs per question.",
    source: "https://huggingface.co/datasets/BeIR/scifact",
    documents,
    questions,
  };

  const out = join(dirname(fileURLToPath(import.meta.url)), "../src/datasets/scifact-seed.json");
  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${out} (${documents.length} docs, ${questions.length} questions)`);
}

function parseJsonl(raw: string): Record<string, JsonlRow> {
  const map: Record<string, JsonlRow> = {};
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as JsonlRow;
    map[row._id] = row;
  }
  return map;
}

function parseQrels(raw: string): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const line of raw.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const [qid, docId, score] = line.split("\t");
    if (!qid || !docId || Number(score) <= 0) continue;
    (map[qid] ??= []).push(docId);
  }
  return map;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
