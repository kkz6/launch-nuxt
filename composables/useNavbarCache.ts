import type { Server, Site } from '~/types'

export const useNavbarCache = () => {
  const serverCache = useState<Server | null>('navbarServerCache', () => null)
  const siteCache = useState<Pick<Site, 'id' | 'address' | 'type' | 'server_id'> | null>('navbarSiteCache', () => null)

  const cacheServer = (server: Server) => {
    serverCache.value = server
  }

  const cacheSite = (site: Pick<Site, 'id' | 'address' | 'type' | 'server_id'>) => {
    siteCache.value = site
  }

  const getCachedServer = (id: string) => {
    const cached = serverCache.value
    if (cached && cached.id === id) {
      return cached
    }
    return null
  }

  const consumeCachedServer = (id: string) => {
    const cached = getCachedServer(id)
    if (cached) {
      serverCache.value = null
    }
    return cached
  }

  const getCachedSite = (id: string) => {
    const cached = siteCache.value
    if (cached && cached.id === id) {
      return cached
    }
    return null
  }

  return {
    cacheServer,
    cacheSite,
    getCachedServer,
    consumeCachedServer,
    getCachedSite,
  }
}
