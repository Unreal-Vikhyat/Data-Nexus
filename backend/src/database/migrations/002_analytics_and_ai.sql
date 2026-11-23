-- Analytics & AI module tables
-- Depends on: 001_identity_and_tenants.sql
SET search_path TO app, public;

-- ─────────────────────────────────────────────
-- Dataset metadata (stub for Data Engineering)
-- Data Engineering owns full upload/parse/profile.
-- Analytics needs to know: which table, which columns, what types.
-- If Data Engineering already has this table, this migration is a no-op
-- and should be coordinated to avoid conflict.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS datasets (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 255),
  description     text DEFAULT '',
  storage_table   text NOT NULL CHECK (storage_table ~ '^ds_[a-f0-9]{32}$'),
  status          text NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading','processing','ready','error','archived')),
  row_count       integer DEFAULT 0,
  created_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS datasets_org_idx ON datasets (organization_id, status);

ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets FORCE ROW LEVEL SECURITY;
CREATE POLICY datasets_tenant_access ON datasets
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON datasets TO nexus_app;

-- ─────────────────────────────────────────────
-- Dataset column metadata
-- Stores detected/mapped column info for each dataset.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dataset_columns (
  id              uuid PRIMARY KEY,
  dataset_id      uuid NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  column_name     text NOT NULL CHECK (length(trim(column_name)) BETWEEN 1 AND 128),
  display_name    text DEFAULT '',
  data_type       text NOT NULL CHECK (data_type IN ('text','integer','numeric','date','timestamp','boolean')),
  is_aggregatable boolean NOT NULL DEFAULT false,
  is_groupable    boolean NOT NULL DEFAULT true,
  is_filterable   boolean NOT NULL DEFAULT true,
  ordinal         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, column_name)
);

CREATE INDEX IF NOT EXISTS dataset_columns_dataset_idx ON dataset_columns (dataset_id);

ALTER TABLE dataset_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_columns FORCE ROW LEVEL SECURITY;
CREATE POLICY dataset_columns_tenant_access ON dataset_columns
  USING (
    EXISTS (
      SELECT 1 FROM datasets d
      WHERE d.id = dataset_columns.dataset_id
        AND d.organization_id = app.current_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets d
      WHERE d.id = dataset_columns.dataset_id
        AND d.organization_id = app.current_organization_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON dataset_columns TO nexus_app;

-- ─────────────────────────────────────────────
-- AI Assistant sessions
-- ─────────────────────────────────────────────

CREATE TABLE assistant_sessions (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dataset_id      uuid REFERENCES datasets(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'New conversation' CHECK (length(trim(title)) <= 255),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assistant_sessions_org_user_idx ON assistant_sessions (organization_id, user_id, updated_at DESC);

ALTER TABLE assistant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_sessions_tenant_access ON assistant_sessions
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON assistant_sessions TO nexus_app;

-- ─────────────────────────────────────────────
-- AI Assistant messages
-- ─────────────────────────────────────────────

CREATE TABLE assistant_messages (
  id              uuid PRIMARY KEY,
  session_id      uuid NOT NULL REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','assistant','system')),
  content         text NOT NULL CHECK (length(content) <= 50000),
  query_plan      jsonb,
  result_summary  jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assistant_messages_session_idx ON assistant_messages (session_id, created_at);

ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_messages_tenant_access ON assistant_messages
  USING (
    EXISTS (
      SELECT 1 FROM assistant_sessions s
      WHERE s.id = assistant_messages.session_id
        AND s.organization_id = app.current_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assistant_sessions s
      WHERE s.id = assistant_messages.session_id
        AND s.organization_id = app.current_organization_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON assistant_messages TO nexus_app;

