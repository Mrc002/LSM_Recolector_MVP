import { useState, useEffect, useRef } from 'react'

function App() {
  const [senas, setSenas] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [senaSeleccionada, setSenaSeleccionada] = useState(null)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // 1. Carga inicial desde el Backend (FastAPI)
  useEffect(() => {
    fetch('http://localhost:8000/api/senas')
      .then(res => res.json())
      .then(data => setSenas(data))
      .catch(err => console.error("Error al conectar con el servidor:", err))
  }, [])

// 2. Lógica del Buscador Mejorada (Con prioridades)
  const resultadosFiltrados = senas
    .filter(s => s.nombre_sena.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => {
      const busq = busqueda.toLowerCase();
      const aNombre = a.nombre_sena.toLowerCase();
      const bNombre = b.nombre_sena.toLowerCase();

      // Prioridad Alta: Coincidencia exacta (Si buscas "1", el nombre "1" gana)
      if (aNombre === busq) return -1;
      if (bNombre === busq) return 1;

      // Prioridad Media: Empieza con la búsqueda (Si buscas "1", "10" gana sobre "Brasier (1)")
      if (aNombre.startsWith(busq) && !bNombre.startsWith(busq)) return -1;
      if (!aNombre.startsWith(busq) && bNombre.startsWith(busq)) return 1;

      // Prioridad Baja: El texto más corto va primero
      return a.nombre_sena.length - b.nombre_sena.length;
    })
    .slice(0, 5);

  // 3. Inicializar MediaPipe (Versión CDN)
  useEffect(() => {
    if (!window.Holistic || !window.Camera) return;

    const holistic = new window.Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
    })

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    holistic.onResults(onResults)

    if (typeof videoRef.current !== 'undefined' && videoRef.current !== null) {
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          await holistic.send({ image: videoRef.current })
        },
        width: 1280,
        height: 720
      })
      camera.start()
    }
  }, [])

  // 4. Dibujar Video y Puntos
  const onResults = (results) => {
    if (!canvasRef.current) return
    const canvasCtx = canvasRef.current.getContext('2d')
    canvasCtx.save()
    
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height)

    if (results.faceLandmarks) {
      window.drawConnectors(canvasCtx, results.faceLandmarks, window.FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 })
    }
    if (results.poseLandmarks) {
      window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 })
      window.drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 })
    }
    if (results.leftHandLandmarks) {
      window.drawConnectors(canvasCtx, results.leftHandLandmarks, window.HAND_CONNECTIONS, { color: '#CC0000', lineWidth: 5 })
      window.drawLandmarks(canvasCtx, results.leftHandLandmarks, { color: '#00FF00', lineWidth: 2 })
    }
    if (results.rightHandLandmarks) {
      window.drawConnectors(canvasCtx, results.rightHandLandmarks, window.HAND_CONNECTIONS, { color: '#00CC00', lineWidth: 5 })
      window.drawLandmarks(canvasCtx, results.rightHandLandmarks, { color: '#FF0000', lineWidth: 2 })
    }
    canvasCtx.restore()
  }

  const seleccionarSena = (sena) => {
    setSenaSeleccionada(sena)
    setBusqueda("") 
  }

  const getEmbedUrl = (url) => url ? url.replace("watch?v=", "embed/") : ""

  return (
    <div style={{ padding: '30px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', color: '#34d399', margin: '0 0 10px 0' }}>Recolector de Datos LSM</h1>
        
        <div style={{ position: 'relative', width: '400px', margin: '20px auto' }}>
          <input 
            type="text" 
            placeholder="🔍 Buscar seña (ej. Gracias, Ayuda...)" 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '15px', borderRadius: '30px', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: '#2d2d2d', color: 'white' }}
          />
          
          {busqueda && (
            <div style={{ position: 'absolute', width: '100%', backgroundColor: '#2d2d2d', borderRadius: '10px', marginTop: '5px', zIndex: 10, overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
              {resultadosFiltrados.map(s => (
                <div 
                  key={s.id_sena} 
                  onClick={() => seleccionarSena(s)}
                  style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #3d3d3d' }}
                >
                  {s.nombre_sena}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {senaSeleccionada && (
        <div style={{ backgroundColor: '#10b98120', borderLeft: '5px solid #10b981', padding: '15px', marginBottom: '30px', borderRadius: '4px' }}>
          <span style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Grabación Activa:</span>
          <h2 style={{ margin: '5px 0', color: '#10b981' }}>{senaSeleccionada.nombre_sena}</h2>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px' }}>
        
        <div style={{ backgroundColor: '#1e1e1e', borderRadius: '15px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
          <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', backgroundColor: '#000', borderRadius: '10px', overflow: 'hidden' }}>
            <video ref={videoRef} style={{ display: 'none' }} />
            <canvas ref={canvasRef} width="1280" height="720" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
          </div>
          <button style={{ width: '100%', marginTop: '20px', padding: '20px', fontSize: '20px', fontWeight: 'bold', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer' }}>
            🔴 INICIAR CAPTURA DE VECTORES
          </button>
        </div>

        <div style={{ backgroundColor: '#1e1e1e', borderRadius: '15px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
          <h3 style={{ marginTop: 0 }}>Referencia CDMX</h3>
          {senaSeleccionada ? (
            <iframe 
              width="100%" 
              height="350" 
              src={getEmbedUrl(senaSeleccionada.url_youtube)} 
              title="YouTube"
              frameBorder="0" 
              allowFullScreen
              style={{ borderRadius: '10px' }}
            ></iframe>
          ) : (
            <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #3d3d3d', borderRadius: '10px' }}>
              <p style={{ color: '#666' }}>Usa el buscador para elegir una seña</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default App