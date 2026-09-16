const viewport = document.querySelector("#stageViewport");
const stage = document.querySelector("#virtualStage");
const pages = document.querySelector("#widgetPages");
const initialGrid = document.querySelector(".widget-grid");

const shade = document.querySelector("#quickShade");
const backdrop = document.querySelector("#shadeBackdrop");
const grabber = document.querySelector("#shadeGrabber");
const topBall = document.querySelector("#shadePokeball");
const bottomBall = document.querySelector("#homePokeball");
const closeButton = document.querySelector("#shadeClose");
const message = document.querySelector("#shadeMessage");

const topColorSelect = document.querySelector("#frameTopColor");
const bottomColorSelect = document.querySelector("#frameBottomColor");
const widgetSizeInput = document.querySelector("#widgetSize");
const widgetSizeValue = document.querySelector("#widgetSizeValue");
const widgetPreview = document.querySelector("#widgetPreview");

const MODES = {
  "desktop-landscape": { width: 1366, height: 768 },
  "desktop-portrait": { width: 768, height: 1366 },
  mobile: { width: 390, height: 844 }
};

const DEFAULT_WIDGET_SIZE = 150;
const MIN_WIDGET_SIZE = 80;
const MAX_WIDGET_SIZE = 220;
const WIDGET_GAP = 12;
const SHADE_RESERVED_HEIGHT = 42;
const PAGE_SWIPE_THRESHOLD = 55;
const SHADE_CLOSE_THRESHOLD = 60;
const SWIPE_COOLDOWN = 500;

const STORAGE_KEYS = {
  topColor: "pokedex-frame-top-color",
  bottomColor: "pokedex-frame-bottom-color",
  widgetSize: "pokedex-frame-widget-size"
};

let currentMode = "desktop-landscape";
let currentWidgetSize = DEFAULT_WIDGET_SIZE;
let pageIndex = 0;
let pageCount = 1;
let wheelLocked = false;
let pageSwipeLocked = false;

let pageDragging = false;
let pagePointerId = null;
let pageStartX = 0;
let pageLastX = 0;
let pageDragDistance = 0;

let shadeOpen = false;
let shadeDragging = false;
let shadePointerId = null;
let shadeStartY = 0;
let shadeStartOffset = 0;
let shadeCurrentOffset = 0;

let bottomBallDragging = false;
let bottomBallPointerId = null;
let bottomBallStartY = 0;
let bottomBallMoved = false;

function isTouchFirst() {
  return window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    navigator.userAgentData?.mobile === true;
}

function detectMode() {
  if (isTouchFirst()) return "mobile";
  return window.innerHeight > window.innerWidth ? "desktop-portrait" : "desktop-landscape";
}

function getVirtualMetrics() {
  const config = MODES[currentMode];
  const padding = currentMode === "mobile" ? 18 : currentMode === "desktop-portrait" ? 24 : 28;
  const availableWidth = config.width - padding * 2;
  const availableHeight = config.height - padding * 2;
  const columns = Math.max(1, Math.floor((availableWidth + WIDGET_GAP) / (currentWidgetSize + WIDGET_GAP)));
  const rows = Math.max(1, Math.floor((availableHeight + WIDGET_GAP) / (currentWidgetSize + WIDGET_GAP)));
  return { columns, rows, capacity: columns * rows };
}

function getOriginalWidgets() {
  return initialGrid ? Array.from(initialGrid.querySelectorAll(".widget")) : [];
}

function buildWidgetPages(resetPage = true) {
  if (!pages) return;

  const widgets = getOriginalWidgets();
  const metrics = getVirtualMetrics();
  pageCount = Math.max(1, Math.ceil(widgets.length / metrics.capacity));
  pages.replaceChildren();

  for (let pageNumber = 0; pageNumber < pageCount; pageNumber += 1) {
    const page = document.createElement("div");
    page.className = "widget-page";

    const pageGrid = document.createElement("div");
    pageGrid.className = "widget-grid";
    pageGrid.setAttribute("aria-label", `Pagina ${pageNumber + 1} di ${pageCount}`);

    const start = pageNumber * metrics.capacity;
    widgets.slice(start, start + metrics.capacity).forEach((widget) => {
      pageGrid.appendChild(widget.cloneNode(true));
    });

    page.appendChild(pageGrid);
    pages.appendChild(page);
  }

  updateGridStyles();
  if (resetPage) pageIndex = 0;
  requestAnimationFrame(() => goToPage(pageIndex, false));
}

function updateGridStyles() {
  const metrics = getVirtualMetrics();
  pages?.querySelectorAll(".widget-grid").forEach((grid) => {
    grid.style.gridTemplateColumns = `repeat(${metrics.columns}, ${currentWidgetSize}px)`;
    grid.style.gridTemplateRows = `repeat(${metrics.rows}, ${currentWidgetSize}px)`;
    grid.style.columnGap = `${WIDGET_GAP}px`;
    grid.style.rowGap = `${WIDGET_GAP}px`;
  });
  document.documentElement.style.setProperty("--widget-size", `${currentWidgetSize}px`);
}

function goToPage(index, smooth = true) {
  if (!pages) return;
  pageIndex = Math.max(0, Math.min(pageCount - 1, index));
  pages.scrollTo({ left: pageIndex * pages.clientWidth, behavior: smooth ? "smooth" : "auto" });
}

function changePage(direction) {
  if (pageSwipeLocked) return;
  const next = pageIndex + Math.sign(direction);
  if (next === pageIndex) return;

  pageSwipeLocked = true;
  goToPage(next);
  window.setTimeout(() => {
    pageSwipeLocked = false;
  }, SWIPE_COOLDOWN);
}

function updatePageIndex() {
  if (pages?.clientWidth && !pageDragging) {
    pageIndex = Math.round(pages.scrollLeft / pages.clientWidth);
  }
}

function updateStageScale() {
  if (!stage || !viewport) return;
  const config = MODES[currentMode];
  const rect = viewport.getBoundingClientRect();
  const scale = Math.min(rect.width / config.width, rect.height / config.height);
  stage.style.width = `${config.width}px`;
  stage.style.height = `${config.height}px`;
  stage.dataset.mode = currentMode;
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function setFrameColor(property, value, storageKey) {
  document.documentElement.style.setProperty(property, value);
  localStorage.setItem(storageKey, value);
}

function loadSettings() {
  const top = localStorage.getItem(STORAGE_KEYS.topColor) || "#c92828";
  const bottom = localStorage.getItem(STORAGE_KEYS.bottomColor) || "#f4f0e7";
  const savedSize = Number(localStorage.getItem(STORAGE_KEYS.widgetSize));

  currentWidgetSize = Number.isFinite(savedSize) && savedSize >= MIN_WIDGET_SIZE && savedSize <= MAX_WIDGET_SIZE
    ? savedSize
    : DEFAULT_WIDGET_SIZE;

  setFrameColor("--frame-top", top, STORAGE_KEYS.topColor);
  setFrameColor("--frame-bottom", bottom, STORAGE_KEYS.bottomColor);

  if (topColorSelect) topColorSelect.value = top;
  if (bottomColorSelect) bottomColorSelect.value = bottom;
  if (widgetSizeInput) widgetSizeInput.value = String(currentWidgetSize);
  updateWidgetSizeInterface();
}

function updateWidgetSizeInterface() {
  if (widgetSizeValue) widgetSizeValue.textContent = `${currentWidgetSize} px`;
  if (widgetPreview) {
    widgetPreview.style.width = `${currentWidgetSize}px`;
    widgetPreview.style.height = `${currentWidgetSize}px`;
  }
  document.documentElement.style.setProperty("--widget-size", `${currentWidgetSize}px`);
}

function applyWidgetSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < MIN_WIDGET_SIZE || size > MAX_WIDGET_SIZE) return;
  currentWidgetSize = size;
  localStorage.setItem(STORAGE_KEYS.widgetSize, String(size));
  updateWidgetSizeInterface();
  buildWidgetPages(true);
}

function setOpen(open) {
  shadeOpen = Boolean(open);
  shade.classList.toggle("is-open", shadeOpen);
  shade.setAttribute("aria-hidden", String(!shadeOpen));
  backdrop.hidden = !shadeOpen;

  if (shadeOpen) {
    shade.style.transform = "translateY(0)";
    shade.style.pointerEvents = "auto";
  } else {
    shade.style.transform = "translateY(calc(-100% + var(--shade-grabber-height)))";
    shade.style.pointerEvents = "none";
  }
}

function beginShadeDrag(event) {
  shadeDragging = true;
  shadePointerId = event.pointerId;
  shadeStartY = event.clientY;
  shadeStartOffset = shadeOpen ? 0 : -shade.offsetHeight + SHADE_RESERVED_HEIGHT;
  shadeCurrentOffset = shadeStartOffset;
  shade.style.transition = "none";
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function moveShadeDrag(event) {
  if (!shadeDragging || event.pointerId !== shadePointerId) return;

  shadeCurrentOffset = Math.max(
    -shade.offsetHeight + SHADE_RESERVED_HEIGHT,
    Math.min(0, shadeStartOffset + event.clientY - shadeStartY)
  );

  shade.style.transform = `translateY(${shadeCurrentOffset}px)`;
  event.preventDefault();
}

function endShadeDrag(event) {
  if (!shadeDragging || (event.pointerId != null && event.pointerId !== shadePointerId)) return;

  const movement = event.clientY - shadeStartY;
  shadeDragging = false;
  shadePointerId = null;
  shade.style.transition = "";

  if (shadeOpen && movement <= -SHADE_CLOSE_THRESHOLD) {
    setOpen(false);
  } else if (!shadeOpen && movement >= SHADE_CLOSE_THRESHOLD) {
    setOpen(true);
  } else {
    setOpen(shadeOpen);
  }
}

function beginBottomBallDrag(event) {
  if (!shadeOpen) return;

  bottomBallDragging = true;
  bottomBallPointerId = event.pointerId;
  bottomBallStartY = event.clientY;
  bottomBallMoved = false;
  bottomBall.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function moveBottomBallDrag(event) {
  if (!bottomBallDragging || event.pointerId !== bottomBallPointerId) return;

  const movement = event.clientY - bottomBallStartY;
  if (Math.abs(movement) >= 10) bottomBallMoved = true;
  event.preventDefault();
}

function endBottomBallDrag(event) {
  if (!bottomBallDragging || (event.pointerId != null && event.pointerId !== bottomBallPointerId)) return;

  const movement = event.clientY - bottomBallStartY;
  bottomBallDragging = false;
  bottomBallPointerId = null;

  if (movement <= -SHADE_CLOSE_THRESHOLD) {
    setOpen(false);
  }
}

function beginPageDrag(event) {
  if (shadeOpen) return;
  if (event.target.closest(".quick-shade, .shade-grabber, .shade-close, .frame-settings, .frame-settings *")) return;
  if (event.button !== undefined && event.button !== 0) return;

  pageDragging = true;
  pagePointerId = event.pointerId;
  pageStartX = event.clientX;
  pageLastX = event.clientX;
  pageDragDistance = 0;
  pages.style.scrollBehavior = "auto";
  pages.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function movePageDrag(event) {
  if (!pageDragging || event.pointerId !== pagePointerId) return;
  const delta = event.clientX - pageLastX;
  pageLastX = event.clientX;
  pageDragDistance = event.clientX - pageStartX;
  pages.scrollLeft -= delta;
  event.preventDefault();
}

function endPageDrag(event) {
  if (!pageDragging || (event.pointerId != null && event.pointerId !== pagePointerId)) return;
  pageDragging = false;
  pages.releasePointerCapture?.(pagePointerId);
  pages.style.scrollBehavior = "smooth";

  if (Math.abs(pageDragDistance) >= PAGE_SWIPE_THRESHOLD) {
    changePage(pageDragDistance < 0 ? 1 : -1);
  } else {
    goToPage(pageIndex);
  }

  pagePointerId = null;
}

function goHome() {
  if (shadeOpen) setOpen(false);
  else goToPage(0);
}

topColorSelect?.addEventListener("change", (event) => {
  setFrameColor("--frame-top", event.target.value, STORAGE_KEYS.topColor);
});

bottomColorSelect?.addEventListener("change", (event) => {
  setFrameColor("--frame-bottom", event.target.value, STORAGE_KEYS.bottomColor);
});

widgetSizeInput?.addEventListener("input", (event) => {
  event.stopPropagation();
  applyWidgetSize(event.target.value);
});

pages?.addEventListener("scroll", updatePageIndex, { passive: true });

pages?.addEventListener("wheel", (event) => {
  if (wheelLocked || shadeOpen) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (Math.abs(delta) < 4) return;
  event.preventDefault();
  wheelLocked = true;
  changePage(delta > 0 ? 1 : -1);
  setTimeout(() => { wheelLocked = false; }, SWIPE_COOLDOWN);
}, { passive: false });

pages?.addEventListener("pointerdown", beginPageDrag);
pages?.addEventListener("pointermove", movePageDrag, { passive: false });
pages?.addEventListener("pointerup", endPageDrag);
pages?.addEventListener("pointercancel", endPageDrag);

grabber?.addEventListener("pointerdown", beginShadeDrag);
topBall?.addEventListener("pointerdown", beginShadeDrag);
bottomBall?.addEventListener("pointerdown", beginBottomBallDrag);

document.addEventListener("pointermove", moveShadeDrag, { passive: false });
document.addEventListener("pointermove", moveBottomBallDrag, { passive: false });
document.addEventListener("pointerup", endShadeDrag);
document.addEventListener("pointerup", endBottomBallDrag);
document.addEventListener("pointercancel", endShadeDrag);
document.addEventListener("pointercancel", endBottomBallDrag);

topBall?.addEventListener("click", () => {
  if (!shadeDragging) setOpen(!shadeOpen);
});

closeButton?.addEventListener("click", () => setOpen(false));
backdrop?.addEventListener("click", () => setOpen(false));
bottomBall?.addEventListener("click", () => {
  if (!bottomBallMoved) goHome();
});

grabber?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setOpen(!shadeOpen);
  }
});

document.querySelectorAll("[data-toggle]").forEach((tile) => {
  tile.addEventListener("click", () => {
    tile.classList.toggle("is-active");
    const active = tile.classList.contains("is-active");
    const label = tile.querySelector("strong")?.textContent || "Funzione";
    const small = tile.querySelector("small");
    if (small) small.textContent = active ? "Attivi" : "Disattivi";
    if (message) message.textContent = `${label}: ${active ? "attivato" : "disattivato"}`;
  });
});

document.querySelector("#settingsButton")?.addEventListener("click", () => {
  if (message) message.textContent = "Impostazioni: pannello dimostrativo";
});

function initialize() {
  loadSettings();
  currentMode = detectMode();
  updateStageScale();
  buildWidgetPages(true);
  setOpen(false);
}

window.addEventListener("resize", () => {
  const nextMode = detectMode();
  if (nextMode !== currentMode) {
    currentMode = nextMode;
    buildWidgetPages(true);
  }
  updateStageScale();
}, { passive: true });

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    currentMode = detectMode();
    updateStageScale();
    buildWidgetPages(true);
  }, 250);
}, { passive: true });

initialize();
