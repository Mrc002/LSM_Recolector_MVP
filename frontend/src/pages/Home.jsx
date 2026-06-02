import React from "react";
import { Link } from "react-router-dom";
import { Video, FolderTree, HandMetal } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-5xl w-full px-6">

        <div className="text-center mb-16 mt-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <HandMetal className="w-16 h-16 text-emerald-400" />
            <h1 className="text-6xl tracking-tight text-white font-bold">LSM Research</h1>
          </div>
          <p className="text-xl max-w-2xl mx-auto leading-relaxed text-slate-300">
            Plataforma científica para la recolección y documentación de
            Lengua de Señas Mexicana
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-slate-800/50 border border-slate-700/50 text-slate-400">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            Sistema de captura activo
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link
            to="/grabadora"
            className="group rounded-2xl p-8 shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:shadow-emerald-500/10 hover:border-emerald-500/30"
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-xl mb-6 transition-all bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20">
              <Video className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-3xl mb-3 text-white font-semibold">Captura de Señas</h2>
            <p className="leading-relaxed text-slate-400">
              Graba y documenta señas de LSM con controles profesionales
              de video y audio y malla tridimensional (MediaPipe).
            </p>
          </Link>

          <Link
            to="/expediente"
            className="group rounded-2xl p-8 shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:shadow-emerald-500/10 hover:border-emerald-500/30"
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-xl mb-6 transition-all bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20">
              <FolderTree className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-3xl mb-3 text-white font-semibold">Dashboard del Dataset</h2>
            <p className="leading-relaxed text-slate-400">
              Monitorea el progreso de recolección, analiza la diversidad demográfica 
              y audita la calidad del corpus de investigación en tiempo real.
            </p>
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 pb-10">
          <div className="rounded-xl p-6 text-center bg-slate-900/30 border border-slate-800/50">
            <div className="text-3xl mb-2 text-emerald-400 font-bold">1,063</div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Señas en Catálogo</div>
          </div>
          <div className="rounded-xl p-6 text-center bg-slate-900/30 border border-slate-800/50">
            <div className="text-3xl mb-2 text-emerald-400 font-bold">0</div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Contribuidores</div>
          </div>
          <div className="rounded-xl p-6 text-center bg-slate-900/30 border border-slate-800/50">
            <div className="text-3xl mb-2 text-emerald-400 font-bold">0%</div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Progreso Corpus</div>
          </div>
        </div>
      </div>
    </div>
  );
}