import { serverService } from '~/services/serverService'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const serverId = to.params.id as string
  if (!serverId) return

  try {
    const { data: server } = await serverService.get(serverId)
    if (server.status !== 'running') {
      return navigateTo('/servers')
    }
  } catch {
    return navigateTo('/servers')
  }
})
