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
  </div>
</template>
