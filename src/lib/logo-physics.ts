/**
 * Shared physics for the AutoLunex logo easter egg: clones an element into a
 * fixed-position layer, drops it with gravity, bounces it off the floor and
 * right wall, and lets the user grab it (1:1, respecting the grab offset) and
 * throw it — the sim continues at the pointer's release velocity. Used by the
 * rail logo (5-click trigger) and the About dialog flywheel escape.
 */

const GRAVITY = 2200;
const BOUNCE_DAMPING = 0.6;
const DEFAULT_HORIZONTAL_SPEED = 350;
const DEFAULT_SPIN_SPEED = 720;
const MIN_BOUNCE_VELOCITY = 60;

export interface LogoLaunchOptions {
  /** Initial horizontal velocity in px/s. Defaults to a rightward roll. */
  initialVX?: number;
  /** Initial vertical velocity in px/s (negative = upward). */
  initialVY?: number;
  /** Spin speed in deg/s. */
  spinSpeed?: number;
  /** Called once the clone has left the screen and been removed. */
  onExit?: () => void;
}

/**
 * Launch a physics clone of `el`. The source element is hidden (visibility)
 * and stays hidden — the caller decides when/if to restore it. Returns a
 * cancel function that removes the clone and stops the sim.
 */
export function launchLogoClone(
  el: HTMLElement,
  options: LogoLaunchOptions = {},
): () => void {
  // getBoundingClientRect measures the *transformed* box. A caller that rotates
  // the element before launching (the About dialog spins it up to escape
  // velocity) would otherwise hand us the rotated bounding box: ~37% too large
  // at 45°, with an offset origin — so the clone jumps at launch and bounces off
  // the floor and walls early. Suppress the transform for the measurement to get
  // the layout box, then put it back.
  const previousTransform = el.style.transform;
  if (previousTransform) {
    el.style.transform = "none";
  }
  const rect = el.getBoundingClientRect();
  if (previousTransform) {
    el.style.transform = previousTransform;
  }
  const startX = rect.left;
  const startY = rect.top;

  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.left = `${startX}px`;
  clone.style.top = `${startY}px`;
  clone.style.zIndex = "9999";
  clone.style.margin = "0";
  // The fallen logo is interactive: it can be grabbed 1:1 and thrown, inheriting
  // the pointer's release velocity.
  clone.style.pointerEvents = "auto";
  clone.style.cursor = "grab";
  clone.style.userSelect = "none";
  document.body.appendChild(clone);

  let x = startX;
  let y = startY;
  let vx = options.initialVX ?? DEFAULT_HORIZONTAL_SPEED;
  let vy = options.initialVY ?? 0;
  let angle = 0;
  let spin = options.spinSpeed ?? DEFAULT_SPIN_SPEED;
  let lastTime: number | null = null;
  let animId = 0;
  let settled = false;

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerTime = 0;
  let pointerVX = 0;
  let pointerVY = 0;

  const onPointerDown = (e: PointerEvent) => {
    isDragging = true;
    settled = false;
    clone.style.cursor = "grabbing";
    clone.setPointerCapture(e.pointerId);

    // Respect where the logo was grabbed — no snap to center.
    dragOffsetX = e.clientX - x;
    dragOffsetY = e.clientY - y;

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = performance.now();
    pointerVX = 0;
    pointerVY = 0;
    vx = 0;
    vy = 0;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const now = performance.now();
    const dt = Math.max((now - lastPointerTime) / 1000, 0.001);

    // Exponential moving average for release velocity (smooths noise).
    const instVX = (e.clientX - lastPointerX) / dt;
    const instVY = (e.clientY - lastPointerY) / dt;
    pointerVX = pointerVX * 0.4 + instVX * 0.6;
    pointerVY = pointerVY * 0.4 + instVY * 0.6;

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = now;

    x = e.clientX - dragOffsetX;
    y = e.clientY - dragOffsetY;
    clone.style.left = `${x}px`;
    clone.style.top = `${y}px`;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    clone.style.cursor = "grab";
    try {
      clone.releasePointerCapture(e.pointerId);
    } catch {
      // Element might be detached.
    }

    // Release velocity carries into physics. A quick flick from the user
    // throws the logo instead of dropping it.
    vx = pointerVX;
    vy = pointerVY;
    // Tangential speed induces spin (rolls along floor / off walls).
    spin = vx * 1.5;
    lastTime = null;
  };

  clone.addEventListener("pointerdown", onPointerDown);
  clone.addEventListener("pointermove", onPointerMove);
  clone.addEventListener("pointerup", onPointerUp);
  clone.addEventListener("pointercancel", onPointerUp);

  const cleanup = () => {
    cancelAnimationFrame(animId);
    clone.removeEventListener("pointerdown", onPointerDown);
    clone.removeEventListener("pointermove", onPointerMove);
    clone.removeEventListener("pointerup", onPointerUp);
    clone.removeEventListener("pointercancel", onPointerUp);
    clone.remove();
  };

  const step = (now: number) => {
    if (lastTime === null) {
      lastTime = now;
      animId = requestAnimationFrame(step);
      return;
    }
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (isDragging) {
      animId = requestAnimationFrame(step);
      return;
    }

    const floor = window.innerHeight - rect.height;
    const rightWall = window.innerWidth - rect.width;

    if (!settled) {
      vy += GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      angle += spin * dt;

      // Floor bounce.
      if (y >= floor) {
        y = floor;
        if (Math.abs(vy) < MIN_BOUNCE_VELOCITY) {
          vy = 0;
          if (Math.abs(vx) < 10) {
            settled = true;
          }
        } else {
          vy = -vy * BOUNCE_DAMPING;
        }
        // Rolling friction.
        vx *= 0.98;
        spin = vx * 2;
        // A logo dropped with no sideways speed would hop in place forever —
        // give it a tiny bias to roll toward the side.
        if (Math.abs(vx) < 1 && !settled) {
          vx = DEFAULT_HORIZONTAL_SPEED * 0.4;
        }
      }

      // Walls: bounce off the right wall (with less energy than the floor, heavy
      // damping), and keep rolling. Left wall has no bounce — the logo
      // launched rightward, so if it reaches the left it was thrown there,
      // let it exit and clean up.
      if (x >= rightWall) {
        x = rightWall;
        vx = -Math.abs(vx) * 0.4;
        spin = -spin * 0.5;
      }
    } else {
      // Settled: slow drift to the right so it doesn't linger forever.
      x += 40 * dt;
      angle += 60 * dt;
    }

    clone.style.left = `${x}px`;
    clone.style.top = `${y}px`;
    clone.style.transform = `rotate(${angle}deg)`;

    // Clean up once it rolls off-screen entirely.
    if (x > window.innerWidth + 100 || x < -rect.width - 100) {
      cleanup();
      options.onExit?.();
      return;
    }

    animId = requestAnimationFrame(step);
  };

  animId = requestAnimationFrame(step);

  return cleanup;
}
