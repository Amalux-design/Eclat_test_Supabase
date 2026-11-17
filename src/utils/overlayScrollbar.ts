/**
 * Floating scrollbar for the whole app (like macOS / iOS): a slim bar drawn
 * over whatever is scrolling (page, sheet, form, calendar column) that fades
 * out after scrolling stops. Takes no layout space; native bars are hidden in
 * index.css. Vertical scrolling only; purely visual (not draggable).
 */
export function installOverlayScrollbar(): void {
  if (typeof document === "undefined" || document.getElementById("ov-thumb")) return;
  const thumb = document.createElement("div");
  thumb.id = "ov-thumb";
  thumb.setAttribute("aria-hidden", "true");
  // On <html>, outside <body>, so the laptop zoom doesn't scale it twice.
  document.documentElement.appendChild(thumb);
  let hide = 0;

  const update = (target: EventTarget | null) => {
    const el =
      target === document || target === document.documentElement || target === document.body
        ? (document.scrollingElement as HTMLElement)
        : (target as HTMLElement);
    if (!el || !(el instanceof HTMLElement)) return;
    const { scrollHeight: sh, clientHeight: ch, scrollTop: st } = el;
    if (sh <= ch + 1) return;
    const isPage = el === document.scrollingElement;
    const r = isPage
      ? { top: 0, right: window.innerWidth, height: window.innerHeight }
      : (() => {
          const b = el.getBoundingClientRect();
          return { top: b.top, right: b.right, height: b.height };
        })();
    const h = Math.max(32, (r.height * ch) / sh);
    const y = r.top + (st / (sh - ch)) * (r.height - h);
    thumb.style.height = `${h - 8}px`;
    thumb.style.transform = `translate(${r.right - 7}px, ${y + 4}px)`;
    thumb.classList.add("on");
    window.clearTimeout(hide);
    hide = window.setTimeout(() => thumb.classList.remove("on"), 900);
  };

  // At most one layout read/write per frame, however many scroll events fire.
  let pending: EventTarget | null = null;
  let frame = 0;
  document.addEventListener(
    "scroll",
    (e) => {
      pending = e.target;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update(pending);
      });
    },
    { capture: true, passive: true }
  );
}
