import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 text-white font-bold text-xl">
              <span className="text-2xl">♟</span>
              <span>ChessPlatform</span>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center gap-6">
              <Link to="/" className="text-gray-300 hover:text-white transition-colors text-sm">
                Home
              </Link>
              <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors text-sm">
                Leaderboard
              </Link>

              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <Link
                    to={`/profile/${user?.id}`}
                    className="text-gray-300 hover:text-white transition-colors text-sm flex items-center gap-1"
                  >
                    <span className="text-blue-400 font-medium">{user?.username}</span>
                    <span className="text-xs text-gray-500">({user?.rating})</span>
                  </Link>
                  <button onClick={handleLogout} className="btn-secondary text-xs px-3 py-1.5">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="text-gray-300 hover:text-white text-sm transition-colors">
                    Login
                  </Link>
                  <Link to="/register" className="btn-primary text-xs px-3 py-1.5">
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-4 text-center text-gray-500 text-xs">
        ChessPlatform © 2026 — Built with React, Node.js & PostgreSQL
      </footer>
    </div>
  );
}
