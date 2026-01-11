export type ServerProvider = 'digitalocean' | 'hetzner' | 'linode' | 'vultr' | 'aws'

export type StorageProvider = 's3'

export interface SubscriptionPlan {
  id: number
  name: string
  short_description: string
  monthly_id: string
  yearly_id: string
  features: string[]
  archived: boolean
  recommended: boolean
  monthly_pricing: number
  yearly_pricing: number
  options: {
    max_servers: number
    max_sites_per_server: number
    max_deployments_per_site: number
    max_team_members: number
    has_backups: boolean
  }
}

export interface CommitData {
  sha: string
  url: string
  name: string
  email: string
  message: string
}

export interface InstallationStatus {
  installed_at: Date | null
  installation_failed_at: Date | null
  uninstallation_requested_at: Date | null
  uninstallation_failed_at: Date | null
}

export interface PaginatedResponse<T> {
  current_page: number
  data: T[]
  first_page_url: string
  from: number
  last_page: number
  last_page_url: string
  links: {
    url: string | null
    label: string
    active: boolean
  }[]
  next_page_url: string | null
  path: string
  per_page: number
  prev_page_url: string | null
  to: number
  total: number
}

export interface User {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  current_team_id: number | null
  profile_photo_path: string | null
  created_at: string
  updated_at: string | null
  two_factor_confirmed_at: string | null
  profile_photo_url: string
  timezone: string
  onboarded: boolean
  all_teams?: Team[] | null
  current_team?: Team
  two_factor_enabled?: boolean
  membership?: TeamMember
}

export interface Team {
  id: string
  user_id: string
  name: string
  image_path: string | null
  image_url: string
  personal_team: boolean
  created_at: string
  updated_at: string
  owner?: User
  users?: User[]
  team_invitations?: TeamInvitation[]
}

export interface TeamMember {
  team_id: number
  user_id: number
  role: string
  created_at: string
  updated_at: string
}

export interface TeamInvitation {
  id: string
  team_id: string
  email: string
  role: string
  created_at: string | null
  updated_at: string | null
}

export interface Server {
  id: string
  team_id: string
  user_id: string
  source_control_id: string
  server_provider_id: string
  name: string
  description: string
  provider: string
  provider_data: Record<string, string>
  type: 'php' | 'database'
  connected: boolean
  cpu_cores: string
  memory_in_mb: string
  storage_in_gb: string
  operating_system: string
  status: string
  public_ipv4: string
  private_ipv4: string
  public_key: string
  private_key: string
  user_public_key: string
  username: string
  password: string
  database_password: string
  ssh_port: string
  working_directory: string
  completed_provision_steps: string
  provisioned_at: string
  provision_command: string
  uninstallation_requested_at: string
  updates: string
  auto_update: string
  available_updates: string
  security_updates: string
  last_update_check: string
  progress: string
  progress_step: string
  created_at: string
  name_with_ip: string
  sites_count: number
}

export interface Site extends InstallationStatus {
  id: string
  server_id: string
  user_id: string
  source_control_id: string
  address: string
  name: string
  type: 'laravel' | 'wordpress' | 'generic'
  typeData?: Record<string, never> | null
  aliases?: Record<string, never> | null
  tls_setting: string
  zero_downtime_deployment: boolean
  deployment_releases_retention: number
  repository_url?: string | null
  repository?: string | undefined
  repository_branch: string | undefined
  deploy_token: string
  deployNotificationEmail?: string | null
  deployKeyPublic?: string | null
  deployKeyPrivate?: string | null
  user: string
  path: string
  web_folder: string
  app_directory: string
  php_version?: string | undefined
  pending_tls_update_since?: Date | null
  pending_caddyfile_update_since?: Date | null
  shared_directories: string[]
  writeable_directories: string[]
  shared_files: string[]
  port?: number | null
  progress?: number | null
  hook_before_updating_repository?: string
  hook_after_updating_repository?: string
  hook_before_making_current?: string
  hook_after_making_current?: string
  features?: string[]
  enabled_features?: string[]
  pending_features?: string[]
  url: string
  created_at: string
  updated_at: string
  source_control_repository?: {
    html_url: string
  }
  latest_deployment?: Deployment
}

export interface Deployment {
  id: string
  site_id: string
  user_id: string | null
  task_id: string
  git_hash: string
  status: string
  vcs_data: VcsData
  commit_data: CommitData
  user_notified_at: string
  created_at: string
  updated_at: string
  task?: Task
  user: null | User
}

export interface VcsData {
  id: number
  ref: string
  sha: string
  url: string
  task: string
  node_id: string
  created_at: string
  updated_at: string
  description: string
  environment: string
  statuses_url: string
  repository_url: string
  original_environment: string
  transient_environment: boolean
  production_environment: boolean
}

export interface Task {
  server_id: string
  user_id: string
  name: string
  user: string
  type: string
  status: string
  output: string
  created_at: string
  updated_at: string
}

export interface GitProvider {
  id: string
  user_id: string
  team_id: string
  provider: 'github' | 'gitlab' | 'bitbucket'
  url: string
  provider_id: string
  provider_data: {
    avatar_url: string
    created_at: string
    id: string
    name: string
    username: string
  }
  created_at: string
}

export interface Subscription {
  id: number
  team_id: string
  type: string
  stripe_id: string
  stripe_status: string
  stripe_price?: string
  quantity?: number
  trial_ends_at?: Date | null
  ends_at?: Date | null
  created_at?: Date | null
  updated_at?: Date | null
}

export interface SSHKey {
  id: string
  user_id: string
  public_key: string
  description: string
  name: string
  fingerprint: string
  remove_url: string
  created_at: string
  updated_at: string
}

export interface Database extends InstallationStatus {
  id: string
  name: string
  created_at: string
}

export interface DatabaseUser extends InstallationStatus {
  id: string
  name: string
  status: string
  password: string
  update_url: string
  databaseIds: string[]
}

export interface Service {
  id: string
  server_id: string
  type: string
  name: string
  version: string
  status: string
  is_default: number
  unit: string
  software: string
  created_at: string
  updated_at: string
}

export interface ApiToken {
  id: number
  name: string
  abilities: string[]
  last_used_ago: string | null
  last_used_at: string | null
  created_at: string | null
  updated_at: string | null
  tokeneable_id: number
  tokeneable_type: string
}

export interface NotificationChannel {
  id: string
  label: string
  provider: 'slack' | 'telegram' | 'discord' | 'email'
  data: Record<string, string>
  connected: string
}

export interface Cron extends InstallationStatus {
  id: string
  server_id: string
  user: string
  expression: string
  command: string
  frequency: string
  hidden: boolean
  status: string
}

export interface QueueDaemon extends InstallationStatus {
  id: string
  server_id: string
  command: string
  directory?: string
  user: string
  processes: number
  stop_wait_seconds: number
  stop_signal: string
  running: boolean
  info?: string
  last_status_check: string | null
}

export interface Backup {
  id: string
  server_id: string
  storage_provider_id: string
  source_type: 'database' | 'files'
  source_id: string | null
  database_type: 'mysql' | 'postgresql'
  database_name: string
  files_path: string | null
  storage_path: string
  frequency: string
  hour: number
  minute: number
  keep_backups: number
  status: string
  last_backup_at: string | null
  created_at: string
  updated_at: string
}

export interface LogInfo {
  name: string
  software: string
  show_route: string
}

export interface FirewallRule {
  update_url: string
  id: string
  server_id: string
  user_id: string
  name: string
  action: string
  port: string
  from_ipv4: string | null
  mask: string
  note: string | null
  status: string
  installed_at: string | null
  installation_failed_at: string | null
  uninstallation_requested_at: string | null
  uninstallation_failed_at: string | null
}

export interface ConnectedServerProvider {
  id: number
  profile: string
  provider: ServerProvider
  connected: boolean
  created_at: string
}

export interface StorageProviderRecord {
  id: number
  user_id: number
  team_id: number
  provider: string
  label: string
  token: string
  credentials: {
    key?: string
    secret?: string
    region?: string
    bucket?: string
    endpoint?: string
  }
  refresh_token: string
  connected: boolean
  token_expires_at: string | null
  backup_jobs_count: number
}

export interface Passkey {
  id: string
  name: string
  credential_id: string
  created_at: string
  last_used_at?: string
  transports?: string[]
}

export interface UserSession {
  agent: {
    browser: string
    is_desktop: boolean
    platform: string
  }
  ip_address: string
  is_current_device: boolean
  last_active: string
}

export interface SearchResultItem {
  name: string
  url: string
  type: string
  info: string
}

export interface SearchResultGroup {
  label: string
  data: SearchResultItem[]
}

// Auth types
export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface AuthResponse {
  token: string
  user: User
}

// API Response types
export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}
