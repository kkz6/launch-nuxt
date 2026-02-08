import { serverService } from '~/services/serverService'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const serverId = to.params.id as string
  if (!serverId) return

  // Check shared cache first (populated when clicking from server list)
  const navbarServerCache = useState<{ id: string; status: string } | null>('navbarServerCache', () => null)
  const cached = navbarServerCache.value
  if (cached && cached.id === serverId) {
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
