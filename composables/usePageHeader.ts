export interface PageCrumb {
  label: string;
  to?: string;
}

// Route-scoped breadcrumb state for the persistent page-header bar
// (components/layout/PageHeader). A page sets its trail in setup via
// `setBreadcrumbs([...])`; the value is tagged with the route it belongs to, so
// the header only renders it on that route. This means navigating to a page
// that sets no breadcrumbs simply hides the bar — without nulling state on
// every navigation, which is what caused the breadcrumb to flicker.
export const usePageBreadcrumbState = () =>
  useState<{ path: string; crumbs: PageCrumb[] } | null>(
    "page:breadcrumbs",
    () => null,
  );

export function setBreadcrumbs(crumbs: PageCrumb[]): void {
  const path = useRouter().currentRoute.value.path;
  usePageBreadcrumbState().value = { path, crumbs };
}
