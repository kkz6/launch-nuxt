<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'

interface Props {
  title: string
  description?: string
  output: string
}

const props = defineProps<Props>()

const isOpen = ref(false)

// Parse ANSI codes to styled spans
const parseAnsi = (text: string) => {
  // Basic ANSI color codes mapping
  const ansiColors: Record<string, string> = {
    '30': 'color: #000',
    '31': 'color: #e74c3c',
    '32': 'color: #2ecc71',
    '33': 'color: #f39c12',
    '34': 'color: #3498db',
    '35': 'color: #9b59b6',
    '36': 'color: #1abc9c',
    '37': 'color: #ecf0f1',
    '90': 'color: #7f8c8d',
    '91': 'color: #e74c3c',
    '92': 'color: #2ecc71',
    '93': 'color: #f1c40f',
    '94': 'color: #3498db',
    '95': 'color: #9b59b6',
    '96': 'color: #1abc9c',
    '97': 'color: #fff',
  }

  // Remove ANSI codes and return plain text with spans
  const parts: { text: string; style: string }[] = []
  let currentStyle = ''
  let lastIndex = 0

  // Match ANSI escape sequences
  const ansiRegex = /\x1b\[([0-9;]*)m/g
  let match

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), style: currentStyle })
    }

    // Update style based on codes
    const codes = match[1].split(';')
    for (const code of codes) {
      if (code === '0' || code === '') {
        currentStyle = ''
      } else if (code === '1') {
        currentStyle += 'font-weight: bold;'
      } else if (ansiColors[code]) {
        currentStyle += ansiColors[code] + ';'
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), style: currentStyle })
  }

  return parts
}

const parsedOutput = computed(() => parseAnsi(props.output || ''))

const handleCopy = async () => {
  try {
    // Copy plain text without ANSI codes
    const plainText = props.output.replace(/\x1b\[[0-9;]*m/g, '')
    await navigator.clipboard.writeText(plainText)
  } catch {
    // Fallback
  }
}

const handleDownload = () => {
  const plainText = props.output.replace(/\x1b\[[0-9;]*m/g, '')
  const blob = new Blob([plainText], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `output-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger as-child>
      <slot />
    </SheetTrigger>
    <SheetContent
      class="!inset-x-4 !inset-y-4 flex !h-auto w-auto flex-col overflow-hidden rounded-lg border sm:!inset-y-auto sm:!left-auto sm:!top-16 sm:!right-3 sm:!bottom-4 sm:w-full sm:max-w-3xl"
      :show-close="true"
    >
      <SheetHeader class="flex-shrink-0 pb-4">
        <SheetTitle>{{ title }}</SheetTitle>
        <div v-if="description" class="flex items-center gap-2">
          <code class="rounded bg-muted px-2 py-1 text-xs">{{ description }}</code>
          <TooltipProvider :delay-duration="0">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleCopy">
                  <Icon name="lucide:copy" class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider :delay-duration="0">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleDownload">
                  <Icon name="lucide:download" class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-950">
        <ScrollArea class="h-full p-4">
          <pre class="whitespace-pre-wrap break-words font-mono text-sm text-zinc-100"><template
            v-for="(part, index) in parsedOutput"
            :key="index"
          ><span :style="part.style">{{ part.text }}</span></template></pre>
        </ScrollArea>
      </div>
    </SheetContent>
  </Sheet>
</template>
