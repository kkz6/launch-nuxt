const isOpen = ref(false)
// Owned here (not in Sheet.vue) so `open('connections')` sets the active
// tab *before* the sheet — and its Tabs — render. Setting it after open
// (the old initialTab + watch approach) raced the Tabs' own init and left
// the requested tab unselected.
const activeTab = ref('general')

export const useSettingsSheet = () => {
  const open = (tab?: string) => {
    activeTab.value = tab || 'general'
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
  }

  return {
    isOpen,
    activeTab,
    open,
    close,
  }
}
