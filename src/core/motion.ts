/**
 * Motion preference helpers.
 *
 * The global `prefers-reduced-motion` rule in globals.css only reaches CSS
 * animations and `scroll-behavior`. Scrolls started from script with
 * `behavior: 'smooth'` animate regardless, so they ask here first.
 */

const reducedMotionQuery =
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : window.matchMedia('(prefers-reduced-motion: reduce)');

export function prefersReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false;
}

/** `'smooth'` normally, `'auto'` for people who asked for less movement. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
