const viewport = document.querySelector('#stageViewport');
const stage = document.querySelector('#virtualStage');
const diagnostics = document.querySelector('#diagnostics');
const handle = document.querySelector('#stageHandle');

const MODES = {
  'desktop-landscape': { width: 1366, height: 768, columns: 6, input: 'MOUSE', visualScale: 0.72 },
  'desktop-portrait': { width: 768, height: 1366, columns: 4, input: 'MOUSE', visualScale: 0.72 },
  mobile: { width: 390, height: 844, columns: 2, input: 'TOUCH' }
};

let offsetY = 0;
let dragStartY = 0;
let dragStartOffset = 0;
let dragging = false;
let activePointerId = null;

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
  const maxOffset = Math.max(0, (rect.height - config.height * scale) / 2);

  offsetY = Math.max(-maxOffset, Math.min(maxOffset, offsetY));
  stage.dataset.mode = mode;
  stage.style.width = `${config.width}px`;
  stage.style.height = `${config.height}px`;
  stage.style.transform = `translate(-50%, calc(-50% + ${offsetY / scale}px)) scale(${scale})`;

  const label = mode.replace('-', ' ').toUpperCase();
  diagnostics.textContent = `MODALITÀ ${label} · STAGE ${config.width}×${config.height} · ${config.columns} COLONNE · INPUT ${config.input} · SCALA ${scale.toFixed(2)}× · OFFSET ${Math.round(offsetY)}px`;
}

function beginDrag(event) {
  if (dragging) return;
  dragging = true;
  activePointerId = event.pointerId;
  dragStartY = event.clientY;
  dragStartOffset = offsetY;
  handle.setPointerCapture?.(event.pointerId);
  handle.classList.add('is-dragging');
  document.body.classList.add('is-dragging-stage');
  event.preventDefault();
}

function moveDrag(event) {
  if (!dragging || event.pointerId !== activePointerId) return;
  offsetY = dragStartOffset + event.clientY - dragStartY;
  updateStage();
  event.preventDefault();
}

function endDrag(event) {
  if (!dragging || (event.pointerId != null && event.pointerId !== activePointerId)) return;
  dragging = false;
  activePointerId = null;
  handle.classList.remove('is-dragging');
  document.body.classList.remove('is-dragging-stage');
}

handle.addEventListener('pointerdown', beginDrag);
document.addEventListener('pointermove', moveDrag, { passive: false });
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
document.addEventListener('selectstart', event => {
  if (dragging) event.preventDefault();
});

const resizeObserver = new ResizeObserver(updateStage);
resizeObserver.observe(viewport);
for (const query of ['(pointer: coarse)', '(hover: none)']) {
  const media = window.matchMedia(query);
  media.addEventListener?.('change', updateStage);
}
window.addEventListener('orientationchange', updateStage, { passive: true });
window.addEventListener('resize', updateStage, { passive: true });
updateStage();
