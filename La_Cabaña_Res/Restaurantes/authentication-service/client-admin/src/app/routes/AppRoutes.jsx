import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from '../../features/auth/pages/AuthPage.jsx';
import { DashboardPage } from '../layouts/DashboardPage.jsx';
import { ProtectedRoutes } from './ProtectedRoutes.jsx';
import { UnauthorizedPage } from '../../features/auth/pages/UnauthorizedPage.jsx';
import { RoleGuard } from './RoleGuard.jsx';
import { Dashboard } from '../../pages/Dashboard.jsx';
import { Menus } from '../../pages/Menus.jsx';
import { Orders } from '../../pages/Orders.jsx';
import { CalendarNotes } from '../../pages/CalendarNotes.jsx';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path='/' element={<Navigate to='/login' replace />} />
      <Route path='/login' element={<AuthPage />} />
      <Route path='/unauthorized' element={<UnauthorizedPage />} />
      <Route
        path='/dashboard/*'
        element={
          <ProtectedRoutes>
            <RoleGuard allowedRoles={['ADMIN', 'COCINA', 'RECEPCION']}>
              <DashboardPage />
            </RoleGuard>
          </ProtectedRoutes>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path='nuevo-pedido' element={<Orders />} />
        <Route path='bebidas' element={<Orders />} />
        <Route path='cocina' element={<Orders />} />
        <Route path='entregas' element={<Orders />} />
        <Route path='historial' element={<Orders />} />
        <Route path='calendario' element={<CalendarNotes />} />
        <Route path='menus' element={<Menus />} />
        <Route path='*' element={<Navigate to='/dashboard' replace />} />
      </Route>
      <Route path='*' element={<Navigate to='/login' replace />} />
    </Routes>
  );
};
