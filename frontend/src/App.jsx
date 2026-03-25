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

export default function App() {
  return (
    <div className="app-container">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/metro" element={<Metro />} />
          <Route path="/nearby" element={<Nearby />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/stops/:stopId" element={<StopDetail />} />
          <Route path="/lines/:routeId" element={<LineDetail />} />
          <Route path="/map" element={<VehicleMap />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
