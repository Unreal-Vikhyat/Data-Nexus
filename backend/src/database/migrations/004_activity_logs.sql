-- Migration 004: Activity and Audit Logging
-- Enterprise audit logging table with actor attribution, entity references,
-- sanitized event metadata, and forced Row Level Security (RLS).

SET search_path TO app, public;

-- ─────────────────────────────────────────────
-- Activity / Audit Logs Table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  action          text NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 120),
  entity_type     text NOT NULL CHECK (length(trim(entity_type)) BETWEEN 1 AND 60),
  entity_id       text,
  details         jsonb DEFAULT '{}'::jsonb,
  ip_address      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Compound indices for efficient timeline queries and action filtering
CREATE INDEX IF NOT EXISTS activity_logs_org_created_idx ON activity_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON activity_logs (organization_id, action);

-- Enforce Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_logs_tenant_access ON activity_logs;
CREATE POLICY activity_logs_tenant_access ON activity_logs
  USING (
    organization_id = app.current_organization_id()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = activity_logs.organization_id
        AND m.user_id = app.current_user_id()
        AND m.status = 'active'
    )
  )
  WITH CHECK (organization_id = app.current_organization_id());

GRANT SELECT, INSERT ON activity_logs TO nexus_app;
