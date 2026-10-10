import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { Store, LogOut, LayoutDashboard, User } from 'lucide-react';
import Badge from './ui/Badge';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true, state: null });
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'vendor') return '/vendor';
    return '/customer';
  };

  const getRoleBadge = () => {
    if (!user) return null;
    if (user.role === 'admin') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider">
          Admin
        </span>
      );
    }
    if (user.role === 'vendor') {
      return (
        <Badge status="active" label="Vendor" size="sm" showIcon={false} />
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
        Shopper
      </span>
    );
  };

  return (
    <header className="border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-50 bg-[#0b0f19]/90 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Store className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white font-display">
                Offer<span className="text-amber-400">Bazaar</span>
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider">
                Local Deals
              </span>
            </div>
          </div>
        </Link>

        {/* Navigation Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link
            to="/"
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors hidden sm:block px-3 py-1.5 rounded-xl hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            Home
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <Link
                to={getDashboardPath()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                Dashboard
              </Link>

              <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-800">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-200 font-medium truncate max-w-[120px]">
                  {user.name}
                </span>
                {getRoleBadge()}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500"
                title="Log Out"
                aria-label="Logout from account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-200 hover:text-white px-3.5 py-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="text-xs font-bold text-slate-950 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-md shadow-amber-500/20 transition-all focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
