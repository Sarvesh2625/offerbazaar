import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context';
import { Loader2 } from 'lucide-react';

/**
 * Route protection wrapper based on authentication state and allowed roles
 * @param {Object} props
 * @param {string[]} [props.allowedRoles] - Optional list of authorized roles
 * @param {React.ReactNode} props.children
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-indigo-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs font-medium text-slate-400">
            Authenticating session...
          </p>
        </div>
      </div>
    );
  }

  // 1. If not authenticated, redirect to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. If roles are specified and user role is not permitted, redirect to appropriate role dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'vendor') {
      return <Navigate to="/vendor" replace />;
    } else {
      return <Navigate to="/customer" replace />;
    }
  }

  return children;
}
