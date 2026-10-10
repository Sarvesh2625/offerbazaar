import { Store, ShieldCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Universal Footer component across public-facing views.
 */
export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Store className="w-4 h-4 font-bold" />
              </div>
              <span className="text-lg font-black tracking-tight text-white font-display">
                Offer<span className="text-amber-400">Bazaar</span>
              </span>
            </Link>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              A modern hyperlocal marketplace connecting neighborhood shoppers
              with genuine verified local retail deals, seasonal promotions, and
              authentic customer reviews.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Verified Local Store Offers</span>
            </div>
          </div>

          {/* Quick Nav */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Marketplace
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link
                  to="/customer"
                  className="hover:text-amber-400 transition-colors"
                >
                  Customer Deals Feed
                </Link>
              </li>
              <li>
                <Link
                  to="/vendor"
                  className="hover:text-amber-400 transition-colors"
                >
                  Vendor Merchant Center
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="hover:text-amber-400 transition-colors"
                >
                  Merchant / Shopper Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Engineering / Author Credit */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Credits &amp; License
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-1.5">
                <span>Built with</span>
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
                <span>by</span>
                <strong className="text-slate-200">Sarvesh Mekhe</strong>
              </p>
              <p>
                Open Source &bull;{' '}
                <strong className="text-slate-200">MIT License</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                React &bull; Tailwind CSS &bull; Express &bull; MongoDB Atlas
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} OfferBazaar. All rights reserved.
          </p>
          <div className="flex items-center space-x-6">
            <span>
              Author:{' '}
              <span className="text-slate-300 font-medium">Sarvesh Mekhe</span>
            </span>
            <span>&bull;</span>
            <span className="text-amber-400/80 font-medium">
              Hyperlocal Deal Discovery
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
