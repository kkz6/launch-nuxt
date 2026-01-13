<script setup lang="ts">
import { Codemirror } from 'vue-codemirror'
import { EditorView } from '@codemirror/view'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'

interface Props {
  modelValue: string
  disabled?: boolean
  masked?: boolean
  placeholder?: string
  lineNumbers?: boolean
  foldGutter?: boolean
  lineWrapping?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  masked: false,
  placeholder: '',
  lineNumbers: true,
  foldGutter: true,
  lineWrapping: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const colorMode = useColorMode()

const theme = computed(() => {
  return colorMode.value === 'dark' ? githubDark : githubLight
})

const extensions = computed(() => {
  const exts = []

  // Add line wrapping if enabled
  if (props.lineWrapping) {
    exts.push(EditorView.lineWrapping)
  }

  return exts
})

const handleUpdate = (value: string) => {
  emit('update:modelValue', value)
}
</script>

<template>
  <div :class="['relative overflow-hidden rounded-md border', props.class]">
    <Codemirror
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :extensions="extensions"
      :theme="theme"
      :basic-setup="{
        lineNumbers,
        foldGutter,
        highlightSelectionMatches: true,
        highlightActiveLine: !disabled,
        allowMultipleSelections: true,
      }"
      :class="['h-full w-full text-sm leading-relaxed', { 'masked-content': masked }]"
      @update:model-value="handleUpdate"
    />
    <div
      v-if="disabled"
      class="absolute inset-0 flex items-center justify-center rounded-md bg-background/50"
    />
  </div>
</template>

<style>
.cm-editor {
  height: 100%;
}
.cm-scroller {
  overflow: auto;
}
.masked-content .cm-content {
  -webkit-text-security: disc;
  text-security: disc;
}
</style>
