import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  return (
    <div className="app-container">
      {/* Skip link per screen reader e navigazione da tastiera */}
      <a href="#main-content" className="skip-link">Vai al contenuto principale</a>

      <main id="main-content" className="app-main">
        <Routes>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
