import { Navbar } from './Navbar.jsx';
import { Sidebar } from './Sidebar.jsx';

export const DashboardContainer = ({ user, onLogout, children }) => {
  return (
    <div className='admin-shell flex min-h-screen flex-col'>
      <Navbar user={user} onLogout={onLogout} />

      <div className='flex flex-1 flex-col md:flex-row'>
        <Sidebar />

        <main className='admin-main flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-8'>
          {children}
        </main>
      </div>
    </div>
  );
};
