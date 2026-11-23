-- Migration 003: Credit Wallets and Transaction Ledger
-- Implements organization-level credit wallets, balance constraints,
-- double-entry transaction history, and forced Row Level Security (RLS).

SET search_path TO app, public;

-- ─────────────────────────────────────────────
-- 1. Organization Credit Wallets
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_wallets (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  balance         numeric(14, 2) NOT NULL DEFAULT 50.00 CHECK (balance >= 0),
  currency        text NOT NULL DEFAULT 'INR',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_wallets_org_idx ON organization_wallets (organization_id);

-- Enforce Row Level Security
ALTER TABLE organization_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_wallets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_wallets_tenant_access ON organization_wallets;
CREATE POLICY organization_wallets_tenant_access ON organization_wallets
  USING (
    organization_id = app.current_organization_id()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organization_wallets.organization_id
        AND m.user_id = app.current_user_id()
        AND m.status = 'active'
    )
  )
  WITH CHECK (organization_id = app.current_organization_id());

GRANT SELECT, INSERT, UPDATE ON organization_wallets TO nexus_app;

-- ─────────────────────────────────────────────
-- 2. Wallet Transactions (Double-Entry Ledger)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id              uuid PRIMARY KEY,
  wallet_id       uuid NOT NULL REFERENCES organization_wallets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  type            text NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'adjustment')),
  amount          numeric(14, 2) NOT NULL CHECK (amount > 0),
  balance_after   numeric(14, 2) NOT NULL CHECK (balance_after >= 0),
  description     text NOT NULL,
  reference_type  text NOT NULL CHECK (reference_type IN ('report_export', 'ai_query', 'razorpay_payment', 'bonus', 'manual')),
  reference_id    text,
  idempotency_key text UNIQUE,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_tx_org_created_idx ON wallet_transactions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_tx_idempotency_idx ON wallet_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Enforce Row Level Security
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_transactions_tenant_access ON wallet_transactions;
CREATE POLICY wallet_transactions_tenant_access ON wallet_transactions
  USING (
    organization_id = app.current_organization_id()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = wallet_transactions.organization_id
        AND m.user_id = app.current_user_id()
        AND m.status = 'active'
    )
  )
  WITH CHECK (organization_id = app.current_organization_id());

GRANT SELECT, INSERT ON wallet_transactions TO nexus_app;
