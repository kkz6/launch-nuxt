<script setup lang="ts">
import type { Server } from '~/types'

interface Props {
  server: Server
}

const props = defineProps<Props>()

const activeMenu = ref('settings')

interface NavLink {
  title: string
  icon: string
  value: string
  show?: boolean
}

const navLinks = computed<NavLink[]>(() => [
  { title: 'Settings', icon: 'lucide:settings', value: 'settings' },
  { title: 'Backups', icon: 'lucide:database-backup', value: 'backups', show: true },
  { title: 'SSH Keys', icon: 'lucide:key-round', value: 'ssh-keys' },
  { title: 'Packages', icon: 'lucide:package-plus', value: 'packages' },
  { title: 'PHP', icon: 'lucide:file-code', value: 'php' },
  { title: 'Services', icon: 'lucide:boxes', value: 'services' },
])
</script>

<template>
  <div class="flex w-full flex-row flex-wrap gap-6 md:flex-nowrap">
    <div class="w-full md:max-w-[18rem]">
      <nav class="flex flex-col space-y-1">
        <button
          v-for="link in navLinks"
          :key="link.value"
          type="button"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            activeMenu === link.value
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          ]"
          @click="activeMenu = link.value"
        >
          <Icon :name="link.icon" class="h-4 w-4" />
          {{ link.title }}
        </button>
      </nav>
    </div>

    <div class="flex w-full flex-col gap-4">
      <ServerSettingsGeneral v-if="activeMenu === 'settings'" :server="server" />
      <ServerSettingsBackups v-if="activeMenu === 'backups'" :server-id="server.id" />
      <ServerSettingsSshKeys v-if="activeMenu === 'ssh-keys'" :server-id="server.id" />
      <ServerSettingsPackages v-if="activeMenu === 'packages'" :server-id="server.id" />
      <ServerSettingsPhp v-if="activeMenu === 'php'" :server-id="server.id" />
      <ServerSettingsServices v-if="activeMenu === 'services'" :server-id="server.id" />
    </div>
  </div>
</template>
