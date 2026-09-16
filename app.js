const diagnostics = document.querySelector('#diagnostics');
const screen = document.querySelector('#screen');

function updateFrame() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const landscape = width >= height;
  const logicalWidth = landscape ? 1366 : 768;
  const logicalHeight = landscape ? 768 : 1366;
  const scale = Math.min(width / logicalWidth, height / logicalHeight);
  const orientation = landscape ? 'LANDSCAPE' : 'PORTRAIT';

  document.documentElement.dataset.orientation = orientation.toLowerCase();
  screen.dataset.logicalWidth = logicalWidth;
  screen.dataset.logicalHeight = logicalHeight;
  diagnostics.textContent = `VIEWPORT ${width}×${height} · ${orientation} · LOGICA ${logicalWidth}×${logicalHeight} · SCALA ${scale.toFixed(2)}×`;
}

window.addEventListener('resize', updateFrame, { passive: true });
window.addEventListener('orientationchange', updateFrame, { passive: true });
updateFrame();
