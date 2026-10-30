import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';

// Each page in its own file, downloaded when first opened (the home page comes with the app).
const Archive = lazy(() => import('./pages/Archive'));
const BossBattle = lazy(() => import('./pages/BossBattle'));
const BossSelect = lazy(() => import('./pages/BossSelect'));
const FreePlay = lazy(() => import('./pages/FreePlay'));
const GamesHub = lazy(() => import('./pages/GamesHub'));
const GuessYear = lazy(() => import('./pages/GuessYear'));
const HigherLower = lazy(() => import('./pages/HigherLower'));
const Jlpt = lazy(() => import('./pages/Jlpt'));
const NameThemAll = lazy(() => import('./pages/NameThemAll'));
const RailRush = lazy(() => import('./pages/RailRush'));
const MemoryPairs = lazy(() => import('./pages/MemoryPairs'));
const OddOneOut = lazy(() => import('./pages/OddOneOut'));
const Crossroads = lazy(() => import('./pages/Crossroads'));
const Summit = lazy(() => import('./pages/Summit'));
const Shop = lazy(() => import('./pages/Shop'));
const Album = lazy(() => import('./pages/Album'));
const Account = lazy(() => import('./pages/Account'));
const Trades = lazy(() => import('./pages/Trades'));
const WhoAmI = lazy(() => import('./pages/WhoAmI'));
const FranchiseWordle = lazy(() => import('./pages/FranchiseWordle'));
const QuickSort = lazy(() => import('./pages/QuickSort'));
const SixDegrees = lazy(() => import('./pages/SixDegrees'));
const Expedition = lazy(() => import('./pages/Expedition'));
const MapQuiz = lazy(() => import('./pages/MapQuiz'));
const Daily = lazy(() => import('./pages/Daily'));
const DailyHub = lazy(() => import('./pages/Daily').then((m) => ({ default: m.DailyHub })));
const VoiceLine = lazy(() => import('./pages/VoiceLine'));
const SpecialistUniverse = lazy(() => import('./pages/Specialist'));
const SpecialistHub = lazy(() => import('./pages/Specialist').then((m) => ({ default: m.SpecialistHub })));
const GuessRankGame = lazy(() => import('./pages/GuessRank'));
const GuessRankHub = lazy(() => import('./pages/GuessRank').then((m) => ({ default: m.GuessRankHub })));
const WhosThat = lazy(() => import('./pages/WhosThat'));
const WhosThatHub = lazy(() => import('./pages/WhosThat').then((m) => ({ default: m.WhosThatHub })));

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
        <Route path="jlpt" element={<Jlpt />} />
        <Route path="jlpt/:deck" element={<Jlpt />} />
        <Route path="name-them-all" element={<NameThemAll />} />
        <Route path="name-them-all/:list" element={<NameThemAll />} />
        <Route path="guess-the-year" element={<GuessYear />} />
        <Route path="rail-rush" element={<RailRush />} />
        <Route path="memory" element={<MemoryPairs />} />
        <Route path="memory/:deck" element={<MemoryPairs />} />
        <Route path="odd-one-out" element={<OddOneOut />} />
        <Route path="crossroads" element={<Crossroads />} />
        <Route path="summit" element={<Summit />} />
        <Route path="shop" element={<Shop />} />
        <Route path="album" element={<Album />} />
        <Route path="account" element={<Account />} />
        <Route path="trades" element={<Trades />} />
        <Route path="voice-line" element={<VoiceLine />} />
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
