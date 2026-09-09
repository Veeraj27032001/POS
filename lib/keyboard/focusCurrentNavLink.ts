// The "return to menu" half of the menu↔page boundary toggle — reused by
// every page's onBoundaryLeft. Finds the sidebar link for whatever route
// we're already on and focuses it; relies on AppNav's aria-label and the
// fact each nav item renders as a real <a href>.
//
// A detail/nested route (e.g. /bills/abc123, /bills/abc123/return) never
// exactly equals a nav link's href — those always point at the list page
// (/bills). So beyond an exact match, also accept a nav link whose href is
// a path-prefix of the current URL, picking the longest such match so a
// more specific nav entry always wins over a shorter, unrelated prefix.
export function focusCurrentNavLink() {
  const path = window.location.pathname;
  const links = document.querySelectorAll<HTMLAnchorElement>(
    'nav[aria-label="Main navigation"] a[href]',
  );

  let best: HTMLAnchorElement | null = null;
  let bestLength = -1;
  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) continue;
    const matches = href === path || path.startsWith(`${href}/`);
    if (matches && href.length > bestLength) {
      best = link;
      bestLength = href.length;
    }
  }
  best?.focus();
}
