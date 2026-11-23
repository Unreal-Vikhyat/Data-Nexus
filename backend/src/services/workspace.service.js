import { env } from "../config/env.js";
import { withNewTenantTransaction, withTenantTransaction, withUserTransaction } from "../database/transaction.js";
import { hashSecret, newId, newSecret } from "../utils/crypto.js";
import { sendWorkspaceInviteEmail } from "./email.service.js";

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export async function listWorkspaces(userId) {
  return withUserTransaction(userId, async (client) => {
    const result = await client.query(
      `SELECT o.id, o.name, m.role, m.joined_at, m.status
       FROM organization_members m JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = $1 AND m.status = 'active' ORDER BY m.created_at`, [userId],
    );
    return result.rows;
  });
}

export async function createWorkspace(userId, name) {
  const organizationId = newId();
  await withNewTenantTransaction(userId, organizationId, async (client) => {
    await client.query("INSERT INTO organizations (id, name, created_by) VALUES ($1, $2, $3)", [organizationId, name.trim(), userId]);
    await client.query(
      "INSERT INTO organization_members (id, organization_id, user_id, role) VALUES ($1, $2, $3, 'owner')",
      [newId(), organizationId, userId],
    );
  });
  return { id: organizationId, name: name.trim(), role: "owner" };
}

export async function getWorkspace(userId, organizationId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const result = await client.query(
      `SELECT o.id, o.name, o.created_at, m.role,
              (SELECT count(*)::int FROM organization_members members
               WHERE members.organization_id = o.id AND members.status = 'active') AS member_count
       FROM organizations o JOIN organization_members m ON m.organization_id = o.id AND m.user_id = $2
       WHERE o.id = $1`, [organizationId, userId],
    );
    return result.rows[0];
  });
}

export async function updateWorkspace(userId, organizationId, name) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const membership = await client.query(
      "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'",
      [organizationId, userId],
    );
    if (!membership.rowCount) throw httpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
    if (!['owner', 'admin'].includes(membership.rows[0].role)) throw httpError(403, "FORBIDDEN", "Only workspace owners or admins can update the workspace");
    const result = await client.query(
      "UPDATE organizations SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, name, updated_at",
      [name.trim(), organizationId],
    );
    return { ...result.rows[0], role: membership.rows[0].role };
  });
}

export async function listMembers(userId, organizationId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const result = await client.query(
      `SELECT m.id, m.user_id AS "userId", u.name, u.email, m.role, m.status, m.joined_at AS "joinedAt"
       FROM organization_members m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1 ORDER BY m.joined_at`, [organizationId],
    );
    return result.rows;
  });
}

export async function inviteMember(userId, organizationId, { email, role }) {
  const token = newSecret();
  const invitation = await withTenantTransaction(userId, organizationId, async (client) => {
    const actor = await client.query(
      "SELECT role FROM organization_members WHERE user_id = $1 AND organization_id = $2 AND status = 'active'",
      [userId, organizationId],
    );
    const actorRole = actor.rows[0]?.role;
    if (!['owner', 'admin'].includes(actorRole)) throw httpError(403, "FORBIDDEN", "Only owners and admins can invite members");
    if (actorRole === 'admin' && role === 'admin') throw httpError(403, "FORBIDDEN", "Admins cannot invite another admin");
    const exists = await client.query(
      `SELECT 1 FROM organization_members m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1 AND u.email = $2 AND m.status = 'active'`, [organizationId, email.toLowerCase()],
    );
    if (exists.rowCount) throw httpError(409, "ALREADY_A_MEMBER", "This user is already a workspace member");
    await client.query(
      `INSERT INTO invitations (id, organization_id, email, role, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 * interval '1 hour'))`,
      [newId(), organizationId, email.toLowerCase(), role, hashSecret(token), userId, env.INVITATION_EXPIRES_HOURS],
    );
    const org = await client.query("SELECT name FROM organizations WHERE id = $1", [organizationId]);
    return { email: email.toLowerCase(), role, workspaceName: org.rows[0].name };
  });
  const url = `${env.FRONTEND_URL}/invitations/accept?token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation.email)}`;
  let delivery;
  try {
    delivery = await sendWorkspaceInviteEmail({
      to: invitation.email,
      workspaceName: invitation.workspaceName,
      inviteUrl: url,
    });
  } catch (error) {
    await withTenantTransaction(userId, organizationId, (client) => client.query(
      "UPDATE invitations SET revoked_at = now() WHERE token_hash = $1", [hashSecret(token)],
    ));
    throw error;
  }
  return { email: invitation.email, role: invitation.role, ...(delivery.developmentUrl ? { developmentInvitationUrl: delivery.developmentUrl } : {}) };
}

export async function acceptInvitation(userId, token) {
  const hashedToken = hashSecret(token);
  return withUserTransaction(userId, async (client) => {
    const found = await client.query(
      `SELECT i.id, i.organization_id, i.role, i.email
       FROM invitations i JOIN users u ON lower(u.email) = i.email
       WHERE i.token_hash = $1 AND i.email = u.email AND u.id = $2
         AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()`, [hashedToken, userId],
    );
    const invitation = found.rows[0];
    if (!invitation) throw httpError(404, "INVITATION_NOT_FOUND", "Invitation is invalid, expired, or belongs to another account");
    await client.query("SELECT set_config('app.current_organization_id', $1, true)", [invitation.organization_id]);
    const existing = await client.query(
      "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
      [invitation.organization_id, userId],
    );
    if (existing.rows[0]?.role === 'owner') throw httpError(409, "OWNER_ROLE_PROTECTED", "An owner cannot accept a member invitation");
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active', role = EXCLUDED.role, updated_at = now()`,
      [newId(), invitation.organization_id, userId, invitation.role],
    );
    await client.query("UPDATE invitations SET accepted_at = now(), accepted_by = $1 WHERE id = $2", [userId, invitation.id]);
    return { workspaceId: invitation.organization_id, role: invitation.role };
  });
}

export async function updateMemberRole(userId, organizationId, memberId, role) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const actor = await client.query("SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2", [organizationId, userId]);
    const target = await client.query("SELECT id, role, user_id FROM organization_members WHERE organization_id = $1 AND id = $2", [organizationId, memberId]);
    if (!target.rowCount) throw httpError(404, "MEMBER_NOT_FOUND", "Member not found");
    const actorRole = actor.rows[0]?.role;
    if (target.rows[0].role === 'owner') throw httpError(409, "OWNER_ROLE_PROTECTED", "Transfer ownership before changing the owner role");
    if (actorRole !== 'owner' && (actorRole !== 'admin' || target.rows[0].role === 'admin' || role === 'admin')) {
      throw httpError(403, "FORBIDDEN", "You cannot change this member's role");
    }
    const result = await client.query(
      "UPDATE organization_members SET role = $1, updated_at = now() WHERE id = $2 RETURNING id, role, status",
      [role, memberId],
    );
    return result.rows[0];
  });
}

export async function removeMember(userId, organizationId, memberId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const actor = await client.query("SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2", [organizationId, userId]);
    const target = await client.query("SELECT id, role FROM organization_members WHERE organization_id = $1 AND id = $2", [organizationId, memberId]);
    if (!target.rowCount) throw httpError(404, "MEMBER_NOT_FOUND", "Member not found");
    if (target.rows[0].role === 'owner') throw httpError(409, "OWNER_ROLE_PROTECTED", "Transfer ownership before removing the owner");
    if (actor.rows[0]?.role !== 'owner' && (actor.rows[0]?.role !== 'admin' || target.rows[0].role === 'admin')) {
      throw httpError(403, "FORBIDDEN", "You cannot remove this member");
    }
    await client.query("DELETE FROM organization_members WHERE id = $1", [memberId]);
    return { removed: true };
  });
}
