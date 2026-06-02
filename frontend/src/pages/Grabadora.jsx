import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom';

export default function Grabadora () {
  const [senas, setSenas] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [senaSeleccionada, setSenaSeleccionada] = useState(null)
  
  // --- ESTADOS DE LA GRABACIÓN ---
  const [estadoGrabacion, setEstadoGrabacion] = useState("inactivo") 
  const [contador, setContador] = useState(3)
  
  // --- NUEVOS ESTADOS PARA METADATOS (DASHBOARD) ---
  const [idUsuario, setIdUsuario] = useState("")
  const [anguloHorizontal, setAnguloHorizontal] = useState("frontal")
  const [anguloVertical, setAnguloVertical] = useState("nivel_ojos")
  const [distancia, setDistancia] = useState("plano_medio")
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  
  // --- REFERENCIAS PARA GUARDAR LOS DATOS ---
  const mediaRecorderRef = useRef(null)
  const chunksVideoRef = useRef([])
  const vectoresRef = useRef([])
  const streamRef = useRef(null) 
  const estadoGrabacionRef = useRef("inactivo")
  const fotogramasSinManosRef = useRef(0)
  const fotogramasSinCaraRef = useRef(0)
  const grabacionAbortadaRef = useRef(false)

  useEffect(() => {
    fetch('http://localhost:8000/api/senas')
      .then(res => res.json())
      .then(data => setSenas(data))
      .catch(err => console.error("Error al conectar con el servidor:", err))
  }, [])

  const resultadosFiltrados = senas
    .filter(s => s.nombre_sena.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => {
      const busq = busqueda.toLowerCase();
      const aNombre = a.nombre_sena.toLowerCase();
      const bNombre = b.nombre_sena.toLowerCase();
      if (aNombre === busq) return -1;
      if (bNombre === busq) return 1;
      if (aNombre.startsWith(busq) && !bNombre.startsWith(busq)) return -1;
      if (!aNombre.startsWith(busq) && bNombre.startsWith(busq)) return 1;
      return a.nombre_sena.length - b.nombre_sena.length;
    })
    .slice(0, 5)

  useEffect(() => {
    estadoGrabacionRef.current = estadoGrabacion
  }, [estadoGrabacion])

  useEffect(() => {
    if (!window.Holistic || !window.Camera) return;

    const holistic = new window.Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
    })

    // Apagamos la segmentación para ganar muchísimos FPS
    holistic.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false, 
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    holistic.onResults(onResults)

    if (typeof videoRef.current !== 'undefined' && videoRef.current !== null) {
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          await holistic.send({ image: videoRef.current })
        },
        width: 640,
        height: 480
      })
      camera.start().then(() => {
        streamRef.current = videoRef.current.srcObject
      })
    }
  }, [])

  const onResults = (results) => {
    if (!canvasRef.current) return;
    const canvasCtx = canvasRef.current.getContext('2d');

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (results.faceLandmarks) {
      window.drawConnectors(canvasCtx, results.faceLandmarks, window.FACEMESH_TESSELATION, {
        color: '#10B981',
        lineWidth: 0.5,
        strokeStyle: 'rgba(16, 185, 129, 0.2)'
      });
    }

    if (results.poseLandmarks) {
      window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#F9FAFB', lineWidth: 2 });
    }

    if (results.leftHandLandmarks) {
      window.drawConnectors(canvasCtx, results.leftHandLandmarks, window.HAND_CONNECTIONS, { color: '#10B981', lineWidth: 3 });
    }
    if (results.rightHandLandmarks) {
      window.drawConnectors(canvasCtx, results.rightHandLandmarks, window.HAND_CONNECTIONS, { color: '#10B981', lineWidth: 3 });
    }
    canvasCtx.restore();

    if (estadoGrabacionRef.current === "grabando") {
      if (!results.leftHandLandmarks && !results.rightHandLandmarks) {
        fotogramasSinManosRef.current += 1;
      } else {
        fotogramasSinManosRef.current = 0;
      }

      if (!results.faceLandmarks) {
        fotogramasSinCaraRef.current += 1;
      } else {
        fotogramasSinCaraRef.current = 0;
      }

      if (fotogramasSinManosRef.current > 15 || fotogramasSinCaraRef.current > 15) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }

        estadoGrabacionRef.current = "inactivo";
        alert("⚠️ ¡Grabación cancelada! Te saliste del encuadre. Por favor, mantén tu rostro y manos visibles en la cámara.");

        fotogramasSinManosRef.current = 0;
        fotogramasSinCaraRef.current = 0;
        chunksVideoRef.current = [];
        vectoresRef.current = [];
        return;
      }

      vectoresRef.current.push({
        rostro: results.faceLandmarks || [],
        cuerpo: results.poseLandmarks || [],
        mano_izq: results.leftHandLandmarks || [],
        mano_der: results.rightHandLandmarks || []
      });
    }
  }

  const iniciarSecuenciaGrabacion = () => {
    if (!senaSeleccionada) {
      alert("Por favor selecciona una seña primero.")
      return
    }

    setEstadoGrabacion("cuenta_regresiva")
    setContador(3)

    let cuenta = 3
    const intervalo = setInterval(() => {
      cuenta -= 1
      setContador(cuenta)

      if (cuenta === 0) {
        clearInterval(intervalo)
        comenzarAGrabar()
      }
    }, 1000)
  }

  const comenzarAGrabar = () => {
    setEstadoGrabacion("grabando")
    vectoresRef.current = [] 
    chunksVideoRef.current = [] 

    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' })
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksVideoRef.current.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      if (grabacionAbortadaRef.current) {
        grabacionAbortadaRef.current = false
        return
      }

      const videoBlob = new Blob(chunksVideoRef.current, { type: 'video/webm' })
      const vectoresJSON = vectoresRef.current
      
      const formData = new FormData()
      formData.append("id_sena", senaSeleccionada.id_sena)
      formData.append("video", videoBlob, "captura.webm")
      const jsonBlob = new Blob([JSON.stringify(vectoresJSON)], { type: 'application/json' })
      formData.append("vectores", jsonBlob, "vectores.json")

      // --- INYECTAMOS LOS METADATOS AL FORMULARIO ---
      formData.append("id_usuario", idUsuario.trim() !== "" ? idUsuario.trim() : "anonimo")
      formData.append("angulo_horizontal", anguloHorizontal)
      formData.append("angulo_vertical", anguloVertical)
      formData.append("distancia", distancia)

      try {
        console.log("🚀 Enviando datos y metadatos al servidor...")
        const response = await fetch('http://localhost:8000/api/muestras', {
          method: 'POST',
          body: formData 
        })

        if (response.ok) {
          const resultado = await response.json()
          console.log("💾 Guardado en disco duro:", resultado)
          alert("✅ ¡Seña guardada y catalogada exitosamente!")
        } else if (response.status === 403) {
          // Atrapamos el error antispam de FastAPI (Límite de 5 muestras)
          const errorData = await response.json()
          alert(`⚠️ ${errorData.detail}`)
        } else {
          console.error("Error del servidor:", await response.text())
          alert("Hubo un error al guardar en el servidor.")
        }
      } catch (error) {
        console.error("Error de red:", error)
        alert("El servidor FastAPI no está respondiendo.")
      }
    }

    mediaRecorder.start()

    setTimeout(() => {
      mediaRecorder.stop()
      setEstadoGrabacion("inactivo")
    }, 3000)
  }

  const seleccionarSena = (sena) => {
    setSenaSeleccionada(sena)
    setBusqueda("")
  }

  const getEmbedUrl = (url) => url ? url.replace("watch?v=", "embed/") : ""

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-[1800px] mx-auto">
        
        {/* ENCABEZADO */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl mb-1 text-white font-bold">Estudio de Captura 3D</h1>
            <p className="text-sm text-slate-400">Sistema de grabación tridimensional MediaPipe</p>
          </div>
          <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700">
            🏠 Volver al Inicio
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* PANEL IZQUIERDO: CÁMARA Y CONTROLES */}
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-slate-900/50 backdrop-blur-sm border border-slate-800">
              
              <div className="aspect-video relative bg-slate-950">
                <video ref={videoRef} width="640" height="480" autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" />
                <canvas ref={canvasRef} width="640" height="480" className="absolute inset-0 w-full h-full object-cover z-10 transform scale-x-[-1]" />
                
                {estadoGrabacion === "cuenta_regresiva" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
                    <span className="text-9xl font-bold text-white animate-bounce">{contador}</span>
                  </div>
                )}

                {estadoGrabacion === "grabando" && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full z-20 shadow-lg shadow-red-900/50">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-sm font-mono font-bold">CAPTURANDO DATOS...</span>
                  </div>
                )}
              </div>

              <div className="p-6">
                <button
                  onClick={iniciarSecuenciaGrabacion}
                  disabled={estadoGrabacion !== "inactivo" || !senaSeleccionada}
                  className={`w-full py-6 rounded-2xl shadow-2xl transition-all font-bold text-2xl flex items-center justify-center gap-4 
                    ${estadoGrabacion === "inactivo" && senaSeleccionada 
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:scale-[1.02] cursor-pointer" 
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"}`}
                >
                  {estadoGrabacion === "inactivo" ? (
                    <>
                      <div className="w-6 h-6 bg-emerald-200 rounded-full border-2 border-white animate-pulse"></div>
                      INICIAR CAPTURA (3 SEG)
                    </>
                  ) : (
                    "PROCESANDO..."
                  )}
                </button>

                {!senaSeleccionada && (
                  <p className="text-yellow-500 text-sm text-center mt-3 bg-yellow-500/10 py-2 rounded-lg border border-yellow-500/20">
                    ⚠️ Busca y selecciona una seña en el panel derecho antes de grabar.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: BUSCADOR, REFERENCIA Y METADATOS */}
          <div className="space-y-4">
            <div className="rounded-2xl p-6 shadow-2xl bg-slate-900/50 backdrop-blur-sm border border-slate-800">
              <h2 className="text-xl mb-4 text-white font-semibold">Base de Referencia y Metadatos</h2>

              {/* BUSCADOR */}
              <div className="relative mb-4">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Escribe el nombre de una seña..."
                  className="w-full pl-4 pr-12 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-500"
                />
                
                {busqueda && resultadosFiltrados.length > 0 && !senaSeleccionada?.nombre_sena?.toLowerCase().includes(busqueda.toLowerCase()) && (
                  <div className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700">
                    {resultadosFiltrados.map((s) => (
                      <button
                        key={s.id_sena || s.nombre_sena}
                        onClick={() => seleccionarSena(s)}
                        className="w-full px-4 py-3 text-left transition-all hover:bg-slate-700 border-b border-slate-700/50 last:border-0"
                      >
                        <div className="text-sm text-white font-medium capitalize">{s.nombre_sena}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* REPRODUCTOR DE YOUTUBE */}
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                {senaSeleccionada ? (
                  <iframe
                    src={getEmbedUrl(senaSeleccionada.url_youtube)}
                    title="Referencia"
                    className={`absolute inset-0 w-full h-full ${estadoGrabacion !== "inactivo" ? 'pointer-events-none opacity-50' : 'auto'}`}
                    frameBorder="0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                    <span className="text-4xl mb-3 opacity-50">🔍</span>
                    <p className="text-sm">El video de referencia aparecerá aquí</p>
                  </div>
                )}
              </div>

              {/* TARJETA DE ESTADO Y METADATOS DE CAPTURA */}
              {senaSeleccionada && (
                <div className="mt-4 p-5 rounded-xl bg-slate-900/50 border border-slate-700">
                  <h3 className="text-sm uppercase tracking-wide text-emerald-400 mb-4 font-bold flex items-center gap-2">
                    ✓ {senaSeleccionada.nombre_sena} (Lista)
                  </h3>
                  
                  <div className="space-y-4 text-sm">
                    <div>
                      <label className="block text-slate-400 mb-1">ID del Voluntario</label>
                      <input 
                        type="text" 
                        value={idUsuario}
                        onChange={(e) => setIdUsuario(e.target.value)}
                        placeholder="Ej. voluntario_01 (Deja en blanco si es anónimo)"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Ángulo Horizontal</label>
                        <select value={anguloHorizontal} onChange={(e) => setAnguloHorizontal(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                          <option value="frontal">Frontal (0°)</option>
                          <option value="lateral_der">Lateral Der (45°)</option>
                          <option value="lateral_izq">Lateral Izq (-45°)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Altura de Cámara</label>
                        <select value={anguloVertical} onChange={(e) => setAnguloVertical(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                          <option value="nivel_ojos">Nivel de los ojos</option>
                          <option value="picado">Picado (Desde arriba)</option>
                          <option value="contrapicado">Contrapicado (Desde abajo)</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-slate-400 mb-1">Distancia al Sujeto</label>
                        <select value={distancia} onChange={(e) => setDistancia(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                          <option value="plano_medio">Plano Medio (Cintura hacia arriba)</option>
                          <option value="close_up">Close-up (Pecho hacia arriba)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}