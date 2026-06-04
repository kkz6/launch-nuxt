// Reset the page-header breadcrumbs before every navigation so a page that
// declares none shows an empty bar (rather than the previous page's trail).
// Pages set their own crumbs in setup, which runs after this guard.
export default defineNuxtPlugin(() => {
  const router = useRouter();
  const crumbs = usePageBreadcrumbs();

  router.beforeEach(() => {
    crumbs.value = null;
  });
});
