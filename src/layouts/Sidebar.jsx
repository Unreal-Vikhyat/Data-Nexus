
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Upload,
  MessageSquare,
  Settings,
  Layers,
  Users,
  CreditCard,
  FileText,
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Datasets", path: "/datasets", icon: Database },
  { name: "Upload Data", path: "/upload", icon: Upload },
  { name: "AI Assistant", path: "/assistant", icon: MessageSquare },
];

const managementItems = [
  { name: "Team Members", path: "/team", icon: Users },
  { name: "Reports", path: "/reports", icon: FileText },
  { name: "Credits & Billing", path: "/billing", icon: CreditCard },
  { name: "Settings", path: "/settings", icon: Settings },
];

function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0 z-20">
      
      <div className="h-20 flex items-center gap-3 px-6 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Layers className="text-white" size={23} />
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Data Nexus
          </h1>
          <p className="text-xs text-slate-500">
            Analytics Platform
          </p>
        </div>
      </div>

      <div className="px-4 py-6 flex-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">
          Main Menu
        </p>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <Icon size={19} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mt-8 mb-3">
          Management
        </p>

        <nav className="space-y-1">
          {managementItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <Icon size={19} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-indigo-50 rounded-xl p-4">
          <p className="text-sm font-semibold text-indigo-900">
            Need Help?
          </p>
          <p className="text-xs text-indigo-700 mt-1">
            Explore your analytics workspace.
          </p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
