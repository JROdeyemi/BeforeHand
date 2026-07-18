import "dotenv/config";
/**
 * Beforehand — question bank seed pipeline.
 *
 * Idempotent by design: upserts by stable id/slug, never deletes.
 * Removing a question = setting `active: false` in its YAML file (the
 * row stays so past reports remain renderable forever). Replacing a
 * question = deactivate the old id, add a new id.
 *
 * Run: npm run db:seed
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { db } from "../src/db";
import { categories, culturalContexts, questions } from "../src/db/schema";

const SEED_DIR = path.join(process.cwd(), "seed");

const categorySchema = z.array(
  z.object({
    slug: z.string(),
    name: z.string(),
    icon: z.string().optional(),
    description: z.string().optional(),
  }),
);

const contextSchema = z.array(
  z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
  }),
);

const questionSchema = z.array(
  z.object({
    id: z.string().regex(/^[a-z]+-\d{3,}$/, "id must look like fin-001"),
    text: z.string().min(10),
    partner_view: z.string().optional(),
    stages: z
      .array(z.enum(["early_dating", "dating", "engaged", "married"]))
      .min(1),
    contexts: z.array(z.string()).default([]),
    active: z.boolean().default(true),
  }),
);

async function main() {
  // Categories
  const cats = categorySchema.parse(
    parse(readFileSync(path.join(SEED_DIR, "categories.yaml"), "utf8")),
  );
  for (const [i, c] of cats.entries()) {
    await db
      .insert(categories)
      .values({ slug: c.slug, name: c.name, displayOrder: i, icon: c.icon, description: c.description ?? null })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: c.name, displayOrder: i, icon: c.icon, description: c.description ?? null },
      });
  }
  console.log(`Categories: ${cats.length} upserted`);

  // Cultural contexts
  const ctxs = contextSchema.parse(
    parse(readFileSync(path.join(SEED_DIR, "contexts.yaml"), "utf8")),
  );
  for (const c of ctxs) {
    await db
      .insert(culturalContexts)
      .values(c)
      .onConflictDoUpdate({
        target: culturalContexts.slug,
        set: { name: c.name, description: c.description },
      });
  }
  console.log(`Cultural contexts: ${ctxs.length} upserted`);

  // Questions — one YAML per category under seed/questions/
  const qDir = path.join(SEED_DIR, "questions");
  let total = 0;
  for (const file of readdirSync(qDir).filter((f) => f.endsWith(".yaml"))) {
    const categorySlug = path.basename(file, ".yaml");
    const rows = questionSchema.parse(
      parse(readFileSync(path.join(qDir, file), "utf8")),
    );
    for (const [i, q] of rows.entries()) {
      await db
        .insert(questions)
        .values({
          id: q.id,
          categorySlug,
          text: q.text,
          partnerView: q.partner_view ?? null,
          stages: q.stages,
          contexts: q.contexts,
          displayOrder: i,
          isActive: q.active,
        })
        .onConflictDoUpdate({
          target: questions.id,
          set: {
            categorySlug,
            text: q.text,
            partnerView: q.partner_view ?? null,
            stages: q.stages,
            contexts: q.contexts,
            displayOrder: i,
            isActive: q.active,
          },
        });
    }
    total += rows.length;
    console.log(`  ${file}: ${rows.length} questions upserted`);
  }
  console.log(`Questions: ${total} upserted. Done.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
