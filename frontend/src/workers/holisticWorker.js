import '@mediapipe/holistic';

let detector = null;
let lastProcessTs = 0;
const minFrameIntervalMs = 40;

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

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    if (!self.Holistic) {
      self.postMessage({
        type: 'ERROR',
        payload: { message: 'Holistic no está disponible en el worker.' },
      });
      return;
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
    self.postMessage({ type: 'READY' });
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