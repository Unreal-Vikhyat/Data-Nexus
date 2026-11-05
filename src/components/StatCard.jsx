
function StatCard({ title, value, change, icon: Icon }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500 font-medium">
          {title}
        </p>

        <div className="p-3 bg-indigo-50 rounded-lg">
          <Icon size={21} className="text-indigo-600" />
        </div>
      </div>

      <h3 className="text-2xl font-bold text-slate-900 mt-4">
        {value}
      </h3>

      <p className="text-sm text-emerald-600 mt-2">
        {change}
      </p>
    </div>
  );
}

export default StatCard;
