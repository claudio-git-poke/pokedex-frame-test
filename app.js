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

const WIDGET_SIZE = 150;
const WIDGET_GAP = 12;
const SHADE_RESERVED_HEIGHT = 42;
const DRAG_THRESHOLD = 50;

let currentMode = "desktop-landscape";
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

  const availableWidth =
    config.width - padding * 2;

  const availableHeight =
    config.height -
    padding * 2 -
    SHADE_RESERVED_HEIGHT;

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
    capacity: columns * rows,
    padding
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
      `repeat(${metrics.columns}, ${WIDGET_SIZE}px)`;

    gridElement.style.gridTemplateRows =
      `repeat(${metrics.rows}, ${WIDGET_SIZE}px)`;

    gridElement.style.columnGap =
      `${WIDGET_GAP}px`;

    gridElement.style.rowGap =
      `${WIDGET_GAP}px`;
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

function initializeLayout() {
  if (layoutInitialized) {
    return;
  }

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

function handleOrientationChange() {
  clearTimeout(orientationTimer);

  orientationTimer = window.setTimeout(() => {
    const nextMode = detectMode();

    if (nextMode === currentMode) {
      return;
    }

    currentMode = nextMode;
    layoutInitialized = false;
    pageIndex = 0;

    updateStageScale();
    buildWidgetPages(true);
    layoutInitialized = true;
  }, 250);
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
  if (!shadeDragging) {
    setOpen(!shadeOpen);
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
