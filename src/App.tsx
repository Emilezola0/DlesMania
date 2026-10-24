import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Archive from './pages/Archive';
import BossBattle from './pages/BossBattle';
import BossSelect from './pages/BossSelect';
import Daily, { DailyHub } from './pages/Daily';
import FreePlay from './pages/FreePlay';
import Home from './pages/Home';
import SpecialistUniverse, { SpecialistHub } from './pages/Specialist';
import GuessRankGame, { GuessRankHub } from './pages/GuessRank';
import WhosThat, { WhosThatHub } from './pages/WhosThat';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="daily" element={<DailyHub />} />
        <Route path="daily/:domain" element={<Daily />} />
        <Route path="daily/:domain/:date" element={<Daily />} />
        <Route path="play" element={<FreePlay />} />
        <Route path="archive" element={<Archive />} />
        <Route path="boss" element={<BossSelect />} />
        <Route path="boss/:id" element={<BossBattle />} />
        <Route path="whos-that" element={<WhosThatHub />} />
        <Route path="whos-that/:key" element={<WhosThat />} />
        <Route path="specialist" element={<SpecialistHub />} />
        <Route path="specialist/:universe" element={<SpecialistUniverse />} />
        <Route path="specialist/:universe/:date" element={<SpecialistUniverse />} />
        <Route path="rank" element={<GuessRankHub />} />
        <Route path="rank/:game" element={<GuessRankGame />} />
        <Route path="rank/:game/:date" element={<GuessRankGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
