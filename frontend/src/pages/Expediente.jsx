import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Expediente() {
  const [senas, setSenas] = useState([]);
  const [statsGlobales, setStatsGlobales] = useState(null);
  
  const [vista, setVista] = useState('dashboard');
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [senaActiva, setSenaActiva] = useState(null);
  const [statsSena, setStatsSena] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/senas')
      .then(res => res.json())
      .then(data => {
        setSenas(data);
        if (data.length > 0) {
          const categoriasUnicas = [...new Set(data.map(s => s.categoria))];
          setCategoriaActiva(categoriasUnicas[0]);
        }
      });

    fetch('http://localhost:8000/api/dashboard/global')
      .then(res => res.json())
      .then(data => setStatsGlobales(data));
  }, [vista]);

  const abrirExpediente = async (sena) => {
    setSenaActiva(sena);
    setVista('expediente');
    try {
      const res = await fetch(`http://localhost:8000/api/dashboard/sena/${sena.id_sena}`);
      const data = await res.json();
      setStatsSena(data);
    } catch (error) {
      console.error("Error cargando expediente:", error);
    }
  };

  const categorias = [...new Set(senas.map(s => s.categoria))];
  const senasDeCategoriaActiva = senas.filter(s => s.categoria === categoriaActiva);

  // --- MATEMÁTICA GAMIFICADA (VOLUMÉTRICA) ---
  
  // 1. Ayudante para mostrar porcentajes pequeños (ej: 0.05%)
  const formatearPorcentaje = (actual, total) => {
    if (total === 0) return 0;
    const p = (actual / total) * 100;
    if (p > 0 && p < 1) return p.toFixed(2); // Si es muy pequeño, muestra 2 decimales
    return Math.floor(p);
  };

  // 2. Progreso Global Absoluto
  const muestrasGlobalesAct = senas.reduce((acc, s) => acc + (s.muestras_actuales || 0), 0);
  const metaGlobal = senas.reduce((acc, s) => acc + (s.meta_muestras || 500), 0);
  const porcentajeGlobalNum = metaGlobal > 0 ? (muestrasGlobalesAct / metaGlobal) * 100 : 0;
  const porcentajeGlobalFormat = formatearPorcentaje(muestrasGlobalesAct, metaGlobal);

  // 3. Progreso por Categoría Absoluto
  const calcularProgresoCategoria = (nombreCat) => {
    const senasCat = senas.filter(s => s.categoria === nombreCat);
    if (senasCat.length === 0) return { porcentajeFormat: 0, porcentajeNum: 0, totalActuales: 0, totalMetas: 0 };
    
    let totalActuales = 0;
    let totalMetas = 0;
    
    senasCat.forEach(s => {
      totalActuales += (s.muestras_actuales || 0);
      totalMetas += (s.meta_muestras || 500);
    });
    
    const porcentajeNum = totalMetas > 0 ? (totalActuales / totalMetas) * 100 : 0;
    return { 
      porcentajeFormat: formatearPorcentaje(totalActuales, totalMetas), 
      porcentajeNum: Math.min(porcentajeNum, 100),
      totalActuales, 
      totalMetas 
    };
  };

  // Cálculos para el Footer inferior
  const totalCompletas = senasDeCategoriaActiva.filter(s => (s.muestras_actuales || 0) >= (s.meta_muestras || 500)).length;
  const totalSinIniciar = senasDeCategoriaActiva.filter(s => (s.muestras_actuales || 0) === 0).length;
  const totalEnProceso = senasDeCategoriaActiva.length - totalCompletas - totalSinIniciar;

  const getColorProgreso = (actual, meta) => {
    if (actual === 0) return 'bg-slate-200';
    if (actual >= meta) return 'bg-emerald-500';
    return 'bg-amber-400';
  };

  const getBordeTarjeta = (actual, meta) => {
    if (actual === 0) return 'border-slate-200';
    if (actual >= meta) return 'border-emerald-500';
    return 'border-amber-400';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans p-6">
      <div className="max-w-[1400px] mx-auto">
        
        {/* ENCABEZADO SUPERIOR */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {vista === 'dashboard' ? 'Dashboard de Progreso del Dataset' : `Expediente: ${senaActiva?.nombre_sena}`}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {vista === 'dashboard' ? 'Seguimiento de recolección LSM para IA' : `Categoría: `}
              {vista === 'expediente' && <span className="text-emerald-600 font-medium">{senaActiva?.categoria}</span>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm">
              <div className="w-4 h-4 bg-amber-400 rounded-full mr-2"></div>
              <span className="text-slate-400 text-xs">☀️</span>
            </div>
            
            {vista === 'dashboard' ? (
              <Link to="/" className="px-5 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-medium hover:bg-slate-50 transition-colors">
                🏠 Inicio
              </Link>
            ) : (
              <button onClick={() => setVista('dashboard')} className="px-5 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                📊 Dashboard
              </button>
            )}
          </div>
        </div>

        {/* ========================================== */}
        {/* VISTA 1: DASHBOARD GLOBAL                  */}
        {/* ========================================== */}
        {vista === 'dashboard' && statsGlobales && (
          <div className="space-y-8 animate-fade-in">
            
            {/* TARJETA 1: PROGRESO GLOBAL */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Progreso Global del Dataset</h2>
              <p className="text-sm text-slate-500 mb-8">Muestras totales recolectadas vs meta global</p>
              
              {/* Anillo de Progreso */}
              <div className="relative w-48 h-48 mb-8 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle cx="96" cy="96" r="88" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                  <circle cx="96" cy="96" r="88" stroke="#10b981" strokeWidth="12" fill="none" strokeDasharray="553" 
                          strokeDashoffset={553 - (553 * (porcentajeGlobalNum / 100))} 
                          strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="text-center">
                  <div className="text-4xl font-bold text-emerald-500">
                    {porcentajeGlobalFormat}%
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    {muestrasGlobalesAct} / {metaGlobal}
                  </div>
                </div>
              </div>

              {/* KPIs Globales Editados para Gamificación */}
              <div className="w-full flex gap-4 mt-4">
                <div className="flex-1 bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                  <div className="text-2xl font-bold text-slate-800">{categorias.length}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Categorías</div>
                </div>
                <div className="flex-1 bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                  <div className="text-2xl font-bold text-emerald-500">{senas.filter(s => (s.muestras_actuales || 0) >= (s.meta_muestras || 500)).length}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Señas al 100%</div>
                </div>
                <div className="flex-1 bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                  <div className="text-2xl font-bold text-amber-600">{muestrasGlobalesAct}</div>
                  <div className="text-xs text-amber-600/70 uppercase tracking-wider mt-1">Videos en Total</div>
                </div>
              </div>
            </div>

            {/* TARJETA 2: PROGRESO POR CATEGORÍAS */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Progreso por Categorías</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categorias.map(cat => {
                  const isActive = categoriaActiva === cat;
                  const statsCat = calcularProgresoCategoria(cat); 
                  
                  return (
                    <button 
                      key={cat}
                      onClick={() => setCategoriaActiva(cat)}
                      className={`text-left bg-white p-5 rounded-2xl border transition-all ${isActive ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500' : 'border-slate-200 shadow-sm hover:border-emerald-300'}`}
                    >
                      <div className="flex justify-between items-center mb-6">
                        <span className="font-semibold text-slate-800 truncate pr-2">{cat}</span>
                        <span className="text-slate-400 text-xs">{isActive ? '▲' : '▼'}</span>
                      </div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-500">Progreso</span>
                        <span className="text-emerald-500 font-medium">{statsCat.porcentajeFormat}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mb-3 overflow-hidden">
                        <div className={`${statsCat.porcentajeNum > 0 ? 'bg-emerald-500' : 'bg-transparent'} h-1.5 rounded-full transition-all`} style={{ width: `${statsCat.porcentajeNum}%` }}></div>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-lg font-bold text-slate-800">{statsCat.totalActuales} <span className="text-xs font-normal text-slate-400">/ {statsCat.totalMetas}</span></span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Muestras</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TARJETA 3: DETALLE DE MUESTREO (Grid de Señas) */}
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Detalle de Muestreo: <span className="text-emerald-600">{categoriaActiva}</span></h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {senasDeCategoriaActiva.map(sena => {
                  const muestrasActuales = sena.muestras_actuales || 0; 
                  const meta = sena.meta_muestras || 500;
                  const porcentaje = Math.min(Math.round((muestrasActuales / meta) * 100), 100);
                  const colorClass = getColorProgreso(muestrasActuales, meta);
                  const borderClass = getBordeTarjeta(muestrasActuales, meta);

                  return (
                    <button 
                      key={sena.id_sena}
                      onClick={() => abrirExpediente(sena)}
                      className={`text-left bg-white p-5 rounded-2xl border-2 transition-all hover:-translate-y-1 ${borderClass}`}
                    >
                      <h4 className={`font-bold mb-2 truncate ${muestrasActuales >= meta ? 'text-emerald-600' : muestrasActuales === 0 ? 'text-slate-400' : 'text-amber-600'}`}>
                        {sena.nombre_sena}
                      </h4>
                      <div className="text-xl font-bold text-slate-800 mb-1">{muestrasActuales} <span className="text-sm font-normal text-slate-500">/ {meta}</span></div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider mb-4">Muestras</div>
                      
                      <div className="flex justify-between text-[10px] mb-1 text-slate-400 uppercase">
                        <span>Progreso</span>
                        <span>{porcentaje}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className={`${colorClass} h-1.5 rounded-full transition-all`} style={{ width: `${porcentaje}%` }}></div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Leyenda Footer */}
              <div className="flex justify-center gap-12 border-t border-slate-100 pt-6">
                 <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Completas</div>
                    <div className="text-xl font-bold text-emerald-500">{totalCompletas}</div>
                 </div>
                 <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">En Proceso</div>
                    <div className="text-xl font-bold text-amber-500">{totalEnProceso}</div>
                 </div>
                 <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Sin Iniciar</div>
                    <div className="text-xl font-bold text-slate-400">{totalSinIniciar}</div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: EXPEDIENTE INDIVIDUAL (Sin cambios, ya funcionaba) */}
        {vista === 'expediente' && statsSena && (
          <div className="space-y-8 animate-fade-in">
            {/* ... Resto del código del expediente que ya funcionaba ... */}
            <div className="flex justify-between items-start">
              <div className="w-1/2">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm text-slate-500">Progreso General</span>
                  <span className="text-2xl font-bold text-amber-500">{statsSena.progreso_actual} <span className="text-lg font-normal text-slate-400">/ {statsSena.meta}</span></span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full mb-2">
                  <div className="bg-amber-400 h-3 rounded-full transition-all" style={{ width: `${statsSena.porcentaje_completado}%` }}></div>
                </div>
                <div className="text-xs text-slate-500">{statsSena.porcentaje_completado}% completado</div>
              </div>

              <div className="bg-white border border-slate-200 p-2 rounded-2xl shadow-sm w-72">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 ml-2 flex items-center gap-1">
                  <span>▷</span> Video de Referencia
                </div>
                <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative">
                  {senaActiva?.url_youtube ? (
                    <iframe 
                      src={senaActiva.url_youtube.replace("watch?v=", "embed/")} 
                      className="w-full h-full" frameBorder="0" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">Sin video</div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full border-2 border-emerald-500 flex items-center justify-center text-emerald-500 font-bold text-sm">!</div>
                <h2 className="text-2xl font-bold text-slate-800">Panel de Auditoría de Sesgo</h2>
              </div>
              <p className="text-slate-500 text-sm mb-6 -mt-4 ml-8">Métricas de calidad para garantizar un dataset diverso y equilibrado</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-8">
                    <span className="text-emerald-500">📷</span> Análisis de Perspectiva y Encuadre
                  </h3>
                  
                  <div className="space-y-6">
                    <MetricaLinea label="ÁNGULO HORIZONTAL" />
                    <BarraDetalle nombre="Frontal (0°)" valor={statsSena.metricas.angulo_horizontal.frontal} max={statsSena.progreso_actual} color="bg-emerald-500" />
                    <BarraDetalle nombre="Lateral Der (45°)" valor={statsSena.metricas.angulo_horizontal.lateral_der} max={statsSena.progreso_actual} color="bg-amber-400" />
                    <BarraDetalle nombre="Lateral Izq (-45°)" valor={statsSena.metricas.angulo_horizontal.lateral_izq} max={statsSena.progreso_actual} color="bg-amber-400" />
                    
                    <MetricaLinea label="ALTURA" />
                    <BarraDetalle nombre="Nivel de ojos" valor={statsSena.metricas.angulo_vertical.nivel_ojos} max={statsSena.progreso_actual} color="bg-emerald-500" />
                    <BarraDetalle nombre="Picado" valor={statsSena.metricas.angulo_vertical.picado} max={statsSena.progreso_actual} color="bg-slate-300" />
                    <BarraDetalle nombre="Contrapicado" valor={statsSena.metricas.angulo_vertical.contrapicado} max={statsSena.progreso_actual} color="bg-slate-300" />

                    <MetricaLinea label="DISTANCIA" />
                    <BarraDetalle nombre="Close-up" valor={statsSena.metricas.distancia.close_up} max={statsSena.progreso_actual} color="bg-emerald-500" />
                    <BarraDetalle nombre="Plano Medio" valor={statsSena.metricas.distancia.plano_medio} max={statsSena.progreso_actual} color="bg-amber-400" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-12">
                      <span className="text-emerald-500">👥</span> Diversidad Demográfica
                    </h3>
                    
                    <div className="text-center">
                      <div className="text-8xl font-bold text-emerald-600 mb-2">1</div>
                      <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-6">Voluntarios Únicos</div>
                      
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200 bg-amber-50 text-amber-600 text-sm font-medium">
                        ⚠️ Se necesita más diversidad
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center text-sm text-slate-600">
                    <span className="font-bold text-slate-800">1</span> persona distinta ha contribuido con esta seña
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-8">
                    <span className="text-emerald-500">📈</span> Límite Individual
                  </h3>

                  <div className="flex-1">
                    <div className="text-sm text-slate-500 mb-2">Tu aportación</div>
                    <div className="text-5xl font-bold text-emerald-600 mb-6">0 <span className="text-2xl font-normal text-slate-400">/ 5 muestras</span></div>
                    
                    <div className="w-full bg-slate-100 h-2 rounded-full mb-2">
                      <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: '0%' }}></div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-slate-500 uppercase font-semibold tracking-wider mb-8">
                      <span>Progreso Individual</span>
                      <span className="text-emerald-600">0%</span>
                    </div>

                    <div className="bg-emerald-50 text-emerald-700 text-center py-3 rounded-xl border border-emerald-100 text-sm font-medium">
                      Puedes aportar 5 muestras más
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const MetricaLinea = ({ label }) => (
  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3">{label}</div>
);

const BarraDetalle = ({ nombre, valor, max, color }) => {
  const porcentaje = max > 0 ? (valor / max) * 100 : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{nombre}</span>
        <span className="text-emerald-600 font-semibold">{valor}</span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${porcentaje}%` }}></div>
      </div>
    </div>
  );
};