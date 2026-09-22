import { useState } from 'react'

export default function Consentimiento() {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [aceptado, setAceptado] = useState(false)

  const habilitado = nombre.trim() !== '' && correo.trim() !== '' && aceptado

  const manejarGuardar = () => {
    if (!habilitado) return

    const payload = {
      nombre: nombre.trim(),
      correo: correo.trim(),
      aceptadoEn: new Date().toISOString(),
    }

    console.log('Consentimiento enviado:', payload)
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-sm">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            Consentimiento informado
          </p>
          <h1 className="text-2xl font-bold text-white">Registro de participación</h1>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="nombre" className="mb-2 block text-sm font-medium text-slate-200">
              Nombre completo del participante
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Ana García López"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          <div>
            <label htmlFor="correo" className="mb-2 block text-sm font-medium text-slate-200">
              Correo electrónico
            </label>
            <input
              id="correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="nombre@ejemplo.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={aceptado}
                onChange={(e) => setAceptado(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-400 accent-amber-500"
              />
              <span className="text-sm text-slate-200">
                Acepto el tratamiento de mis datos para esta investigación.
                <a
                  href="#consentimiento-documento"
                  onClick={(e) => {
                    e.preventDefault();
                    const modal = document.getElementById('modal-consentimiento-ejemplo');
                    if (modal) modal.classList.remove('hidden');
                  }}
                  className="ml-1 font-medium text-amber-300 underline decoration-amber-500/60 underline-offset-2 hover:text-amber-200"
                >
                  Leer el documento de Consentimiento Informado completo
                </a>
              </span>
            </label>

            <div id="modal-consentimiento-ejemplo" className="hidden">
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
                <h2 className="mb-3 text-lg font-bold text-white">Ejemplo de documento de consentimiento</h2>
                <p className="text-sm leading-6 text-slate-300">
                  Yo, <strong>[Nombre completo del participante]</strong>, con correo electrónico <strong>[correo@ejemplo.com]</strong>, acepto participar en la recolección de video con rostro visible para la investigación de la Lengua de Señas Mexicana (LSM). Entiendo que mi participación es voluntaria y que el material capturado será utilizado exclusivamente para fines de investigación, análisis técnico y desarrollo del sistema. Autorizo la utilización de mi imagen y datos de contacto únicamente para la gestión de esta investigación, así como para posibles comunicaciones relacionadas con el estudio. Comprendo que puedo solicitar la eliminación de mis datos o rectificar mi consentimiento en cualquier momento contactando al equipo responsable mediante el correo proporcionado.
                </p>
                <button
                  type="button"
                  onClick={() => document.getElementById('modal-consentimiento-ejemplo')?.classList.add('hidden')}
                  className="mt-4 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              “Acepto ser grabado en video con mi rostro plenamente visible. Entiendo que este material biométrico se utilizará exclusivamente con fines de investigación científica y desarrollo tecnológico para el reconocimiento de la Lengua de Señas Mexicana (LSM). Comprendo que mi participación es voluntaria y que podré solicitar la eliminación de mi video de la base de datos en cualquier momento utilizando el correo electrónico proporcionado.”
            </p>
          </div>

          <button
            type="button"
            onClick={manejarGuardar}
            disabled={!habilitado}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Guardar consentimiento y Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
