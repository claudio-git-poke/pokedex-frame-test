const viewport = document.querySelector("#stageViewport");
const stage = document.querySelector("#virtualStage");
const pages = document.querySelector("#widgetPages");
const grid = document.querySelector(".widget-grid");

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
    input: "MOUSE",
    visualScale: 0.72,
    padding: 28
  },
  "desktop-portrait": {
    width: 768,
    height: 1366,
    input: "MOUSE",
    visualScale: 0.72,
    padding: 24
  },
  mobile: {
    width: 390,
    height: 844,
    input: "TOUCH",
    padding: 22
  }
};

const WIDGET_SIZE = 150;
const WIDGET_GAP = 12;
const DRAG_THRESHOLD = 50;

let shadeOpen = false;
let shadeDragging = false;
let pointerStartY = 0;
let shadeStartY = 0;
let shadeDragY = 0;
let activePointerId = null;

let pageIndex = 0;
let pageCount = 1;
let pageDragging = false;
let pagePointerId = null;
let pageStartX = 0;
let pageStartScrollLeft = 0;
let pageLastX = 0;
let pageDragDistance = 0;
let wheelLocked = false;

function isTouchFirst() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const mobile = navigator.userAgentData?.mobile === true;

  return (coarse && noHover) || mobile;
}

function getMode() {
  return isTouchFirst()
    ? "mobile"
    : window.innerHeight > window.innerWidth
      ? "desktop-portrait"
      : "desktop-landscape";
}

function getVirtualMetrics() {
  const mode = getMode();
  const config = MODES[mode];

  const viewportWidth = config.width - config.padding * 2;
  const viewportHeight = config.height - config.padding * 2;

  const columns = Math.max(
    1,
    Math.floor((viewportWidth + WIDGET_GAP) / (WIDGET_SIZE + WIDGET_GAP))
  );

  const rows = Math.max(
    1,
    Math.floor((viewportHeight + WIDGET_GAP) / (WIDGET_SIZE + WIDGET_GAP))
  );

  return {
    mode,
    config,
    columns,
    rows,
    capacity: columns * rows
  };
}

function buildWidgetPages() {
  if (!pages || !grid) return;

  const widgets = Array.from(grid.querySelectorAll(".widget"));
  const metrics = getVirtualMetrics();

  pageCount = Math.max(1, Math.ceil(widgets.length / metrics.capacity));
  pageIndex = 0;

  pages.replaceChildren();

  for (let pageNumber = 0; pageNumber < pageCount; pageNumber += 1) {
    const page = document.createElement("div");
    page.className = "widget-page";
    page.dataset.page = String(pageNumber);

    const pageGrid = document.createElement("div");
    pageGrid.className = "widget-grid";
    pageGrid.setAttribute(
      "aria-label",
      `Pagina ${pageNumber + 1} di ${pageCount}`
    );

    const start = pageNumber * metrics.capacity;
    const pageWidgets = widgets.slice(start, start + metrics.capacity);

    pageWidgets.forEach((widget) => {
      pageGrid.appendChild(widget);
    });

    page.appendChild(pageGrid);
    pages.appendChild(page);
  }

  pages.scrollLeft = 0;
  updatePageLayout();
}

function updatePageLayout() {
  if (!pages) return;

  const metrics = getVirtualMetrics();

  pages.querySelectorAll(".widget-grid").forEach((pageGrid) => {
    pageGrid.style.gridTemplateColumns = `repeat(${metrics.columns}, ${WIDGET_SIZE}px)`;
    pageGrid.style.gridTemplateRows = `repeat(${metrics.rows}, ${WIDGET_SIZE}px)`;
    pageGrid.style.width = "100%";
    pageGrid.style.height = "100%";
  });

  pages.querySelectorAll(".widget-page").forEach((page) => {
    page.style.width = "100%";
    page.style.minWidth = "100%";
  });
}

function goToPage(nextIndex, smooth = true) {
  if (!pages) return;

  pageIndex = Math.max(0, Math.min(pageCount - 1, nextIndex));

  pages.scrollTo({
    left: pageIndex * pages.clientWidth,
    behavior: smooth ? "smooth" : "auto"
  });
}

function changePage(direction) {
  const nextIndex = pageIndex + Math.sign(direction);

  if (nextIndex !== pageIndex) {
    goToPage(nextIndex);
  }
}

function updatePageIndexFromScroll() {
  if (!pages || !pages.clientWidth) return;

  pageIndex = Math.max(
    0,
    Math.min(
      pageCount - 1,
      Math.round(pages.scrollLeft / pages.clientWidth)
    )
  );
}

function updateStage() {
  const metrics = getVirtualMetrics();
  const { mode, config } = metrics;
  const rect = viewport.getBoundingClientRect();

  const fitScale = Math.min(
    rect.width / config.width,
    rect.height / config.height
  );

  const scale = mode === "mobile"
    ? fitScale
    : Math.min(fitScale, config.visualScale);

  stage.dataset.mode = mode;
  stage.style.width = `${config.width}px`;
  stage.style.height = `${config.height}px`;
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;

  buildWidgetPages();
}

function handleWheel(event) {
  if (!pages || wheelLocked) return;

  const horizontal = Math.abs(event.deltaX);
  const vertical = Math.abs(event.deltaY);

  if (Math.max(horizontal, vertical) < 4) return;

  event.preventDefault();

  wheelLocked = true;
  changePage(horizontal > vertical && event.deltaX > 0 || vertical > horizontal && event.deltaY > 0 ? 1 : -1);

  window.setTimeout(() => {
    wheelLocked = false;
  }, 450);
}

function beginPageDrag(event) {
  if (!pages || event.button !== undefined && event.button !== 0) return;

  pageDragging = true;
  pagePointerId = event.pointerId;
  pageStartX = event.clientX;
  pageLastX = event.clientX;
  pageStartScrollLeft = pages.scrollLeft;
  pageDragDistance = 0;

  pages.setPointerCapture?.(event.pointerId);
  pages.style.scrollBehavior = "auto";
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
  if (!pageDragging) return;
  if (event.pointerId != null && event.pointerId !== pagePointerId) return;

  pageDragging = false;
  pages.releasePointerCapture?.(pagePointerId);
  pages.style.scrollBehavior = "smooth";

  if (Math.abs(pageDragDistance) >= DRAG_THRESHOLD) {
    changePage(pageDragDistance < 0 ? 1 : -1);
  } else {
    goToPage(pageIndex);
  }

  pagePointerId = null;
}

function setOpen(open) {
  shadeOpen = open;
  shade.classList.toggle("is-open", open);
  shade.setAttribute("aria-hidden", String(!open));
  backdrop.hidden = !open;
  shade.style.transform = open
    ? "translateY(0)"
    : "translateY(calc(-100% + 42px))";
  topBall.style.top = open ? "calc(100vh - 16px)" : "16px";
}

function beginShadeDrag(event) {
  shadeDragging = true;
  activePointerId = event.pointerId;
  pointerStartY = event.clientY;
  shadeStartY = shadeOpen ? 0 : -shade.offsetHeight + 42;
  shadeDragY = shadeStartY;

  [grabber, shade, topBall].forEach((element) => {
    element.classList.add("is-dragging");
  });

  event.preventDefault();
}

function moveShadeDrag(event) {
  if (!shadeDragging || event.pointerId !== activePointerId) return;

  shadeDragY = Math.max(
    -shade.offsetHeight + 42,
    Math.min(0, shadeStartY + event.clientY - pointerStartY)
  );

  shade.style.transition = "none";
  shade.style.transform = `translateY(${shadeDragY}px)`;

  const progress =
    (shadeDragY + shade.offsetHeight - 42) /
    (shade.offsetHeight - 42);

  topBall.style.top =
    `calc(16px + ${progress} * (100vh - 32px))`;

  event.preventDefault();
}

function endShadeDrag(event) {
  if (!shadeDragging) return;
  if (event.pointerId != null && event.pointerId !== activePointerId) return;

  const moved = event.clientY - pointerStartY;

  shadeDragging = false;
  activePointerId = null;

  [grabber, shade, topBall].forEach((element) => {
    element.classList.remove("is-dragging");
  });

  shade.style.transition = "";

  if (moved > 8) {
    setOpen(true);
  } else if (moved < -8) {
    setOpen(false);
  } else {
    setOpen(shadeOpen);
  }
}

pages?.addEventListener("wheel", handleWheel, { passive: false });
pages?.addEventListener("scroll", updatePageIndexFromScroll, { passive: true });

pages?.addEventListener("pointerdown", beginPageDrag);
pages?.addEventListener("pointermove", movePageDrag, { passive: false });
pages?.addEventListener("pointerup", endPageDrag);
pages?.addEventListener("pointercancel", endPageDrag);

[grabber, shade, topBall].forEach((element) => {
  element.addEventListener("pointerdown", beginShadeDrag);
});

document.addEventListener("pointermove", moveShadeDrag, { passive: false });
document.addEventListener("pointerup", endShadeDrag);
document.addEventListener("pointercancel", endShadeDrag);

topBall.addEventListener("click", () => {
  if (!shadeDragging) setOpen(!shadeOpen);
});

grabber.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setOpen(!shadeOpen);
  }
});

closeButton.addEventListener("click", () => setOpen(false));
backdrop.addEventListener("click", () => setOpen(false));

document.querySelectorAll("[data-toggle]").forEach((tile) => {
  tile.addEventListener("click", () => {
    tile.classList.toggle("is-active");

    const active = tile.classList.contains("is-active");
    const label = tile.querySelector("strong").textContent;

    tile.querySelector("small").textContent = active
      ? "Attivi"
      : "Disattivi";

    message.textContent =
      `${label}: ${active ? "attivato" : "disattivato"}`;
  });
});

document.querySelector("#settingsButton")?.addEventListener("click", () => {
  message.textContent = "Impostazioni: pannello dimostrativo";
});

let resizeTimer;

function handleResize() {
  window.clearTimeout(resizeTimer);

  resizeTimer = window.setTimeout(() => {
    pageIndex = 0;
    updateStage();
  }, 100);
}

window.addEventListener("resize", handleResize, { passive: true });
window.addEventListener("orientationchange", handleResize, { passive: true });

updateStage();
