
import {
  Database,
  TrendingUp,
  Users,
  ChartNoAxesCombined,
} from "lucide-react";

import StatCard from "../components/StatCard";
import ChartCard from "../components/ChartCard";

function Dashboard() {
  const stats = [
    {
      title: "Total Datasets",
      value: "24",
      change: "Datasets uploaded",
      icon: Database,
    },
    {
      title: "Total Revenue",
      value: "₹2,45,000",
      change: "Sample revenue data",
      icon: TrendingUp,
    },
    {
      title: "Active Members",
      value: "12",
      change: "Workspace members",
      icon: Users,
    },
    {
      title: "Reports Generated",
      value: "86",
      change: "Reports created",
      icon: ChartNoAxesCombined,
    },
  ];

  return (
    <div className="space-y-8">

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your business analytics in one place.
          </p>
        </div>

        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg text-sm font-medium">
          + Create Report
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ChartCard />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900">
          Recent Datasets
        </h3>

        <p className="text-sm text-slate-500 mt-1 mb-5">
          Your recently uploaded files
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="py-3">Dataset Name</th>
                <th className="py-3">File Type</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>

            <tbody className="text-sm text-slate-700">
              <tr className="border-b border-slate-100">
                <td className="py-4 font-medium">Sales Report</td>
                <td>Excel</td>
                <td>
                  <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full">
                    Processed
                  </span>
                </td>
              </tr>

              <tr className="border-b border-slate-100">
                <td className="py-4 font-medium">Customer Data</td>
                <td>CSV</td>
                <td>
                  <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full">
                    Processed
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-4 font-medium">Product Analysis</td>
                <td>Excel</td>
                <td>
                  <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full">
                    Pending
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
