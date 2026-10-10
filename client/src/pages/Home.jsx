import { Link } from 'react-router-dom';
import { useAuth } from '../context';
import { ShieldCheck, Zap, ArrowRight, UserCheck, Store } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-700/40 text-indigo-300 text-xs font-medium mb-6">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          Hyperlocal Retail Deals &amp; Marketplace
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-4">
          Welcome to{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            OfferBazaar
          </span>
        </h1>
        <p className="text-lg text-slate-300 font-normal leading-relaxed mb-8">
          A high-performance full-stack deals and marketplace platform. Discover
          verified promotions from local neighborhood merchants, or register
          your shop to reach shoppers in your area.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {isAuthenticated ? (
            <Link
              to={
                user?.role === 'admin'
                  ? '/admin'
                  : user?.role === 'vendor'
                    ? '/vendor'
                    : '/customer'
              }
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-600/25 transition-all"
            >
              Go to Your Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-600/25 transition-all"
              >
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Role Cards Quick Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4">
            <UserCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">
            Customer Account
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Discover local deals nearby, filter by category, bookmark favorite
            offers, and write verified reviews for local shops.
          </p>
          <Link
            to="/signup"
            className="text-xs text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1"
          >
            Sign up as Customer &rarr;
          </Link>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
            <Store className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">
            Vendor Account
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Sign up to list promotional deals, manage shop details, track
            customer impressions, and reach local shoppers effortlessly.
          </p>
          <Link
            to="/signup"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
          >
            Sign up as Vendor &rarr;
          </Link>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">
            Admin Portal
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Strict role isolation: admin accounts are seeded securely from
            environment variables or appointed by existing administrators.
          </p>
          <Link
            to="/login"
            className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
          >
            Admin Sign In &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
