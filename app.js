const viewport = document.querySelector('#stageViewport');
const stage = document.querySelector('#virtualStage');
const diagnostics = document.querySelector('#diagnostics');

const MODES = {
  'desktop-landscape': { width: 1366, height: 768, columns: 6, input: 'MOUSE', visualScale: 0.72 },
  'desktop-portrait': { width: 768, height: 1366, columns: 4, input: 'MOUSE', visualScale: 0.72 },
  mobile: { width: 390, height: 844, columns: 2, input: 'TOUCH' }
};

function isTouchFirst() {
  const coarseTouch = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  const userAgentMobile = navigator.userAgentData?.mobile === true;
  return (coarseTouch && noHover) || userAgentMobile;
}

function getMode() {
  if (isTouchFirst()) return 'mobile';
  return window.innerHeight > window.innerWidth ? 'desktop-portrait' : 'desktop-landscape';
}

function updateStage() {
  const mode = getMode();
  const config = MODES[mode];
  const rect = viewport.getBoundingClientRect();
  const fitScale = Math.min(rect.width / config.width, rect.height / config.height);
  const scale = mode === 'mobile' ? fitScale : config.visualScale;

  stage.dataset.mode = mode;
  stage.style.width = `${config.width}px`;
  stage.style.height = `${config.height}px`;
  stage.style.setProperty('--stage-scale', scale);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;

  const label = mode.replace('-', ' ').toUpperCase();
  diagnostics.textContent = `MODALITÀ ${label} · STAGE ${config.width}×${config.height} · ${config.columns} COLONNE · INPUT ${config.input} · SCALA ${scale.toFixed(2)}×`;
}

const resizeObserver = new ResizeObserver(updateStage);
resizeObserver.observe(viewport);

for (const query of ['(pointer: coarse)', '(hover: none)']) {
  const media = window.matchMedia(query);
  media.addEventListener?.('change', updateStage);
}

window.addEventListener('orientationchange', updateStage, { passive: true });
window.addEventListener('resize', updateStage, { passive: true });
updateStage();
