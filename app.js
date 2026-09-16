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

const topColorSelect =
  document.querySelector("#frameTopColor");

const bottomColorSelect =
  document.querySelector("#frameBottomColor");

const widgetSizeInput =
  document.querySelector("#widgetSize");

const widgetSizeValue =
  document.querySelector("#widgetSizeValue");

const widgetPreview =
  document.querySelector("#widgetPreview");

const MODES = {
  "desktop-landscape": {
    width: 1366,
    height: 768,
    visualScale: 0.72
  },

  "desktop-portrait": {
    width: 768,
    height: 1366,
    visualScale: 0.72
  },

  mobile: {
    width: 390,
    height: 844,
    visualScale: 1
  }
};

const DEFAULT_WIDGET_SIZE = 150;
const MIN_WIDGET_SIZE = 80;
const MAX_WIDGET_SIZE = 220;
const WIDGET_GAP = 12;
const SHADE_RESERVED_HEIGHT = 42;
const DRAG_THRESHOLD = 50;

const STORAGE_KEYS = {
  topColor: "pokedex-frame-top-color",
  bottomColor: "pokedex-frame-bottom-color",
  widgetSize: "pokedex-frame-widget-size"
};

const DEFAULT_COLORS = {
  top: "#c92828",
  bottom: "#f4f0e7"
};

let currentMode = "desktop-landscape";
let currentWidgetSize = DEFAULT_WIDGET_SIZE;

let pageIndex = 0;
let pageCount = 1;
let wheelLocked = false;

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

let layoutInitialized = false;
let orientationTimer = null;

function isTouchFirst() {
  const coarse = window.matchMedia(
    "(pointer: coarse)"
  ).matches;

  const noHover = window.matchMedia(
    "(hover: none)"
  ).matches;

  const mobile =
    navigator.userAgentData?.mobile === true;

  return (coarse && noHover) || mobile;
}

function detectMode() {
  if (isTouchFirst()) {
    return "mobile";
  }

  return window.innerHeight > window.innerWidth
    ? "desktop-portrait"
    : "desktop-landscape";
}

function getVirtualMetrics() {
  const config = MODES[currentMode];

  const padding =
    currentMode === "mobile"
      ? 22
      : currentMode === "desktop-portrait"
        ? 24
        : 28;

  const safeBottom =
    currentMode === "mobile"
      ? parseFloat(
          getComputedStyle(
            document.documentElement
          ).getPropertyValue("--safe-bottom")
        ) || 0
      : 0;

  const availableWidth =
    config.width - padding * 2;

  const availableHeight =
    config.height -
    padding * 2 -
    SHADE_RESERVED_HEIGHT -
    safeBottom;

  const columns = Math.max(
    1,
    Math.floor(
      (availableWidth + WIDGET_GAP) /
      (currentWidgetSize + WIDGET_GAP)
    )
  );

  const rows = Math.max(
    1,
    Math.floor(
      (availableHeight + WIDGET_GAP) /
      (currentWidgetSize + WIDGET_GAP)
    )
  );

  return {
    columns,
    rows,
    capacity: columns * rows,
    padding,
    safeBottom
  };
}

function getOriginalWidgets() {
  if (!initialGrid) {
    return [];
  }

  return Array.from(
    initialGrid.querySelectorAll(".widget")
  );
}

function buildWidgetPages(resetPage = true) {
  if (!pages) {
    return;
  }

  const widgets = getOriginalWidgets();
  const metrics = getVirtualMetrics();

  pageCount = Math.max(
    1,
    Math.ceil(
      widgets.length / metrics.capacity
    )
  );

  pages.replaceChildren();

  for (
    let pageNumber = 0;
    pageNumber < pageCount;
    pageNumber += 1
  ) {
    const page = document.createElement("div");
    page.className = "widget-page";
    page.dataset.page = String(pageNumber);

    const pageGrid = document.createElement("div");
    pageGrid.className = "widget-grid";
    pageGrid.setAttribute(
      "aria-label",
      `Pagina ${pageNumber + 1} di ${pageCount}`
    );

    const start =
      pageNumber * metrics.capacity;

    const pageWidgets = widgets.slice(
      start,
      start + metrics.capacity
    );

    pageWidgets.forEach((widget) => {
      pageGrid.appendChild(
        widget.cloneNode(true)
      );
    });

    page.appendChild(pageGrid);
    pages.appendChild(page);
  }

  updateGridStyles();

  if (resetPage) {
    pageIndex = 0;
  }

  requestAnimationFrame(() => {
    goToPage(pageIndex, false);
  });
}

function updateGridStyles() {
  if (!pages) {
    return;
  }

  const metrics = getVirtualMetrics();

  pages.querySelectorAll(".widget-grid").forEach((gridElement) => {
    gridElement.style.gridTemplateColumns =
      `repeat(${metrics.columns}, ${currentWidgetSize}px)`;

    gridElement.style.gridTemplateRows =
      `repeat(${metrics.rows}, ${currentWidgetSize}px)`;

    gridElement.style.columnGap =
      `${WIDGET_GAP}px`;

    gridElement.style.rowGap =
      `${WIDGET_GAP}px`;
  });

  pages.querySelectorAll(".widget-page").forEach((page) => {
    page.style.paddingBottom =
      `${metrics.safeBottom}px`;
  });

  document.documentElement.style.setProperty(
    "--widget-size",
    `${currentWidgetSize}px`
  );
}

function goToPage(index, smooth = true) {
  if (!pages) {
    return;
  }

  pageIndex = Math.max(
    0,
    Math.min(pageCount - 1, index)
  );

  pages.scrollTo({
    left: pageIndex * pages.clientWidth,
    behavior: smooth ? "smooth" : "auto"
  });
}

function changePage(direction) {
  const nextPage =
    pageIndex + Math.sign(direction);

  if (nextPage !== pageIndex) {
    goToPage(nextPage);
  }
}

function updatePageIndexFromScroll() {
  if (!pages || !pages.clientWidth) {
    return;
  }

  pageIndex = Math.max(
    0,
    Math.min(
      pageCount - 1,
      Math.round(
        pages.scrollLeft / pages.clientWidth
      )
    )
  );
}

function updateStageScale() {
  if (!stage || !viewport) {
    return;
  }

  const config = MODES[currentMode];
  const viewportRect =
    viewport.getBoundingClientRect();

  const scale = Math.min(
    viewportRect.width / config.width,
    viewportRect.height / config.height
  );

  stage.style.width = `${config.width}px`;
  stage.style.height = `${config.height}px`;
  stage.dataset.mode = currentMode;
  stage.style.transform =
    `translate(-50%, -50%) scale(${scale})`;
}

function setFrameColor(
  property,
  value,
  storageKey
) {
  document.documentElement.style.setProperty(
    property,
    value
  );

  localStorage.setItem(storageKey, value);
}

function loadSettings() {
  const savedTopColor =
    localStorage.getItem(
      STORAGE_KEYS.topColor
    ) || DEFAULT_COLORS.top;

  const savedBottomColor =
    localStorage.getItem(
      STORAGE_KEYS.bottomColor
    ) || DEFAULT_COLORS.bottom;

  const savedWidgetSize = Number(
    localStorage.getItem(
      STORAGE_KEYS.widgetSize
    )
  );

  currentWidgetSize =
    Number.isFinite(savedWidgetSize) &&
    savedWidgetSize >= MIN_WIDGET_SIZE &&
    savedWidgetSize <= MAX_WIDGET_SIZE
      ? savedWidgetSize
      : DEFAULT_WIDGET_SIZE;

  setFrameColor(
    "--frame-top",
    savedTopColor,
    STORAGE_KEYS.topColor
  );

  setFrameColor(
    "--frame-bottom",
    savedBottomColor,
    STORAGE_KEYS.bottomColor
  );

  if (topColorSelect) {
    topColorSelect.value = savedTopColor;
  }

  if (bottomColorSelect) {
    bottomColorSelect.value =
      savedBottomColor;
  }

  if (widgetSizeInput) {
    widgetSizeInput.value =
      String(currentWidgetSize);
  }

  updateWidgetSizeInterface();
}

function updateWidgetSizeInterface() {
  if (widgetSizeValue) {
    widgetSizeValue.textContent =
      `${currentWidgetSize} px`;
  }

  if (widgetPreview) {
    widgetPreview.style.width =
      `${currentWidgetSize}px`;

    widgetPreview.style.height =
      `${currentWidgetSize}px`;
  }

  document.documentElement.style.setProperty(
    "--widget-size",
    `${currentWidgetSize}px`
  );
}

function applyWidgetSize(value) {
  const nextSize = Number(value);

  if (
    !Number.isFinite(nextSize) ||
    nextSize < MIN_WIDGET_SIZE ||
    nextSize > MAX_WIDGET_SIZE
  ) {
    return;
  }

  currentWidgetSize = nextSize;

  localStorage.setItem(
    STORAGE_KEYS.widgetSize,
    String(currentWidgetSize)
  );

  updateWidgetSizeInterface();

  pageIndex = 0;
  buildWidgetPages(true);
}

function initializeLayout() {
  if (layoutInitialized) {
    return;
  }

  loadSettings();

  currentMode = detectMode();
  updateStageScale();
  buildWidgetPages(true);

  layoutInitialized = true;
}

function handleWheel(event) {
  if (!pages || wheelLocked) {
    return;
  }

  const delta =
    Math.abs(event.deltaX) >
    Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

  if (Math.abs(delta) < 4) {
    return;
  }

  event.preventDefault();
  wheelLocked = true;

  changePage(delta > 0 ? 1 : -1);

  window.setTimeout(() => {
    wheelLocked = false;
  }, 450);
}

function beginPageDrag(event) {
  if (!pages) {
    return;
  }

  if (
    event.button !== undefined &&
    event.button !== 0
  ) {
    return;
  }

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
  if (!pageDragging) {
    return;
  }

  if (event.pointerId !== pagePointerId) {
    return;
  }

  const delta =
    event.clientX - pageLastX;

  pageLastX = event.clientX;
  pageDragDistance =
    event.clientX - pageStartX;

  pages.scrollLeft -= delta;

  event.preventDefault();
}

function endPageDrag(event) {
  if (!pageDragging) {
    return;
  }

  if (
    event.pointerId != null &&
    event.pointerId !== pagePointerId
  ) {
    return;
  }

  pageDragging = false;

  pages.releasePointerCapture?.(
    pagePointerId
  );

  pages.style.scrollBehavior = "smooth";

  if (
    Math.abs(pageDragDistance) >=
    DRAG_THRESHOLD
  ) {
    changePage(
      pageDragDistance < 0 ? 1 : -1
    );
  } else {
    goToPage(pageIndex);
  }

  pagePointerId = null;
}

function setOpen(open) {
  shadeOpen = Boolean(open);

  shade.classList.toggle(
    "is-open",
    shadeOpen
  );

  shade.setAttribute(
    "aria-hidden",
    String(!shadeOpen)
  );

  backdrop.hidden = !shadeOpen;

  shade.style.transform = shadeOpen
    ? "translateY(0)"
    : "translateY(calc(-100% + var(--shade-grabber-height)))";
}

function beginShadeDrag(event) {
  shadeDragging = true;
  shadePointerId = event.pointerId;
  shadeStartY = event.clientY;

  shadeStartOffset = shadeOpen
    ? 0
    : -shade.offsetHeight +
      SHADE_RESERVED_HEIGHT;

  shadeCurrentOffset = shadeStartOffset;

  shade.style.transition = "none";

  [grabber, shade, topBall].forEach((element) => {
    element.classList.add("is-dragging");
  });

  event.preventDefault();
}

function moveShadeDrag(event) {
  if (!shadeDragging) {
    return;
  }

  if (event.pointerId !== shadePointerId) {
    return;
  }

  shadeCurrentOffset = Math.max(
    -shade.offsetHeight +
      SHADE_RESERVED_HEIGHT,
    Math.min(
      0,
      shadeStartOffset +
        event.clientY -
        shadeStartY
    )
  );

  shade.style.transform =
    `translateY(${shadeCurrentOffset}px)`;

  event.preventDefault();
}

function endShadeDrag(event) {
  if (!shadeDragging) {
    return;
  }

  if (
    event.pointerId != null &&
    event.pointerId !== shadePointerId
  ) {
    return;
  }

  const movement =
    event.clientY - shadeStartY;

  shadeDragging = false;
  shadePointerId = null;

  [grabber, shade, topBall].forEach((element) => {
    element.classList.remove("is-dragging");
  });

  shade.style.transition = "";

  if (movement > 8) {
    setOpen(true);
  } else if (movement < -8) {
    setOpen(false);
  } else {
    setOpen(shadeOpen);
  }
}

function goHome() {
  if (shadeOpen) {
    setOpen(false);
    return;
  }

  goToPage(0);
}

function beginBottomBallDrag(event) {
  bottomBallDragging = true;
  bottomBallPointerId = event.pointerId;
  bottomBallStartY = event.clientY;
  bottomBallMoved = false;

  bottomBall.setPointerCapture?.(
    event.pointerId
  );

  bottomBall.classList.add("is-dragging");
  event.preventDefault();
}

function moveBottomBallDrag(event) {
  if (!bottomBallDragging) {
    return;
  }

  if (event.pointerId !== bottomBallPointerId) {
    return;
  }

  const movement =
    event.clientY - bottomBallStartY;

  if (Math.abs(movement) >= 8) {
    bottomBallMoved = true;
  }

  if (shadeOpen && movement < -8) {
    const progress = Math.min(
      1,
      Math.abs(movement) /
        Math.max(1, shade.offsetHeight)
    );

    shade.style.transition = "none";
    shade.style.transform =
      `translateY(${
        -progress * shade.offsetHeight
      }px)`;
  }

  event.preventDefault();
}

function endBottomBallDrag(event) {
  if (!bottomBallDragging) {
    return;
  }

  if (
    event.pointerId != null &&
    event.pointerId !== bottomBallPointerId
  ) {
    return;
  }

  const movement =
    event.clientY - bottomBallStartY;

  bottomBallDragging = false;
  bottomBall.releasePointerCapture?.(
    bottomBallPointerId
  );

  bottomBall.classList.remove(
    "is-dragging"
  );

  shade.style.transition = "";

  if (shadeOpen && movement < -20) {
    setOpen(false);
  } else if (!bottomBallMoved) {
    goHome();
  } else if (!shadeOpen) {
    goHome();
  }

  bottomBallPointerId = null;
}

function handleOrientationChange() {
  clearTimeout(orientationTimer);

  orientationTimer = window.setTimeout(() => {
    const nextMode = detectMode();

    if (nextMode === currentMode) {
      return;
    }

    currentMode = nextMode;
    pageIndex = 0;

    updateStageScale();
    buildWidgetPages(true);
  }, 250);
}

topColorSelect?.addEventListener(
  "change",
  (event) => {
    setFrameColor(
      "--frame-top",
      event.target.value,
      STORAGE_KEYS.topColor
    );
  }
);

bottomColorSelect?.addEventListener(
  "change",
  (event) => {
    setFrameColor(
      "--frame-bottom",
      event.target.value,
      STORAGE_KEYS.bottomColor
    );
  }
);

widgetSizeInput?.addEventListener(
  "input",
  (event) => {
    applyWidgetSize(event.target.value);
  }
);

pages?.addEventListener(
  "wheel",
  handleWheel,
  { passive: false }
);

pages?.addEventListener(
  "scroll",
  updatePageIndexFromScroll,
  { passive: true }
);

pages?.addEventListener(
  "pointerdown",
  beginPageDrag
);

pages?.addEventListener(
  "pointermove",
  movePageDrag,
  { passive: false }
);

pages?.addEventListener(
  "pointerup",
  endPageDrag
);

pages?.addEventListener(
  "pointercancel",
  endPageDrag
);

[grabber, shade, topBall].forEach((element) => {
  element.addEventListener(
    "pointerdown",
    beginShadeDrag
  );
});

bottomBall?.addEventListener(
  "pointerdown",
  beginBottomBallDrag
);

document.addEventListener(
  "pointermove",
  moveShadeDrag,
  { passive: false }
);

document.addEventListener(
  "pointermove",
  moveBottomBallDrag,
  { passive: false }
);

document.addEventListener(
  "pointerup",
  endShadeDrag
);

document.addEventListener(
  "pointerup",
  endBottomBallDrag
);

document.addEventListener(
  "pointercancel",
  endShadeDrag
);

document.addEventListener(
  "pointercancel",
  endBottomBallDrag
);

topBall.addEventListener("click", () => {
  if (!shadeDragging) {
    setOpen(!shadeOpen);
  }
});

bottomBall?.addEventListener("click", () => {
  if (!bottomBallMoved) {
    goHome();
  }
});

grabber.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" ||
    event.key === " "
  ) {
    event.preventDefault();
    setOpen(!shadeOpen);
  }
});

closeButton.addEventListener(
  "click",
  () => setOpen(false)
);

backdrop.addEventListener(
  "click",
  () => setOpen(false)
);

document
  .querySelectorAll("[data-toggle]")
  .forEach((tile) => {
    tile.addEventListener("click", () => {
      tile.classList.toggle("is-active");

      const active =
        tile.classList.contains("is-active");

      const label =
        tile.querySelector("strong").textContent;

      tile.querySelector("small").textContent =
        active ? "Attivi" : "Disattivi";

      message.textContent =
        `${label}: ${
          active ? "attivato" : "disattivato"
        }`;
    });
  });

document
  .querySelector("#settingsButton")
  ?.addEventListener("click", () => {
    message.textContent =
      "Impostazioni: pannello dimostrativo";
  });

window.addEventListener(
  "orientationchange",
  handleOrientationChange,
  { passive: true }
);

initializeLayout();
setOpen(false);
