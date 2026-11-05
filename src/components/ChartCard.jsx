
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const data = [
  { month: "Jan", sales: 12000 },
  { month: "Feb", sales: 18000 },
  { month: "Mar", sales: 15000 },
  { month: "Apr", sales: 25000 },
  { month: "May", sales: 22000 },
  { month: "Jun", sales: 32000 },
];

function ChartCard() {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">
          Revenue Overview
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Monthly revenue performance
        </p>
      </div>

      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />

            <Tooltip />

            <Area
              type="monotone"
              dataKey="sales"
              stroke="#6366f1"
              fill="url(#revenueColor)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ChartCard;
