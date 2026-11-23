
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layers, Eye, EyeOff, Mail, Lock } from "lucide-react";

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setMessage("");

    if (!email || !password) {
      setMessage("Please fill in all fields.");
      return;
    }

    setMessage("Demo login successful! Backend authentication is not connected yet.");

    // Temporary frontend navigation for testing
    setTimeout(() => navigate("/dashboard"), 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center">
            <Layers size={30} className="text-white" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mt-4">
            Data Nexus
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Welcome back! Sign in to your account.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>

            <div className="flex items-center border border-slate-200 rounded-lg px-3">
              <Mail size={18} className="text-slate-400" />

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 outline-none text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>

            <div className="flex items-center border border-slate-200 rounded-lg px-3">
              <Lock size={18} className="text-slate-400" />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <div className="flex justify-between items-center text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" className="accent-indigo-600" />
              Remember me
            </label>

            <button
              type="button"
              className="text-indigo-600 font-medium"
              onClick={() => setMessage("Forgot password functionality will be added later.")}
            >
              Forgot Password?
            </button>
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
            Sign In
          </button>

        </form>

        <p className="text-center text-sm text-slate-500 mt-7">
          Don't have an account?{" "}
          <Link to="/signup" className="text-indigo-600 font-semibold">
            Create Account
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Login;
