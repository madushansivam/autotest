import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/auth/AuthGuard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RunDetail from './pages/RunDetail';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes – AuthGuard redirects to /login if no session */}
        <Route element={<AuthGuard />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/runs/:runId" element={<RunDetail />} />
        </Route>

        {/* Fallbacks */}
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
