// Removes the inline splash from index.html once the app is ready.
// The splash logo glides up and shrinks into the header logo's exact spot
// while the cream backdrop fades, so the mark seems to settle into place.

// Long enough for the full logo reveal plus a short hold on the finished mark.
const MIN_VISIBLE_MS = 2600;
const GLIDE_MS = 800;
let done = false;

export function hideSplash(): void {
  if (done) return;
  done = true;
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
  setTimeout(handoff, wait);
}

function handoff(): void {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const from = splash.querySelector<HTMLElement>(".splash-logo");
  const to = document.querySelector<HTMLElement>(".masthead .logo");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // No visible header logo (e.g. phone held upright): just fade out.
  if (!from || !to || reduced || to.getClientRects().length === 0) {
    splash.classList.add("leaving");
    setTimeout(() => splash.remove(), 650);
    return;
  }

  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  // On wide screens the page is zoomed (see "laptop scale" in index.css).
  // Positions come back in screen pixels, but a transform inside the zoomed
  // page gets zoomed again, so convert back or the logo overshoots.
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const dx = (b.left + b.width / 2 - (a.left + a.width / 2)) / zoom;
  const dy = (b.top + b.height / 2 - (a.top + a.height / 2)) / zoom;
  const scale = b.height / a.height;

  // Freeze the logo in its finished state (no reveal/shimmer mid-flight).
  from.style.animation = "none";
  from.style.clipPath = "none";
  from.style.background = "#3f1715";

  to.style.opacity = "0";
  splash.classList.add("handoff");
  requestAnimationFrame(() => {
    from.style.transition = `transform ${GLIDE_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
    from.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  });

  setTimeout(() => {
    to.style.transition = "none";
    to.style.opacity = "1";
    splash.remove();
    requestAnimationFrame(() => {
      to.style.transition = "";
    });
  }, GLIDE_MS + 40);
}
