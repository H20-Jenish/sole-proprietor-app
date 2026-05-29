import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Recruiters from './components/Recruiters';
import Expenses from './components/Expenses';
import Timesheets from './components/Timesheets';
import Invoices from './components/Invoices';
import Settings from './components/Settings';
import Resources from './components/Resources';
import SecurityGateModalHost from './components/SecurityGateModalHost';
import Reports from './components/Reports';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="recruiters" element={<Recruiters />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="resources" element={<Resources />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <SecurityGateModalHost />
      </AuthProvider>
    </BrowserRouter>
  );
}