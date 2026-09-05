-- ═══════════════════════════════════════════════════════════════════════════
-- Sales feedback round 2
--   * Country / City reference masters (city dropdown + VAT length rules)
--   * Customer: blacklist flag, multi-currency, address country/city/street
--   * Item: reservationAllowed
--   * Price list: code is a mandatory unique key, exchange rate dropped
--   * Salesman: related-salesman removed
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Salesman: drop the related-salesman self reference ─────────────────────
ALTER TABLE "salesmen" DROP CONSTRAINT IF EXISTS "salesmen_relatedSalesmanId_fkey";
ALTER TABLE "salesmen" DROP COLUMN IF EXISTS "relatedSalesmanId";

-- ── Customer address: country / city links and a street line ────────────────
ALTER TABLE "customer_addresses" ADD COLUMN     "cityId" TEXT,
ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "street" VARCHAR(200);

-- ── Customer: blacklist flag ───────────────────────────────────────────────
ALTER TABLE "customers" ADD COLUMN     "isBlackListed" BOOLEAN NOT NULL DEFAULT false;

-- ── Item: only flagged items can be reserved on a sales order ──────────────
ALTER TABLE "items" ADD COLUMN     "reservationAllowed" BOOLEAN NOT NULL DEFAULT false;

-- ── Price list: exchange rate removed; code becomes the mandatory key ──────
ALTER TABLE "price_lists" DROP COLUMN "exchangeRate";

-- Backfill a code for every list that has none, numbered per company and type
-- (STD001… for standard lists, CSP001… for customer-specific ones).
UPDATE "price_lists" pl
SET "code" = gen.new_code
FROM (
  SELECT
    id,
    CASE WHEN "type" = 'CUSTOMER_SPECIFIC' THEN 'CSP' ELSE 'STD' END
      || LPAD(
           ROW_NUMBER() OVER (
             PARTITION BY "companyId", "type"
             ORDER BY "createdAt", id
           )::text, 3, '0'
         ) AS new_code
  FROM "price_lists"
  WHERE "code" IS NULL OR btrim("code") = ''
) gen
WHERE pl.id = gen.id;

-- Should a backfilled code collide with a hand-entered one, push the duplicate
-- onto a suffixed code so the unique index below can be created.
UPDATE "price_lists" pl
SET "code" = pl."code" || '-' || substr(md5(pl.id), 1, 4)
WHERE EXISTS (
  SELECT 1 FROM "price_lists" other
  WHERE other."companyId" = pl."companyId"
    AND other."code" = pl."code"
    AND other.id <> pl.id
    AND other.id < pl.id
);

ALTER TABLE "price_lists" ALTER COLUMN "code" SET NOT NULL;

-- ── New tables ─────────────────────────────────────────────────────────────
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "vatPrefix" VARCHAR(5),
    "vatLength" INTEGER,
    "vatFormatHint" VARCHAR(120),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_currencies" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customer_currencies_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");
CREATE INDEX "cities_countryId_idx" ON "cities"("countryId");
CREATE UNIQUE INDEX "cities_countryId_code_key" ON "cities"("countryId", "code");
CREATE INDEX "customer_currencies_customerId_idx" ON "customer_currencies"("customerId");
CREATE UNIQUE INDEX "customer_currencies_customerId_currencyId_key" ON "customer_currencies"("customerId", "currencyId");
CREATE UNIQUE INDEX "price_lists_companyId_code_key" ON "price_lists"("companyId", "code");

-- ── Foreign keys ───────────────────────────────────────────────────────────
ALTER TABLE "cities" ADD CONSTRAINT "cities_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_currencies" ADD CONSTRAINT "customer_currencies_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_currencies" ADD CONSTRAINT "customer_currencies_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Reference data: GCC + common trading countries, with their VAT rules.
-- Ids are derived from the country code so re-running is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO "countries" ("id", "code", "name", "vatPrefix", "vatLength", "vatFormatHint", "isActive")
VALUES
  (md5('country:OM'), 'OM', 'Oman',                 'OM', 15,   'OM followed by 13 digits',      true),
  (md5('country:AE'), 'AE', 'United Arab Emirates', NULL, 15,   '15-digit TRN',                  true),
  (md5('country:SA'), 'SA', 'Saudi Arabia',         NULL, 15,   '15-digit VAT number',           true),
  (md5('country:QA'), 'QA', 'Qatar',                NULL, 11,   '11-digit tax identification',   true),
  (md5('country:BH'), 'BH', 'Bahrain',              NULL, 15,   '15-digit VAT account number',   true),
  (md5('country:KW'), 'KW', 'Kuwait',               NULL, NULL, NULL,                            true),
  (md5('country:IN'), 'IN', 'India',                NULL, 15,   '15-character GSTIN',            true),
  (md5('country:GB'), 'GB', 'United Kingdom',       'GB', 11,   'GB followed by 9 digits',       true),
  (md5('country:US'), 'US', 'United States',        NULL, NULL, NULL,                            true)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "cities" ("id", "countryId", "code", "name", "isActive")
VALUES
  -- Oman
  (md5('city:OM:MCT'), md5('country:OM'), 'MCT', 'Muscat',        true),
  (md5('city:OM:SLL'), md5('country:OM'), 'SLL', 'Salalah',       true),
  (md5('city:OM:SOH'), md5('country:OM'), 'SOH', 'Sohar',         true),
  (md5('city:OM:NZW'), md5('country:OM'), 'NZW', 'Nizwa',         true),
  (md5('city:OM:SUR'), md5('country:OM'), 'SUR', 'Sur',           true),
  (md5('city:OM:DUQ'), md5('country:OM'), 'DUQ', 'Duqm',          true),
  (md5('city:OM:IBR'), md5('country:OM'), 'IBR', 'Ibri',          true),
  (md5('city:OM:HAI'), md5('country:OM'), 'HAI', 'Haima',         true),
  -- United Arab Emirates
  (md5('city:AE:DXB'), md5('country:AE'), 'DXB', 'Dubai',         true),
  (md5('city:AE:AUH'), md5('country:AE'), 'AUH', 'Abu Dhabi',     true),
  (md5('city:AE:SHJ'), md5('country:AE'), 'SHJ', 'Sharjah',       true),
  (md5('city:AE:AAN'), md5('country:AE'), 'AAN', 'Al Ain',        true),
  (md5('city:AE:RAK'), md5('country:AE'), 'RAK', 'Ras Al Khaimah',true),
  (md5('city:AE:FUJ'), md5('country:AE'), 'FUJ', 'Fujairah',      true),
  -- Saudi Arabia
  (md5('city:SA:RUH'), md5('country:SA'), 'RUH', 'Riyadh',        true),
  (md5('city:SA:JED'), md5('country:SA'), 'JED', 'Jeddah',        true),
  (md5('city:SA:DMM'), md5('country:SA'), 'DMM', 'Dammam',        true),
  (md5('city:SA:MED'), md5('country:SA'), 'MED', 'Medina',        true),
  (md5('city:SA:MKA'), md5('country:SA'), 'MKA', 'Mecca',         true),
  -- Qatar
  (md5('city:QA:DOH'), md5('country:QA'), 'DOH', 'Doha',          true),
  (md5('city:QA:RYN'), md5('country:QA'), 'RYN', 'Al Rayyan',     true),
  (md5('city:QA:WKR'), md5('country:QA'), 'WKR', 'Al Wakrah',     true),
  -- Bahrain
  (md5('city:BH:MNM'), md5('country:BH'), 'MNM', 'Manama',        true),
  (md5('city:BH:MHQ'), md5('country:BH'), 'MHQ', 'Muharraq',      true),
  (md5('city:BH:RIF'), md5('country:BH'), 'RIF', 'Riffa',         true),
  -- Kuwait
  (md5('city:KW:KWI'), md5('country:KW'), 'KWI', 'Kuwait City',   true),
  (md5('city:KW:HAW'), md5('country:KW'), 'HAW', 'Hawalli',       true),
  (md5('city:KW:AHM'), md5('country:KW'), 'AHM', 'Ahmadi',        true),
  -- India
  (md5('city:IN:BOM'), md5('country:IN'), 'BOM', 'Mumbai',        true),
  (md5('city:IN:DEL'), md5('country:IN'), 'DEL', 'New Delhi',     true),
  (md5('city:IN:BLR'), md5('country:IN'), 'BLR', 'Bengaluru',     true),
  (md5('city:IN:MAA'), md5('country:IN'), 'MAA', 'Chennai',       true),
  (md5('city:IN:COK'), md5('country:IN'), 'COK', 'Kochi',         true),
  -- United Kingdom
  (md5('city:GB:LON'), md5('country:GB'), 'LON', 'London',        true),
  (md5('city:GB:MAN'), md5('country:GB'), 'MAN', 'Manchester',    true),
  (md5('city:GB:BHX'), md5('country:GB'), 'BHX', 'Birmingham',    true),
  -- United States
  (md5('city:US:NYC'), md5('country:US'), 'NYC', 'New York',      true),
  (md5('city:US:HOU'), md5('country:US'), 'HOU', 'Houston',       true),
  (md5('city:US:LAX'), md5('country:US'), 'LAX', 'Los Angeles',   true)
ON CONFLICT ("countryId", "code") DO NOTHING;

-- Link existing addresses to the new masters wherever the free-text country
-- and city already match a reference row.
UPDATE "customer_addresses" a
SET "countryId" = c.id
FROM "countries" c
WHERE a."countryId" IS NULL
  AND a."country" IS NOT NULL
  AND upper(btrim(a."country")) IN (upper(c."name"), upper(c."code"));

UPDATE "customer_addresses" a
SET "cityId" = ct.id
FROM "cities" ct
WHERE a."cityId" IS NULL
  AND a."countryId" = ct."countryId"
  AND a."city" IS NOT NULL
  AND upper(btrim(a."city")) = upper(ct."name");
