
import { useState } from "react";
import { Building2, Plus, Users } from "lucide-react";

function Workspace() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaces, setWorkspaces] = useState([
    {
      id: 1,
      name: "My Company",
      members: 1,
      role: "Owner",
    },
  ]);

  const handleCreateWorkspace = (e) => {
    e.preventDefault();

    if (!workspaceName.trim()) return;

    const newWorkspace = {
      id: Date.now(),
      name: workspaceName.trim(),
      members: 1,
      role: "Owner",
    };

    setWorkspaces([...workspaces, newWorkspace]);
    setWorkspaceName("");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          Workspace Management
        </h1>
        <p className="mt-2 text-gray-500">
          Create and manage your company workspaces.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3">
              <Plus className="text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold">Create Workspace</h2>
          </div>

          <form onSubmit={handleCreateWorkspace}>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Company / Workspace Name
            </label>

            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Enter company name"
              className="w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500"
              required
            />

            <button
              type="submit"
              className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
            >
              <Plus size={18} />
              Create Workspace
            </button>
          </form>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-semibold">
            Your Workspaces
          </h2>

          <div className="space-y-4">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-3">
                    <Building2 className="text-purple-600" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {workspace.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {workspace.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users size={17} />
                  {workspace.members}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Workspace;
