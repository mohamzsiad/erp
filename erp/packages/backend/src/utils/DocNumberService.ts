import { PrismaClient } from '@prisma/client';

/**
 * Atomically generates the next document number for a given company/module/docType.
 * Uses a database transaction + UPDATE...RETURNING to prevent race conditions.
 *
 * Example output: "MRL-202604000001"
 */
export async function getNextDocNo(
  prisma: PrismaClient,
  companyId: string,
  module: string,
  docType: string
): Promise<string> {
  // Use a raw transaction to atomically increment and return the sequence
  const result = await prisma.$transaction(async (tx) => {
    // Lock the row for update using raw SQL
    const rows = await tx.$queryRaw<{ nextNo: number; prefix: string; padLength: number }[]>`
      UPDATE doc_sequences
      SET "nextNo" = "nextNo" + 1
      WHERE "companyId" = ${companyId}
        AND "module"    = ${module}
        AND "docType"   = ${docType}
      RETURNING "nextNo", prefix, "padLength"
    `;

    if (rows.length === 0) {
      throw new Error(
        `DocSequence not found: company=${companyId}, module=${module}, docType=${docType}. ` +
        `Run the seed script to initialise sequences.`
      );
    }

    const { nextNo, prefix, padLength } = rows[0];
    // nextNo was just incremented, so the number we want is nextNo - 1
    const seqNumber = Number(nextNo) - 1;

    // Build: PREFIX + YYYYMM + zero-padded sequence
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const padded = String(seqNumber).padStart(Number(padLength), '0');

    return `${prefix}-${yyyymm}${padded}`;
  });

  return result;
}
