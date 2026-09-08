// The "return to menu" half of the menu↔page boundary toggle — reused by
// every page's onBoundaryLeft. Finds the sidebar link for whatever route
// we're already on and focuses it; relies on AppNav's aria-label and the
// fact each nav item renders as a real <a href>.
export function focusCurrentNavLink() {
  document
    .querySelector<HTMLAnchorElement>(
      `nav[aria-label="Main navigation"] a[href="${window.location.pathname}"]`,
    )
    ?.focus();
}
