import React, { useState } from 'react';
import { User, Lock, EyeOff, Eye, ArrowRight, ArrowLeft } from 'lucide-react';

export default function LoginPage({ c, setActive, setIsLoggedIn, setUserRole }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const trimmedId = userId.trim();
    const trimmedPass = password.trim();

    if (!trimmedId || !trimmedPass) {
      setError('Please enter both User ID and Password');
      return;
    }

    // Check credentials:
    // If ID is Sarathi@123 and Pass is 12345678 -> HomePage with full TopNav Bar
    // If any other credentials -> Live Map with only LivePage, Reports, and Alerts
    if (trimmedId === 'Sarathi@123' && trimmedPass === '12345678') {
      setIsLoggedIn(true);
      if (setUserRole) setUserRole('admin');
      setActive('Home');
    } else {
      setIsLoggedIn(true);
      if (setUserRole) setUserRole('restricted');
      setActive('Live Map');
    }
  };

  return (
    <div className="flex h-screen w-full bg-white font-sans overflow-hidden fixed inset-0 z-[100]">

      {/* LEFT SIDE - IMAGE (Fitted to screen height without cutting) */}
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
            className="flex items-center text-sm font-semibold text-gray-500 hover:text-[#0f2a4a] transition-colors"
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
          <p className="text-gray-500 mb-8 text-base">Log in to access SARATHI.</p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label className="block text-[#0f2a4a] font-bold text-sm mb-2">User ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#0a8754] focus:ring-1 focus:ring-[#0a8754] text-gray-800 placeholder-gray-400 bg-white"
                  placeholder="Enter your user ID"
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
              <a href="#" onClick={(e) => e.preventDefault()} className="text-sm font-bold text-[#0a8754] hover:text-[#086a42] underline decoration-transparent hover:decoration-[#0a8754] transition-all">
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0a8754] hover:bg-[#086a42] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-[#0a8754]/30 cursor-pointer active:scale-[0.99]"
            >
              <span className="text-lg tracking-wide">Login</span> <ArrowRight size={20} className="ml-2" />
            </button>
          </form>

          {/* Quick hint for testing */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
            Admin: <span className="font-mono text-gray-600 font-semibold">Sarathi@123</span> / <span className="font-mono text-gray-600 font-semibold">12345678</span> (Full access)
            <br />
            Any other ID/Pass: Restricted access (Live Map, Reports, Alerts)
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

