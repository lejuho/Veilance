import { Navigate, Route, Routes } from 'react-router-dom';
import { Screen } from './Screen';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Screen />} />
      <Route path="/explorer/tx/:hash" element={<Screen explorer="tx" />} />
      <Route path="/explorer/block/:height" element={<Screen explorer="block" />} />
      <Route path="/explorer/contract" element={<Screen explorer="contract" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
