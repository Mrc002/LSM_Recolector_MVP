import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Grabadora from './pages/Grabadora';
import Expediente from './pages/Expediente';

export default function App() {
  return (
    <Router>
      {/* Usamos Tailwind para el fondo base oscuro de toda la app */}
      <div className="min-h-screen bg-[#0B1121] text-[#F9FAFB] font-sans">
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/grabadora" element={<Grabadora />} />
          <Route path="/expediente" element={<Expediente />} />
        </Routes>
        
      </div>
    </Router>
  );
}