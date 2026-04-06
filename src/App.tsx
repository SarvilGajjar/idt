import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import CreateAdmin from './pages/CreateAdmin';
import CreateTempAdmin from './pages/CreateTempAdmin';
import Profile from './pages/Profile';
import ActivityHistory from './pages/ActivityHistory';

function DashboardRouter() {
  const { userProfile } = useAuth();

  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  return userProfile.role === 'admin' ? <AdminDashboard /> : <UserDashboard />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/create"
            element={
              <ProtectedRoute requiredRole="admin">
                <CreateAdmin />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/create-temp"
            element={
              <ProtectedRoute requiredRole="admin">
                <CreateTempAdmin />
              </ProtectedRoute>
            }
          />

          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route path="/activity" element={<ProtectedRoute><ActivityHistory /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
