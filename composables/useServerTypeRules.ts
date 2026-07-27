export type ServerTypeId =
  | "php"
  | "database"
  | "loadbalancer"
  | "docker"
  | (string & {});

export interface ServerDetailTab {
  value: string;
  label: string;
  query: string;
  icon: string;
}

export interface ServerTypeRules {
  showsPhp: boolean;
  showsDatabase: boolean;
  showsAgentToggle: boolean;
  description: string;
  tabs: ServerDetailTab[];
}

const PHP_TABS: ServerDetailTab[] = [
  { value: "sites", label: "Sites", query: "sites", icon: "lucide:layout" },
  {
    value: "metrics",
    label: "Metrics",
    query: "metrics",
    icon: "lucide:activity",
  },
  {
    value: "databases",
    label: "Databases",
    query: "databases",
    icon: "lucide:database",
  },
  {
    value: "networks",
    label: "Networks",
    query: "networks",
    icon: "lucide:network",
  },
  { value: "daemons", label: "Daemons", query: "daemons", icon: "lucide:bot" },
  {
    value: "schedulers",
    label: "Schedulers",
    query: "schedulers",
    icon: "lucide:clock",
  },
  {
    value: "advanced",
    label: "Advanced",
    query: "advanced",
    icon: "lucide:sliders-horizontal",
  },
];

const LOADBALANCER_TABS: ServerDetailTab[] = [
  {
    value: "upstreams",
    label: "Upstreams",
    query: "upstreams",
    icon: "lucide:git-fork",
  },
  {
    value: "metrics",
    label: "Metrics",
    query: "metrics",
    icon: "lucide:activity",
  },
  {
    value: "networks",
    label: "Networks",
    query: "networks",
    icon: "lucide:network",
  },
  { value: "daemons", label: "Daemons", query: "daemons", icon: "lucide:bot" },
  {
    value: "schedulers",
    label: "Schedulers",
    query: "schedulers",
    icon: "lucide:clock",
  },
  {
    value: "advanced",
    label: "Advanced",
    query: "advanced",
    icon: "lucide:sliders-horizontal",
  },
];

const DOCKER_TABS: ServerDetailTab[] = [
  {
    value: "projects",
    label: "Projects",
    query: "projects",
    icon: "lucide:folder-tree",
  },
  {
    value: "containers",
    label: "Containers",
    query: "containers",
    icon: "lucide:container",
  },
  {
    value: "networks",
    label: "Networks",
    query: "networks",
    icon: "lucide:network",
  },
  { value: "daemons", label: "Daemons", query: "daemons", icon: "lucide:bot" },
  {
    value: "schedulers",
    label: "Schedulers",
    query: "schedulers",
    icon: "lucide:clock",
  },
  {
    value: "metrics",
    label: "Metrics",
    query: "metrics",
    icon: "lucide:activity",
  },
  {
    value: "advanced",
    label: "Advanced",
    query: "advanced",
    icon: "lucide:sliders-horizontal",
  },
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
      "Docker CE + Traefik reverse proxy with docker-label discovery. Run apps as containers.",
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

const TYPE_ICONS: Record<string, string> = {
  php: "lucide:code-2",
  database: "lucide:database",
  loadbalancer: "lucide:network",
  docker: "simple-icons:docker",
};

export function getServerTypeIcon(
  type: ServerTypeId | null | undefined,
): string {
  if (!type) return "lucide:server";
  return TYPE_ICONS[type] ?? "lucide:server";
}

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

export function getServerTypeRules(
  type: ServerTypeId | null | undefined,
): ServerTypeRules {
  if (!type) return FALLBACK;
  return RULES[type] ?? FALLBACK;
}

export function normalizeCreatePayload<
  T extends {
    type: ServerTypeId;
    php_version?: string;
    database_type?: string;
  },
>(payload: T): T {
  const rules = getServerTypeRules(payload.type);
  return {
    ...payload,
    php_version: rules.showsPhp ? payload.php_version : "none",
    database_type: rules.showsDatabase ? payload.database_type : "none",
  };
}
