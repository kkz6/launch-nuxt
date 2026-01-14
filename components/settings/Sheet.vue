<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Button } from '~/components/ui/button'

const { isOpen, initialTab } = useSettingsSheet()

const activeTab = ref('general')
const tabsContainer = ref<HTMLElement | null>(null)
const showLeftArrow = ref(false)
const showRightArrow = ref(true)

const tabs = [
  { value: 'general', label: 'General', icon: 'lucide:user' },
  { value: 'connections', label: 'Connections', icon: 'lucide:plug' },
  { value: 'ssh-keys', label: 'SSH Keys', icon: 'lucide:key-round' },
  { value: 'security', label: 'Security', icon: 'lucide:shield' },
  { value: 'notifications', label: 'Notifications', icon: 'lucide:bell' },
  { value: 'billing', label: 'Billing', icon: 'lucide:credit-card' },
  { value: 'danger', label: 'Danger Zone', icon: 'lucide:alert-triangle' },
]

const updateArrows = () => {
  if (!tabsContainer.value) return
  const { scrollLeft, scrollWidth, clientWidth } = tabsContainer.value
  showLeftArrow.value = scrollLeft > 0
  showRightArrow.value = scrollLeft < scrollWidth - clientWidth - 1
}

const scrollTabs = (direction: 'left' | 'right') => {
  if (!tabsContainer.value) return
  const scrollAmount = 150
  tabsContainer.value.scrollBy({
    left: direction === 'left' ? -scrollAmount : scrollAmount,
    behavior: 'smooth',
  })
}

// Reset to general tab (or initialTab) when sheet opens
watch(isOpen, (open) => {
  if (open) {
    activeTab.value = initialTab.value || 'general'
    initialTab.value = null
    nextTick(() => {
      if (tabsContainer.value) {
        // Scroll to make active tab visible
        const activeTabIndex = tabs.findIndex(t => t.value === activeTab.value)
        if (activeTabIndex > 0) {
          tabsContainer.value.scrollLeft = activeTabIndex * 100
        } else {
          tabsContainer.value.scrollLeft = 0
        }
        updateArrows()
      }
    })
  }
})

onMounted(() => {
  nextTick(updateArrows)
})
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent
      class="!inset-x-2 !inset-y-2 !h-auto w-auto rounded-lg border sm:!inset-y-auto sm:!left-auto sm:!top-16 sm:!right-3 sm:!bottom-4 sm:w-full sm:max-w-2xl"
      :show-close="true"
    >
      <SheetHeader class="pb-4">
        <SheetTitle class="text-xl">Settings</SheetTitle>
      </SheetHeader>

      <Tabs v-model="activeTab" class="w-full">
        <div class="relative mb-4">
          <!-- Left Arrow -->
          <Button
            v-show="showLeftArrow"
            variant="ghost"
            size="sm"
            class="absolute -left-2 top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full border bg-background p-0 shadow-sm"
            @click="scrollTabs('left')"
          >
            <Icon name="lucide:chevron-left" class="size-4" />
          </Button>

          <!-- Tabs Container -->
          <div
            ref="tabsContainer"
            class="scrollbar-hide overflow-x-auto"
            :class="{ 'pl-6': showLeftArrow, 'pr-6': showRightArrow }"
            @scroll="updateArrows"
          >
            <TabsList class="inline-flex h-auto w-max gap-1 bg-transparent p-0">
              <TabsTrigger
                v-for="tab in tabs"
                :key="tab.value"
                :value="tab.value"
                class="shrink-0 rounded-md px-2 py-1.5 text-sm data-[state=active]:bg-muted sm:px-3"
              >
                <Icon :name="tab.icon" class="block size-4 sm:mr-1.5" />
                <span class="hidden sm:inline">{{ tab.label }}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <!-- Right Arrow -->
          <Button
            v-show="showRightArrow"
            variant="ghost"
            size="sm"
            class="absolute -right-2 top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full border bg-background p-0 shadow-sm"
            @click="scrollTabs('right')"
          >
            <Icon name="lucide:chevron-right" class="size-4" />
          </Button>
        </div>

        <ScrollArea class="h-[calc(100vh-10rem)] sm:h-[calc(100vh-14rem)]">
          <TabsContent value="general" class="mt-0 pr-4">
            <SettingsGeneralTab />
          </TabsContent>

          <TabsContent value="connections" class="mt-0 pr-4">
            <SettingsConnectionsTab />
          </TabsContent>

          <TabsContent value="ssh-keys" class="mt-0 pr-4">
            <SettingsSSHKeysTab />
          </TabsContent>

          <TabsContent value="security" class="mt-0 pr-4">
            <SettingsSecurityTab />
          </TabsContent>

          <TabsContent value="notifications" class="mt-0 pr-4">
            <SettingsNotificationsTab />
          </TabsContent>

          <TabsContent value="billing" class="mt-0 pr-4">
            <SettingsBillingTab />
          </TabsContent>

          <TabsContent value="danger" class="mt-0 pr-4">
            <SettingsDangerTab />
          </TabsContent>
        </ScrollArea>
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
