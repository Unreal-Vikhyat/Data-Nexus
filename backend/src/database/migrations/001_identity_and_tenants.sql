CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION CURRENT_USER;
SET search_path TO app, public;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid $$;

CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  email text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(trim(email)))
);
CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  UNIQUE (id, organization_id)
);
CREATE INDEX organization_members_user_idx ON organization_members (user_id, status, organization_id);
CREATE INDEX organization_members_org_role_idx ON organization_members (organization_id, role, status);
CREATE UNIQUE INDEX organization_single_owner_idx ON organization_members (organization_id) WHERE role = 'owner' AND status = 'active';

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self_or_workspace_access ON users
  USING (
    id = app.current_user_id()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.user_id = users.id
        AND m.organization_id = app.current_organization_id()
        AND m.status = 'active'
    )
  )
  WITH CHECK (id = app.current_user_id());

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_user_idx ON password_reset_tokens (user_id, expires_at) WHERE used_at IS NULL;

CREATE TABLE invitations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(trim(email)))
);
CREATE INDEX invitations_org_pending_idx ON invitations (organization_id, created_at DESC) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX invitations_email_pending_idx ON invitations (email, expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_member_access ON organizations
  USING (
    id = app.current_organization_id()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organizations.id
        AND m.user_id = app.current_user_id()
        AND m.status = 'active'
    )
  )
  WITH CHECK (id = app.current_organization_id());

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_members_scoped_access ON organization_members
  USING (user_id = app.current_user_id() OR organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_sessions_self_access ON auth_sessions
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY password_reset_self_access ON password_reset_tokens
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitations_workspace_or_recipient_access ON invitations
  USING (
    organization_id = app.current_organization_id()
    OR email = (SELECT u.email FROM users u WHERE u.id = app.current_user_id())
  )
  WITH CHECK (organization_id = app.current_organization_id());

CREATE FUNCTION app.lookup_user_for_auth(p_email text)
RETURNS TABLE (user_id uuid, user_name text, user_email text, user_password_hash text, user_disabled_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT u.id, u.name, u.email, u.password_hash, u.disabled_at
  FROM users u WHERE u.email = lower(trim(p_email))
$$;
REVOKE ALL ON FUNCTION app.lookup_user_for_auth(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lookup_user_for_auth(text) TO nexus_app;

REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON SCHEMA app FROM nexus_app;
GRANT USAGE ON SCHEMA app TO nexus_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, organizations, organization_members,
  auth_sessions, password_reset_tokens, invitations TO nexus_app;
REVOKE ALL ON FUNCTION app.current_user_id(), app.current_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_user_id(), app.current_organization_id() TO nexus_app;
CREATE FUNCTION app.lookup_password_reset_token(p_token_hash text)
RETURNS TABLE (reset_id uuid, reset_user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT t.id, t.user_id FROM password_reset_tokens t
  WHERE t.token_hash = p_token_hash AND t.used_at IS NULL AND t.expires_at > now()
$$;
REVOKE ALL ON FUNCTION app.lookup_password_reset_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lookup_password_reset_token(text) TO nexus_app;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexus_app' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'nexus_app must not be SUPERUSER or BYPASSRLS';
  END IF;
END $$;
