export interface PageCrumb {
  label: string;
  to?: string;
}

// Shared state for the persistent page-header bar (components/layout/PageHeader).
// A page declares its breadcrumb trail in setup via `setBreadcrumbs([...])`;
// the bar renders it without animating, because it lives in the layout rather
// than inside the page-transition slot. The plugins/page-header plugin clears
// this on every navigation, so a page that sets nothing shows no bar.
export const usePageBreadcrumbs = () =>
  useState<PageCrumb[] | null>("page:breadcrumbs", () => null);

export function setBreadcrumbs(crumbs: PageCrumb[] | null): void {
  usePageBreadcrumbs().value = crumbs;
}
