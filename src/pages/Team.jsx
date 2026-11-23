
import { useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
} from "lucide-react";

function Team() {
  const [members, setMembers] = useState([
    {
      id: 1,
      name: "Workspace Owner",
      email: "owner@example.com",
      role: "Owner",
      status: "Active",
    },
  ]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Editor");

  const handleInvite = (e) => {
    e.preventDefault();

    const newMember = {
      id: Date.now(),
      name: email.split("@")[0],
      email: email,
      role: role,
      status: "Pending",
    };

    setMembers([...members, newMember]);
    setEmail("");
    setRole("Editor");
  };

  const handleRemove = (id) => {
    setMembers(members.filter((member) => member.id !== id));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          Team Members
        </h1>
        <p className="mt-2 text-gray-500">
          Manage your workspace team and invitations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-6 shadow-sm lg:col-span-1">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3">
              <UserPlus className="text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold">
              Invite Member
            </h2>
          </div>

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Select Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="Admin">Admin</option>
                <option value="Editor">Editor</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
            >
              <Mail size={18} />
              Send Invitation
            </button>
          </form>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              All Members
            </h2>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              {members.length} Members
            </span>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-purple-100 p-3">
                    <Users className="text-purple-600" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {member.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {member.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {member.role}
                    </p>
                    <p className="text-xs text-gray-500">
                      {member.status}
                    </p>
                  </div>

                  {member.role !== "Owner" && (
                    <button
                      type="button"
                      onClick={() => handleRemove(member.id)}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      title="Remove member"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Team;
