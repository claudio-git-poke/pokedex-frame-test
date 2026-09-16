const viewport = document.querySelector("#stageViewport");
const stage = document.querySelector("#virtualStage");
const pages = document.querySelector("#widgetPages");
const initialGrid = document.querySelector(".widget-grid");

const shade = document.querySelector("#quickShade");
const backdrop = document.querySelector("#shadeBackdrop");
const grabber = document.querySelector("#shadeGrabber");
const topBall = document.querySelector("#shadePokeball");
const closeButton = document.querySelector("#shadeClose");
const message = document.querySelector("#shadeMessage");

const MODES = {
  "desktop-landscape": {
    width: 1366,
    height: 768,
    visualScale: 0.72,
    padding: 28
  },

  "desktop-portrait": {
    width: 768,
    height: 1366,
    visualScale: 0.72,
    padding: 24
  },

  mobile: {
    width: 390,
    height: 844,
    visualScale: 1,
    padding: 22
  }
};

const WIDGET_SIZE = 150;
const WIDGET_GAP = 12;
const SHADE_RESERVED_HEIGHT = 42;
const DRAG_THRESHOLD = 50;

let currentMode = null;
let pageIndex = 0;
let pageCount = 1;
let wheelLocked = false;
let resizeTimer = null;

let pageDragging = false;
let pagePointerId = null;
let pageStartX = 0;
let pageLastX = 0;
let pageDragDistance = 0;

let shadeOpen = false;
let shadeDragging = false;
let pointerStartY = 0;
let shadeStartY = 0;
let shadeDragY = 0;
let activePointerId = null;

let zoomInProgress = false;
let zoomTimer = null;

let lastViewportWidth = 0;
let lastViewportHeight = 0;
let lastVisualViewportScale =
  window.visualViewport?.scale || 1;

function isTouchFirst() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const mobile = navigator.userAgentData?.mobile === true;

  return (coarse && noHover) || mobile;
}

function getViewportSize() {
  const visualViewport = window.visualViewport;

  return {
    width: visualViewport?.width || window.innerWidth,
    height: visualViewport?.height || window.innerHeight
  };
}

function detectMode() {
  const viewportSize = getViewportSize();

  if (isTouchFirst()) {
    return "mobile";
  }

  return viewportSize.height > viewportSize.width
    ? "desktop-portrait"
    : "desktop-landscape";
}

function getVirtualMetrics() {
  const config = MODES[currentMode];
  const viewportSize = getViewportSize();

  let availableWidth =
    config.width - config.padding * 2;

  let availableHeight =
    config.height -
    config.padding * 2 -
    SHADE_RESERVED_HEIGHT;

  if (currentMode === "mobile") {
    const mobileScale = Math.min(
      1,
      viewportSize.width / config.width
    );

    const visibleVirtualWidth =
      viewportSize.width / mobileScale;

    const visibleVirtualHeight =
      viewportSize.height / mobileScale;

    availableWidth = Math.max(
      0,
      visibleVirtualWidth - config.padding * 2
    );

    availableHeight = Math.max(
      0,
      visibleVirtualHeight -
        config.padding * 2 -
        SHADE_RESERVED_HEIGHT
    );
  }

  const columns = Math.max(
    1,
    Math.floor(
      (availableWidth + WIDGET_GAP) /
      (WIDGET_SIZE + WIDGET_GAP)
    )
  );

  const rows = Math.max(
    1,
    Math.floor(
      (availableHeight + WIDGET_GAP) /
      (WIDGET_SIZE + WIDGET_GAP)
    )
  );

  return {
    columns,
    rows,
    capacity: columns * rows
  };
}

function buildWidgetPages() {
  if (!pages || !initialGrid) {
    return;
  }

  const widgets = Array.from(
    initialGrid.querySelectorAll(".widget")
  );

  const metrics = getVirtualMetrics();

  pageCount = Math.max(
    1,
    Math.ceil(widgets.length / metrics.capacity)
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
      pageGrid.appendChild(widget);
    });

    page.appendChild(pageGrid);
    pages.appendChild(page);
  }

  updatePageLayout();
  goToPage(0, false);
}

function updatePageLayout() {
  if (!pages) {
    return;
  }

  const metrics = getVirtualMetrics();

  pages.querySelectorAll(".widget-grid").forEach((pageGrid) => {
    pageGrid.style.gridTemplateColumns =
      `repeat(${metrics.columns}, ${WIDGET_SIZE}px)`;

    pageGrid.style.gridTemplateRows =
      `repeat(${metrics.rows}, ${WIDGET_SIZE}px)`;

    pageGrid.style.width = "100%";
    pageGrid.style.height =
      `calc(100% - ${SHADE_RESERVED_HEIGHT}px)`;

    pageGrid.style.overflow = "hidden";
  });

  pages.querySelectorAll(".widget-page").forEach((page) => {
    page.style.width = "100%";
    page.style.minWidth = "100%";
    page.style.paddingTop =
      `${SHADE_RESERVED_HEIGHT}px`;
  });
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
  if (!viewport || !stage || !currentMode) {
    return;
  }

  const config = MODES[currentMode];
  const viewportSize = getViewportSize();
  const rect = viewport.getBoundingClientRect();

  const availableWidth = Math.min(
    rect.width,
    viewportSize.width
  );

  const availableHeight = Math.min(
    rect.height,
    viewportSize.height
  );

  const fitScale = Math.min(
    availableWidth / config.width,
    availableHeight / config.height
  );

  const scale = currentMode === "mobile"
    ? Math.min(
        1,
        availableWidth / config.width
      )
    : Math.min(
        fitScale,
        config.visualScale
      );

  stage.dataset.mode = currentMode;
  stage.style.width = `${config.width}px`;
  stage.style.height = `${config.height}px`;
  stage.style.transform =
    `translate(-50%, -50%) scale(${scale})`;
}

function initializeLayout(force = false) {
  const detectedMode = detectMode();

  if (!force && currentMode === detectedMode) {
    updateStageScale();
    buildWidgetPages();
    return;
  }

  currentMode = detectedMode;
  pageIndex = 0;

  updateStageScale();
  buildWidgetPages();
}

function handleWheel(event) {
  if (!pages || wheelLocked || zoomInProgress) {
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
  if (!pages || zoomInProgress) {
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
  if (zoomInProgress) {
    return;
  }

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

  topBall.style.top = shadeOpen
    ? "calc(100% - var(--pokeball-offset))"
    : "var(--pokeball-offset)";
}

function beginShadeDrag(event) {
  if (zoomInProgress) {
    return;
  }

  shadeDragging = true;
  activePointerId = event.pointerId;
  pointerStartY = event.clientY;

  shadeStartY = shadeOpen
    ? 0
    : -shade.offsetHeight +
      SHADE_RESERVED_HEIGHT;

  shadeDragY = shadeStartY;

  [grabber, shade, topBall].forEach((element) => {
    element.classList.add("is-dragging");
  });

  event.preventDefault();
}

function moveShadeDrag(event) {
  if (!shadeDragging || zoomInProgress) {
    return;
  }

  if (event.pointerId !== activePointerId) {
    return;
  }

  shadeDragY = Math.max(
    -shade.offsetHeight +
      SHADE_RESERVED_HEIGHT,
    Math.min(
      0,
      shadeStartY +
        event.clientY -
        pointerStartY
    )
  );

  shade.style.transition = "none";
  shade.style.transform =
    `translateY(${shadeDragY}px)`;

  event.preventDefault();
}

function endShadeDrag(event) {
  if (!shadeDragging) {
    return;
  }

  if (
    event.pointerId != null &&
    event.pointerId !== activePointerId
  ) {
    return;
  }

  const moved =
    event.clientY - pointerStartY;

  shadeDragging = false;
  activePointerId = null;

  [grabber, shade, topBall].forEach((element) => {
    element.classList.remove("is-dragging");
  });

  shade.style.transition = "";

  if (zoomInProgress) {
    return;
  }

  if (moved > 8) {
    setOpen(true);
  } else if (moved < -8) {
    setOpen(false);
  } else {
    setOpen(shadeOpen);
  }
}

function beginZoomProtection() {
  zoomInProgress = true;

  clearTimeout(zoomTimer);

  shadeDragging = false;
  pageDragging = false;
  shadeOpen = false;

  shade.classList.remove("is-open");
  shade.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;

  shade.style.transition = "none";
  shade.style.transform =
    "translateY(calc(-100% + var(--shade-grabber-height)))";

  topBall.style.top =
    "var(--pokeball-offset)";

  zoomTimer = window.setTimeout(() => {
    zoomInProgress = false;
    shade.style.transition = "";
    setOpen(false);
  }, 400);
}

function handleViewportChange() {
  const viewportSize = getViewportSize();
  const visualScale =
    window.visualViewport?.scale || 1;

  const widthChanged =
    Math.abs(
      viewportSize.width -
      lastViewportWidth
    ) > 1;

  const heightChanged =
    Math.abs(
      viewportSize.height -
      lastViewportHeight
    ) > 1;

  const scaleChanged =
    Math.abs(
      visualScale -
      lastVisualViewportScale
    ) > 0.01;

  if (
    scaleChanged ||
    widthChanged ||
    heightChanged
  ) {
    beginZoomProtection();
  }

  lastVisualViewportScale = visualScale;
  lastViewportWidth = viewportSize.width;
  lastViewportHeight = viewportSize.height;

  clearTimeout(resizeTimer);

  resizeTimer = window.setTimeout(() => {
    zoomInProgress = false;
    updateStageScale();
    buildWidgetPages();
  }, 400);
}

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

document.addEventListener(
  "pointermove",
  moveShadeDrag,
  { passive: false }
);

document.addEventListener(
  "pointerup",
  endShadeDrag
);

document.addEventListener(
  "pointercancel",
  endShadeDrag
);

topBall.addEventListener("click", () => {
  if (!shadeDragging && !zoomInProgress) {
    setOpen(!shadeOpen);
  }
});

grabber.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" ||
    event.key === " "
  ) {
    event.preventDefault();

    if (!zoomInProgress) {
      setOpen(!shadeOpen);
    }
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
      if (zoomInProgress) {
        return;
      }

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
    if (!zoomInProgress) {
      message.textContent =
        "Impostazioni: pannello dimostrativo";
    }
  });

window.addEventListener(
  "resize",
  handleViewportChange,
  { passive: true }
);

window.visualViewport?.addEventListener(
  "resize",
  handleViewportChange,
  { passive: true }
);

window.addEventListener(
  "orientationchange",
  () => {
    currentMode = detectMode();
    initializeLayout(true);
  },
  { passive: true }
);

const initialViewportSize = getViewportSize();

lastViewportWidth = initialViewportSize.width;
lastViewportHeight = initialViewportSize.height;
currentMode = detectMode();

initializeLayout(true);
setOpen(false);
