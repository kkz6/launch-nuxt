<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  ChevronDown,
  LogOut,
  Settings,
  Shield,
  Sun,
  Moon,
  Monitor,
  Server,
  Globe,
  Terminal,
} from "lucide-vue-next";
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Deployment } from "~/types";
import type { LocalePreference } from "~/types/locale";
import { isLocalePreference } from "~/utils/locale";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

const { t } = useI18n();
const navLabel = (key: string) => t(`common.navigation.${key}`);
const actionLabel = (key: string) => t(`common.actions.${key}`);
const { user, logout, updateLocale } = useAuth();
const { localePreference, setLocalePreference } = useLocalePreference();
// Role gating — hide create/mutate actions for read-only members.
const { canEdit, canDelete } = useCan();
const { open: openSettingsSheet } = useSettingsSheet();
const colorMode = useColorMode();
const route = useRoute();

// Staff (support/super_admin) get the Admin Panel entry + the back-office
// context row. The menu item flips to "Back to App" once inside /admin.
const isStaff = computed(
  () =>
    user.value?.staff_role === "support" ||
    user.value?.staff_role === "super_admin",
);
const showAdminContext = computed(() => route.path.startsWith("/admin"));
const adminBreadcrumbState = usePageBreadcrumbState();
const adminCrumbs = computed(() =>
  adminBreadcrumbState.value?.path === route.path
    ? adminBreadcrumbState.value.crumbs
    : [],
);
interface AdminTab {
  label: string;
  to: string;
  icon: string;
  match?: (path: string) => boolean;
}

const adminTabs = computed<AdminTab[]>(() => [
  {
    label: navLabel("overview"),
    to: "/admin/overview",
    icon: "lucide:bar-chart-3",
  },
  {
    label: navLabel("users"),
    to: "/admin",
    icon: "lucide:users",
    match: (p: string) => p === "/admin" || p.startsWith("/admin/users"),
  },
  {
    label: navLabel("invitations"),
    to: "/admin/invitations",
    icon: "lucide:mail",
  },
  {
    label: navLabel("servers"),
    to: "/admin/servers",
    icon: "lucide:server",
  },
  {
    label: navLabel("failures"),
    to: "/admin/failures",
    icon: "lucide:triangle-alert",
  },
  {
    label: navLabel("observability"),
    to: "/admin/observability",
    icon: "lucide:activity",
  },
]);
const isAdminTabActive = (tab: AdminTab): boolean =>
  tab.match ? tab.match(route.path) : route.path.startsWith(tab.to);

// Check if current team is subscribed
const isSubscribed = computed(
  () => user.value?.current_team?.is_subscribed ?? true,
);

// Global navigation tabs
const globalTabsBase = computed(() => [
  {
    value: "dashboard",
    label: navLabel("dashboard"),
    route: "/dashboard",
    icon: "lucide:layout-dashboard",
  },
  {
    value: "servers",
    label: navLabel("servers"),
    route: "/servers",
    icon: "lucide:server",
  },
  {
    value: "domains",
    label: navLabel("domains"),
    route: "/dns",
    icon: "lucide:globe",
  },
  {
    value: "scripts",
    label: navLabel("scripts"),
    route: "/scripts",
    icon: "lucide:scroll-text",
  },
]);

// Track if component is mounted (client-side)
const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});

const globalTabs = computed(() => {
  // On server-side, always return base tabs to avoid hydration mismatch
  if (!isMounted.value) {
    return globalTabsBase.value;
  }

  // If not subscribed, only show dashboard
  if (!isSubscribed.value) {
    return [
      {
        value: "dashboard",
        label: navLabel("dashboard"),
        route: "/dashboard",
        icon: "lucide:layout-dashboard",
      },
    ];
  }

  if (!user.value?.onboarded) {
    return [
      {
        value: "onboarding",
        label: navLabel("onboarding"),
        route: "/onboarding",
        icon: "lucide:rocket",
      },
      ...globalTabsBase.value,
    ];
  }
  return globalTabsBase.value;
});

// Tab indicator animation
const globalNavRef = ref<HTMLElement | null>(null);
const tabRefs = ref<Map<string, HTMLElement>>(new Map());
const indicatorLeft = ref(0);
const indicatorWidth = ref(0);

const setTabRef = (key: string, el: unknown) => {
  if (el) {
    tabRefs.value.set(
      key,
      (el as { $el: HTMLElement }).$el || (el as HTMLElement),
    );
  }
};

const updateIndicator = () => {
  if (!showGlobalTabs.value) {
    indicatorWidth.value = 0;
    return;
  }
  const currentPath = route.path.replace(/\/$/, "");
  const activeTab = globalTabs.value.find((tab) => {
    return currentPath === tab.route || currentPath.startsWith(`${tab.route}/`);
  });

  if (activeTab && tabRefs.value.has(activeTab.value)) {
    const tabEl = tabRefs.value.get(activeTab.value);
    if (tabEl && globalNavRef.value) {
      const navRect = globalNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      indicatorLeft.value = tabRect.left - navRect.left;
      indicatorWidth.value = tabRect.width;
    }
  } else {
    indicatorWidth.value = 0;
  }
};

watch(
  () => route.path,
  () => {
    nextTick(updateIndicator);
  },
  { immediate: true },
);

onMounted(() => {
  nextTick(updateIndicator);
});

// Server tabs indicator
const serverNavRef = ref<HTMLElement | null>(null);
const serverTabRefs = ref<Map<string, HTMLElement>>(new Map());
const serverIndicatorLeft = ref(0);
const serverIndicatorWidth = ref(0);

const setServerTabRef = (key: string, el: unknown) => {
  if (el) {
    serverTabRefs.value.set(
      key,
      (el as { $el: HTMLElement }).$el || (el as HTMLElement),
    );
  }
};

const updateServerIndicator = () => {
  if (!showServerTabs.value) {
    serverIndicatorWidth.value = 0;
    return;
  }
  // Default to whichever tab the active server type lists first. Docker
  // servers default to "projects", load-balancers to "upstreams", PHP to
  // "sites" — driven entirely by useServerTypeRules.
  const defaultTab = serverDetailTabs.value[0]?.value ?? "sites";
  const currentTab = (route.query.tab as string) || defaultTab;
  if (serverTabRefs.value.has(currentTab)) {
    const tabEl = serverTabRefs.value.get(currentTab);
    if (tabEl && serverNavRef.value) {
      const navRect = serverNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      serverIndicatorLeft.value = tabRect.left - navRect.left;
      serverIndicatorWidth.value = tabRect.width;
    }
  } else {
    serverIndicatorWidth.value = 0;
  }
};

// Site tabs indicator
const siteNavRef = ref<HTMLElement | null>(null);
const siteTabRefs = ref<Map<string, HTMLElement>>(new Map());
const siteIndicatorLeft = ref(0);
const siteIndicatorWidth = ref(0);

const setSiteTabRef = (key: string, el: unknown) => {
  if (el) {
    siteTabRefs.value.set(
      key,
      (el as { $el: HTMLElement }).$el || (el as HTMLElement),
    );
  }
};

const updateSiteIndicator = () => {
  if (!showSiteTabs.value) {
    siteIndicatorWidth.value = 0;
    return;
  }
  const currentTab = (route.query.tab as string) || "general";
  if (siteTabRefs.value.has(currentTab)) {
    const tabEl = siteTabRefs.value.get(currentTab);
    if (tabEl && siteNavRef.value) {
      const navRect = siteNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      siteIndicatorLeft.value = tabRect.left - navRect.left;
      siteIndicatorWidth.value = tabRect.width;
    }
  } else {
    siteIndicatorWidth.value = 0;
  }
};

// Project tabs indicator — same shape as siteTabRefs.
const projectNavRef = ref<HTMLElement | null>(null);
const projectTabRefs = ref<Map<string, HTMLElement>>(new Map());
const projectIndicatorLeft = ref(0);
const projectIndicatorWidth = ref(0);

const setProjectTabRef = (key: string, el: unknown) => {
  if (el) {
    projectTabRefs.value.set(
      key,
      (el as { $el: HTMLElement }).$el || (el as HTMLElement),
    );
  }
};

const updateProjectIndicator = () => {
  if (!showProjectTabs.value) {
    projectIndicatorWidth.value = 0;
    return;
  }
  const currentTab = (route.query.tab as string) || "overview";
  if (projectTabRefs.value.has(currentTab)) {
    const tabEl = projectTabRefs.value.get(currentTab);
    if (tabEl && projectNavRef.value) {
      const navRect = projectNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      projectIndicatorLeft.value = tabRect.left - navRect.left;
      projectIndicatorWidth.value = tabRect.width;
    }
  } else {
    projectIndicatorWidth.value = 0;
  }
};

// Workload (database / application / compose) subtab nav renders
// through LayoutTabStrip, which owns the sliding-underline indicator
// (see workloadActiveSubtab below).

// Advanced sub-tabs indicator
const advancedNavRef = ref<HTMLElement | null>(null);
const advancedTabRefs = ref<Map<string, HTMLElement>>(new Map());
const advancedIndicatorLeft = ref(0);
const advancedIndicatorWidth = ref(0);

const setAdvancedTabRef = (key: string, el: unknown) => {
  if (el) {
    advancedTabRefs.value.set(
      key,
      (el as { $el: HTMLElement }).$el || (el as HTMLElement),
    );
  }
};

const updateAdvancedIndicator = () => {
  if (!isAdvancedTabActive.value) {
    advancedIndicatorWidth.value = 0;
    return;
  }
  const currentSubTab = (route.query.subtab as string) || "general";
  if (advancedTabRefs.value.has(currentSubTab)) {
    const tabEl = advancedTabRefs.value.get(currentSubTab);
    if (tabEl && advancedNavRef.value) {
      const navRect = advancedNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      advancedIndicatorLeft.value = tabRect.left - navRect.left;
      advancedIndicatorWidth.value = tabRect.width;
    }
  } else {
    advancedIndicatorWidth.value = 0;
  }
};

// Watch for route changes to update all indicators
watch(
  [() => route.path, () => route.query.tab, () => route.query.subtab],
  () => {
    nextTick(() => {
      updateServerIndicator();
      updateSiteIndicator();
      updateProjectIndicator();
      updateAdvancedIndicator();
    });
  },
  { immediate: true },
);

// Server detail tabs — driven by useServerTypeRules so adding a new server
// type doesn't require touching this file. Keeps the loadbalancer/docker
// branches out of the navbar render path. The "isLoadBalancerServer"
// derived ref is kept for the advanced sub-tabs block below, which still
// filters by type until that block is similarly composable-driven.
const isLoadBalancerServer = computed(
  () => serverType.value === "loadbalancer",
);
const isDockerServer = computed(() => serverType.value === "docker");

const serverDetailTabs = computed(() =>
  getServerTypeRules(serverType.value).tabs.map((tab) => ({
    ...tab,
    label: navLabel(tab.value),
  })),
);

// Advanced sub-tabs (second level) - filtered by server type.
// - Load balancers: no backups (no app data) and no packages tab (the host
//   stack is minimal Caddy).
// - Docker servers: same exclusions. Backups belong inside individual
//   docker workloads, not the host. Packages aren't user-managed.
const advancedSubTabs = computed(() => {
  const isHostManaged = !isLoadBalancerServer.value && !isDockerServer.value;
  const tabs = [
    {
      value: "general",
      label: navLabel("general"),
      query: "general",
      icon: "lucide:info",
    },
  ];
  if (isHostManaged) {
    tabs.push({
      value: "backups",
      label: navLabel("backups"),
      query: "backups",
      icon: "lucide:hard-drive",
    });
  }
  tabs.push({
    value: "ssh-keys",
    label: navLabel("sshKeys"),
    query: "ssh-keys",
    icon: "lucide:key",
  });
  if (isHostManaged) {
    tabs.push({
      value: "packages",
      label: navLabel("packages"),
      query: "packages",
      icon: "lucide:package",
    });
  }
  tabs.push({
    value: "services",
    label: navLabel("services"),
    query: "services",
    icon: "lucide:cog",
  });
  // Docker-only: Traefik config editing sits under Advanced rather than
  // as a top-level tab — admins occasionally inspect it, but it's not a
  // day-to-day workflow.
  if (isDockerServer.value) {
    tabs.push({
      value: "traefik",
      label: navLabel("traefik"),
      query: "traefik",
      icon: "simple-icons:traefikproxy",
    });
    // Maintenance — orphaned-resource cleanup + future host-level
    // maintenance actions. Buried under Advanced (not a top-level tab)
    // because most users will never need it: the label-based teardown
    // means new compose deletes don't strand containers anymore.
    tabs.push({
      value: "maintenance",
      label: navLabel("maintenance"),
      query: "maintenance",
      icon: "lucide:wrench",
    });
  }
  return tabs;
});

// Site detail tabs (base - filtered based on site type)
const allSiteDetailTabs = computed(() => [
  {
    value: "general",
    label: navLabel("overview"),
    query: "general",
    icon: "lucide:layout-dashboard",
  },
  {
    value: "deployments",
    label: navLabel("deployments"),
    query: "deployments",
    icon: "lucide:git-branch",
  },
  {
    value: "files",
    label: navLabel("files"),
    query: "files",
    icon: "lucide:folder-open",
  },
  {
    value: "queues",
    label: navLabel("queues"),
    query: "queues",
    icon: "lucide:list-todo",
  },
  {
    value: "redirects",
    label: navLabel("redirects"),
    query: "redirects",
    icon: "lucide:corner-up-right",
  },
  {
    value: "commands",
    label: navLabel("commands"),
    query: "commands",
    icon: "lucide:terminal-square",
  },
  {
    value: "settings",
    label: navLabel("settings"),
    query: "settings",
    icon: "lucide:settings",
  },
]);

// DNS domain detail tabs
const dnsDetailTabs = computed(() => [
  { value: "records", label: navLabel("records"), path: "" },
  { value: "settings", label: navLabel("settings"), path: "/settings" },
]);

// Check if we're on a server detail page
const isServerDetailPage = computed(() => {
  const match = route.path.match(/^\/servers\/([^/]+)$/);
  return match && match[1] !== "create";
});

// Check if we're on a site detail page
const isSiteDetailPage = computed(() => {
  const match = route.path.match(/^\/servers\/([^/]+)\/sites\/([^/]+)$/);
  return match !== null;
});

// Project detail page — exact match on /servers/:id/projects/:projectId
// (no deeper segments). The workload detail pages live one level
// further down (applications/composes/databases) and have their own
// breadcrumb block below.
const isProjectDetailPage = computed(() => {
  return route.path.match(/^\/servers\/([^/]+)\/projects\/([^/]+)$/) !== null;
});

// Workload detail pages — /servers/:id/projects/:p/(databases|applications|composes)/:w
// The navbar renders a breadcrumb trail (Servers / server / project /
// workload) on these so the user doesn't need an inline "Back to
// project" link on the page itself.
const workloadDetailMatch = computed(() => {
  return route.path.match(
    /^\/servers\/([^/]+)\/projects\/([^/]+)\/(databases|applications|composes)\/([^/]+)$/,
  );
});
const isWorkloadDetailPage = computed(() => workloadDetailMatch.value !== null);
const workloadKind = computed<"database" | "application" | "compose" | null>(
  () => {
    const m = workloadDetailMatch.value;
    if (!m) return null;
    if (m[3] === "databases") return "database";
    if (m[3] === "applications") return "application";
    return "compose";
  },
);
const workloadId = computed(() => {
  const m = workloadDetailMatch.value;
  return m ? m[4] : null;
});
const workloadKindLabel = computed(() => {
  switch (workloadKind.value) {
    case "database":
      return navLabel("database");
    case "application":
      return navLabel("application");
    case "compose":
      return navLabel("composeStack");
    default:
      return "";
  }
});
const workloadKindIcon = computed(() => {
  // Databases get the engine-specific brand icon so the breadcrumb
  // reads like a per-engine product entry (Postgres logo, MySQL
  // dolphin, etc.) rather than the generic database glyph. Apps and
  // composes use their kind icon.
  //
  // While the workload fetch is in flight, `workloadEngine` is still
  // null. Return an empty string here so the template hides the icon
  // (via v-if) instead of falling through to the generic
  // `lucide:database` glyph for ~200ms — that flicker is what made
  // the breadcrumb seem to pick a random icon between renders.
  if (workloadKind.value === "database") {
    switch (workloadEngine.value) {
      case "postgres":
        return "simple-icons:postgresql";
      case "mysql":
        return "simple-icons:mysql";
      case "mariadb":
        return "simple-icons:mariadb";
      case "redis":
        return "simple-icons:redis";
      case "mongo":
        return "simple-icons:mongodb";
      default:
        return "";
    }
  }
  if (workloadKind.value === "application") return "lucide:box";
  if (workloadKind.value === "compose") return "lucide:layers";
  return "lucide:circle";
});

// Per-engine icon tint so the breadcrumb's last segment carries a
// little brand colour — postgres = sky, mysql/mariadb = amber, etc.
const workloadKindIconColor = computed(() => {
  if (workloadKind.value !== "database") return "text-muted-foreground";
  switch (workloadEngine.value) {
    case "postgres":
      return "text-sky-500";
    case "mysql":
    case "mariadb":
      return "text-amber-500";
    case "redis":
      return "text-rose-500";
    case "mongo":
      return "text-emerald-500";
    default:
      return "text-muted-foreground";
  }
});

const workloadStatusBadgeClass = computed(() => {
  switch (workloadStatus.value) {
    case "running":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "building":
    case "idle":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "stopped":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    default:
      return "";
  }
});

// Single-dot variant of the status indicator. Same colour ramp as the
// pill badge above, used in the breadcrumb so the visual weight stays
// low — same pattern the project breadcrumb uses for server
// connection state.
const workloadStatusDotClass = computed(() => {
  switch (workloadStatus.value) {
    case "running":
      return "bg-emerald-500";
    case "building":
    case "idle":
      return "bg-amber-500 animate-pulse";
    case "failed":
      return "bg-rose-500";
    case "stopped":
      return "bg-zinc-400";
    default:
      return "bg-muted";
  }
});

// Engine version + port info used to live in a breadcrumb subtitle
// but the two-line layout felt heavy. Engine version is shown on the
// General tab info-card grid; the breadcrumb stays single-line.
const workloadParentTab = computed(() => {
  switch (workloadKind.value) {
    case "database":
      return "databases";
    case "application":
      return "applications";
    case "compose":
      return "compose";
    default:
      return "overview";
  }
});

// Subtabs per workload kind. Mirrors the existing per-page SUBTABS
// arrays so a refactor here keeps the navbar + page in sync. The
// `query` value matches the `?subtab=` URL param the pages already
// read on mount.
// Workload subtabs share a canonical order across all three types:
//
//   1. General      — overview / identity
//   2. Deployments  — recent activity (high-frequency; app + compose only)
//   3. Environment  — runtime config
//   4. Domains      — public access (app + compose)
//   5. Redirects    — extends Domains (app only)
//   6. Volumes      — persistence (app + compose)
//   7. Schedules    — cron (app only)
//   8. Backups      — periodic dumps (database only)
//   9. Logs         — observability (always late so config is in front)
//   10. Advanced    — settings + danger zone (always last)
//
// Each list below is a sparse view of this canonical sequence —
// keep them in the same relative order whenever a tab is added so
// the three detail pages don't drift again.

const databaseSubTabs = computed(() => [
  {
    value: "general",
    label: navLabel("general"),
    query: "general",
    icon: "lucide:info",
  },
  {
    value: "environment",
    label: navLabel("environment"),
    query: "environment",
    icon: "lucide:key",
  },
  {
    value: "backups",
    label: navLabel("backups"),
    query: "backups",
    icon: "lucide:hard-drive",
  },
  {
    value: "logs",
    label: navLabel("logs"),
    query: "logs",
    icon: "lucide:scroll",
  },
  {
    value: "advanced",
    label: navLabel("advanced"),
    query: "advanced",
    icon: "lucide:sliders-horizontal",
  },
]);
// `gha` only renders when this specific workload is build_location=
// github_actions. See workloadSubTabs below for the conditional —
// keeping the canonical order here means the filter doesn't have to
// reorder when it adds the tab in.
const applicationSubTabs = computed(() => [
  {
    value: "general",
    label: navLabel("overview"),
    query: "general",
    icon: "lucide:layout-dashboard",
  },
  {
    value: "deployments",
    label: navLabel("deployments"),
    query: "deployments",
    icon: "lucide:git-branch",
  },
  {
    value: "environment",
    label: navLabel("environment"),
    query: "environment",
    icon: "lucide:key",
  },
  {
    value: "domains",
    label: navLabel("domains"),
    query: "domains",
    icon: "lucide:globe",
  },
  {
    value: "redirects",
    label: navLabel("redirects"),
    query: "redirects",
    icon: "lucide:corner-up-right",
  },
  {
    value: "schedules",
    label: navLabel("schedulers"),
    query: "schedules",
    icon: "lucide:clock",
  },
  // Logs moved into the Actions dropdown (see the application Actions
  // menu) so the tab strip stays focused on configuration. The
  // ?subtab=logs route still renders the log viewer.
  {
    value: "advanced",
    label: navLabel("advanced"),
    query: "advanced",
    icon: "lucide:sliders-horizontal",
  },
]);
// Compose subtabs mirror the application tabs where they make sense
// at the stack level. Skipped:
//   - Domains / Redirects → per-service config, lives in the YAML
//   - Schedulers           → per-container; needs a service selector
// Logs has a service selector inside the component so the user can
// pick which container's stdout to stream when the stack has more
// than one service.
//
// Volumes is included even though compose stacks declare mounts in
// the YAML — the same surface as applications, but bind/volume rows
// are tracking-only (operator wires them into YAML) and file rows
// are materialized under `${STACK_DIR}/files/` before deploy.
// Already in the canonical order (see top-of-file comment). Compose
// skips Redirects (per-service / lives in YAML), Schedules (per-
// container, needs a service selector) and Backups (database only).
const composeSubTabs = computed(() => [
  {
    value: "general",
    label: navLabel("general"),
    query: "general",
    icon: "lucide:info",
  },
  {
    value: "deployments",
    label: navLabel("deployments"),
    query: "deployments",
    icon: "lucide:git-branch",
  },
  {
    value: "environment",
    label: navLabel("environment"),
    query: "environment",
    icon: "lucide:key",
  },
  {
    value: "domains",
    label: navLabel("domains"),
    query: "domains",
    icon: "lucide:globe",
  },
  {
    value: "volumes",
    label: navLabel("volumes"),
    query: "volumes",
    icon: "lucide:hard-drive",
  },
  {
    value: "gha",
    label: navLabel("githubActions"),
    query: "gha",
    icon: "simple-icons:github",
  },
  {
    value: "logs",
    label: navLabel("logs"),
    query: "logs",
    icon: "lucide:scroll",
  },
  {
    value: "advanced",
    label: navLabel("advanced"),
    query: "advanced",
    icon: "lucide:sliders-horizontal",
  },
]);
const workloadSubTabs = computed(() => {
  switch (workloadKind.value) {
    case "database":
      // Redis is the one engine where backups don't apply — it's an
      // in-memory store, the dump tools simply don't exist for it.
      // Hide the tab so we don't dangle a non-functional surface.
      if (workloadEngine.value === "redis") {
        return databaseSubTabs.value.filter((t) => t.value !== "backups");
      }
      return databaseSubTabs.value;
    case "application":
      // GitHub Actions settings moved into the Advanced tab (shown
      // there only for github_actions builds), so there's no longer a
      // GHA subtab to conditionally hide here.
      return applicationSubTabs.value;
    case "compose":
      if (workloadBuildLocation.value !== "github_actions") {
        return composeSubTabs.value.filter((t) => t.value !== "gha");
      }
      return composeSubTabs.value;
    default:
      return [];
  }
});

// The active workload subtab is the URL identifier. Each subtab's
// `value` equals its `query`, so LayoutTabStrip matches activeKey
// against tab.value directly.
const workloadActiveSubtab = computed(
  () => (route.query.subtab as string) || "general",
);

// Docker application Advanced sub-tabs. Rendered here in the navbar
// (not the page body) so they sit tight under the workload tabs like
// the PHP server Advanced tab. URL-driven via ?section=… ; these values
// must mirror the section v-show keys in
// components/application/Advanced.vue and its GHA/Danger gating.
const applicationAdvancedSubTabs = computed(() => {
  const tabs = [
    { value: "general", label: navLabel("general"), icon: "lucide:tag" },
    {
      value: "runtime",
      label: navLabel("runtime"),
      icon: "lucide:sliders-horizontal",
    },
    {
      value: "volumes",
      label: navLabel("volumes"),
      icon: "lucide:hard-drive",
    },
  ];
  if (workloadBuildLocation.value === "github_actions") {
    tabs.push({
      value: "build",
      label: navLabel("githubActions"),
      icon: "simple-icons:github",
    });
  }
  tabs.push({
    value: "proxy",
    label: navLabel("traefik"),
    icon: "simple-icons:traefikproxy",
  });
  if (canDelete.value) {
    tabs.push({
      value: "danger",
      label: navLabel("dangerZone"),
      icon: "lucide:alert-triangle",
    });
  }
  return tabs;
});
const applicationAdvancedActiveKey = computed(
  () => (route.query.section as string) || "general",
);
const showApplicationAdvancedSubTabs = computed(
  () =>
    isWorkloadDetailPage.value &&
    workloadKind.value === "application" &&
    workloadActiveSubtab.value === "advanced",
);

// Workload action bus. The detail page subscribes to bumps on this
// key so it can re-fetch immediately when the navbar fires a
// lifecycle action — same shape dockerProjectsRefreshKey uses for
// the New-Project flow.
const workloadActionRefreshKey = useState<number>(
  "workloadActionRefreshKey",
  () => 0,
);
const workloadActionInFlight = useState<
  "start" | "stop" | "restart" | "deploy" | null
>("workloadActionInFlight", () => null);

// Application Actions dropdown handler. The verbs in the dropdown
// (Deploy / Reload / Rebuild / Stop / Start) map to:
//   - Deploy / Rebuild → POST /:id/deploy (rebuild is currently same
//     pipeline; "rebuild" label kept so users coming from dokploy
//     find what they expect)
//   - Reload  → POST /:id/reload  (plain docker restart; it does not
//     recreate the container or apply newly saved env/config)
//   - Stop    → POST /:id/stop    (docker stop)
//   - Start   → POST /:id/start   (docker start)
const runApplicationAction = async (
  action: "deploy" | "reload" | "rebuild" | "stop" | "start",
) => {
  if (
    !serverId.value ||
    !projectId.value ||
    !workloadId.value ||
    workloadActionInFlight.value !== null
  ) {
    return;
  }
  // Map the dropdown verb back onto the slot the in-flight ref expects.
  // Deploy + Rebuild share the slot so the spinner shows on either.
  const inflightSlot: "start" | "stop" | "restart" | "deploy" = {
    deploy: "deploy",
    rebuild: "deploy",
    reload: "restart",
    stop: "stop",
    start: "start",
  }[action] as "start" | "stop" | "restart" | "deploy";
  workloadActionInFlight.value = inflightSlot;
  try {
    const { dockerService } = await import("~/services/dockerService");
    if (action === "deploy" || action === "rebuild") {
      await dockerService.applications.deploy(
        serverId.value,
        projectId.value,
        workloadId.value,
      );
      toast.success(
        t(
          action === "rebuild"
            ? "common.rebuildQueued"
            : "common.deploymentQueued",
        ),
      );
    } else {
      await dockerService.applications.lifecycle(
        serverId.value,
        projectId.value,
        workloadId.value,
        action,
      );
      toast.success(t("common.actionQueued", { action: actionLabel(action) }));
    }
    workloadActionRefreshKey.value++;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message ||
        t("common.actionFailed", { action: actionLabel(action) }),
    );
  } finally {
    workloadActionInFlight.value = null;
  }
};

// "View logs" lives in the Actions dropdown rather than the tab strip.
// Keeps the current workload-detail path and just flips the subtab query
// so the log viewer renders (the ?subtab=logs route is still valid).
const viewWorkloadLogs = () => {
  void navigateTo(`${route.path}?subtab=logs`);
};

const runDatabaseLifecycle = async (action: "start" | "stop" | "restart") => {
  if (
    !serverId.value ||
    !projectId.value ||
    !workloadId.value ||
    workloadActionInFlight.value !== null
  ) {
    return;
  }
  workloadActionInFlight.value = action;
  try {
    const { dockerService } = await import("~/services/dockerService");
    await dockerService.databases.lifecycle(
      serverId.value,
      projectId.value,
      workloadId.value,
      action,
    );
    toast.success(t("common.actionQueued", { action: actionLabel(action) }));
    workloadActionRefreshKey.value++;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message ||
        t("common.actionFailed", { action: actionLabel(action) }),
    );
  } finally {
    workloadActionInFlight.value = null;
  }
};

// Check if we're on a DNS domain detail page
const isDnsDetailPage = computed(() => {
  const match = route.path.match(/^\/dns\/([^/]+)(?:\/|$)/);
  return match && match[1] !== "create";
});

// Check if we're on DNS settings page
const isDnsSettingsPage = computed(() => {
  return route.path.match(/^\/dns\/([^/]+)\/settings$/) !== null;
});

const serverId = computed(() => {
  // Match both /servers/:id and /servers/:id/sites/:siteId
  const serverMatch = route.path.match(/^\/servers\/([^/]+)(?:\/|$)/);
  return serverMatch ? serverMatch[1] : null;
});

const siteId = computed(() => {
  const match = route.path.match(/^\/servers\/([^/]+)\/sites\/([^/]+)$/);
  return match ? match[2] : null;
});

// projectId is extracted from any URL that starts with
// /servers/:id/projects/:projectId, so it works on the project page
// AND its nested workload pages (applications/.., composes/.., etc.)
// — those pages won't use the project tab strip but might reuse the
// crumb in a future iteration.
const projectId = computed(() => {
  const match = route.path.match(/^\/servers\/([^/]+)\/projects\/([^/]+)/);
  return match ? match[2] : null;
});

const domainId = computed(() => {
  const match = route.path.match(/^\/dns\/([^/]+)(?:\/|$)/);
  return match ? match[1] : null;
});

// Server data for detail page
const serverName = ref<string | null>(null);
const serverIp = ref<string | null>(null);
const serverConnected = ref(false);
const serverProvider = ref<string | null>(null);
const serverStatus = ref<string | null>(null);
const serverType = ref<string | null>(null);
const serverProvisionCommand = ref<string | null>(null);
const showProvisionDialog = ref(false);

// Site data for detail page
const siteAddress = ref<string | null>(null);
const siteType = ref<string | null>(null);
const siteUrl = ref<string | null>(null);
const isDeploying = ref(false);

// Project data for detail page. Loaded on navigation; cached in
// memory across re-renders so the breadcrumb name doesn't flash to
// "Loading..." on every route change inside the project subtree.
const projectName = ref<string | null>(null);

// Workload (database / application / compose) metadata for the
// breadcrumb on workload detail pages. Loaded once per workloadId
// change; falls back to "Loading..." while in-flight.
//
// Engine / version are populated for databases (postgres / mysql / etc)
// so the last breadcrumb segment can use the brand icon + show the
// version inline — replaces the redundant on-page h1.
const workloadName = ref<string | null>(null);
const workloadStatus = ref<string | null>(null);
const workloadEngine = ref<string | null>(null);
const workloadVersion = ref<string | null>(null);
const workloadExternalPort = ref<number | null>(null);
// build_location for application + compose workloads. Drives whether
// the "GitHub Actions" subtab appears in the strip — we hide it for
// server-built workloads to keep the chrome clean for the common case.
// Null when the field isn't applicable (databases) or hasn't loaded.
const workloadBuildLocation = ref<string | null>(null);

const projectDetailTabs = computed(() => [
  {
    value: "overview",
    label: navLabel("overview"),
    query: "overview",
    icon: "lucide:layout-dashboard",
  },
  {
    value: "applications",
    label: navLabel("applications"),
    query: "applications",
    icon: "lucide:box",
  },
  {
    value: "compose",
    label: navLabel("compose"),
    query: "compose",
    icon: "lucide:layers",
  },
  {
    value: "databases",
    label: navLabel("databases"),
    query: "databases",
    icon: "lucide:database",
  },
  {
    value: "settings",
    label: navLabel("settings"),
    query: "settings",
    icon: "lucide:settings",
  },
  // Project-level env vars don't live as a tab — they're a sibling
  // concept used by every workload, so they're reached via a
  // dedicated Environment button in the project breadcrumb action
  // area that opens a Dialog. Keeping it out of the tab strip means
  // the user can update shared env from any tab without losing
  // their place.
]);

const showProjectTabs = computed(() => {
  if (!isSubscribed.value) return false;
  return isProjectDetailPage.value;
});

const isProjectTabActive = (query: string) => {
  const currentTab = (route.query.tab as string) || "overview";
  return currentTab === query;
};

// Shared bus consumed by the site detail page so that triggering a deploy
// from the navbar updates the on-page overview card immediately, without
// waiting for the WebSocket roundtrip + debounced refetch.
const lastTriggeredDeployment = useState<Deployment | null>(
  "lastTriggeredDeployment",
  () => null,
);

const onDeployTriggered = (deployment: Deployment) => {
  isDeploying.value = true;
  lastTriggeredDeployment.value = deployment;
};

// Get current team for WebSocket channel
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

// Subscribe to real-time deployment events
useDeploymentEvents(teamId, (data) => {
  // Update deployment status for current site
  if (data.site_id === siteId.value) {
    if (data.status === "pending" || data.status === "installing") {
      isDeploying.value = true;
    } else if (
      data.status === "finished" ||
      data.status === "failed" ||
      data.status === "timeout"
    ) {
      isDeploying.value = false;
    }
  }
});

// Domain data for DNS detail page
const domainAddress = ref<string | null>(null);
const domainProvider = ref<string | null>(null);
const domainProviderLabel = ref<string | null>(null);

const providerLabels = computed<Record<string, string>>(() => ({
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: t("common.customServer"),
}));

const siteTypeLabels = computed<Record<string, string>>(() => ({
  laravel: "Laravel",
  wordpress: "WordPress",
  generic: t("common.genericPhp"),
  phpmyadmin: "phpMyAdmin",
}));

// Computed site tabs based on site type
const siteDetailTabs = computed(() => {
  if (!siteType.value) return allSiteDetailTabs.value;
  if (siteType.value === "wordpress") {
    return allSiteDetailTabs.value.filter(
      (t) => !["deployments", "queues"].includes(t.value),
    );
  }
  if (siteType.value === "phpmyadmin") {
    return allSiteDetailTabs.value.filter(
      (t) =>
        !["deployments", "queues", "redirects", "commands"].includes(t.value),
    );
  }
  if (siteType.value === "generic") {
    return allSiteDetailTabs.value.filter((t) => !["queues"].includes(t.value));
  }
  return allSiteDetailTabs.value;
});

const { getCachedServer, getCachedSite } = useNavbarCache();

// Shared state bus for the current server's public IP. The navbar
// already fetches the server for the breadcrumb; broadcasting the IP
// here lets child pages (e.g. database General → External Connection
// URL) reuse it without making a duplicate /servers/:id request.
const currentServerPublicIp = useState<string | null>(
  "currentServerPublicIp",
  () => null,
);

const applyServerData = (data: {
  name: string;
  public_ipv4: string;
  connected: boolean;
  provider: string;
  status: string;
  type: string;
  provision_command?: string;
}) => {
  serverName.value = data.name;
  serverIp.value = data.public_ipv4;
  currentServerPublicIp.value = data.public_ipv4 || null;
  serverConnected.value = data.connected;
  serverProvider.value = data.provider;
  serverStatus.value = data.status;
  serverType.value = data.type;
  serverProvisionCommand.value = data.provision_command || null;
};

// Fetch server info when on server / site / project detail page.
// projectId is in the dep list so the crumb refreshes if the user
// jumps between projects, but the watch body keeps its existing
// site-vs-server-only branches and treats project the same as
// "server with extra resource".
watch(
  [serverId, siteId, projectId],
  async ([sId, stId, pId]) => {
    if (sId && !stId) {
      // Server detail page - use cache if available, otherwise fetch
      const cached = getCachedServer(sId);
      if (cached) {
        applyServerData(cached);
      } else {
        try {
          const response = await $api<{
            data: {
              name: string;
              public_ipv4: string;
              connected: boolean;
              provider: string;
              status: string;
              type: string;
              provision_command?: string;
            };
          }>(`/servers/${sId}`);
          applyServerData(response.data);
        } catch {
          serverName.value = null;
        }
      }
      // Clear site data
      siteAddress.value = null;
      siteType.value = null;
    } else if (sId && stId) {
      // Apply site cache immediately for instant tab filtering
      const cachedSite = getCachedSite(stId);
      if (cachedSite) {
        siteAddress.value = cachedSite.address;
        siteType.value = cachedSite.type;
      }

      // Fetch full data from API
      try {
        const [serverRes, siteRes] = await Promise.all([
          $api<{
            data: {
              name: string;
              public_ipv4: string;
              connected: boolean;
              provider: string;
              status: string;
              type: string;
              provision_command?: string;
            };
          }>(`/servers/${sId}`),
          $api<{ data: { address: string; type: string; url: string } }>(
            `/servers/${sId}/sites/${stId}`,
          ),
        ]);
        applyServerData(serverRes.data);
        siteAddress.value = siteRes.data.address;
        siteType.value = siteRes.data.type;
        siteUrl.value = siteRes.data.url;
      } catch {
        serverName.value = null;
        siteAddress.value = null;
      }
    }

    // Project detail page — load the project (and server, if not
    // already loaded by the branch above). The crumb keeps stale data
    // around for an instant load on back/forward navigation; the
    // ${projectId}` URL change forces a refresh.
    if (sId && pId) {
      try {
        const [serverRes, projectRes] = await Promise.all([
          $api<{
            data: {
              name: string;
              public_ipv4: string;
              connected: boolean;
              provider: string;
              status: string;
              type: string;
              provision_command?: string;
            };
          }>(`/servers/${sId}`),
          $api<{ data: { name: string } }>(
            `/servers/${sId}/docker/projects/${pId}`,
          ),
        ]);
        applyServerData(serverRes.data);
        projectName.value = projectRes.data.name;
      } catch {
        // Page-level guard will redirect on its own — just blank.
        projectName.value = null;
      }
    } else if (!pId) {
      // Clear the project name when leaving the project subtree so a
      // late navigation doesn't paint the previous breadcrumb.
      projectName.value = null;
    }

    if (!sId) {
      serverName.value = null;
      serverProvider.value = null;
      serverStatus.value = null;
      serverType.value = null;
      serverProvisionCommand.value = null;
      siteAddress.value = null;
      siteType.value = null;
      currentServerPublicIp.value = null;
    }
  },
  { immediate: true },
);

// Load the workload name when on a workload detail page so the
// breadcrumb segment renders the real name rather than the opaque
// ULID. Three sibling endpoints (databases/applications/composes)
// all return { data: { name, status } } so we branch by kind and
// keep the lookup tight.
// workloadActionRefreshKey is in the deps array so a lifecycle action
// fired from the navbar (Stop / Restart) immediately re-pulls the
// status — Running → Stopped flips the button in the chrome to
// "Start" without waiting for a WS round-trip.
watch(
  [workloadKind, workloadId, serverId, projectId, workloadActionRefreshKey],
  async ([kind, wId, sId, pId]) => {
    if (!kind || !wId || !sId || !pId) {
      workloadName.value = null;
      workloadStatus.value = null;
      workloadEngine.value = null;
      workloadVersion.value = null;
      workloadExternalPort.value = null;
      return;
    }
    const path = `/servers/${sId}/docker/projects/${pId}/${
      kind === "database"
        ? "databases"
        : kind === "application"
          ? "applications"
          : "composes"
    }/${wId}`;
    try {
      const res = await $api<{
        data: {
          name: string;
          status?: string;
          engine?: string;
          engine_version?: string;
          external_port?: number | null;
          build_location?: string | null;
        };
      }>(path);
      workloadName.value = res.data.name;
      workloadStatus.value = res.data.status ?? null;
      workloadEngine.value = res.data.engine ?? null;
      workloadVersion.value = res.data.engine_version ?? null;
      workloadExternalPort.value = res.data.external_port ?? null;
      workloadBuildLocation.value = res.data.build_location ?? null;
    } catch {
      workloadName.value = null;
      workloadStatus.value = null;
      workloadEngine.value = null;
      workloadVersion.value = null;
      workloadExternalPort.value = null;
      workloadBuildLocation.value = null;
    }
  },
  { immediate: true },
);

// Fetch domain info when on DNS detail page
watch(
  domainId,
  async (dId) => {
    if (dId && dId !== "create") {
      try {
        const response = await $api<{
          data: {
            domain: {
              address: string;
              provider?: { provider: string; profile: string };
            };
          };
        }>(`/dns/domains/${dId}`);
        domainAddress.value = response.data.domain.address;
        domainProvider.value = response.data.domain.provider?.provider || null;
        domainProviderLabel.value =
          response.data.domain.provider?.profile || null;
      } catch {
        domainAddress.value = null;
        domainProvider.value = null;
        domainProviderLabel.value = null;
      }
    } else {
      domainAddress.value = null;
      domainProvider.value = null;
      domainProviderLabel.value = null;
    }
  },
  { immediate: true },
);

const isGlobalTabActive = (tabRoute: string) => {
  const currentPath = route.path.replace(/\/$/, ""); // Remove trailing slash
  return currentPath === tabRoute || currentPath.startsWith(`${tabRoute}/`);
};

const isServerTabActive = (query: string) => {
  const currentTab = (route.query.tab as string) || "sites";
  return currentTab === query;
};

const isAdvancedTabActive = computed(() => {
  return (route.query.tab as string) === "advanced";
});

const isAdvancedSubTabActive = (query: string) => {
  const currentSubTab = (route.query.subtab as string) || "general";
  return currentSubTab === query;
};

// Scalar active-key computeds for the LayoutTabStrip — picks the
// route's `tab=` (server-detail) and `subtab=` (advanced) and falls
// back to the first available tab when the query is absent. The
// fallback matches the page's defaulting logic in
// pages/servers/[id]/index.vue.
const serverActiveTabKey = computed(() => {
  const fromQuery = route.query.tab as string | undefined;
  if (fromQuery && serverDetailTabs.value.some((t) => t.value === fromQuery)) {
    return fromQuery;
  }
  return serverDetailTabs.value[0]?.value ?? "sites";
});

const advancedActiveTabKey = computed(() => {
  const fromQuery = route.query.subtab as string | undefined;
  if (fromQuery && advancedSubTabs.value.some((t) => t.value === fromQuery)) {
    return fromQuery;
  }
  return "general";
});

const isSiteTabActive = (query: string) => {
  const currentTab = (route.query.tab as string) || "general";
  return currentTab === query;
};

const isDnsTabActive = (tabPath: string) => {
  if (tabPath === "") {
    // Records tab is active when not on settings page
    return !isDnsSettingsPage.value;
  }
  if (tabPath === "/settings") {
    return isDnsSettingsPage.value;
  }
  return false;
};

// Show provision button for custom servers that need provisioning
const showProvisionButton = computed(() => {
  return (
    serverProvider.value === "custom_server" && serverStatus.value === "new"
  );
});

const showGlobalTabs = computed(() => {
  const currentPath = route.path.replace(/\/$/, ""); // Remove trailing slash
  // If not subscribed, only show on dashboard
  if (!isSubscribed.value) {
    return currentPath === "/dashboard";
  }
  // Show global tabs only on list pages, not detail pages
  return (
    currentPath === "/dashboard" ||
    currentPath === "/servers" ||
    currentPath === "/dns" ||
    currentPath === "/scripts" ||
    currentPath === "/onboarding"
  );
});

const showDnsTabs = computed(() => {
  if (!isSubscribed.value) return false;
  return isDnsDetailPage.value;
});

const isServerDataLoaded = computed(() => serverType.value !== null);

const showServerTabs = computed(() => {
  if (!isSubscribed.value) return false;
  return isServerDetailPage.value;
});

const showSiteTabs = computed(() => {
  if (!isSubscribed.value) return false;
  return isSiteDetailPage.value;
});

// Watch for section visibility changes to update indicators when they become visible
watch(
  [
    showGlobalTabs,
    showServerTabs,
    showSiteTabs,
    showProjectTabs,
    isAdvancedTabActive,
  ],
  ([
    globalVisible,
    serverVisible,
    siteVisible,
    projectVisible,
    advancedVisible,
  ]) => {
    // Clear stale refs when sections become hidden
    if (!serverVisible) serverTabRefs.value.clear();
    if (!siteVisible) siteTabRefs.value.clear();
    if (!projectVisible) projectTabRefs.value.clear();
    if (!advancedVisible) advancedTabRefs.value.clear();

    // Wait for refs to be populated after render
    setTimeout(() => {
      nextTick(() => {
        if (globalVisible) updateIndicator();
        if (serverVisible) updateServerIndicator();
        if (siteVisible) updateSiteIndicator();
        if (projectVisible) updateProjectIndicator();
        if (advancedVisible) updateAdvancedIndicator();
      });
    }, 50);
  },
  { immediate: true },
);

// DNS refresh trigger
const dnsRefreshKey = useState("dnsRefreshKey", () => 0);
const onDnsCreated = () => {
  dnsRefreshKey.value++;
};

// Scripts refresh trigger
const scriptsRefreshKey = useState("scriptsRefreshKey", () => 0);
const onScriptCreated = () => {
  scriptsRefreshKey.value++;
};

// Sites refresh trigger (when a site is created from navbar)
const sitesRefreshKey = useState("sitesRefreshKey", () => 0);
const onSiteCreated = () => {
  sitesRefreshKey.value++;
};

// Docker projects refresh trigger — bumped by the navbar's New
// Project button so ServerDockerProjects can prepend the new row
// without a full refetch. Same pattern as sitesRefreshKey.
const dockerProjectsRefreshKey = useState("dockerProjectsRefreshKey", () => 0);
const onDockerProjectCreated = () => {
  dockerProjectsRefreshKey.value++;
};

// Terminal state (shared with server detail page)
const isTerminalOpen = useState("serverTerminalOpen", () => false);
const openTerminal = () => {
  isTerminalOpen.value = true;
};

// Compose "View YAML" dialog state — shared with the compose detail
// page which mounts the actual dialog (so it can read the already-
// loaded `compose.raw_yaml` without a second fetch). The navbar item
// just flips the flag; the page reacts.
const composeYamlDialogOpen = useState<boolean>(
  "composeYamlDialogOpen",
  () => false,
);
const openComposeYamlDialog = () => {
  composeYamlDialogOpen.value = true;
};

// Database "Connection info" dialog — same shared-flag pattern as
// composeYamlDialogOpen. Navbar item flips the flag; the database
// detail page mounts the actual dialog (so it has access to the
// already-loaded database row without a second fetch).
const databaseConnectionDialogOpen = useState<boolean>(
  "databaseConnectionDialogOpen",
  () => false,
);
const openDatabaseConnectionDialog = () => {
  databaseConnectionDialogOpen.value = true;
};

// Cross-component bus for the project detail tabs' "New X" buttons.
// Pages bind their create sheets' v-model:open to these flags; the
// navbar trigger flips the flag, the page reacts. Keeps the navbar
// decoupled from the page's local component state — same convention
// dockerProjectsRefreshKey + ServerDockerCreateProject established.
const dockerCreateApplicationOpen = useState<boolean>(
  "dockerCreateApplicationOpen",
  () => false,
);
const dockerCreateComposeOpen = useState<boolean>(
  "dockerCreateComposeOpen",
  () => false,
);
const dockerCreateDatabaseOpen = useState<boolean>(
  "dockerCreateDatabaseOpen",
  () => false,
);
// Project-level env-vars dialog. Doesn't belong on any single project
// tab — it's a sibling concept used by every workload below — so we
// surface it as a stand-alone action button in the project breadcrumb
// and open a Dialog on the page from here.
const dockerProjectEnvOpen = useState<boolean>(
  "dockerProjectEnvOpen",
  () => false,
);
const openCreateApplication = () => {
  dockerCreateApplicationOpen.value = true;
};
const openCreateCompose = () => {
  dockerCreateComposeOpen.value = true;
};
const openCreateDatabase = () => {
  dockerCreateDatabaseOpen.value = true;
};
const openProjectEnv = () => {
  dockerProjectEnvOpen.value = true;
};

const setColorMode = (mode: "light" | "dark" | "system") => {
  colorMode.preference = mode;
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else if (mode === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
};

let localePreferenceChangeQueue: Promise<void> = Promise.resolve();
let latestLocalePreferenceChange = 0;

const handleLocalePreferenceChange = (value: unknown): Promise<void> => {
  if (!isLocalePreference(value)) return Promise.resolve();

  const changeId = ++latestLocalePreferenceChange;
  const runChange = async () => {
    const previousPreference: LocalePreference = localePreference.value;
    try {
      // Serialize the local switch and the persisted mutation. This ensures a
      // slower, earlier request (or its rollback) can never finish after and
      // overwrite a newer selection.
      await setLocalePreference(value);
      await updateLocale(value);
      if (changeId === latestLocalePreferenceChange) {
        toast.success(t("common.localeUpdated"));
      }
    } catch {
      await setLocalePreference(previousPreference).catch(() => undefined);
      if (changeId === latestLocalePreferenceChange) {
        toast.error(t("common.localeUpdateFailed"));
      }
    }
  };

  const queuedChange = localePreferenceChangeQueue.then(runChange, runChange);
  localePreferenceChangeQueue = queuedChange.catch(() => undefined);
  return queuedChange;
};

const isOpen = ref(false);

const openSettings = () => {
  isOpen.value = false;
  openSettingsSheet();
};

const userInitials = computed(() => {
  if (!user.value?.name) return "U";
  return user.value.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});

const handleLogout = async () => {
  isOpen.value = false;
  await logout();
};

const navigateTo = (path: string) => {
  isOpen.value = false;
  useRouter().push(path);
};
</script>

<template>
  <nav
    class="z-40 w-full shrink-0 border-b border-divider bg-background/70 backdrop-blur-lg"
  >
    <div class="flex h-16 items-center justify-between px-4 lg:px-8">
      <NuxtLink to="/dashboard" class="flex items-center gap-2">
        <span class="text-xl font-bold">launchctl</span>
      </NuxtLink>

      <!-- Subscription Banner -->
      <div
        v-if="!isSubscribed"
        class="group relative h-5 cursor-pointer overflow-hidden text-sm"
        @click="openSettingsSheet('billing')"
      >
        <span
          class="block text-muted-foreground transition-transform duration-300 ease-out group-hover:-translate-y-full"
        >
          {{ t("common.subscriptionInactive") }}
        </span>
        <span
          class="absolute inset-x-0 top-full flex items-center gap-1 font-medium text-primary transition-transform duration-300 ease-out group-hover:-translate-y-full"
        >
          {{ t("common.subscribeNow") }}
          <Icon name="lucide:arrow-right" class="h-3.5 w-3.5" />
        </span>
      </div>

      <div class="flex items-center space-x-2">
        <LayoutActiveActions />
        <!-- User Menu (with Teams) -->
        <ClientOnly>
          <DropdownMenu v-model:open="isOpen">
            <DropdownMenuTrigger as-child>
              <div
                class="group flex h-9 cursor-pointer items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 transition-colors duration-150 hover:bg-muted/50"
              >
                <Avatar class="h-8 w-8 border-2 border-background shadow-sm">
                  <AvatarImage :src="user?.profile_photo_url || ''" />
                  <AvatarFallback class="text-xs font-medium sm:text-sm">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>

                <ChevronDown
                  class="ml-1 h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-y-0.5"
                />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-52 p-1">
              <!-- User Info -->
              <div class="px-2 py-1.5">
                <p class="text-sm font-medium">{{ user?.name }}</p>
                <p class="text-xs text-muted-foreground">{{ user?.email }}</p>
              </div>
              <DropdownMenuSeparator class="my-1" />

              <SharedTeamSwitcher />
              <DropdownMenuSeparator class="my-1" />

              <!-- Menu Items -->
              <DropdownMenuItem
                class="cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm"
                @click="openSettings"
              >
                <Settings class="h-3.5 w-3.5 text-muted-foreground" />
                <span>{{ t("common.settings") }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="isStaff"
                class="cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm"
                @click="navigateTo(showAdminContext ? '/dashboard' : '/admin')"
              >
                <Icon
                  v-if="showAdminContext"
                  name="lucide:layout-dashboard"
                  class="h-3.5 w-3.5 text-muted-foreground"
                />
                <Shield v-else class="h-3.5 w-3.5 text-muted-foreground" />
                <span>{{
                  showAdminContext
                    ? t("common.backToApp")
                    : t("common.adminPanel")
                }}</span>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  class="cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <Globe class="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{{ t("common.language") }}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent class="w-40">
                  <DropdownMenuRadioGroup
                    :model-value="localePreference"
                    @update:model-value="handleLocalePreferenceChange"
                  >
                    <DropdownMenuRadioItem data-test="locale-auto" value="auto">
                      {{ t("common.languageAutomatic") }}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem data-test="locale-en" value="en">
                      {{ t("common.english") }}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem data-test="locale-ja" value="ja">
                      {{ t("common.japanese") }}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator class="my-1" />

              <!-- Theme Switcher -->
              <div class="flex items-center justify-between px-2 py-1.5">
                <span class="text-sm text-muted-foreground">{{
                  t("common.theme")
                }}</span>
                <div
                  class="flex items-center gap-0.5 rounded-md border bg-muted/50 p-0.5"
                >
                  <button
                    type="button"
                    :aria-label="t('common.themeLight')"
                    :title="t('common.themeLight')"
                    class="rounded p-1 transition-colors"
                    :class="
                      colorMode.preference === 'light'
                        ? 'bg-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click.stop="setColorMode('light')"
                  >
                    <Sun class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    :aria-label="t('common.themeDark')"
                    :title="t('common.themeDark')"
                    class="rounded p-1 transition-colors"
                    :class="
                      colorMode.preference === 'dark'
                        ? 'bg-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click.stop="setColorMode('dark')"
                  >
                    <Moon class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    :aria-label="t('common.themeSystem')"
                    :title="t('common.themeSystem')"
                    class="rounded p-1 transition-colors"
                    :class="
                      colorMode.preference === 'system'
                        ? 'bg-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click.stop="setColorMode('system')"
                  >
                    <Monitor class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <DropdownMenuSeparator class="my-1" />

              <DropdownMenuItem
                class="cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm text-destructive focus:text-destructive"
                @click="handleLogout"
              >
                <LogOut class="h-3.5 w-3.5" />
                <span>{{ t("common.signOut") }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <template #fallback>
            <div
              class="flex h-9 animate-pulse items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2"
            >
              <div class="h-8 w-8 rounded-full bg-muted" />
              <div class="h-3.5 w-3.5 rounded bg-muted" />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- Global Navigation Tabs (Servers / Domains) -->
    <!-- On mobile the tabs can overflow the viewport; we let them scroll
         horizontally and keep the page-level "Create" action pinned to the
         right so it's always reachable. The scrollbar is hidden visually
         but the area still scrolls via touch / wheel. -->
    <div v-if="showGlobalTabs" class="px-4 lg:px-8">
      <div class="-mb-px flex items-center gap-3">
        <nav
          ref="globalNavRef"
          class="relative flex flex-1 gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <NuxtLink
            v-for="tab in globalTabs"
            :key="tab.value"
            :ref="(el) => setTabRef(tab.value, el)"
            :to="tab.route"
            class="relative flex shrink-0 items-center gap-2 whitespace-nowrap px-1 py-3 text-sm font-medium transition-colors"
            :class="[
              isGlobalTabActive(tab.route)
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ]"
          >
            <Icon :name="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
          </NuxtLink>
          <!-- Sliding indicator -->
          <span
            class="absolute bottom-0 h-0.5 bg-foreground transition-all duration-300 ease-out"
            :style="{
              left: `${indicatorLeft}px`,
              width: `${indicatorWidth}px`,
            }"
          />
        </nav>
        <div class="flex shrink-0 items-center">
          <ServerCreateServerDialog v-if="route.path === '/servers'" />
          <DnsAddDomain
            v-if="route.path === '/dns'"
            :providers="[]"
            @created="onDnsCreated"
          />
          <ScriptsCreateScript
            v-if="route.path === '/scripts'"
            @created="onScriptCreated"
          />
        </div>
      </div>
    </div>

    <!-- Admin back-office context (breadcrumb + section tabs) -->
    <div v-if="showAdminContext" class="px-4 lg:px-8">
      <div
        v-if="adminCrumbs.length"
        class="flex items-center gap-1.5 pb-1.5 pt-1 text-sm"
      >
        <template v-for="(crumb, i) in adminCrumbs" :key="i">
          <NuxtLink
            v-if="crumb.to && i < adminCrumbs.length - 1"
            :to="crumb.to"
            class="text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ crumb.label }}
          </NuxtLink>
          <span v-else class="font-medium text-foreground">{{
            crumb.label
          }}</span>
          <Icon
            v-if="i < adminCrumbs.length - 1"
            name="lucide:chevron-right"
            class="h-3.5 w-3.5 text-muted-foreground/60"
          />
        </template>
      </div>
      <nav class="-mb-px flex gap-6 overflow-x-auto">
        <NuxtLink
          v-for="tab in adminTabs"
          :key="tab.to"
          :to="tab.to"
          class="relative flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors"
          :class="
            isAdminTabActive(tab)
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          <Icon :name="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </div>

    <!-- Server Detail Navigation -->
    <div v-if="showServerTabs" class="px-4 lg:px-8">
      <div class="flex items-center justify-between py-2">
        <!-- Breadcrumb + Server info -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/servers"
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Server class="h-4 w-4" />
            {{ navLabel("servers") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <template v-if="isServerDataLoaded">
            <div class="flex items-center gap-2">
              <span
                class="relative flex items-center gap-1.5 text-sm font-medium"
              >
                <span
                  class="h-2 w-2 rounded-full"
                  :class="serverConnected ? 'bg-emerald-500' : 'bg-red-500'"
                />
                {{ serverName }}
              </span>
              <span
                v-if="isLoadBalancerServer"
                class="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
              >
                {{ t("common.loadBalancer") }}
              </span>
              <span
                v-if="serverProvider"
                class="rounded bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {{ providerLabels[serverProvider] || serverProvider }}
              </span>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-2">
              <div class="h-4 w-32 animate-pulse rounded bg-muted" />
              <div class="h-5 w-16 animate-pulse rounded bg-muted" />
            </div>
          </template>
        </div>
        <div v-if="isServerDataLoaded" class="flex items-center gap-2">
          <Button
            v-if="showProvisionButton"
            variant="outline"
            size="sm"
            class="border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
            @click="showProvisionDialog = true"
          >
            <Icon name="lucide:terminal" class="mr-2 h-4 w-4" />
            {{ actionLabel("provision") }}
          </Button>
          <Button
            v-if="serverConnected"
            variant="outline"
            size="sm"
            @click="openTerminal"
          >
            <Terminal class="mr-2 h-4 w-4" />
            {{ actionLabel("terminal") }}
          </Button>
          <ServerAddSite
            v-if="
              serverId && !isLoadBalancerServer && isServerTabActive('sites')
            "
            :server-id="serverId"
            @created="onSiteCreated"
          />
          <!--
            Docker-only create-project action. Mirrors ServerAddSite's
            convention: tab-gated, self-contained button + dialog,
            emits to bump the page's refresh key. Visible only on
            docker servers when the Projects tab is active.
          -->
          <ServerDockerCreateProject
            v-if="serverId && isDockerServer && isServerTabActive('projects')"
            :server-id="serverId"
            @created="onDockerProjectCreated"
          />
        </div>
      </div>
      <!--
        Server-detail tab strip. Replaced the hand-rolled nav (and
        its sibling -ml-3 / sliding-indicator-refs / conditional
        full-width border) with the shared LayoutTabStrip component.
        Same component is used for the Advanced sub-tabs below, so
        the icons in both strips line up under the breadcrumb above
        regardless of which sub-strip is open.
      -->
      <LayoutTabStrip
        v-if="isServerDataLoaded"
        :tabs="serverDetailTabs"
        :active-key="serverActiveTabKey"
        :to-link="
          (tab) => ({
            path: `/servers/${serverId}`,
            query:
              tab.query === 'advanced'
                ? { tab: tab.query, subtab: 'general' }
                : { tab: tab.query },
          })
        "
        :extend-border="isAdvancedTabActive"
      />
      <nav v-else class="relative -mb-px flex gap-1 overflow-x-auto">
        <div
          v-for="i in 6"
          :key="i"
          class="h-9 w-20 animate-pulse rounded bg-muted px-3 py-2"
        />
      </nav>
      <LayoutTabStrip
        v-if="isAdvancedTabActive"
        :tabs="advancedSubTabs"
        :active-key="advancedActiveTabKey"
        :to-link="
          (tab) => ({
            path: `/servers/${serverId}`,
            query: { tab: 'advanced', subtab: tab.query },
          })
        "
        variant="rose"
      />
    </div>

    <!-- Site Detail Navigation -->
    <div v-if="showSiteTabs" class="px-4 lg:px-8">
      <div class="flex items-center justify-between py-2">
        <!-- Breadcrumb: Servers / ServerName / SiteAddress -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/servers"
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Server class="h-4 w-4" />
            {{ navLabel("servers") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <NuxtLink
            :to="`/servers/${serverId}`"
            class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="serverConnected ? 'bg-emerald-500' : 'bg-red-500'"
            />
            {{ serverName || t("common.loading") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <div class="flex items-center gap-2">
            <Globe class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">{{
              siteAddress || t("common.loading")
            }}</span>
            <span
              v-if="siteType"
              class="rounded bg-muted px-2 py-0.5 text-xs font-medium"
            >
              {{ siteTypeLabels[siteType] || siteType }}
            </span>
            <a
              v-if="siteUrl"
              :href="siteUrl"
              target="_blank"
              rel="noreferrer"
              class="text-muted-foreground hover:text-foreground"
            >
              <Icon name="lucide:external-link" class="h-4 w-4" />
            </a>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <SharedLogsSheet
            v-if="serverId && siteId"
            :server-id="serverId"
            type="site"
            :site-id="siteId"
          />
          <Button
            v-if="serverConnected"
            variant="outline"
            size="sm"
            @click="openTerminal"
          >
            <Terminal class="mr-2 h-4 w-4" />
            {{ actionLabel("terminal") }}
          </Button>
          <SiteDeployApplication
            v-if="
              serverId &&
              siteId &&
              siteType &&
              !['wordpress', 'phpmyadmin'].includes(siteType)
            "
            :server-id="serverId"
            :site-id="siteId"
            :is-deploying="isDeploying"
            @deployed="onDeployTriggered"
          />
        </div>
      </div>
      <nav
        ref="siteNavRef"
        class="relative -mb-px -ml-3 flex gap-1 overflow-x-auto"
      >
        <NuxtLink
          v-for="tab in siteDetailTabs"
          :key="tab.value"
          :ref="(el) => setSiteTabRef(tab.query, el)"
          :to="{
            path: `/servers/${serverId}/sites/${siteId}`,
            query: { tab: tab.query },
          }"
          class="relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isSiteTabActive(tab.query)
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          ]"
        >
          <Icon :name="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </NuxtLink>
        <!-- Sliding indicator -->
        <span
          class="absolute bottom-0 h-0.5 bg-foreground transition-all duration-300 ease-out"
          :style="{
            left: `${siteIndicatorLeft}px`,
            width: `${siteIndicatorWidth}px`,
          }"
        />
      </nav>
    </div>

    <!--
      Project Detail Navigation. Same shape as the site detail block —
      breadcrumb on the left (Servers / serverName / projectName),
      action bar on the right (just Terminal for now), then a tab
      strip with the sliding indicator.
    -->
    <div v-if="showProjectTabs" class="px-4 lg:px-8">
      <div class="flex items-center justify-between py-2">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/servers"
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Server class="h-4 w-4" />
            {{ navLabel("servers") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <NuxtLink
            :to="`/servers/${serverId}?tab=projects`"
            class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="serverConnected ? 'bg-emerald-500' : 'bg-red-500'"
            />
            {{ serverName || t("common.loading") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <div class="flex items-center gap-2">
            <Icon
              name="lucide:folder-tree"
              class="h-4 w-4 text-muted-foreground"
            />
            <span class="text-sm font-medium">
              {{ projectName || t("common.loading") }}
            </span>
          </div>
        </div>
        <!--
          min-h-9 reserves the action row's height even when only some
          tabs render a "New X" button. Without it the row collapsed
          on tabs that had no action (Overview / Settings pre-change),
          which made the whole breadcrumb shorter by ~28px between
          Databases ↔ Settings — the navbar appeared to "move up".
          The Environment button is always present below, but the
          min-height is the proper structural fix so future per-tab
          actions can come and go without shifting the chrome.
        -->
        <div class="flex min-h-9 items-center gap-2">
          <!--
            No Terminal button at the project level — a project is a
            grouping of workloads, not a thing you shell into. Per-
            workload Terminal lives on the database / application
            detail breadcrumb below and opens the CONTAINER shell.
          -->

          <!--
            Environment button — always available on the project
            breadcrumb regardless of which tab is active. Flips the
            shared `dockerProjectEnvOpen` useState bus that the
            project page reads to open the env-vars dialog.
            Stand-alone (not tab-scoped) because shared env applies
            to every workload underneath.
          -->
          <Button variant="outline" size="sm" @click="openProjectEnv">
            <Icon name="lucide:key" class="mr-2 h-4 w-4" />
            {{ actionLabel("environment") }}
          </Button>

          <!--
            Per-tab "New X" trigger. We flip a useState flag the page
            component reads on its sheet's v-model:open binding — same
            convention dockerProjectsRefreshKey uses to keep the navbar
            decoupled from page internals. The sheet itself stays in
            the page so its $emit('created') still drives the
            optimistic prepend.
          -->
          <Button
            v-if="canEdit && isProjectTabActive('applications')"
            size="sm"
            @click="openCreateApplication"
          >
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            {{ actionLabel("newApplication") }}
          </Button>
          <Button
            v-else-if="canEdit && isProjectTabActive('compose')"
            size="sm"
            @click="openCreateCompose"
          >
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            {{ actionLabel("newComposeStack") }}
          </Button>
          <Button
            v-else-if="canEdit && isProjectTabActive('databases')"
            size="sm"
            @click="openCreateDatabase"
          >
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            {{ actionLabel("newDatabase") }}
          </Button>
        </div>
      </div>
      <!--
        -ml-3 pulls the nav left by exactly the first tab's px-3 left
        padding so the Overview icon lines up vertically with the
        Servers icon in the breadcrumb above. Indicator math reads
        tabRect.left - navRect.left so it's relative to the nav and
        survives the offset.
      -->
      <nav
        ref="projectNavRef"
        class="relative -mb-px -ml-3 flex gap-1 overflow-x-auto"
      >
        <NuxtLink
          v-for="tab in projectDetailTabs"
          :key="tab.value"
          :ref="(el) => setProjectTabRef(tab.query, el)"
          :to="{
            path: `/servers/${serverId}/projects/${projectId}`,
            query: { tab: tab.query },
          }"
          class="relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isProjectTabActive(tab.query)
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          ]"
        >
          <Icon :name="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </NuxtLink>
        <span
          class="absolute bottom-0 h-0.5 bg-foreground transition-all duration-300 ease-out"
          :style="{
            left: `${projectIndicatorLeft}px`,
            width: `${projectIndicatorWidth}px`,
          }"
        />
      </nav>
    </div>

    <!--
      Workload Detail navigation. Same shape as the project + site
      detail blocks: breadcrumb on top, then a subtab strip with a
      sliding underline indicator. Removes the need for an inline
      "Back to project" link AND the on-page tab strip the workload
      pages used to render themselves.
    -->
    <div v-if="isWorkloadDetailPage" class="px-4 lg:px-8">
      <div class="flex items-center justify-between py-2">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <NuxtLink
            to="/servers"
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Server class="h-4 w-4" />
            {{ navLabel("servers") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <NuxtLink
            :to="`/servers/${serverId}?tab=projects`"
            class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="serverConnected ? 'bg-emerald-500' : 'bg-red-500'"
            />
            {{ serverName || t("common.loading") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <NuxtLink
            :to="`/servers/${serverId}/projects/${projectId}?tab=${workloadParentTab}`"
            class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="lucide:folder-tree" class="h-4 w-4" />
            {{ projectName || t("common.loading") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <!--
            Last breadcrumb segment — single line.
              [• dot] [🐘 brand icon] [name]
            Status dot on the left mirrors the server-connection
            indicator higher up in the breadcrumb (uniform colour-dot
            pattern), then the engine logo (postgres / mysql / redis /
            etc.), then the name. Title attr surfaces the verbal
            status on hover.
          -->
          <div class="flex min-w-0 items-center gap-2">
            <span
              v-if="workloadStatus"
              class="h-2 w-2 shrink-0 rounded-full"
              :class="workloadStatusDotClass"
              :title="
                workloadStatus.charAt(0).toUpperCase() + workloadStatus.slice(1)
              "
            />
            <Icon
              v-if="workloadKindIcon"
              :name="workloadKindIcon"
              class="h-4 w-4 shrink-0"
              :class="workloadKindIconColor"
            />
            <span class="truncate text-sm font-medium text-foreground">
              {{ workloadName || t("common.loading") }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!--
            Workload chrome — Terminal + lifecycle (Start / Stop /
            Restart) collapsed into a single Actions dropdown. Keeps
            the breadcrumb tidy on narrow widths and groups every
            mutating action under one label (matches the Backups
            tab's "Actions" pattern). The dropdown items hide / swap
            based on workloadStatus so users only see legal
            transitions for the current state.
          -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="sm">
                <Icon name="lucide:settings-2" class="mr-2 h-4 w-4" />
                {{ actionLabel("actions") }}
                <Icon name="lucide:chevron-down" class="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-44">
              <DropdownMenuItem v-if="serverConnected" @select="openTerminal">
                <Terminal class="mr-2 h-4 w-4" />
                {{ actionLabel("terminal") }}
              </DropdownMenuItem>

              <template v-if="workloadKind === 'database'">
                <DropdownMenuSeparator v-if="serverConnected" />
                <DropdownMenuItem
                  v-if="workloadStatus && workloadStatus !== 'running'"
                  :disabled="workloadActionInFlight !== null"
                  @select="runDatabaseLifecycle('start')"
                >
                  <Icon
                    :name="
                      workloadActionInFlight === 'start'
                        ? 'lucide:loader-2'
                        : 'lucide:play'
                    "
                    :class="[
                      'mr-2 h-4 w-4',
                      workloadActionInFlight === 'start' && 'animate-spin',
                    ]"
                  />
                  {{ actionLabel("start") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="workloadStatus === 'running'"
                  :disabled="workloadActionInFlight !== null"
                  @select="runDatabaseLifecycle('stop')"
                >
                  <Icon
                    :name="
                      workloadActionInFlight === 'stop'
                        ? 'lucide:loader-2'
                        : 'lucide:square'
                    "
                    :class="[
                      'mr-2 h-4 w-4',
                      workloadActionInFlight === 'stop' && 'animate-spin',
                    ]"
                  />
                  {{ actionLabel("stop") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  :disabled="workloadActionInFlight !== null"
                  @select="runDatabaseLifecycle('restart')"
                >
                  <Icon
                    :name="
                      workloadActionInFlight === 'restart'
                        ? 'lucide:loader-2'
                        : 'lucide:rotate-cw'
                    "
                    :class="[
                      'mr-2 h-4 w-4',
                      workloadActionInFlight === 'restart' && 'animate-spin',
                    ]"
                  />
                  {{ actionLabel("restart") }}
                </DropdownMenuItem>
                <!--
                  Connection info — opens the credentials dialog the
                  database detail page mounts. Same shared-flag bridge
                  the compose YAML viewer uses, so the dialog has
                  access to the already-loaded database row.
                -->
                <DropdownMenuSeparator />
                <DropdownMenuItem @select="openDatabaseConnectionDialog">
                  <Icon name="lucide:link" class="mr-2 h-4 w-4" />
                  {{ actionLabel("connectionInfo") }}
                </DropdownMenuItem>
              </template>

              <!--
                Application actions — mirrors dokploy's row of buttons
                (Deploy / Reload / Rebuild / Stop) but rolled into the
                Actions dropdown so the breadcrumb chrome stays the
                same height across workload kinds.

                Items shown/hidden by workloadStatus so the user only
                sees legal transitions: Start appears only when the
                container is stopped; Stop only when running; Deploy /
                Rebuild always; Reload only when running.
              -->
              <template v-if="workloadKind === 'application'">
                <DropdownMenuSeparator v-if="serverConnected" />
                <DropdownMenuItem
                  :disabled="workloadActionInFlight !== null"
                  @select="runApplicationAction('deploy')"
                >
                  <Icon
                    :name="
                      workloadActionInFlight === 'deploy'
                        ? 'lucide:loader-2'
                        : 'lucide:rocket'
                    "
                    :class="[
                      'mr-2 h-4 w-4',
                      workloadActionInFlight === 'deploy' && 'animate-spin',
                    ]"
                  />
                  {{ actionLabel("deploy") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="workloadStatus === 'running'"
                  :disabled="workloadActionInFlight !== null"
                  @select="runApplicationAction('reload')"
                >
                  <Icon
                    :name="
                      workloadActionInFlight === 'restart'
                        ? 'lucide:loader-2'
                        : 'lucide:refresh-cw'
                    "
                    :class="[
                      'mr-2 h-4 w-4',
                      workloadActionInFlight === 'restart' && 'animate-spin',
                    ]"
                  />
                  {{ actionLabel("reload") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  :disabled="workloadActionInFlight !== null"
                  @select="runApplicationAction('rebuild')"
                >
                  <Icon name="lucide:hammer" class="mr-2 h-4 w-4" />
                  {{ actionLabel("rebuild") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="workloadStatus && workloadStatus !== 'running'"
                  :disabled="workloadActionInFlight !== null"
                  @select="runApplicationAction('start')"
                >
                  <Icon
                    :name="
                      workloadActionInFlight === 'start'
                        ? 'lucide:loader-2'
                        : 'lucide:play'
                    "
                    :class="[
                      'mr-2 h-4 w-4',
                      workloadActionInFlight === 'start' && 'animate-spin',
                    ]"
                  />
                  {{ actionLabel("start") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="workloadStatus === 'running'"
                  :disabled="workloadActionInFlight !== null"
                  @select="runApplicationAction('stop')"
                >
                  <Icon
                    :name="
                      workloadActionInFlight === 'stop'
                        ? 'lucide:loader-2'
                        : 'lucide:square'
                    "
                    :class="[
                      'mr-2 h-4 w-4',
                      workloadActionInFlight === 'stop' && 'animate-spin',
                    ]"
                  />
                  {{ actionLabel("stop") }}
                </DropdownMenuItem>

                <!-- Logs moved here from the tab strip. -->
                <DropdownMenuSeparator />
                <DropdownMenuItem @select="viewWorkloadLogs">
                  <Icon name="lucide:scroll" class="mr-2 h-4 w-4" />
                  {{ actionLabel("viewLogs") }}
                </DropdownMenuItem>
              </template>

              <!--
                Compose-specific actions. Just "View YAML" today — the
                read-only docker-compose.yml viewer that used to live
                on the General subtab. Edit + redeploy stays on the
                Advanced subtab; this is a quick peek without leaving
                the current view. The dropdown item flips a shared
                useState flag the compose detail page watches; the
                dialog itself is mounted there so it has access to the
                already-loaded compose row (avoids a second fetch).
              -->
              <template v-if="workloadKind === 'compose'">
                <DropdownMenuSeparator v-if="serverConnected" />
                <DropdownMenuItem @select="openComposeYamlDialog">
                  <Icon name="lucide:file-code" class="mr-2 h-4 w-4" />
                  {{ actionLabel("viewYaml") }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <!--
        -ml-3 nudges the first tab so its icon aligns with the
        breadcrumb's Server icon above (same trick the project tab nav
        uses). Indicator math is relative to the nav so it follows.
      -->
      <LayoutTabStrip
        :tabs="workloadSubTabs"
        :active-key="workloadActiveSubtab"
        :to-link="
          (tab) => ({
            query: { ...route.query, subtab: tab.query, section: undefined },
          })
        "
        :extend-border="showApplicationAdvancedSubTabs"
      />
      <!--
        Application Advanced sub-tabs (rose). Second-level nav rendered
        in the navbar so it sits tight under the workload tabs — same
        pattern as the PHP server Advanced sub-tabs. The page body
        (components/application/Advanced.vue) reads ?section= to render
        the matching section.
      -->
      <LayoutTabStrip
        v-if="showApplicationAdvancedSubTabs"
        :tabs="applicationAdvancedSubTabs"
        :active-key="applicationAdvancedActiveKey"
        :to-link="
          (tab) => ({
            query: { ...route.query, subtab: 'advanced', section: tab.value },
          })
        "
        variant="rose"
      />
    </div>

    <!-- DNS Domain Detail Navigation -->
    <div v-if="showDnsTabs" class="px-4 lg:px-8">
      <div class="flex items-center justify-between py-2">
        <!-- Breadcrumb: Domains / domain.address -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/dns"
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Globe class="h-4 w-4" />
            {{ navLabel("domains") }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{
              domainAddress || t("common.loading")
            }}</span>
            <span
              v-if="domainProviderLabel"
              class="rounded bg-muted px-2 py-0.5 text-xs font-medium"
            >
              {{ domainProviderLabel }}
            </span>
          </div>
        </div>
      </div>
      <nav class="-mb-px flex gap-1 overflow-x-auto">
        <NuxtLink
          v-for="tab in dnsDetailTabs"
          :key="tab.value"
          :to="`/dns/${domainId}${tab.path}`"
          class="relative whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isDnsTabActive(tab.path)
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground',
          ]"
        >
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </div>

    <SettingsSheet />

    <!-- Provision Command Dialog -->
    <ServerProvisionCommandDialog
      v-if="serverId && serverProvisionCommand"
      v-model:open="showProvisionDialog"
      :server-id="serverId"
      :provision-command="serverProvisionCommand"
    />
  </nav>
</template>
