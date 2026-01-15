<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { ScrollArea } from '~/components/ui/scroll-area'

const { isOpen, initialTab } = useSettingsSheet()

const activeTab = ref('general')
const tabsContainer = ref<HTMLElement | null>(null)
const contentContainer = ref<HTMLElement | null>(null)
const isScrolled = ref(false)

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  isScrolled.value = target.scrollTop > 0
}

const tabs = [
  { value: 'general', label: 'General' },
  { value: 'teams', label: 'Members' },
  { value: 'connections', label: 'Connections' },
  { value: 'ssh-keys', label: 'SSH Keys' },
  { value: 'security', label: 'Security' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'billing', label: 'Billing' },
  { value: 'danger', label: 'Danger Zone' },
]

// Reset to general tab (or initialTab) when sheet opens
watch(isOpen, (open) => {
  if (open) {
    activeTab.value = initialTab.value || 'general'
    initialTab.value = null
    isScrolled.value = false
    nextTick(() => {
      if (tabsContainer.value) {
        const activeTabIndex = tabs.findIndex(t => t.value === activeTab.value)
        if (activeTabIndex > 0) {
          tabsContainer.value.scrollLeft = activeTabIndex * 100
        } else {
          tabsContainer.value.scrollLeft = 0
        }
      }
      if (contentContainer.value) {
        contentContainer.value.scrollTop = 0
      }
    })
  }
})
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent
      class="flex !inset-x-2 !inset-y-2 !h-auto w-auto flex-col gap-0 rounded-lg border p-0 sm:!inset-y-auto sm:!left-auto sm:!top-16 sm:!right-3 sm:!bottom-4 sm:w-full sm:max-w-2xl"
      :show-close="true"
    >
      <SheetHeader class="flex-shrink-0 px-6 pt-6 pb-0">
        <SheetTitle class="text-xl font-semibold">Settings</SheetTitle>
      </SheetHeader>

      <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
        <!-- Tabs Navigation -->
        <div
          class="relative flex-shrink-0 border-b transition-shadow duration-200"
          :class="isScrolled ? 'shadow-md' : ''"
        >
          <div
            ref="tabsContainer"
            class="scrollbar-hide overflow-x-auto px-6"
          >
            <TabsList class="inline-flex h-auto w-max gap-1 bg-transparent p-0">
              <TabsTrigger
                v-for="tab in tabs"
                :key="tab.value"
                :value="tab.value"
                class="relative shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {{ tab.label }}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <!-- Tab Content -->
        <div
          ref="contentContainer"
          class="min-h-0 flex-1 overflow-y-auto"
          @scroll="handleScroll"
        >
          <div class="py-6">
            <TabsContent value="general" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SettingsGeneralTab />
            </TabsContent>

            <TabsContent value="teams" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SettingsTeamsTab />
            </TabsContent>

            <TabsContent value="connections" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SettingsConnectionsTab />
            </TabsContent>

            <TabsContent value="ssh-keys" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SettingsSSHKeysTab />
            </TabsContent>

            <TabsContent value="security" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SettingsSecurityTab />
            </TabsContent>

            <TabsContent value="notifications" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SettingsNotificationsTab />
            </TabsContent>

            <TabsContent value="billing" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SettingsBillingTab />
            </TabsContent>

            <TabsContent value="danger" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SettingsDangerTab />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
