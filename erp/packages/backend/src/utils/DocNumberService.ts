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
    const rows = await tx.$queryRaw<{ next_no: number; prefix: string; pad_length: number }[]>`
      UPDATE doc_sequences
      SET next_no = next_no + 1
      WHERE company_id = ${companyId}
        AND module     = ${module}
        AND doc_type   = ${docType}
      RETURNING next_no, prefix, pad_length
    `;

    if (rows.length === 0) {
      throw new Error(
        `DocSequence not found: company=${companyId}, module=${module}, docType=${docType}. ` +
        `Run the seed script to initialise sequences.`
      );
    }

    const { next_no, prefix, pad_length } = rows[0];
    // next_no was just incremented, so the number we want is next_no - 1
    const seqNumber = next_no - 1;

    // Build: PREFIX + YYYYMM + zero-padded sequence
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const padded = String(seqNumber).padStart(pad_length, '0');

    return `${prefix}-${yyyymm}${padded}`;
  });

  return result;
}
