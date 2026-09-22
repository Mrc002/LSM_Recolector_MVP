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
  const [nombreParticipante, setNombreParticipante] = useState("")
  const [correoParticipante, setCorreoParticipante] = useState("")
  const [consentimientoAceptado, setConsentimientoAceptado] = useState(false)
  const [consentimientoId, setConsentimientoId] = useState(null)
  const [guardandoConsentimiento, setGuardandoConsentimiento] = useState(false)
  const [mostrarConsentimientoModal, setMostrarConsentimientoModal] = useState(true)
  const [mostrarModalConsentimiento, setMostrarModalConsentimiento] = useState(false)
  const [anguloHorizontal, setAnguloHorizontal] = useState("frontal")
  const [anguloVertical, setAnguloVertical] = useState("nivel_ojos")
  const [distancia, setDistancia] = useState("plano_medio")
  const progresoVacio = {
    total_donaciones: 0,
    limite_total: 20,
    faltan_total: 20,
    porcentaje_total: 0,
    caso_actual: 0,
    limite_caso: 20,
    faltan_caso: 20,
    porcentaje_caso: 0,
    casos: {
      frontal: { actual: 0, limite: 5, faltan: 5, porcentaje: 0 },
      lateral_der: { actual: 0, limite: 5, faltan: 5, porcentaje: 0 },
      lateral_izq: { actual: 0, limite: 5, faltan: 5, porcentaje: 0 },
      close_up: { actual: 0, limite: 5, faltan: 5, porcentaje: 0 },
    },
    bloqueado: false,
  }

  const [progresoUsuario, setProgresoUsuario] = useState(progresoVacio)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const holisticRef = useRef(null)
  const rafRef = useRef(null)
  const initHolisticRef = useRef(false)
  const initCamaraRef = useRef(false)
  
  // --- REFERENCIAS PARA GUARDAR LOS DATOS ---
  const mediaRecorderRef = useRef(null)
  const chunksVideoRef = useRef([])
  const vectoresRef = useRef([])
  const streamRef = useRef(null) 
  const estadoGrabacionRef = useRef("inactivo")
  const fotogramasSinManosRef = useRef(0)
  const fotogramasSinCaraRef = useRef(0)
  const grabacionAbortadaRef = useRef(false)

  const [modeloListo, setModeloListo] = useState(false)
  const [calidadAceptable, setCalidadAceptable] = useState(false)

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

  const fetchProgresoUsuario = async (usuario = correoParticipante.trim() || idUsuario.trim(), currentSena = senaSeleccionada) => {
    const usuarioActivo = (usuario || '').trim()
    if (!usuarioActivo || usuarioActivo.toLowerCase() === 'anonimo') {
      setProgresoUsuario(progresoVacio)
      return
    }

    const url = `http://localhost:8000/api/progreso-usuario/${encodeURIComponent(usuarioActivo)}${currentSena ? `?id_sena=${currentSena.id_sena}` : ''}`

    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('No se pudo cargar el progreso.')
      const data = await res.json()
      setProgresoUsuario(data)
    } catch {
      setProgresoUsuario(progresoVacio)
    }
  }

  useEffect(() => {
    fetchProgresoUsuario(correoParticipante.trim() || idUsuario.trim(), senaSeleccionada)
  }, [idUsuario, correoParticipante, senaSeleccionada])

  const dibujarResultadosWorker = (payload) => {
    if (!canvasRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const dibujarLandmarks = (landmarks, connections, color, lineWidth = 2) => {
      if (!landmarks || !landmarks.length || !window.drawConnectors) return;
      const puntos = landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z }));
      window.drawConnectors(canvasCtx, puntos, connections, {
        color,
        lineWidth,
        strokeStyle: color
      });
    };

    if (payload.face?.length) {
      dibujarLandmarks(payload.face, window.FACEMESH_TESSELATION, '#10B981', 0.5);
    }

    if (payload.pose?.length) {
      dibujarLandmarks(payload.pose, window.POSE_CONNECTIONS, '#F9FAFB', 2);
    }

    if (payload.leftHand?.length) {
      dibujarLandmarks(payload.leftHand, window.HAND_CONNECTIONS, '#10B981', 3);
    }

    if (payload.rightHand?.length) {
      dibujarLandmarks(payload.rightHand, window.HAND_CONNECTIONS, '#10B981', 3);
    }

    canvasCtx.restore();

    const validation = payload.validation || { valido: true };
    setCalidadAceptable(validation.valido);

    if (estadoGrabacionRef.current === "grabando") {
      const manosPresentes = !!payload.leftHand?.length || !!payload.rightHand?.length;
      const caraPresente = !!payload.face?.length;

      if (!manosPresentes) {
        fotogramasSinManosRef.current += 1;
      } else {
        fotogramasSinManosRef.current = 0;
      }

      if (!caraPresente) {
        fotogramasSinCaraRef.current += 1;
      } else {
        fotogramasSinCaraRef.current = 0;
      }

      if (fotogramasSinManosRef.current > 15 || fotogramasSinCaraRef.current > 15) {
        grabacionAbortadaRef.current = true
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }

        estadoGrabacionRef.current = "inactivo";
        setEstadoGrabacion("inactivo");
        alert("⚠️ ¡Grabación cancelada! Te saliste del encuadre. Por favor, mantén tu rostro y manos visibles en la cámara.");

        fotogramasSinManosRef.current = 0;
        fotogramasSinCaraRef.current = 0;
        chunksVideoRef.current = [];
        vectoresRef.current = [];
        return;
      }

      vectoresRef.current.push({
        rostro: payload.face || [],
        cuerpo: payload.pose || [],
        mano_izq: payload.leftHand || [],
        mano_der: payload.rightHand || []
      });
    }
  }

  useEffect(() => {
    let isMounted = true

    if (initHolisticRef.current) return () => {
      isMounted = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
    initHolisticRef.current = true

    const initHolistic = async () => {
      try {
        const HolisticCtor = window.Holistic

        if (!HolisticCtor) {
          throw new Error('Holistic no está disponible en window.Holistic.')
        }

        const holistic = new HolisticCtor({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        })

        holistic.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          enableSegmentation: false,
          refineFaceLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        holistic.onResults((results) => {
          if (!isMounted) return
          dibujarResultadosWorker({
            face: results.faceLandmarks || [],
            pose: results.poseLandmarks || [],
            leftHand: results.leftHandLandmarks || [],
            rightHand: results.rightHandLandmarks || [],
            validation: {
              valido: !!(results.faceLandmarks || results.poseLandmarks || results.leftHandLandmarks || results.rightHandLandmarks),
              face: !!results.faceLandmarks,
              pose: !!results.poseLandmarks,
              hands: !!(results.leftHandLandmarks || results.rightHandLandmarks),
            },
          })
        })

        await holistic.initialize()

        if (!isMounted) return
        holisticRef.current = holistic
        setModeloListo(true)
      } catch (error) {
        console.error('Error inicializando Holistic:', error)
      }
    }

    initHolistic()

    return () => {
      isMounted = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const enviarFrameAlWorker = async () => {
    const video = videoRef.current
    const holistic = holisticRef.current

    if (!video || !holistic) {
      rafRef.current = requestAnimationFrame(enviarFrameAlWorker)
      return
    }

    if (video.readyState >= 2) {
      try {
        await holistic.send({ image: video })
      } catch (err) {
        console.warn('No se pudo enviar frame a Holistic:', err)
      }
    }

    rafRef.current = requestAnimationFrame(enviarFrameAlWorker)
  }

  useEffect(() => {
    if (mostrarConsentimientoModal || !consentimientoAceptado) {
      detenerCamara()
      return undefined
    }

    let isCancelled = false

    const iniciarCamara = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('getUserMedia no disponible en este navegador.')
          return
        }

        detenerCamara()

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
          enviarFrameAlWorker()
        }
      } catch (error) {
        console.error('Error al iniciar la cámara:', error)
      }
    }

    iniciarCamara()

    return () => {
      isCancelled = true
      detenerCamara()
    }
  }, [mostrarConsentimientoModal, consentimientoAceptado])

  const registrarConsentimiento = async () => {
    if (!consentimientoAceptado) {
      alert("Debes aceptar el consentimiento informado antes de grabar video con rostro visible.")
      return null
    }

    setGuardandoConsentimiento(true)

    const formData = new FormData()
    formData.append("id_usuario", correoParticipante.trim() || idUsuario.trim() || "anonimo")
    formData.append("acepta_consentimiento", "true")
    formData.append("nombre_participante", nombreParticipante.trim())
    formData.append("correo", correoParticipante.trim())
    formData.append("version_documento", "v1")

    try {
      const response = await fetch('http://localhost:8000/api/consentimiento', {
        method: 'POST',
        body: formData
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.detail || 'No se pudo registrar el consentimiento informado.')
      }

      setConsentimientoId(payload.id_consentimiento)
      setConsentimientoAceptado(true)
      setMostrarConsentimientoModal(false)
      return payload.id_consentimiento
    } catch (error) {
      console.error('Consentimiento error:', error)
      alert(error.message || 'No se pudo guardar el consentimiento informado.')
      return null
    } finally {
      setGuardandoConsentimiento(false)
    }
  }

  const iniciarSecuenciaGrabacion = async () => {
    if (!senaSeleccionada) {
      alert("Por favor selecciona una seña primero.")
      return
    }

    if (!consentimientoAceptado || mostrarConsentimientoModal) {
      alert("Debes aceptar el consentimiento informado antes de continuar.")
      setMostrarConsentimientoModal(true)
      return
    }

    if (progresoUsuario.bloqueado || progresoUsuario.total_donaciones >= progresoUsuario.limite_total) {
      alert("Ya llegaste al límite de 20 donaciones por persona. No puedes registrar más muestras.")
      return
    }

    const casoActual = anguloHorizontal === 'frontal' ? 'frontal' : anguloHorizontal === 'lateral_der' ? 'lateral_der' : anguloHorizontal === 'lateral_izq' ? 'lateral_izq' : 'close_up'
    const casoLimitado = distancia === 'close_up' ? 'close_up' : casoActual
    const casoInfo = progresoUsuario.casos?.[casoLimitado]
    if (casoInfo && casoInfo.actual >= casoInfo.limite) {
      alert(`Ya llegaste al límite de ${casoInfo.limite} donaciones para la pose ${casoLimitado === 'close_up' ? 'close-up' : casoLimitado.replace('_', ' ')}.`)
      return
    }

    const consentId = consentimientoId || await registrarConsentimiento()
    if (!consentId) return

    grabacionAbortadaRef.current = false
    setEstadoGrabacion("cuenta_regresiva")
    setContador(3)

    let cuenta = 3
    const intervalo = setInterval(() => {
      cuenta -= 1
      setContador(cuenta)

      if (cuenta === 0) {
        clearInterval(intervalo)
        comenzarAGrabar(consentId)
      }
    }, 1000)
  }

  const comenzarAGrabar = (consentId) => {
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
      const consentimientoIdActual = consentimientoId ?? null

      if (!consentimientoIdActual) {
        alert('No se pudo guardar la muestra porque falta el consentimiento informado.')
        return
      }
      
      const formData = new FormData()
      formData.append("id_sena", senaSeleccionada.id_sena)
      formData.append("video", videoBlob, "captura.webm")
      const jsonBlob = new Blob([JSON.stringify(vectoresJSON)], { type: 'application/json' })
      formData.append("vectores", jsonBlob, "vectores.json")

      // --- INYECTAMOS LOS METADATOS AL FORMULARIO ---
      formData.append("id_usuario", idUsuario.trim() !== "" ? idUsuario.trim() : "anonimo")
      formData.append("id_consentimiento", String(consentimientoIdActual))
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
          await fetchProgresoUsuario(correoParticipante.trim() || idUsuario.trim(), senaSeleccionada)
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

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }

  const finalizarSesion = () => {
    setIdUsuario("")
    setNombreParticipante("")
    setCorreoParticipante("")
    setConsentimientoAceptado(false)
    setConsentimientoId(null)
    setMostrarConsentimientoModal(true)
    setMostrarModalConsentimiento(false)

    detenerCamara()

    if (estadoGrabacion !== 'inactivo') {
      setEstadoGrabacion('inactivo')
    }
  }

  const getEmbedUrl = (url) => url ? url.replace("watch?v=", "embed/") : ""

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-[1800px] mx-auto">
        {mostrarConsentimientoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-slate-950/70">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Consentimiento informado</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Antes de continuar, confirma tu participación</h2>
              </div>

              <div className="space-y-4 text-sm leading-7 text-slate-200">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Nombre completo</label>
                  <input
                    type="text"
                    value={nombreParticipante}
                    onChange={(e) => setNombreParticipante(e.target.value)}
                    placeholder="Ej. Ana García López"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Correo electrónico</label>
                  <input
                    type="email"
                    value={correoParticipante}
                    onChange={(e) => setCorreoParticipante(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={consentimientoAceptado}
                      onChange={(e) => setConsentimientoAceptado(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-400 accent-amber-500"
                    />
                    <span>
                      Acepto participar en la recolección de video con rostro visible. Entiendo que este material se utilizará exclusivamente para investigación científica y desarrollo tecnológico de Lengua de Señas Mexicana (LSM). Autorizo la utilización de mi correo y mi imagen para la gestión de la investigación y la trazabilidad de cada muestra.
                    </span>
                  </label>
                </div>

                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">
                  El correo será la clave de trazabilidad del participante. No se requiere un ID manual adicional.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={registrarConsentimiento}
                  disabled={guardandoConsentimiento || !nombreParticipante.trim() || !correoParticipante.trim() || !consentimientoAceptado}
                  className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {guardandoConsentimiento ? 'Guardando...' : 'Aceptar y continuar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ENCABEZADO */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl mb-1 text-white font-bold">Estudio de Captura 3D</h1>
            <p className="text-sm text-slate-400">Sistema de grabación tridimensional MediaPipe</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={finalizarSesion}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
            >
              🔒 Finalizar sesión
            </button>
            <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700">
              🏠 Volver al Inicio
            </Link>
          </div>
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

              <div className="p-6 space-y-4">
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

                <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                    <span className="font-semibold text-white">{senaSeleccionada ? `Progreso de ${senaSeleccionada.nombre_sena}` : 'Progreso de la seña'}</span>
                    <span className="text-emerald-300 font-bold">{progresoUsuario.caso_actual} / {progresoUsuario.limite_caso}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300"
                      style={{ width: `${progresoUsuario.porcentaje_caso}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>Faltan {progresoUsuario.faltan_caso} donaciones para esta seña</span>
                    <span>{progresoUsuario.porcentaje_caso}%</span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                    {Object.entries(progresoUsuario.casos || {}).map(([nombre, datos]) => {
                      const label = nombre === 'close_up' ? 'Close-up' : nombre === 'lateral_der' ? 'Lateral der' : nombre === 'lateral_izq' ? 'Lateral izq' : 'Frontal'
                      return (
                        <div key={nombre}>
                          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-300">
                            <span>{label}</span>
                            <span>{datos.actual} / {datos.limite}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300"
                              style={{ width: `${datos.porcentaje}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
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
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                      <label className="flex items-start gap-3 text-sm text-amber-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consentimientoAceptado}
                          onChange={(e) => setConsentimientoAceptado(e.target.checked)}
                          className="mt-1 h-4 w-4 accent-amber-500"
                        />
                        <span>
                          He leído y acepto el consentimiento informado para la captura de video con rostro visible y la utilización de estos datos para investigación.
                          <a
                            href="#consentimiento-documento"
                            onClick={(e) => {
                              e.preventDefault();
                              setMostrarModalConsentimiento(true);
                            }}
                            className="ml-1 font-medium text-amber-300 underline decoration-amber-500/60 underline-offset-2 hover:text-amber-200"
                          >
                            Leer documento de ejemplo
                          </a>
                        </span>
                      </label>

                      {mostrarModalConsentimiento && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
                          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-slate-950/60">
                            <div className="mb-4 flex items-start justify-between gap-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Consentimiento informado</p>
                                <h3 className="mt-2 text-xl font-bold text-white">Ejemplo del documento</h3>
                              </div>
                            </div>

                            <div className="space-y-4 text-sm leading-7 text-slate-200">
                              <p>
                                Yo, <strong>[Nombre completo del participante]</strong>, con correo electrónico <strong>[correo@ejemplo.com]</strong>, acepto de manera libre, informada y voluntaria participar en la recolección de video con rostro visible para la investigación de reconocimiento de la Lengua de Señas Mexicana (LSM).
                              </p>
                              <p>
                                Entiendo que el material capturado será utilizado exclusivamente con fines de investigación, validación y desarrollo del sistema de reconocimiento. Autorizo la utilización de mi imagen y mi información de contacto para la gestión de la participación, así como para futuras comunicaciones relacionadas con la investigación, siempre que se respeten las condiciones de confidencialidad y protección de datos establecidas por la institución.
                              </p>
                              <p>
                                Comprendo que mi participación es voluntaria y que puedo solicitar la eliminación o rectificación de mis datos en cualquier momento contactando al equipo responsable mediante el correo proporcionado. Declaro que he leído esta información, he entendido sus alcances y acepto participar en el proceso.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {consentimientoAceptado && (
                        <div className="mt-3 space-y-3">
                          <input
                            type="text"
                            value={nombreParticipante}
                            onChange={(e) => setNombreParticipante(e.target.value)}
                            placeholder="Nombre del participante"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="email"
                            value={correoParticipante}
                            onChange={(e) => setCorreoParticipante(e.target.value)}
                            placeholder="Correo electrónico"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                          />
                          {consentimientoId ? (
                            <div className="text-xs text-emerald-300">Consentimiento registrado con ID: {consentimientoId}</div>
                          ) : (
                            <button
                              type="button"
                              onClick={registrarConsentimiento}
                              disabled={guardandoConsentimiento}
                              className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
                            >
                              {guardandoConsentimiento ? 'Guardando consentimiento...' : 'Guardar consentimiento'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Ángulo Horizontal</label>
                        <select value={anguloHorizontal} onChange={(e) => setAnguloHorizontal(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                          <option value="frontal">Frontal (0°)</option>
                          <option value="lateral_der">Lateral (45°)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Altura de Cámara</label>
                        <select value={anguloVertical} onChange={(e) => setAnguloVertical(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                          <option value="nivel_ojos">Nivel de los ojos</option>
                          <option value="picado">Picado (Desde arriba)</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-slate-400 mb-1">Distancia al Sujeto</label>
                        <select value={distancia} onChange={(e) => setDistancia(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                          <option value="plano_medio">Plano Medio (Cintura hacia arriba)</option>
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