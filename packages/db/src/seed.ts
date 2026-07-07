import { eq } from "drizzle-orm";
import { getDb, closeDb } from "./client.js";
import { corpora, documents, questions } from "./schema.js";
import { migrate } from "./migrate.js";
import { PIGEON_DOCS, PIGEON_QUESTIONS } from "./seed-data.js";

const CORPUS_NAME = "Pigeon docs";

export async function seed(): Promise<void> {
  await migrate();
  const db = getDb();

  let corpus = await db.query.corpora.findFirst({
    where: eq(corpora.name, CORPUS_NAME),
  });

  if (!corpus) {
    const [created] = await db
      .insert(corpora)
      .values({
        name: CORPUS_NAME,
        description:
          "Fictional Pigeon message-delivery API docs for RAGtime demos",
      })
      .returning();
    corpus = created!;
    console.log(`Created corpus: ${corpus.id}`);
  } else {
    console.log(`Corpus already exists: ${corpus.id}`);
  }

  for (const doc of PIGEON_DOCS) {
    const existing = await db.query.documents.findFirst({
      where: (d, { and, eq: eqFn }) =>
        and(eqFn(d.corpusId, corpus!.id), eqFn(d.title, doc.title)),
    });
    if (existing) continue;

    await db.insert(documents).values({
      corpusId: corpus.id,
      sourceType: "upload",
      title: doc.title,
      sourceUri: doc.filename,
      rawText: doc.content,
      status: "pending",
    });
    console.log(`  Added document: ${doc.title}`);
  }

  for (const q of PIGEON_QUESTIONS) {
    const existing = await db.query.questions.findFirst({
      where: (row, { and, eq: eqFn }) =>
        and(eqFn(row.corpusId, corpus!.id), eqFn(row.text, q.text)),
    });
    if (existing) continue;

    await db.insert(questions).values({
      corpusId: corpus.id,
      text: q.text,
      referenceAnswer: q.referenceAnswer,
      origin: "manual",
    });
    console.log(`  Added question: ${q.text.slice(0, 50)}...`);
  }

  console.log("\nSeed complete.");
  console.log(`Corpus ID: ${corpus.id}`);
  console.log(
    "Run `pnpm suggest-matrix` with OPENROUTER_API_KEY set to print a suggested model matrix."
  );

  await closeDb();
}

if (process.argv[1]?.includes("seed")) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
