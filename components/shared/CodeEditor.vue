<script setup lang="ts">
import { Codemirror } from 'vue-codemirror'
import { EditorView } from '@codemirror/view'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'

interface Props {
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

const modelValue = defineModel<string>({ default: '' })

const colorMode = useColorMode()

const theme = computed(() => {
  return colorMode.value === 'dark' ? githubDark : githubLight
})

const basicSetup = computed(() => ({
  lineNumbers: props.lineNumbers,
  foldGutter: props.foldGutter,
  highlightSelectionMatches: true,
  highlightActiveLine: !props.disabled,
  highlightActiveLineGutter: !props.disabled,
  allowMultipleSelections: true,
}))

const extensions = computed(() => {
  const exts: any[] = []
  exts.push(theme.value)
  if (props.lineWrapping) {
    exts.push(EditorView.lineWrapping)
  }
  return exts
})

// Generate a key to force re-mount when settings change
const editorKey = computed(() => `${props.lineNumbers}-${props.foldGutter}-${colorMode.value}`)
</script>

<template>
  <div :class="['relative overflow-hidden rounded-md border', props.class, { 'no-line-numbers': !lineNumbers }]">
    <Codemirror
      :key="editorKey"
      v-model="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :extensions="extensions"
      :basic-setup="basicSetup"
      :class="['h-full w-full text-sm leading-relaxed', { 'masked-content': masked }]"
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
/* Hide line numbers when not needed */
.no-line-numbers .cm-lineNumbers {
  display: none !important;
}
.no-line-numbers .cm-gutters {
  border-right: none !important;
  background: transparent !important;
}
</style>
