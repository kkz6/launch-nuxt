<script setup lang="ts">
interface Tab {
  value: string
  label: string
  route: string
  icon?: string
}

interface Props {
  tabs: Tab[]
  activeTab: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:activeTab': [value: string]
}>()

const router = useRouter()

const handleTabClick = (tab: Tab) => {
  emit('update:activeTab', tab.value)
  router.push(tab.route)
}
</script>

<template>
  <div class="border-b border-border">
    <nav class="-mb-px flex gap-6">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        class="relative flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors"
        :class="[
          activeTab === tab.value
            ? 'border-foreground text-foreground'
            : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
        ]"
        @click="handleTabClick(tab)"
      >
        <Icon v-if="tab.icon" :name="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </button>
    </nav>
  </div>
</template>
