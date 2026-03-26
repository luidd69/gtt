import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';

// Pagine V2 (interfaccia principale)
import HomeV2          from './pages/v2/HomeV2';
import SearchV2        from './pages/v2/SearchV2';
import StopDetailV2    from './pages/v2/StopDetailV2';
import JourneyPlannerV2 from './pages/v2/JourneyPlannerV2';
import BottomNavV2     from './components/v2/BottomNavV2';

// Pagine condivise (nessuna versione V2 dedicata)
import Metro       from './pages/Metro';
import Nearby      from './pages/Nearby';
import Favorites   from './pages/Favorites';
import LineDetail  from './pages/LineDetail';
import VehicleMap  from './pages/VehicleMap';
import TripDetail  from './pages/TripDetail';

function StopRedirect() {
  const { stopId } = useParams();
  return <Navigate to={`/v2/stops/${stopId}`} replace />;
}

function ThemeInit() {
  useEffect(() => {
    document.getElementById('root')?.classList.add('theme-v2');
  }, []);
  return null;
}

export default function App() {
  return (
    <div className="app-container">
      <ThemeInit />
      <a href="#main-content" className="skip-link">Vai al contenuto principale</a>

      <main id="main-content" className="app-main">
        <Routes>
          {/* Home */}
          <Route path="/v2"        element={<HomeV2 />} />
          <Route path="/"          element={<Navigate to="/v2" replace />} />

          {/* Ricerca */}
          <Route path="/v2/search" element={<SearchV2 />} />
          <Route path="/search"    element={<Navigate to="/v2/search" replace />} />

          {/* Dettaglio fermata */}
          <Route path="/v2/stops/:stopId" element={<StopDetailV2 />} />
          <Route path="/stops/:stopId"    element={<StopRedirect />} />

          {/* Journey planner */}
          <Route path="/v2/journey" element={<JourneyPlannerV2 />} />
          <Route path="/journey"    element={<Navigate to="/v2/journey" replace />} />

          {/* Pagine condivise */}
          <Route path="/metro"               element={<Metro />} />
          <Route path="/nearby"              element={<Nearby />} />
          <Route path="/favorites"           element={<Favorites />} />
          <Route path="/lines/:routeId"      element={<LineDetail />} />
          <Route path="/map"                 element={<VehicleMap />} />
          <Route path="/journey/trip/:tripId" element={<TripDetail />} />
          <Route path="/trips/:tripId"       element={<TripDetail />} />

          <Route path="*" element={<Navigate to="/v2" replace />} />
        </Routes>
      </main>

      <BottomNavV2 />
    </div>
  );
}
