import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { computed } from 'vue'
import ServiceStatusDialog from '../../components/server/settings/ServiceStatusDialog.vue'
import Services from '../../components/server/settings/Services.vue'

const emptyValue = new Proxy(() => emptyValue, {
  get: (_target, key) => {
    if (key === Symbol.toPrimitive) return () => ''
    if (key === Symbol.iterator) return function* () {}
    if (key === 'then' || key === 'toJSON') return undefined
    return emptyValue
  },
})

const collectText = (node: unknown, text: string[] = [], seen = new Set<object>()): string[] => {
  if (typeof node === 'string') {
    text.push(node)
    return text
  }
  if (!node || typeof node !== 'object' || seen.has(node as object)) return text
  seen.add(node as object)

  if (Array.isArray(node)) {
    for (const child of node) collectText(child, text, seen)
    return text
  }

  const vnode = node as { children?: unknown }
  if (typeof vnode.children === 'string') {
    text.push(vnode.children)
  } else if (Array.isArray(vnode.children)) {
    collectText(vnode.children, text, seen)
  } else if (vnode.children && typeof vnode.children === 'object') {
    for (const slot of Object.values(vnode.children)) {
      if (typeof slot === 'function') collectText(slot(emptyValue), text, seen)
    }
  }

  return text
}

const renderServiceMenu = (canRemove: boolean) => {
  const service = {
    id: 'service-1',
    server_id: 'server-1',
    type: 'memory_database',
    type_label: 'Redis',
    name: 'Redis',
    version: '7.2.0',
    status: 'missing',
    status_label: 'Not Installed',
    is_default: false,
    can_remove: canRemove,
    software: 'redis',
    software_label: 'Redis',
    created_at: '2026-08-12T00:00:00Z',
    updated_at: '2026-08-12T00:00:00Z',
  }
  const setupValues = {
    agentUpdateInProgress: false,
    agentVersion: null,
    isLoading: false,
    isLoadBalancer: false,
    services: [service],
    sortedServices: [service],
    loadingAction: null,
    logsByService: new Map(),
    selectedPhpService: null,
    selectedServiceForStatus: null,
    getDisplayStatus: () => ({ status: 'missing', label: 'Not Installed' }),
    displayVersion: () => service.version,
    getServiceImagePath: () => '/images/services/memory_database.svg',
    canStart: () => false,
    canStop: () => false,
    canRestart: () => false,
    wsConnected: true,
    wsConnecting: false,
    wsError: null,
    wsLastUpdated: null,
  }
  const setup = new Proxy(setupValues, {
    get: (target, key) => key in target ? target[key as keyof typeof target] : emptyValue,
  })
  const context = new Proxy({}, { get: () => emptyValue })
  const props = { serverId: 'server-1', serverType: 'php' }
  const render = (Services as { render?: (...args: unknown[]) => unknown }).render

  expect(render).toBeTypeOf('function')
  const vnode = render!(context, [], props, setup, {}, {})
  return collectText(vnode).join(' ')
}

describe('service removal menu', () => {
  beforeAll(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal('computed', computed)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows Uninstall for removable Redis records', () => {
    expect(renderServiceMenu(true)).toContain('Uninstall')
  })

  it('does not show Uninstall when the API protects a service', () => {
    expect(renderServiceMenu(false)).not.toContain('Uninstall')
  })

  it('labels a missing live service as Not Installed', () => {
    const wrapper = shallowMount(ServiceStatusDialog, {
      props: {
        open: true,
        service: {
          id: 'service-1',
          server_id: 'server-1',
          type: 'memory_database',
          type_label: 'Redis',
          name: 'Redis',
          version: '7.2.0',
          status: 'stopped',
          status_label: 'Stopped',
          is_default: false,
          software: 'redis',
          software_label: 'Redis',
          created_at: '2026-08-12T00:00:00Z',
          updated_at: '2026-08-12T00:00:00Z',
        },
        getImagePath: () => '/images/services/memory_database.svg',
        liveStatus: { status: 'missing' },
      },
      global: {
        renderStubDefaultSlot: true,
        stubs: {
          Icon: {
            props: ['name'],
            template: '<i :data-name="name" />',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Not Installed')
    expect(wrapper.find('[data-name="lucide:circle-off"]').exists()).toBe(true)
  })
})
