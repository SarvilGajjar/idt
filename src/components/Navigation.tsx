import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

export const Navigation: React.FC = () => {
  const { userProfile, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-700 text-white shadow-xl border-b-4 border-indigo-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition" onClick={() => navigate('/')}>
            <div className="bg-white bg-opacity-20 p-2 rounded-lg backdrop-blur">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="font-bold text-2xl hidden sm:inline bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">BookWorm</span>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-white to-blue-50 text-indigo-700 px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              📚 Dashboard
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => navigate('/admin')}
                  className="bg-gradient-to-r from-amber-400 to-orange-400 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  ⚙️ Admin
                </button>
                <button
                  onClick={() => navigate('/admin/create-temp')}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  👤 Temp Admin
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/profile')}
              className="bg-gradient-to-r from-green-400 to-teal-400 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              👤 Profile
            </button>
            <button
              onClick={() => navigate('/activity')}
              className="bg-gradient-to-r from-cyan-400 to-blue-400 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              📋 Activity
            </button>
            <div className="h-10 w-0.5 bg-white bg-opacity-30 mx-2"></div>
            <div className="flex flex-col items-end">
              <span className="font-semibold text-white">{userProfile?.name}</span>
              <span className="text-xs text-blue-100 uppercase tracking-wider">{userProfile?.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-lg hover:scale-105"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t-2 border-blue-400 bg-blue-700 bg-opacity-50">
            <p className="text-white py-3 px-2 font-semibold">
              {userProfile?.name} • {userProfile?.role}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-white text-indigo-700 px-4 py-2 rounded-lg font-semibold mb-2 hover:shadow-lg transition"
            >
              📚 Dashboard
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full bg-amber-400 text-white px-4 py-2 rounded-lg font-semibold mb-2 hover:shadow-lg transition"
                >
                  ⚙️ Admin Panel
                </button>
                <button
                  onClick={() => navigate('/admin/create-temp')}
                  className="w-full bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold mb-2 hover:shadow-lg transition"
                >
                  👤 Create Temp Admin
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/profile')}
              className="w-full bg-green-400 text-white px-4 py-2 rounded-lg font-semibold mb-2 hover:shadow-lg transition"
            >
              👤 Profile
            </button>
            <button
              onClick={() => navigate('/activity')}
              className="w-full bg-cyan-400 text-white px-4 py-2 rounded-lg font-semibold mb-2 hover:shadow-lg transition"
            >
              📋 Activity
            </button>
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all hover:shadow-lg"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
