import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPolicy } from './pages/AdminPolicy';
import { Attest } from './pages/Attest';
import { Credentials } from './pages/Credentials';
import { Dashboard } from './pages/Dashboard';
import { Demo } from './pages/Demo';
import { Issue } from './pages/Issue';
import { Transfer } from './pages/Transfer';
import { Verify } from './pages/Verify';
import { VerifyResult } from './pages/VerifyResult';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/admin/policy" element={<AdminPolicy />} />
        <Route path="/issue" element={<Issue />} />
        <Route path="/credentials" element={<Credentials />} />
        <Route path="/credentials/:id/transfer" element={<Transfer />} />
        <Route path="/credentials/:id/attest" element={<Attest />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:challenge" element={<VerifyResult />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
