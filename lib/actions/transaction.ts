import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const SERIALIZATION_RETRY_LIMIT = 3;

export function isRetryableWriteConflict(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "P2034" || /write conflict|deadlock|serialization/i.test(message);
}

export async function withWriteConflictRetry<T>(operation: () => Promise<T>, retryLimit = SERIALIZATION_RETRY_LIMIT): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retryLimit; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableWriteConflict(error) || attempt === retryLimit) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
  throw lastError;
}

export async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withWriteConflictRetry(
    () => prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 20_000,
        timeout: 120_000,
      }),
  );
}
