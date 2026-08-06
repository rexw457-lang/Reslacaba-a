import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/authStore';

export const RoleGuard = ({ children, allowedRoles = [] }) => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const allowed = allowedRoles.map((role) => role.toUpperCase());
  const hasAccess = allowed.includes(user?.role?.toUpperCase());

  if (!isAuthenticated) {
    return <Navigate to='/login' replace state={{ from: location }} />;
  }

  if (!hasAccess) {
    return <Navigate to='/unauthorized' replace />;
  }

  return children;
};
