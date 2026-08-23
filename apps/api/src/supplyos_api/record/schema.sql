-- The system of record, as SQL.
--
-- Table and column names follow ERPNext's doctypes (`tabItem`, `item_code`,
-- `tabBin.actual_qty`, `tabSupplier.supplier_name`) so that pointing this at a
-- real ERPNext instance is a change of adapter, not a change of vocabulary.
--
-- Money is TEXT, never REAL. SQLite's REAL is a float and a float cent error is
-- invisible in a demo and fatal in procurement; the contracts parse these back
-- into Decimal on the way out.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS tabBOMItem;
DROP TABLE IF EXISTS tabBOM;
DROP TABLE IF EXISTS tabIncident;
DROP TABLE IF EXISTS tabPurchaseOrder;
DROP TABLE IF EXISTS tabItemPrice;
DROP TABLE IF EXISTS tabSupplierPriceBreak;
DROP TABLE IF EXISTS tabSupplierItem;
DROP TABLE IF EXISTS tabSupplier;
DROP TABLE IF EXISTS tabBin;
DROP TABLE IF EXISTS tabWarehouse;
DROP TABLE IF EXISTS tabItem;
DROP TABLE IF EXISTS tabCompanyProfile;

CREATE TABLE tabItem (
    part_id        TEXT PRIMARY KEY,
    item_code      TEXT NOT NULL UNIQUE,
    item_name      TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    spec_json      TEXT NOT NULL DEFAULT '{}',
    stock_uom      TEXT NOT NULL DEFAULT 'Nos',
    criticality    TEXT NOT NULL DEFAULT 'medium',
    part_class     TEXT NOT NULL,
    weight_kg      REAL NOT NULL,
    hs_code        TEXT NOT NULL,
    standard_cost  TEXT NOT NULL          -- Decimal as text
);

CREATE TABLE tabWarehouse (
    warehouse         TEXT PRIMARY KEY,
    plant_id          TEXT NOT NULL,
    plant_name        TEXT NOT NULL,
    city              TEXT,
    country           TEXT,
    production_lines  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE tabBin (
    part_id            TEXT NOT NULL REFERENCES tabItem(part_id),
    warehouse          TEXT NOT NULL REFERENCES tabWarehouse(warehouse),
    plant_id           TEXT NOT NULL,
    actual_qty         INTEGER NOT NULL,
    reserved_qty       INTEGER NOT NULL DEFAULT 0,
    reorder_level      INTEGER NOT NULL,
    daily_consumption  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (part_id, warehouse)
);

CREATE TABLE tabSupplier (
    supplier_id              TEXT PRIMARY KEY,
    supplier_name            TEXT NOT NULL,
    country                  TEXT NOT NULL,
    locale                   TEXT NOT NULL DEFAULT 'en-GB',
    -- The raw E.164 number lives here and is never selected by any read that
    -- feeds an API response. `phone_masked` is what leaves this module.
    phone                    TEXT NOT NULL,
    phone_masked             TEXT NOT NULL,
    email                    TEXT,
    marketplace_url          TEXT,
    channels                 TEXT NOT NULL DEFAULT '[]',
    approved                 INTEGER NOT NULL DEFAULT 0,
    preferred                INTEGER NOT NULL DEFAULT 0,
    incumbent                INTEGER NOT NULL DEFAULT 0,
    contract_unit_price      TEXT,
    standard_lead_days       INTEGER,
    certifications           TEXT NOT NULL DEFAULT '[]',
    certification_expires_at TEXT,
    audit_status             TEXT NOT NULL DEFAULT 'never_audited',
    known_allocations        INTEGER NOT NULL DEFAULT 0,
    max_historical_fill      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tabSupplierItem (
    supplier_id TEXT NOT NULL REFERENCES tabSupplier(supplier_id),
    part_id     TEXT NOT NULL REFERENCES tabItem(part_id),
    PRIMARY KEY (supplier_id, part_id)
);

CREATE TABLE tabSupplierPriceBreak (
    supplier_id TEXT NOT NULL REFERENCES tabSupplier(supplier_id),
    min_qty     INTEGER NOT NULL,
    unit_price  TEXT NOT NULL,
    PRIMARY KEY (supplier_id, min_qty)
);

CREATE TABLE tabItemPrice (
    supplier_id TEXT NOT NULL REFERENCES tabSupplier(supplier_id),
    part_id     TEXT NOT NULL REFERENCES tabItem(part_id),
    as_of       TEXT NOT NULL,
    unit_price  TEXT NOT NULL,
    qty         INTEGER NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'EUR'
);

CREATE TABLE tabPurchaseOrder (
    po_id          TEXT PRIMARY KEY,
    part_id        TEXT NOT NULL REFERENCES tabItem(part_id),
    supplier_id    TEXT NOT NULL REFERENCES tabSupplier(supplier_id),
    qty            INTEGER NOT NULL,
    promised_date  TEXT NOT NULL,
    revised_date   TEXT,
    status         TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE tabIncident (
    case_id                  TEXT PRIMARY KEY,
    part_id                  TEXT NOT NULL REFERENCES tabItem(part_id),
    plant_id                 TEXT NOT NULL,
    production_line          TEXT NOT NULL,
    qty_required             INTEGER NOT NULL,
    qty_on_hand              INTEGER NOT NULL,
    needed_by                TEXT NOT NULL,
    line_stop_at             TEXT NOT NULL,
    line_stop_cost_per_hour  TEXT NOT NULL,
    currency                 TEXT NOT NULL DEFAULT 'EUR',
    incumbent_supplier_id    TEXT REFERENCES tabSupplier(supplier_id),
    reason                   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE tabBOM (
    bom_id          TEXT PRIMARY KEY,
    item_name       TEXT NOT NULL,
    plant_id        TEXT NOT NULL,
    production_line TEXT NOT NULL
);

CREATE TABLE tabBOMItem (
    bom_id       TEXT NOT NULL REFERENCES tabBOM(bom_id),
    idx          INTEGER NOT NULL,   -- BOM lines are ordered; the PK is not
    part_id      TEXT NOT NULL REFERENCES tabItem(part_id),
    qty_per_unit INTEGER NOT NULL,
    PRIMARY KEY (bom_id, part_id)
);

-- Single row. Kept in the database so a deployment can edit the rules of the
-- house without redeploying, and so the policy rules have one place to read.
CREATE TABLE tabCompanyProfile (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    profile_json TEXT NOT NULL
);

-- The two queries that actually run on the hot path.
CREATE INDEX idx_bin_part ON tabBin(part_id);
CREATE INDEX idx_supplier_item_part ON tabSupplierItem(part_id);
CREATE INDEX idx_item_price_part ON tabItemPrice(part_id, supplier_id);
CREATE INDEX idx_po_part ON tabPurchaseOrder(part_id);

-- Parts at risk, worst first. The shortage detector and the cockpit dashboard
-- both read this rather than each re-deriving it.
DROP VIEW IF EXISTS vw_parts_at_risk;
CREATE VIEW vw_parts_at_risk AS
SELECT
    b.part_id,
    i.item_code,
    i.item_name,
    b.plant_id,
    b.actual_qty,
    b.reserved_qty,
    b.reorder_level,
    b.daily_consumption,
    (b.actual_qty - b.reserved_qty) AS available_qty,
    CASE WHEN b.daily_consumption > 0
         THEN ROUND((b.actual_qty - b.reserved_qty) * 1.0 / b.daily_consumption, 1)
         ELSE 999.0 END AS days_of_cover,
    i.criticality,
    inc.case_id,
    (SELECT po.po_id FROM tabPurchaseOrder po
      WHERE po.part_id = b.part_id
        AND po.revised_date IS NOT NULL
        AND po.revised_date > po.promised_date
      LIMIT 1) AS delayed_po_id
FROM tabBin b
JOIN tabItem i ON i.part_id = b.part_id
LEFT JOIN tabIncident inc ON inc.part_id = b.part_id
WHERE (b.actual_qty - b.reserved_qty) < b.reorder_level
   OR inc.case_id IS NOT NULL
ORDER BY days_of_cover ASC;
