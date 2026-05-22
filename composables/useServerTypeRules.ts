/**
 * Capability rules for each server type, mirroring the Go backend's
 * `ServerType.GetFeatures()` and `createServicesForServer` switch.
 *
 * Used by the server-create form to decide which optional fields to show,
 * and which fields to force to "none" before submission.
 *
 * Keeping this in a composable (no DOM, no Nuxt runtime) makes it cheap to
 * unit test without mounting a component.
 */

export type ServerTypeId =
  | "php"
  | "database"
  | "loadbalancer"
  | "docker"
  | (string & {}); // tolerate forward-compatible types from the API

/**
 * A top-level tab on the server detail page. The `query` value is what we
 * write to `?tab=…` in the URL; `value` is the canonical identifier the
 * page component reads.
 */
export interface ServerDetailTab {
  value: string;
  label: string;
  query: string;
  icon: string;
}

export interface ServerTypeRules {
  /** Whether the PHP version field is meaningful for this server type. */
  showsPhp: boolean;
  /** Whether the database field is meaningful for this server type. */
  showsDatabase: boolean;
  /** Whether the "install agent" toggle applies (it does for everything currently). */
  showsAgentToggle: boolean;
  /**
   * Optional summary explaining what the type will provision; useful as a
   * helper text under the type selector.
   */
  description: string;
  /**
   * Top-level tabs shown on the server detail page. Order matters — first
   * entry is the default landing tab when no `?tab=` query is present.
   * Single source of truth: Navbar.vue and pages/servers/[id]/index.vue
   * both read from here.
   */
  tabs: ServerDetailTab[];
}

// Tab presets per server type. Keep these as data so adding a new type only
// requires extending RULES — no Navbar/page logic changes.
const PHP_TABS: ServerDetailTab[] = [
  { value: "sites", label: "Sites", query: "sites", icon: "lucide:layout" },
  { value: "metrics", label: "Metrics", query: "metrics", icon: "lucide:activity" },
  { value: "databases", label: "Databases", query: "databases", icon: "lucide:database" },
  { value: "networks", label: "Networks", query: "networks", icon: "lucide:network" },
  { value: "daemons", label: "Daemons", query: "daemons", icon: "lucide:bot" },
  { value: "schedulers", label: "Schedulers", query: "schedulers", icon: "lucide:clock" },
  { value: "advanced", label: "Advanced", query: "advanced", icon: "lucide:sliders-horizontal" },
];

const LOADBALANCER_TABS: ServerDetailTab[] = [
  { value: "upstreams", label: "Upstreams", query: "upstreams", icon: "lucide:git-fork" },
  { value: "metrics", label: "Metrics", query: "metrics", icon: "lucide:activity" },
  { value: "networks", label: "Networks", query: "networks", icon: "lucide:network" },
  { value: "daemons", label: "Daemons", query: "daemons", icon: "lucide:bot" },
  { value: "schedulers", label: "Schedulers", query: "schedulers", icon: "lucide:clock" },
  { value: "advanced", label: "Advanced", query: "advanced", icon: "lucide:sliders-horizontal" },
];

// Docker server has its own world: Projects group docker workloads
// (applications, compose, databases). Containers/Volumes/Networks/Traefik
// give server-level visibility into the docker host. See
// docs/plans/2026-05-22-docker-server-menus-design.md.
const DOCKER_TABS: ServerDetailTab[] = [
  { value: "projects", label: "Projects", query: "projects", icon: "lucide:folder-tree" },
  { value: "containers", label: "Containers", query: "containers", icon: "lucide:container" },
  { value: "volumes", label: "Volumes", query: "volumes", icon: "lucide:hard-drive" },
  { value: "networks", label: "Networks", query: "networks", icon: "lucide:network" },
  { value: "traefik", label: "Traefik", query: "traefik", icon: "simple-icons:traefikproxy" },
  { value: "metrics", label: "Metrics", query: "metrics", icon: "lucide:activity" },
  { value: "advanced", label: "Advanced", query: "advanced", icon: "lucide:sliders-horizontal" },
];

const RULES: Record<string, ServerTypeRules> = {
  php: {
    showsPhp: true,
    showsDatabase: true,
    showsAgentToggle: true,
    description: "PHP stack with Caddy and optional MySQL/PostgreSQL.",
    tabs: PHP_TABS,
  },
  database: {
    showsPhp: false,
    showsDatabase: true,
    showsAgentToggle: true,
    description: "Dedicated database server (MySQL or PostgreSQL).",
    tabs: PHP_TABS,
  },
  loadbalancer: {
    showsPhp: false,
    showsDatabase: false,
    showsAgentToggle: true,
    description: "Caddy load balancer routing to backend application servers.",
    tabs: LOADBALANCER_TABS,
  },
  docker: {
    showsPhp: false,
    showsDatabase: false,
    showsAgentToggle: true,
    description:
      "Docker CE + Swarm + Traefik reverse proxy. Run apps as containers.",
    tabs: DOCKER_TABS,
  },
};

const FALLBACK: ServerTypeRules = {
  showsPhp: true,
  showsDatabase: true,
  showsAgentToggle: true,
  description: "",
  tabs: PHP_TABS,
};

/**
 * Iconify name for each server type. Used in the create dialog dropdown and
 * anywhere else we want a visual marker. Returns a sensible default for unknown
 * types so the UI never renders an empty icon.
 */
const TYPE_ICONS: Record<string, string> = {
  php: "lucide:code-2",
  database: "lucide:database",
  loadbalancer: "lucide:network",
  docker: "simple-icons:docker",
};

export function getServerTypeIcon(type: ServerTypeId | null | undefined): string {
  if (!type) return "lucide:server";
  return TYPE_ICONS[type] ?? "lucide:server";
}

/**
 * Iconify name for each cloud provider. Brand icons via simple-icons, with a
 * lucide fallback for custom servers and unknown providers.
 */
// Note: simple-icons dropped the standalone "linode" entry after the Akamai
// rebrand. Using simple-icons:akamai next to a "Linode" label would mislead
// users, so we fall back to a neutral cloud icon for that one.
const PROVIDER_ICONS: Record<string, string> = {
  digitalocean: "simple-icons:digitalocean",
  hetzner: "simple-icons:hetzner",
  linode: "lucide:cloud",
  vultr: "simple-icons:vultr",
  aws: "simple-icons:amazonwebservices",
  custom_server: "lucide:server-cog",
};

export function getProviderIcon(provider: string | null | undefined): string {
  if (!provider) return "lucide:cloud";
  return PROVIDER_ICONS[provider] ?? "lucide:cloud";
}

/**
 * Returns the capability rules for a given server type id.
 * Unknown ids fall back to the PHP rules so the form stays usable
 * when the backend adds new types ahead of the UI.
 */
export function getServerTypeRules(type: ServerTypeId | null | undefined): ServerTypeRules {
  if (!type) return FALLBACK;
  return RULES[type] ?? FALLBACK;
}

/**
 * Normalise the create-server payload so fields that don't apply to the
 * selected type are sent as "none" — this matches the Go DTO's expectations.
 */
export function normalizeCreatePayload<
  T extends { type: ServerTypeId; php_version?: string; database_type?: string },
>(payload: T): T {
  const rules = getServerTypeRules(payload.type);
  return {
    ...payload,
    php_version: rules.showsPhp ? payload.php_version : "none",
    database_type: rules.showsDatabase ? payload.database_type : "none",
  };
}
