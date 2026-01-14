const isOpen = ref(false)
const initialTab = ref<string | null>(null)

export const useSettingsSheet = () => {
  const open = (tab?: string) => {
    if (tab) {
      initialTab.value = tab
    }
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
    initialTab.value = null
  }

  return {
    isOpen,
    initialTab,
    open,
    close,
  }
}
