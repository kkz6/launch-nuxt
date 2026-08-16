export type ServerProvider =
  | "digitalocean"
  | "hetzner"
  | "linode"
  | "vultr"
  | "aws";

export type StorageProvider = "s3";

export interface SubscriptionPlan {
  id: number;
  name: string;
  short_description: string;
  monthly_id: string;
  yearly_id: string;
  features: string[];
  archived: boolean;
  recommended: boolean;
  monthly_pricing: number;
  yearly_pricing: number;
  options: {
    max_servers: number;
    max_sites_per_server: number;
    max_deployments_per_site: number;
    max_team_members: number;
    has_backups: boolean;
  };
}

export interface CommitData {
  sha: string;
  url: string;
  name: string;
  email: string;
  message: string;
  rollback_to?: string;
}

export interface InstallationStatus {
  installed_at?: string | null;
  installation_failed_at?: string | null;
  uninstallation_requested_at?: string | null;
  uninstallation_failed_at?: string | null;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: {
    url: string | null;
    label: string;
    active: boolean;
  }[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  current_team_id: number | null;
  profile_photo_path: string | null;
  created_at: string;
  updated_at: string | null;
  two_factor_confirmed_at: string | null;
  profile_photo_url: string;
  timezone: string;
  onboarded: boolean;
  staff_role?: "support" | "super_admin" | null;
  status?: string;
  all_teams?: Team[] | null;
  current_team?: Team;
  two_factor_enabled?: boolean;
  membership?: TeamMember;
  // The caller's role in their current team. Populated by /auth/user
  // and used to gate UI actions (see useCan()). The backend remains
  // the authorization source of truth.
  role?: TeamRole;
}

// Team roles, highest privilege first. Mirrors the backend hierarchy
// (owner > admin > editor > member). Drives frontend UI gating only.
export type TeamRole = "owner" | "admin" | "editor" | "member";

export interface Team {
  id: string;
  user_id: string;
  name: string;
  image_path: string | null;
  image_url: string;
  personal_team: boolean;
  is_subscribed: boolean;
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
  owner?: User;
  users?: User[];
  team_invitations?: TeamInvitation[];
}

export interface TeamMember {
  team_id: number;
  user_id: number;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ServerUsers {
  root: string;
  local: string;
}

export interface Server {
  id: string;
  team_id: string;
  user_id?: string;
  source_control_id?: string;
  server_provider_id?: string;
  name: string;
  description?: string;
  provider: string;
  provider_label?: string;
  provider_data?: Record<string, string>;
  type: string;
  type_label?: string;
  connected: boolean;
  monitoring_enabled?: boolean;
  cpu_cores?: string;
  memory_in_mb?: string;
  storage_in_gb?: string;
  operating_system: string;
  operating_system_label?: string;
  // Detected* mirror what the detect_os provision step pulled from
  // /etc/os-release + uname on the actual box. Distinct from
  // operating_system above (the user's dashboard pick). UI surfaces
  // both so any mismatch is visible — particularly useful for custom
  // (BYO) servers where customers sometimes select Ubuntu in the
  // dropdown but bring a Debian VPS.
  detected_os_id?: string;
  detected_os_version?: string;
  detected_os_version_codename?: string;
  detected_arch?: string;
  detected_kernel?: string;
  detected_at?: string;
  status: string;
  status_label?: string;
  public_ipv4: string;
  private_ipv4?: string;
  public_key?: string;
  private_key?: string;
  user_public_key?: string;
  username: string;
  users?: ServerUsers;
  password?: string;
  database_password?: string;
  ssh_port: number | string;
  working_directory?: string;
  completed_provision_steps?: string;
  provisioned_at: string;
  provision_command?: string;
  uninstallation_requested_at?: string;
  updates?: string;
  auto_update: boolean | string;
  available_updates?: string;
  security_updates?: string;
  last_update_check?: string;
  progress: number | string;
  progress_step: string;
  created_at: string;
  updated_at?: string;
  name_with_ip?: string;
  sites_count?: number;
  services_count?: number;
  upstreams_count?: number;
  // Live count of docker_projects on this server. Always present in
  // responses (0 for PHP / database / loadbalancer servers). The
  // delete-server flow on docker servers blocks while this is > 0;
  // the backend re-validates the same condition.
  projects_count?: number;
  // Live count of docker workloads (applications + composes +
  // managed databases) for the server. 0 on non-docker servers.
  // Surfaced on the Servers list card in place of `sites_count`
  // when type === "docker" — that table is Laravel-only and is
  // always 0 for docker servers.
  workloads_count?: number;
}

export interface Site extends InstallationStatus {
  id: string;
  server_id: string;
  user_id: string;
  source_control_id: string;
  address: string;
  name: string;
  type: "laravel" | "wordpress" | "generic" | "phpmyadmin";
  typeData?: Record<string, never> | null;
  aliases?: Record<string, never> | null;
  tls_setting: string;
  zero_downtime_deployment: boolean;
  deployment_releases_retention: number;
  auto_deployment?: boolean;
  queue_deployments?: boolean;
  auto_restart_queue?: boolean;
  repository_url?: string | null;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
    html_url: string;
  } | null;
  repository_branch?: string;
  deploy_token: string;
  deployNotificationEmail?: string | null;
  deployKeyPublic?: string | null;
  deployKeyPrivate?: string | null;
  user: string;
  path: string;
  web_folder: string;
  app_directory: string;
  php_version?: string | undefined;
  pending_php_version?: string | null;
  pending_tls_update_since?: string | null;
  pending_caddyfile_update_since?: string | null;
  shared_directories: string[];
  writeable_directories: string[];
  shared_files: string[];
  load_balanced_upstream_id?: string | null;
  port?: number | null;
  progress?: number | null;
  hook_before_updating_repository?: string;
  hook_after_updating_repository?: string;
  hook_before_making_current?: string;
  hook_after_making_current?: string;
  features?: string[];
  enabled_features?: string[];
  pending_features?: string[];
  queue_count?: number;
  url: string;
  created_at: string;
  updated_at: string;
  source_control?: {
    id: string;
    provider: string;
    login: string;
    name: string;
    type: string;
  } | null;
  latest_deployment?: Deployment;
}

export type CertificateStatus =
  | "valid"
  | "not_issued"
  | "expired"
  | "invalid"
  | "unreachable";

export interface CertificateStatusResult {
  host: string;
  status: CertificateStatus;
  valid: boolean;
  message: string;
  issuer?: string;
  subject?: string;
  serial_number?: string;
  resolved_ip?: string;
  dns_names?: string[];
  not_before?: string;
  expires_at?: string;
  days_remaining?: number;
  checked_at: string;
}

export interface Deployment {
  id: string;
  site_id: string;
  user_id: string | null;
  task_id: string;
  git_hash: string;
  status: string;
  vcs_data: VcsData;
  commit_data: CommitData;
  user_notified_at: string;
  created_at: string;
  updated_at: string;
  task?: Task;
  user: null | User;
}

export interface VcsData {
  id: number;
  ref: string;
  sha: string;
  url: string;
  task: string;
  node_id: string;
  created_at: string;
  updated_at: string;
  description: string;
  environment: string;
  statuses_url: string;
  repository_url: string;
  original_environment: string;
  transient_environment: boolean;
  production_environment: boolean;
}

export interface Task {
  id: string;
  server_id: string;
  user_id?: string;
  name: string;
  user: string;
  type: string;
  status: string;
  output?: string;
  exit_code?: number;
  created_at: string;
  updated_at?: string;
}

export interface ProvisionStatusStep {
  name: string;
  description: string;
  status: "completed" | "current" | "pending";
}

export interface ProvisionStatus {
  steps: ProvisionStatusStep[];
  current_step?: ProvisionStatusStep;
  latest_task?: Task;
  // Set by the backend when server.status is "failed". The UI uses these to
  // suppress the spinner on a never-resolving "current" step and render an
  // error banner instead. See BuildProvisionStatus in responses.go.
  failed?: boolean;
  error_message?: string;
}

export interface GitProvider {
  id: string;
  user_id: string;
  team_id: string;
  provider: "github" | "gitlab" | "bitbucket";
  url: string;
  provider_id: string;
  provider_data: {
    avatar_url: string;
    created_at: string;
    id: string;
    name: string;
    username: string;
  };
  created_at: string;
}

export interface SourceControl {
  id: string;
  provider: "github" | "gitlab" | "bitbucket";
  provider_label: string;
  login: string;
  avatar_url?: string;
  repository_count: number;
}

export interface Repository {
  id: string;
  name: string;
  full_name: string;
  default_branch: string;
  html_url: string;
  public: boolean;
  ssh_url?: string;
}

export interface Subscription {
  id: number;
  team_id: string;
  type: string;
  stripe_id: string;
  stripe_status: string;
  stripe_price?: string;
  quantity?: number;
  trial_ends_at?: Date | null;
  ends_at?: Date | null;
  created_at?: Date | null;
  updated_at?: Date | null;
}

export interface SSHKey {
  id: string;
  user_id: string;
  public_key: string;
  description: string;
  name: string;
  fingerprint: string;
  is_global: boolean;
  remove_url: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseBackupBrief {
  id: string;
  path: string;
  enabled: boolean;
}

export interface Database extends InstallationStatus {
  id: string;
  name: string;
  created_at: string;
  // Server-level backup configurations that include this database in
  // their dump set — populated by the API when listing databases for
  // the server's Databases tab. Drives the per-row "Run Backup" action.
  backups?: DatabaseBackupBrief[];
}

export interface DatabaseUser extends InstallationStatus {
  id: string;
  server_id: string;
  name: string;
  password: string | null;
  host: string;
  status: string;
  database_ids: string[];
}

export interface Service {
  id: string;
  server_id: string;
  type: string;
  name: string;
  version: string;
  status: string;
  is_default: number;
  default_change_pending?: boolean;
  unit: string;
  software: string;
  task_id?: string;
  patch_status?: string;
  patch_error?: string;
  created_at: string;
  updated_at: string;
}

export interface PersonalAccessToken {
  id: string;
  name: string;
  abilities: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

export interface PersonalAccessTokenCreated extends PersonalAccessToken {
  plain_text_token: string;
}

export interface NotificationChannel {
  id: string;
  label: string;
  provider: "slack" | "telegram" | "discord" | "email";
  data: Record<string, string>;
  connected: string;
}

export interface Cron extends InstallationStatus {
  id: string;
  server_id: string;
  user: string;
  expression: string;
  command: string;
  frequency: string;
  hidden: boolean;
  status: string;
}

export interface QueueDaemon extends InstallationStatus {
  id: string;
  server_id: string;
  command: string;
  directory?: string;
  user: string;
  processes: number;
  stop_wait_seconds: number;
  stop_signal: string;
  running: boolean;
  info?: {
    error: string | null;
    pid: string;
    state: string;
    uptime: string;
  } | null;
  last_status_check: string | null;
}

export interface Backup {
  id: string;
  server_id: string;
  storage_provider_id: string;
  source_type: "database" | "files";
  source_id: string | null;
  database_type: "mysql" | "postgresql";
  database_name: string;
  files_path: string | null;
  storage_path: string;
  frequency: string;
  hour: number;
  minute: number;
  keep_backups: number;
  status: string;
  last_backup_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogInfo {
  name: string;
  description?: string;
  path?: string;
  context?: string;
  type?: string;
  file_type?: string;
  software: string;
  show_route: string;
  update_route?: string;
}

export interface FirewallRule {
  update_url: string;
  id: string;
  server_id: string;
  user_id: string;
  name: string;
  action: string;
  port: string;
  from_ipv4: string | null;
  mask: string;
  note: string | null;
  status: string;
  installed_at: string | null;
  installation_failed_at: string | null;
  uninstallation_requested_at: string | null;
  uninstallation_failed_at: string | null;
}

export interface ConnectedServerProvider {
  id: string;
  profile: string;
  provider: string;
  connected: boolean;
  created_at: string;
}

export interface StorageProviderRecord {
  id: number;
  user_id: number;
  team_id: number;
  provider: string;
  label: string;
  token: string;
  credentials: {
    key?: string;
    secret?: string;
    region?: string;
    bucket?: string;
    endpoint?: string;
  };
  refresh_token: string;
  connected: boolean;
  token_expires_at: string | null;
  backup_jobs_count: number;
}

export interface Passkey {
  id: string;
  name: string;
  credential_id: string;
  created_at: string;
  last_used_at?: string;
  transports?: string[];
}

export interface UserSession {
  id: string;
  agent: {
    browser: string;
    is_desktop: boolean;
    platform: string;
  };
  ip_address: string;
  is_current_device: boolean;
  last_active: string;
}

export interface SearchResultItem {
  name: string;
  url: string;
  type: string;
  info: string;
}

export interface SearchResultGroup {
  label: string;
  data: SearchResultItem[];
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Load Balancer types
export interface LoadBalancerUpstream {
  id: string;
  server_id: string;
  team_id: string;
  name: string;
  address: string;
  port: number;
  tls_setting: string;
  lb_policy: string;
  lb_policy_label: string;
  health_check_path: string;
  health_check_interval: string;
  health_check_timeout: string;
  installed_at?: string | null;
  created_at: string;
  updated_at: string;
  backends?: LoadBalancerBackend[];
}

export interface LoadBalancerBackend {
  id: string;
  upstream_id: string;
  site_id: string;
  server_id: string;
  port: number;
  is_down: boolean;
  health_status: string;
  last_health_check_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpstreamHealthResponse {
  upstream_id: string;
  address: string;
  total_backends: number;
  healthy_backends: number;
  backends: BackendHealthStatus[];
}

export interface BackendHealthStatus {
  backend_id: string;
  server_id: string;
  site_id: string;
  port: number;
  is_down: boolean;
  health_status: string;
  last_health_check_at?: string | null;
}

export interface CheckDomainResponse {
  address: string;
  exists: boolean;
  sites?: DomainCheckSite[];
  warning?: string;
}

export interface DomainCheckSite {
  id: string;
  server_id: string;
  address: string;
  type: string;
}

// Platform Update types
export interface PlatformUpdate {
  id: string;
  key: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  server_types?: string[];
  status_counts?: Record<string, number>;
  created_at?: string;
}

export interface PlatformUpdateDetail extends PlatformUpdate {
  server_statuses: ServerUpdateStatus[];
}

export interface ServerUpdateStatus {
  id: string;
  server_id: string;
  server_name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  task_id?: string;
  error_message?: string;
  completed_at?: string;
}

// API Response types
export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Stored SSL Certificates (team library — managed in Settings → Connections,
// picked from PHP site SSL + docker domain dialogs).
//
// The backend never sends the private_key over the wire (`json:"-"` on the
// model) — it lives only on the server for deploy-time material. The
// `certificate` field carries the leaf + chain PEM bundle and is safe to
// surface in the UI for fingerprint / domain inspection.
// ---------------------------------------------------------------------------
export interface StoredCertificate {
  id: string;
  team_id: string;
  user_id?: string;
  name: string;
  notes?: string;
  certificate: string;
  domains: string[];
  common_name?: string;
  issuer?: string;
  not_before: string;
  not_after: string;
  serial_number?: string;
  fingerprint_sha256?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface CertificateUsage {
  kind: "site" | "docker_domain";
  id: string;
  name: string;
}

// Admin panel (staff back-office) types
export interface AdminTeamSubscription {
  status: string;
  trial_ends_at?: string | null;
}

export interface AdminTeam {
  id: string;
  name: string;
  personal_team: boolean;
  subscription?: AdminTeamSubscription | null;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  staff_role?: string | null;
  status: string;
  created_at?: string | null;
  teams: AdminTeam[];
}

// Resource tabs on the admin user-detail page. Each mirrors the secret-safe
// allow-list DTO returned by the matching /admin/users/:id/* endpoint.
export interface AdminServerSummary {
  id: string;
  team_id: string;
  user_id: string;
  name: string;
  description?: string | null;
  provider: string;
  type?: string | null;
  status: string;
  public_ipv4?: string | null;
  connected: boolean;
  operating_system?: string | null;
  cpu_cores?: number | null;
  memory_in_mb?: number | null;
  storage_in_gb?: number | null;
  provisioned_at?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminSiteSummary {
  id: string;
  server_id: string;
  server_name: string;
  address: string;
  type: string;
  tls_setting: string;
  repository_branch?: string | null;
  created_at?: string | null;
}

export interface AdminSubscriptionSummary {
  team_id: string;
  team_name: string;
  status: string;
  type: string;
  trial_ends_at?: string | null;
  renews_at?: string | null;
  ends_at?: string | null;
  card_brand?: string | null;
  card_last_four?: string | null;
  created_at: string;
}

export interface AdminServerOwner {
  team_id: string;
  team_name: string;
  personal_team: boolean;
  user_id: string;
  user_name: string;
  user_email: string;
}

export interface AdminServerDetail {
  id: string;
  name: string;
  description?: string | null;
  provider: string;
  type?: string | null;
  status: string;
  connected: boolean;
  public_ipv4?: string | null;
  cpu_cores?: number | null;
  memory_in_mb?: number | null;
  storage_in_gb?: number | null;
  operating_system?: string | null;
  detected_os_id?: string | null;
  detected_os_version?: string | null;
  detected_arch?: string | null;
  detected_kernel?: string | null;
  monitoring_enabled: boolean;
  auto_update: boolean;
  provisioned_at?: string | null;
  last_connectivity_check?: string | null;
  created_at?: string | null;
  owner: AdminServerOwner;
}

export interface RecentPayment {
  team_id: string;
  team_name: string;
  total: number;
  currency: string;
  ordered_at?: string | null;
}

export interface RevenueMonth {
  month: string;
  total: number;
}

export interface AdminOverview {
  currency: string;
  mrr_cents: number;
  total_revenue_cents: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  new_subscriptions_mtd: number;
  cancelled_mtd: number;
  revenue_this_month_cents: number;
  revenue_last_month_cents: number;
  recent_payments: RecentPayment[];
  revenue_trend: RevenueMonth[];
}

export interface AdminFailure {
  kind: string;
  id: string;
  title: string;
  team_id?: string;
  server_id?: string;
  when?: string | null;
  error: string;
  detail?: string;
}

export interface AdminFailuresResponse {
  failures: AdminFailure[];
  caveat: string;
}

export interface PlatformInvitation {
  id: string;
  email: string;
  plan_id?: string;
  trial_ends_at: string;
  invited_by: string;
  accepted_at?: string | null;
  expires_at: string;
  created_at?: string | null;
}

export interface AdminPlan {
  id: string;
  name: string;
  monthly_pricing: number;
  yearly_pricing: number;
  recommended: boolean;
}

export interface QueryEntry {
  sql: string;
  duration_ns: number;
  rows: number;
  caller: string;
  trace_id?: string;
  slow: boolean;
  error?: string;
  timestamp: string;
}

export interface N1Pattern {
  sql: string;
  count: number;
  trace_id: string;
  caller: string;
  total_ms: number;
  timestamp: string;
}

export interface RuntimeStats {
  goroutines: number;
  heap_alloc_mb: number;
  heap_inuse_mb: number;
  heap_objects_k: number;
  stack_inuse_mb: number;
  sys_mem_mb: number;
  num_gc: number;
  last_gc_pause_ms: number;
  gc_cpu_percent: number;
  num_cpu: number;
  uptime: string;
}

export interface DBPoolStats {
  max_open: number;
  open: number;
  in_use: number;
  idle: number;
  wait_count: number;
  wait_duration: string;
}

export interface ObservabilitySnapshot {
  runtime: RuntimeStats;
  db_pool: DBPoolStats;
  queries: {
    total: number;
    slow_count: number;
    n1_count: number;
    avg_ms: number;
    recent: QueryEntry[];
    slow_queries: QueryEntry[];
    n1_patterns: N1Pattern[];
  };
  uptime: string;
  timestamp: string;
}
