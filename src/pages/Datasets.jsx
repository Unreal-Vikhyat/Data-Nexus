
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Upload,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Trash2,
  Eye,
  Database,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

const initialDatasets = [
  {
    id: 1,
    name: "Sales Report 2026",
    type: "CSV",
    rows: 12500,
    size: "2.4 MB",
    date: "Nov 10, 2026",
    status: "Completed",
  },
  {
    id: 2,
    name: "Customer Analytics",
    type: "XLSX",
    rows: 8400,
    size: "1.8 MB",
    date: "Nov 09, 2026",
    status: "Completed",
  },
  {
    id: 3,
    name: "Product Performance",
    type: "CSV",
    rows: 5200,
    size: "950 KB",
    date: "Nov 08, 2026",
    status: "Processing",
  },
  {
    id: 4,
    name: "Regional Revenue",
    type: "XLSX",
    rows: 3200,
    size: "1.2 MB",
    date: "Nov 07, 2026",
    status: "Failed",
  },
];

function StatusBadge({ status }) {
  const styles = {
    Completed: "bg-green-50 text-green-700",
    Processing: "bg-yellow-50 text-yellow-700",
    Failed: "bg-red-50 text-red-700",
  };

  const icons = {
    Completed: <CheckCircle2 size={14} />,
    Processing: <Clock size={14} />,
    Failed: <AlertCircle size={14} />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
}

export default function Datasets() {
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState(initialDatasets);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredDatasets = useMemo(() => {
    return datasets.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesType =
        typeFilter === "All" || item.type === typeFilter;

      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [datasets, search, typeFilter, statusFilter]);

  const deleteDataset = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this dataset?"
    );

    if (confirmed) {
      setDatasets((previous) =>
        previous.filter((item) => item.id !== id)
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Datasets
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and explore all your uploaded datasets.
          </p>
        </div>

        <button
          onClick={() => navigate("/upload")}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Upload size={17} />
          Upload Dataset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Total Datasets</p>
            <Database className="text-indigo-600" size={20} />
          </div>
          <h2 className="mt-3 text-2xl font-bold">{datasets.length}</h2>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Completed</p>
            <CheckCircle2 className="text-green-600" size={20} />
          </div>
          <h2 className="mt-3 text-2xl font-bold">
            {datasets.filter((d) => d.status === "Completed").length}
          </h2>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Total Rows</p>
            <FileSpreadsheet className="text-blue-600" size={20} />
          </div>
          <h2 className="mt-3 text-2xl font-bold">
            {datasets.reduce((sum, d) => sum + d.rows, 0).toLocaleString()}
          </h2>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search datasets..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={17} className="text-gray-400" />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="All">All file types</option>
              <option value="CSV">CSV</option>
              <option value="XLSX">Excel</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="All">All statuses</option>
              <option value="Completed">Completed</option>
              <option value="Processing">Processing</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Dataset</th>
                <th className="px-4 py-3 font-medium">Rows</th>
                <th className="px-4 py-3 font-medium">File Size</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredDatasets.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-50 p-2 text-green-600">
                        {item.type === "CSV" ? (
                          <FileText size={20} />
                        ) : (
                          <FileSpreadsheet size={20} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.type} File
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-600">
                    {item.rows.toLocaleString()}
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-600">
                    {item.size}
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-600">
                    {item.date}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        title="View dataset"
                        onClick={() =>
                          alert("Dataset details page will be added next.")
                        }
                        className="rounded-lg p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        <Eye size={17} />
                      </button>

                      <button
                        title="Delete dataset"
                        onClick={() => deleteDataset(item.id)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredDatasets.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center">
                    <Database
                      size={30}
                      className="mx-auto mb-2 text-gray-300"
                    />
                    <p className="text-sm font-medium text-gray-600">
                      No datasets found
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-400">
          Showing {filteredDatasets.length} of {datasets.length} datasets
        </div>
      </div>
    </div>
  );
}
