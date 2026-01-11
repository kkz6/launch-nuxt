import { defineStore } from 'pinia'

interface AppState {
  sidebarOpen: boolean
  loading: boolean
  notifications: Notification[]
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timestamp: Date
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    sidebarOpen: true,
    loading: false,
    notifications: [],
  }),

  getters: {
    isSidebarOpen: (state) => state.sidebarOpen,
    isLoading: (state) => state.loading,
    unreadNotifications: (state) => state.notifications.length,
  },

  actions: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    setSidebarOpen(open: boolean) {
      this.sidebarOpen = open
    },

    setLoading(loading: boolean) {
      this.loading = loading
    },

    addNotification(notification: Omit<Notification, 'id' | 'timestamp'>) {
      this.notifications.push({
        ...notification,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      })
    },

    removeNotification(id: string) {
      const index = this.notifications.findIndex((n) => n.id === id)
      if (index > -1) {
        this.notifications.splice(index, 1)
      }
    },

    clearNotifications() {
      this.notifications = []
    },
  },
})
