import { eq } from "drizzle-orm";
import { getDb, closeDb } from "./client.js";
import { corpora, documents, questions } from "./schema.js";
import { migrate } from "./migrate.js";
import { SEED_CORPORA, type SeedCorpus } from "./datasets/index.js";

// REVIEW M7 (Medium): check-then-insert throughout this function is not concurrency-safe
// — two simultaneous /api/seed-demo calls can each create the corpus (and duplicate
// documents/questions; there are no unique constraints on corpora.name or
// documents(corpus_id, title)). Duplicates then inflate "all" question counts and future
// run work. Add unique indexes matching the seed identity and use
// INSERT ... ON CONFLICT ... RETURNING inside a transaction.
export async function seedCorpus(db: ReturnType<typeof getDb>, bundle: SeedCorpus): Promise<string> {
  let corpus = await db.query.corpora.findFirst({
    where: eq(corpora.name, bundle.corpusName),
  });

  if (!corpus) {
    const [created] = await db
      .insert(corpora)
      .values({
        name: bundle.corpusName,
        description: bundle.description,
      })
      .returning();
    corpus = created!;
    console.log(`Created corpus: ${corpus.name} (${corpus.id})`);
  } else {
    console.log(`Corpus already exists: ${corpus.name} (${corpus.id})`);
  }

  for (const doc of bundle.documents) {
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
    console.log(`  Added document: ${doc.title.slice(0, 60)}`);
  }

  for (const q of bundle.questions) {
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
    console.log(`  Added question: ${q.text.slice(0, 60)}...`);
  }

  return corpus.id;
}

export async function seed(): Promise<void> {
  await migrate();
  const db = getDb();

  console.log(`Seeding ${SEED_CORPORA.length} corpora...\n`);
  const ids: string[] = [];
  for (const bundle of SEED_CORPORA) {
    console.log(`--- ${bundle.corpusName} ---`);
    if (bundle.source) console.log(`Source: ${bundle.source}`);
    ids.push(await seedCorpus(db, bundle));
    console.log("");
  }

  console.log("Seed complete.");
  console.log("Default bake-off corpus (SciFact):", ids[0]);
  console.log(
    "Run `pnpm suggest-matrix` with OPENROUTER_API_KEY set to print a starter model matrix."
  );

  await closeDb();
}

if (process.argv[1]?.includes("seed")) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
