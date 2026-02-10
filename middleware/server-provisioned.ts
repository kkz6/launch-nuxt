import { serverService } from '~/services/serverService'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const serverId = to.params.id as string
  if (!serverId) return

  // Check shared cache first (populated when clicking from server list)
  const { getCachedServer } = useNavbarCache()
  const cached = getCachedServer(serverId)
  if (cached) {
    if (cached.status !== 'running') {
      return navigateTo('/servers')
    }
    return
  }

  // Direct navigation (no cache) - fetch to verify server is provisioned
  try {
    const { data: server } = await serverService.get(serverId)
    if (server.status !== 'running') {
      return navigateTo('/servers')
    }
  } catch {
    return navigateTo('/servers')
  }
})
