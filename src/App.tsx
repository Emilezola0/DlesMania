import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Archive from './pages/Archive';
import Daily from './pages/Daily';
import FreePlay from './pages/FreePlay';
import Home from './pages/Home';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="daily" element={<Daily />} />
        <Route path="daily/:date" element={<Daily />} />
        <Route path="play" element={<FreePlay />} />
        <Route path="archive" element={<Archive />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
