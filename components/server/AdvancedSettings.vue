<script setup lang="ts">
import type { Server } from '~/types'

interface Props {
  server: Server
  activeSubTab: string
}

defineProps<Props>()
</script>

<template>
  <div class="w-full">
    <ServerSettingsGeneral v-if="activeSubTab === 'general'" :server="server" />
    <ServerSettingsBackups v-if="activeSubTab === 'backups'" :server-id="server.id" />
    <ServerSettingsSshKeys v-if="activeSubTab === 'ssh-keys'" :server-id="server.id" />
    <ServerSettingsPackages v-if="activeSubTab === 'packages'" :server-id="server.id" />
    <ServerSettingsServices v-if="activeSubTab === 'services'" :server-id="server.id" :server-type="server.type" />
    <!--
      Traefik panel is docker-only; Navbar only emits subtab=traefik
      for docker servers (see advancedSubTabs computed there). Still
      guard with server.type so a hand-typed URL doesn't render this
      against a PHP server.
    -->
    <ServerDockerTraefik
      v-if="activeSubTab === 'traefik' && server.type === 'docker'"
      :server-id="server.id"
    />
    <!--
      Maintenance panel — docker-only. Currently hosts orphaned-compose
      cleanup; the home for future host-level maintenance actions.
    -->
    <ServerDockerOrphanCleanup
      v-if="activeSubTab === 'maintenance' && server.type === 'docker'"
      :server-id="server.id"
    />
  </div>
</template>
