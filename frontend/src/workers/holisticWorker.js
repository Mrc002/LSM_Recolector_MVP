let detector = null;
let lastProcessTs = 0;
let isInitializing = false;
let initAttempts = 0;
const minFrameIntervalMs = 40;
const maxInitAttempts = 3;
const holisticUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js';

const normalizeLandmarks = (landmarks = []) =>
  landmarks.map((point) => ({
    x: Number(point.x ?? 0),
    y: Number(point.y ?? 0),
    z: Number(point.z ?? 0),
    visibility: Number(point.visibility ?? 0),
  }));

const validationFromResults = (results) => {
  const face = !!(results.faceLandmarks && results.faceLandmarks.length > 0);
  const pose = !!(results.poseLandmarks && results.poseLandmarks.length > 0);
  const hands =
    !!(results.leftHandLandmarks && results.leftHandLandmarks.length > 0) ||
    !!(results.rightHandLandmarks && results.rightHandLandmarks.length > 0);

  return {
    valido: face || pose || hands,
    face,
    pose,
    hands,
  };
};

const loadHolisticLibrary = () => {
  if (self.Holistic) return true;

  try {
    self.importScripts(holisticUrl);
    return !!self.Holistic;
  } catch (error) {
    console.error('Holistic worker load failed:', error);
    return false;
  }
};

const initializeDetector = async () => {
  if (detector) return detector;
  if (isInitializing) return null;

  isInitializing = true;

  try {
    if (!loadHolisticLibrary()) {
      throw new Error('Holistic no está disponible en el worker.');
    }

    detector = new self.Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    detector.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    detector.onResults((results) => {
      self.postMessage({
        type: 'RESULTS',
        payload: {
          face: normalizeLandmarks(results.faceLandmarks),
          pose: normalizeLandmarks(results.poseLandmarks),
          leftHand: normalizeLandmarks(results.leftHandLandmarks),
          rightHand: normalizeLandmarks(results.rightHandLandmarks),
          validation: validationFromResults(results),
        },
      });
    });

    await detector.initialize();
    return detector;
  } catch (error) {
    detector = null;
    throw error;
  } finally {
    isInitializing = false;
  }
};

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    try {
      await initializeDetector();
      self.postMessage({ type: 'READY' });
    } catch (error) {
      initAttempts += 1;
      const message = error?.message || 'Error inicializando Holistic';

      self.postMessage({
        type: 'ERROR',
        payload: { message },
      });

      if (initAttempts < maxInitAttempts) {
        self.setTimeout(() => {
          self.postMessage({ type: 'RETRY_INIT' });
        }, 1000);
      }
    }
    return;
  }

  if (type === 'RETRY_INIT') {
    try {
      await initializeDetector();
      self.postMessage({ type: 'READY' });
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        payload: { message: error?.message || 'Reintento fallido de Holistic' },
      });
    }
    return;
  }

  if (type === 'PROCESS_FRAME' && detector) {
    const now = performance.now();
    if (now - lastProcessTs < minFrameIntervalMs) return;
    lastProcessTs = now;

    try {
      await detector.send({ image: payload });
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        payload: { message: error?.message || 'Error procesando frame' },
      });
    }
  }
};