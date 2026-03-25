import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Search from './pages/Search';
import Metro from './pages/Metro';
import Nearby from './pages/Nearby';
import Favorites from './pages/Favorites';
import StopDetail from './pages/StopDetail';
import LineDetail from './pages/LineDetail';
import VehicleMap from './pages/VehicleMap';
import JourneyPlanner from './pages/JourneyPlanner';
import TripDetail from './pages/TripDetail';

// V2 pages
import HomeV2 from './pages/v2/HomeV2';
import SearchV2 from './pages/v2/SearchV2';
import StopDetailV2 from './pages/v2/StopDetailV2';
import JourneyPlannerV2 from './pages/v2/JourneyPlannerV2';
import BottomNavV2 from './components/v2/BottomNavV2';
import useThemeStore from './store/themeStore';

function ThemeSync() {
  const theme = useThemeStore(s => s.theme);
  const location = useLocation();

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    if (theme === 'v2' || location.pathname.startsWith('/v2')) {
      root.classList.add('theme-v2');
    } else {
      root.classList.remove('theme-v2');
    }
  }, [theme, location.pathname]);

  return null;
}

export default function App() {
  const theme = useThemeStore(s => s.theme);
  const location = useLocation();
  const isV2 = theme === 'v2' || location.pathname.startsWith('/v2');

  return (
    <div className="app-container">
      <ThemeSync />
      {/* Skip link per screen reader e navigazione da tastiera */}
      <a href="#main-content" className="skip-link">Vai al contenuto principale</a>

      <main id="main-content" className="app-main">
        <Routes>
          {/* ── V1 routes (unchanged) ── */}
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/metro" element={<Metro />} />
          <Route path="/nearby" element={<Nearby />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/stops/:stopId" element={<StopDetail />} />
          <Route path="/lines/:routeId" element={<LineDetail />} />
          <Route path="/map" element={<VehicleMap />} />
          <Route path="/journey" element={<JourneyPlanner />} />
          <Route path="/journey/trip/:tripId" element={<TripDetail />} />
          <Route path="/trips/:tripId" element={<TripDetail />} />

          {/* ── V2 routes ── */}
          <Route path="/v2" element={<HomeV2 />} />
          <Route path="/v2/search" element={<SearchV2 />} />
          <Route path="/v2/stops/:stopId" element={<StopDetailV2 />} />
          <Route path="/v2/journey" element={<JourneyPlannerV2 />} />

          <Route path="*" element={<Navigate to={isV2 ? '/v2' : '/'} replace />} />
        </Routes>
      </main>

      {isV2 ? <BottomNavV2 /> : <BottomNav />}
    </div>
  );
}
