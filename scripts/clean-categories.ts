import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { uncategorizedCategoryIdFor } from "../lib/businesses";

const DEFAULT_DEMO_CATEGORY_NAMES = [
  "Electronics",
  "Laptops",
  "Phones",
  "Accessories",
  "Computers",
  "Office Supplies",
  "Furniture",
];
const UNCATEGORIZED_CATEGORY_NAME = "Uncategorized";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const includeAllEmpty = args.includes("--all-empty");
const allToReplacement = args.includes("--all-to");
const uncategorizeAll = args.includes("--uncategorize-all");
const listOnly = args.includes("--list");
const reassignTo = uncategorizeAll
  ? UNCATEGORIZED_CATEGORY_NAME
  : readOptionValue("--reassign-to");
const confirmHost = readOptionValue("--confirm-host");
const confirmDatabase = readOptionValue("--confirm-database");
const categoryNames = readOptionValue("--names")
  ? readOptionValue("--names")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
  : DEFAULT_DEMO_CATEGORY_NAMES;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const databaseName = databaseUrl.pathname.replace(/^\//, "");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  if (listOnly) {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    });
    if (categories.length === 0) {
      console.log("No categories found.");
      return;
    }
    categories.forEach((category) => {
      console.log(
        `${category.name} (${category.id}): ${category._count.items} item(s)`,
      );
    });
    return;
  }

  console.log(
    apply
      ? "Running category cleanup..."
      : "Dry run only. Add --apply to make changes.",
  );
  console.log(
    `Database target: host=${databaseUrl.hostname} database=${databaseName || "(none)"}`,
  );
  if (apply) {
    if (
      confirmHost.toLowerCase() !== databaseUrl.hostname.toLowerCase() ||
      confirmDatabase !== databaseName
    ) {
      throw new Error(
        `Refusing to apply without exact database confirmation. Re-run with --confirm-host ${databaseUrl.hostname} --confirm-database ${databaseName}`,
      );
    }
  }
  console.log(
    `Target categories: ${uncategorizeAll ? "all visible categories" : includeAllEmpty ? "all empty categories plus named targets" : categoryNames.join(", ")}`,
  );
  if (reassignTo)
    console.log(
      `Referenced target categories will be reassigned to: ${reassignTo}`,
    );

  const categories = await prisma.category.findMany({
    where:
      uncategorizeAll || allToReplacement || includeAllEmpty
        ? {}
        : {
            OR: categoryNames.map((name) => ({
              name: { equals: name, mode: "insensitive" as const },
            })),
          },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });

  const targets = uncategorizeAll
    ? categories.filter(
        (category) =>
          category.name.toLowerCase() !==
          UNCATEGORIZED_CATEGORY_NAME.toLowerCase(),
      )
    : allToReplacement && reassignTo
      ? categories.filter(
          (category) =>
            category.name.toLowerCase() !== reassignTo.toLowerCase(),
        )
      : includeAllEmpty
        ? categories.filter(
            (category) =>
              category._count.items === 0 ||
              categoryNames.some(
                (name) => name.toLowerCase() === category.name.toLowerCase(),
              ),
          )
        : categories;

  if (targets.length === 0) {
    console.log("No matching categories found.");
    return;
  }

  let replacementCategoryId = "";
  if (
    apply &&
    reassignTo &&
    targets.some((category) => category._count.items > 0)
  ) {
    const fallbackLocation = await prisma.location.findFirstOrThrow({
      where: { isActive: true },
    });
    const id =
      reassignTo === UNCATEGORIZED_CATEGORY_NAME
        ? uncategorizedCategoryIdFor(fallbackLocation.id)
        : `cat-${fallbackLocation.id}-${slugify(reassignTo)}`;
    const replacement = await prisma.category.upsert({
      where: { id },
      update: { name: reassignTo },
      create: { id, name: reassignTo, locationId: fallbackLocation.id },
    });
    replacementCategoryId = replacement.id;
  }

  for (const category of targets) {
    const itemCount = category._count.items;
    if (itemCount > 0 && !reassignTo) {
      console.log(
        `SKIP ${category.name} (${category.id}): ${itemCount} item(s) still use it.`,
      );
      continue;
    }

    if (!apply) {
      const action =
        itemCount > 0 && reassignTo
          ? `would reassign ${itemCount} item(s) to "${reassignTo}" then delete`
          : "would delete";
      console.log(`DRY ${category.name} (${category.id}): ${action}.`);
      continue;
    }

    if (itemCount > 0) {
      await prisma.item.updateMany({
        where: { categoryId: category.id },
        data: { categoryId: replacementCategoryId },
      });
    }

    await prisma.category.delete({ where: { id: category.id } });
    console.log(
      `DELETED ${category.name} (${category.id})${itemCount > 0 ? ` after reassigning ${itemCount} item(s)` : ""}.`,
    );
  }
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "category"
  );
}

function readOptionValue(option: string) {
  const equalsArg = args.find((arg) => arg.startsWith(`${option}=`));
  if (equalsArg) return equalsArg.slice(option.length + 1).trim();

  const index = args.indexOf(option);
  if (index < 0) return "";

  return args
    .slice(index + 1)
    .filter((arg) => !arg.startsWith("--"))
    .join(" ")
    .trim();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
