# Prompt 11: PROGRESS BILL (INTERIM PAYMENT CERTIFICATE) → AR + GL

## Context — what has been built so far

Sales Contracts with BOQs exist (Prompt 10). Finance auto-posting is already used by the Sales Invoice (Prompt 8).
Build the Progress Bill — the interim payment certificate that certifies and invoices work done to date.

## TASK — copy everything below to Claude

```
Build the PROGRESS BILL (IPC) end to end.

BACKEND (ProgressBillService):
- For a contract and period, list all BOQ lines with contractQty/rate and the previously certified cumulative quantity/value.
- Per line, the user enters cumulative quantity or % complete to date. Compute cumValue = cumQty × rate and thisValue = cumValue − previousValue.
- OVER-BILLING GUARD: cumQty cannot exceed contractQty + approved variations. Reject/clip with a clear error.
- Apply VAT to the sum of thisValue (current-period certified value); compute amount, taxAmount, totalAmount.
- certify/approve workflow: DRAFT → SUBMITTED → CERTIFIED → POSTED.
- post(billId) in a DB transaction: create an ArInvoice and a JournalEntry via AccountMapping (Dr Receivable, Cr Contract Revenue, Cr VAT Output). Store journalId + arInvoiceId. No stock movement (service revenue).
- Provide a progress summary: contract value, certified-to-date, this bill, balance-to-complete, % complete.
- Routes `/api/v1/sales/progress-bills` (CRUD + /submit + /certify + /post). RBAC, Swagger, audit. Printable IPC/certificate PDF.

FRONTEND: Progress Bills page — select contract + period, BOQ grid pre-filled with previous cumulative values, enter current cumulative/%; live current-period value and progress summary; submit/certify/post/print.

TESTS: thisValue = cumulative − previous across consecutive bills; over-billing blocked; journal balances and posts to contract-revenue accounts. Deliver building green.
```

## Notes

- This is the trickiest math — test two or three consecutive progress bills on the same contract to prove cumulative logic.
- When retention is added later, it slots in as a deduction on thisValue before AR posting.
