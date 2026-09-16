const viewport = document.querySelector('#stageViewport');
const stage = document.querySelector('#virtualStage');
const diagnostics = document.querySelector('#diagnostics');
const shade = document.querySelector('#quickShade');
const backdrop = document.querySelector('#shadeBackdrop');
const handle = document.querySelector('#shadeHandle');
const closeButton = document.querySelector('#shadeClose');
const message = document.querySelector('#shadeMessage');

const MODES = {
  'desktop-landscape': { width: 1366, height: 768, columns: 6, input: 'MOUSE', visualScale: 0.72 },
  'desktop-portrait': { width: 768, height: 1366, columns: 4, input: 'MOUSE', visualScale: 0.72 },
  mobile: { width: 390, height: 844, columns: 2, input: 'TOUCH' }
};
let shadeOpen = false;
let shadeDragging = false;
let pointerStartY = 0;
let shadeStartY = 0;
let shadeDragY = 0;
let activePointerId = null;

function isTouchFirst() { const coarseTouch = window.matchMedia('(pointer: coarse)').matches; const noHover = window.matchMedia('(hover: none)').matches; const userAgentMobile = navigator.userAgentData?.mobile === true; return (coarseTouch && noHover) || userAgentMobile; }
function getMode() { if (isTouchFirst()) return 'mobile'; return window.innerHeight > window.innerWidth ? 'desktop-portrait' : 'desktop-landscape'; }
function updateStage() { const mode = getMode(); const config = MODES[mode]; const rect = viewport.getBoundingClientRect(); const fitScale = Math.min(rect.width / config.width, rect.height / config.height); const scale = mode === 'mobile' ? fitScale : config.visualScale; stage.dataset.mode = mode; stage.style.width = `${config.width}px`; stage.style.height = `${config.height}px`; stage.style.transform = `translate(-50%, -50%) scale(${scale})`; const label = mode.replace('-', ' ').toUpperCase(); diagnostics.textContent = `MODALITÀ ${label} · STAGE ${config.width}×${config.height} · ${config.columns} COLONNE · INPUT ${config.input} · SCALA ${scale.toFixed(2)}×`; }
function setOpen(open) { shadeOpen = open; shade.classList.toggle('is-open', open); shade.setAttribute('aria-hidden', String(!open)); backdrop.hidden = !open; shade.style.transform = ''; }
function beginShadeDrag(event) { shadeDragging = true; activePointerId = event.pointerId; pointerStartY = event.clientY; shadeStartY = shadeOpen ? 0 : -shade.offsetHeight; shadeDragY = shadeStartY; handle.setPointerCapture?.(event.pointerId); event.preventDefault(); }
function moveShadeDrag(event) { if (!shadeDragging || event.pointerId !== activePointerId) return; shadeDragY = Math.max(-shade.offsetHeight, Math.min(0, shadeStartY + event.clientY - pointerStartY)); shade.style.transition = 'none'; shade.style.transform = `translateY(${shadeDragY}px)`; event.preventDefault(); }
function endShadeDrag(event) { if (!shadeDragging || (event.pointerId != null && event.pointerId !== activePointerId)) return; const threshold = shade.offsetHeight * .25; const shouldOpen = shadeDragY > -threshold; shadeDragging = false; activePointerId = null; shade.style.transition = ''; setOpen(shouldOpen); }
handle.addEventListener('pointerdown', beginShadeDrag); document.addEventListener('pointermove', moveShadeDrag, { passive:false }); document.addEventListener('pointerup', endShadeDrag); document.addEventListener('pointercancel', endShadeDrag);
handle.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(!shadeOpen); } });
closeButton.addEventListener('click', () => setOpen(false)); backdrop.addEventListener('click', () => setOpen(false));
document.querySelectorAll('[data-toggle]').forEach(tile => tile.addEventListener('click', () => { tile.classList.toggle('is-active'); const active = tile.classList.contains('is-active'); const label = tile.querySelector('strong').textContent; tile.querySelector('small').textContent = active ? 'Attivi' : 'Disattivi'; message.textContent = `${label}: ${active ? 'attivato' : 'disattivato'}`; }));
document.querySelector('#settingsButton').addEventListener('click', () => { message.textContent = 'Impostazioni: pannello dimostrativo'; });
window.addEventListener('resize', updateStage, { passive:true }); window.addEventListener('orientationchange', updateStage, { passive:true }); updateStage();
