
import { Search, Bell, ChevronDown } from "lucide-react";

function Navbar() {
  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      
      <div>
        <p className="text-sm text-slate-500">
          Welcome back!
        </p>
        <h2 className="text-lg font-semibold text-slate-900">
          Your Workspace
        </h2>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden md:flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-64">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search anything..."
            className="bg-transparent outline-none text-sm ml-2 w-full"
          />
        </div>

        <button className="relative text-slate-500 hover:text-indigo-600">
          <Bell size={21} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            M
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">
              Mahi
            </p>
            <p className="text-xs text-slate-500">
              Workspace Owner
            </p>
          </div>

          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </div>
    </header>
  );
}

export default Navbar;
