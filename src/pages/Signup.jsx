
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layers, Eye, EyeOff, User, Mail, Lock, Building2 } from "lucide-react";

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSignup = (e) => {
    e.preventDefault();
    setMessage("");

    if (form.password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    setMessage("Demo account created! Backend registration is not connected yet.");

    setTimeout(() => navigate("/login"), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">

        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center">
            <Layers size={30} className="text-white" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mt-4">
            Create Account
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Start your analytics journey with Data Nexus.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">

          {[
            { name: "name", label: "Full Name", placeholder: "Enter your name", icon: User, type: "text" },
            { name: "company", label: "Company Name", placeholder: "Enter company name", icon: Building2, type: "text" },
            { name: "email", label: "Email Address", placeholder: "you@example.com", icon: Mail, type: "email" },
          ].map((field) => {
            const Icon = field.icon;

            return (
              <div key={field.name}>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {field.label}
                </label>

                <div className="flex items-center border border-slate-200 rounded-lg px-3">
                  <Icon size={18} className="text-slate-400" />

                  <input
                    name={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={form[field.name]}
                    onChange={handleChange}
                    className="w-full p-3 outline-none text-sm"
                    required
                  />
                </div>
              </div>
            );
          })}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>

            <div className="flex items-center border border-slate-200 rounded-lg px-3">
              <Lock size={18} className="text-slate-400" />

              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={handleChange}
                className="w-full p-3 outline-none text-sm"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {message && (
            <p className="text-sm text-indigo-600 bg-indigo-50 p-3 rounded-lg">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold transition"
          >
            Create Account
          </button>

        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 font-semibold">
            Sign In
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Signup;
