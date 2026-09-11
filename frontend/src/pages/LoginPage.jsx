import { useState } from 'react';
import { User, Lock, EyeOff, Eye, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { login } from '../api/auth';

export default function LoginPage({ setActive, setIsLoggedIn, setUserRole, setCurrentUser }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedId = userId.trim();
    const trimmedPass = password.trim();

    if (!trimmedId || !trimmedPass) {
      setError('Please enter both User ID and Password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { user } = await login(trimmedId, trimmedPass);
      if (setIsLoggedIn) setIsLoggedIn(true);
      if (setUserRole) setUserRole(user.role);
      if (setCurrentUser) setCurrentUser(user);

      // Both ADMIN and DRIVER land on Live Map after login
      setActive('Live Map');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const quickFill = (id, pass) => {
    setUserId(id);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="flex h-screen w-full bg-white font-sans overflow-hidden fixed inset-0 z-[100]">

      {/* LEFT SIDE - IMAGE */}
      <div className="hidden md:flex h-full flex-shrink-0 items-center justify-center bg-[#DDF3FE] overflow-hidden select-none">
        <img
          src="/loginBg.png"
          alt="SARATHI Logistics Intelligence Platform"
          className="h-full w-auto max-h-screen max-w-[50vw] object-contain"
        />
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="flex-1 h-full flex flex-col justify-between px-8 sm:px-12 md:px-16 lg:px-24 py-8 bg-white overflow-y-auto relative">

        {/* Top Header Row */}
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => setActive('Home')}
            className="flex items-center text-sm font-semibold text-gray-500 hover:text-[#0f2a4a] transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} className="mr-1.5" /> Back to Home
          </button>
          <div className="text-xs font-bold tracking-widest text-[#0a8754] uppercase">
            CONNECT &bull; COORDINATE &bull; DELIVER
          </div>
        </div>

        {/* Center Form Container */}
        <div className="max-w-md w-full mx-auto my-auto py-6">
          <h1 className="text-4xl font-extrabold text-[#0f2a4a] mb-2">Welcome Back</h1>
          <p className="text-gray-500 mb-6 text-base">Log in to access SARATHI.</p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label className="block text-[#0f2a4a] font-bold text-sm mb-2">User ID / Vehicle ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={userId}
                  disabled={isLoading}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#0a8754] focus:ring-1 focus:ring-[#0a8754] text-gray-800 placeholder-gray-400 bg-white"
                  placeholder="e.g. admin or AS-01-FOOD-04"
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[#0f2a4a] font-bold text-sm mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#0a8754] focus:ring-1 focus:ring-[#0a8754] text-gray-800 placeholder-gray-400 bg-white"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-7">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" className="form-checkbox h-4 w-4 text-[#0a8754] rounded focus:ring-[#0a8754] border-gray-300" defaultChecked />
                <span className="ml-2 text-sm text-[#0f2a4a] font-semibold">Remember me</span>
              </label>
              <span className="text-xs text-gray-400">JWT 8h Session</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0a8754] hover:bg-[#086a42] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-[#0a8754]/30 cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span className="text-lg tracking-wide">Login</span> <ArrowRight size={20} className="ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Quick fill buttons for testing & evaluation */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 mb-2 text-center">Quick Login (Seed Accounts):</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => quickFill('admin', 'sarathi@123')}
                className="px-2.5 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded font-medium hover:bg-emerald-100 transition-colors text-left"
              >
                <b>Admin</b> (all 8 tabs)
              </button>
              <button
                type="button"
                onClick={() => quickFill('AS-01-FOOD-04', 'driver123')}
                className="px-2.5 py-1.5 border border-blue-300 bg-blue-50 text-blue-800 rounded font-medium hover:bg-blue-100 transition-colors text-left"
              >
                <b>Driver 1</b> (Food truck)
              </button>
              <button
                type="button"
                onClick={() => quickFill('AS-02-MED-11', 'driver123')}
                className="px-2.5 py-1.5 border border-purple-300 bg-purple-50 text-purple-800 rounded font-medium hover:bg-purple-100 transition-colors text-left"
              >
                <b>Driver 2</b> (Med truck)
              </button>
              <button
                type="button"
                onClick={() => quickFill('AS-03-FUEL-07', 'driver123')}
                className="px-2.5 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 rounded font-medium hover:bg-amber-100 transition-colors text-left"
              >
                <b>Driver 3</b> (Fuel truck)
              </button>
              <button
                type="button"
                onClick={() => quickFill('AS-04-WATER-09', 'driver123')}
                className="px-2.5 py-1.5 border border-cyan-300 bg-cyan-50 text-cyan-800 rounded font-medium hover:bg-cyan-100 transition-colors text-left"
              >
                <b>Driver 4</b> (Water tanker)
              </button>
              <button
                type="button"
                onClick={() => quickFill('AS-05-SHELTER-12', 'driver123')}
                className="px-2.5 py-1.5 border border-rose-300 bg-rose-50 text-rose-800 rounded font-medium hover:bg-rose-100 transition-colors text-left"
              >
                <b>Driver 5</b> (Shelter truck)
              </button>
            </div>
          </div>
        </div>

        {/* Bottom subtle brand note */}
        <div className="w-full text-center text-xs text-gray-400 py-2">
          SARATHI &copy; {new Date().getFullYear()} &bull; Logistics Intelligence Platform
        </div>
      </div>

    </div>
  );
}
