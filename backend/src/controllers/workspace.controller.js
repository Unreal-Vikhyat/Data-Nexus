import * as workspaceService from "../services/workspace.service.js";

export async function list(req, res) {
  const data = await workspaceService.listWorkspaces(req.auth.userId);
  res.json({ success: true, message: "Workspaces", data });
}

export async function create(req, res) {
  const data = await workspaceService.createWorkspace(req.auth.userId, req.body.name);
  res.status(201).json({ success: true, message: "Workspace created", data });
}

export async function get(req, res) {
  const data = await workspaceService.getWorkspace(req.auth.userId, req.params.workspaceId);
  res.json({ success: true, message: "Workspace", data });
}

export async function update(req, res) {
  const data = await workspaceService.updateWorkspace(req.auth.userId, req.params.workspaceId, req.body.name);
  res.json({ success: true, message: "Workspace updated", data });
}

export async function members(req, res) {
  const data = await workspaceService.listMembers(req.auth.userId, req.params.workspaceId);
  res.json({ success: true, message: "Workspace members", data });
}

export async function invite(req, res) {
  const data = await workspaceService.inviteMember(req.auth.userId, req.params.workspaceId, req.body);
  res.status(201).json({ success: true, message: "Invitation created", data });
}

export async function acceptInvitation(req, res) {
  const data = await workspaceService.acceptInvitation(req.auth.userId, req.body.token);
  res.json({ success: true, message: "Invitation accepted", data });
}

export async function updateMember(req, res) {
  const data = await workspaceService.updateMemberRole(req.auth.userId, req.params.workspaceId, req.params.memberId, req.body.role);
  res.json({ success: true, message: "Member role updated", data });
}

export async function removeMember(req, res) {
  const data = await workspaceService.removeMember(req.auth.userId, req.params.workspaceId, req.params.memberId);
  res.json({ success: true, message: "Member removed", data });
}
