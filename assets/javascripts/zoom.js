// 正文里的 Mermaid 流程图和图片：点击放大，支持滚轮缩放、拖动平移、双击复位、Esc 关闭。
// Mermaid 图由主题渲染在 closed shadow root 里，无法复制 SVG，
// 所以放大时把原节点整体搬进浮层，关闭时再放回原位（SVG 是矢量，放大依然清晰）。
(function () {
  const SELECTOR = ".md-content .mermaid, .md-content article img";
  let overlay = null;
  let state = null;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "nv-zoom";
    overlay.innerHTML =
      '<div class="nv-zoom__stage"></div>' +
      '<div class="nv-zoom__bar">' +
      '<button type="button" data-act="out" title="缩小">−</button>' +
      '<span class="nv-zoom__pct">100%</span>' +
      '<button type="button" data-act="in" title="放大">+</button>' +
      '<button type="button" data-act="fit" title="适应窗口（双击图也可）">适应</button>' +
      '<button type="button" data-act="close" title="关闭（Esc）">✕</button>' +
      "</div>" +
      '<div class="nv-zoom__hint">滚轮缩放 · 拖动平移 · 双击复位 · Esc 关闭</div>';
    document.body.appendChild(overlay);

    const stage = overlay.querySelector(".nv-zoom__stage");
    overlay.querySelector(".nv-zoom__bar").addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (!act || !state) return;
      const r = stage.getBoundingClientRect();
      if (act === "in") zoomAt(1.25, r.width / 2, r.height / 2);
      if (act === "out") zoomAt(0.8, r.width / 2, r.height / 2);
      if (act === "fit") fit();
      if (act === "close") close();
    });
    stage.addEventListener("click", (e) => {
      // 只有在空白处按下、且没有拖动时才关闭（拖动用了 pointer capture，click 目标总是 stage）
      if (state?.downOnBg && !state.moved) close();
    });
    stage.addEventListener("wheel", (e) => {
      if (!state) return;
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    stage.addEventListener("dblclick", () => state && fit());

    stage.addEventListener("pointerdown", (e) => {
      if (!state || e.button !== 0) return;
      state.drag = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
      state.moved = false;
      state.downOnBg = e.target === stage;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (e) => {
      if (!state?.drag) return;
      const dx = e.clientX - state.drag.x, dy = e.clientY - state.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
      state.tx = state.drag.tx + dx;
      state.ty = state.drag.ty + dy;
      apply();
    });
    const end = () => {
      if (!state) return;
      state.drag = null;
      stage.classList.remove("is-dragging");
      setTimeout(() => state && (state.moved = false), 0);
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);

    document.addEventListener("keydown", (e) => {
      if (!state) return;
      if (e.key === "Escape") close();
      if (e.key === "+" || e.key === "=") overlay.querySelector('[data-act="in"]').click();
      if (e.key === "-") overlay.querySelector('[data-act="out"]').click();
      if (e.key === "0") fit();
    });
  }

  function apply() {
    state.node.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.s})`;
    overlay.querySelector(".nv-zoom__pct").textContent = Math.round(state.s * 100) + "%";
  }

  function fit() {
    const r = overlay.querySelector(".nv-zoom__stage").getBoundingClientRect();
    const s = Math.min((r.width * 0.94) / state.w, (r.height * 0.9) / state.h);
    state.s = Math.max(0.1, Math.min(s, 6));
    state.tx = (r.width - state.w * state.s) / 2;
    state.ty = (r.height - state.h * state.s) / 2;
    apply();
  }

  function zoomAt(k, cx, cy) {
    const s = Math.max(0.1, Math.min(state.s * k, 12));
    k = s / state.s;
    state.tx = cx - (cx - state.tx) * k;
    state.ty = cy - (cy - state.ty) * k;
    state.s = s;
    apply();
  }

  function open(el) {
    if (!overlay) build();
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const stage = overlay.querySelector(".nv-zoom__stage");
    let node, placeholder = null;

    if (el.tagName === "IMG") {
      node = new Image();
      node.src = el.currentSrc || el.src;
      node.alt = el.alt;
    } else {
      // 占位，保持正文排版不跳动，关闭时把原节点放回来
      placeholder = document.createElement("div");
      placeholder.style.height = rect.height + "px";
      el.replaceWith(placeholder);
      node = el;
    }
    node.classList.add("nv-zoom__item");
    node.style.width = rect.width + "px";
    node.style.height = rect.height + "px";
    stage.appendChild(node);

    state = { node, el, placeholder, w: rect.width, h: rect.height, s: 1, tx: 0, ty: 0 };
    overlay.classList.add("is-open");
    document.documentElement.classList.add("nv-zoom-lock");
    fit();
  }

  function close() {
    if (!state) return;
    const { node, placeholder } = state;
    node.classList.remove("nv-zoom__item");
    node.style.transform = node.style.width = node.style.height = "";
    if (placeholder) placeholder.replaceWith(node);
    else node.remove();
    state = null;
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("nv-zoom-lock");
  }

  // 事件委托：shadow DOM 内的点击会重定向到宿主 .mermaid，所以 closest 能命中
  document.addEventListener("click", (e) => {
    if (state || e.defaultPrevented || e.button !== 0) return;
    const el = e.target.closest?.(SELECTOR);
    if (!el || el.closest("a")) return;   // 带链接的图片保持原行为
    e.preventDefault();
    open(el);
  });

  // 给可放大元素加提示
  function mark() {
    document.querySelectorAll(SELECTOR).forEach((el) => {
      if (el.closest("a")) return;
      el.classList.add("nv-zoomable");
      el.title = el.title || "点击放大";
    });
  }
  if (window.document$) document$.subscribe(() => { close(); setTimeout(mark, 300); setTimeout(mark, 1500); });
  new MutationObserver(() => mark()).observe(document.documentElement, { childList: true, subtree: true });
})();
