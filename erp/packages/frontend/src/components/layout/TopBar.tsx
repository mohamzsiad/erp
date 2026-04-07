import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

const TopBar: React.FC = () => {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const addToast = useUiStore((s) => s.addToast);
  const closeAllTabs = useUiStore((s) => s.closeAllTabs);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearAuth();
      closeAllTabs();
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-3 shrink-0 z-10">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        title="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumb / app name */}
      <span className="text-gray-700 font-semibold text-sm hidden sm:block">CloudERP</span>

      <div className="flex-1" />

      {/* Notifications */}
      <button className="relative p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
        <Bell size={17} />
        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-[#1F4E79] flex items-center justify-center text-white text-xs font-bold uppercase">
            {user?.firstName?.charAt(0) ?? 'U'}
          </div>
          <span className="text-sm text-gray-700 hidden sm:block max-w-[120px] truncate">
            {user ? `${user.firstName} ${user.lastName}` : 'User'}
          </span>
          <ChevronDown size={13} className="text-gray-400" />
        </button>

        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-20"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {user ? `${user.firstName} ${user.lastName}` : ''}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setMenuOpen(false);
                  addToast({ type: 'info', title: 'Coming soon', message: 'Profile settings will be available soon.' });
                }}
              >
                <User size={14} />
                Profile
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default TopBar;
