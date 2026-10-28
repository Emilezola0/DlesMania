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
import GamesHub from './pages/GamesHub';
import GuessYear from './pages/GuessYear';
import HigherLower from './pages/HigherLower';
import NameThemAll from './pages/NameThemAll';
import RailRush from './pages/RailRush';
import MemoryPairs from './pages/MemoryPairs';
import OddOneOut from './pages/OddOneOut';
import Crossroads from './pages/Crossroads';
import WhoAmI from './pages/WhoAmI';
import FranchiseWordle from './pages/FranchiseWordle';
import QuickSort from './pages/QuickSort';
import SixDegrees from './pages/SixDegrees';
import Expedition from './pages/Expedition';
import MapQuiz from './pages/MapQuiz';
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
        <Route path="games" element={<GamesHub />} />
        <Route path="higher-lower" element={<HigherLower />} />
        <Route path="higher-lower/:deck" element={<HigherLower />} />
        <Route path="name-them-all" element={<NameThemAll />} />
        <Route path="name-them-all/:list" element={<NameThemAll />} />
        <Route path="guess-the-year" element={<GuessYear />} />
        <Route path="rail-rush" element={<RailRush />} />
        <Route path="memory" element={<MemoryPairs />} />
        <Route path="memory/:deck" element={<MemoryPairs />} />
        <Route path="odd-one-out" element={<OddOneOut />} />
        <Route path="crossroads" element={<Crossroads />} />
        <Route path="who-am-i" element={<WhoAmI />} />
        <Route path="wordle" element={<FranchiseWordle />} />
        <Route path="wordle/:set" element={<FranchiseWordle />} />
        <Route path="quick-sort" element={<QuickSort />} />
        <Route path="quick-sort/:deck" element={<QuickSort />} />
        <Route path="six-degrees" element={<SixDegrees />} />
        <Route path="expedition" element={<Expedition />} />
        <Route path="map-quiz" element={<MapQuiz />} />
        <Route path="map-quiz/:map" element={<MapQuiz />} />
        <Route path="map-quiz/:map/edit" element={<MapQuiz edit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
