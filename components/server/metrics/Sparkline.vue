<script setup lang="ts">
interface Props {
  data: number[]
  color?: string
  max?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  color: 'rgb(34, 197, 94)',
  max: 100,
  height: 40,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const renderedData = ref<number[]>([])
const animationDuration = 480
let animationFrame: number | null = null

const draw = (data = renderedData.value) => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height
  const max = props.max

  if (data.length < 2) {
    // Draw a flat line if we have less than 2 points
    ctx.clearRect(0, 0, width, height)
    ctx.beginPath()
    ctx.strokeStyle = props.color
    ctx.lineWidth = 1.5
    const y = data.length === 1 ? height - (data[0] / max) * height : height / 2
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
    return
  }

  ctx.clearRect(0, 0, width, height)

  // Draw fill
  ctx.beginPath()
  const step = width / (data.length - 1)

  ctx.moveTo(0, height)
  data.forEach((value, i) => {
    const x = i * step
    const y = height - (value / max) * height
    ctx.lineTo(x, y)
  })
  ctx.lineTo(width, height)
  ctx.closePath()

  // Create gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, props.color.replace('rgb', 'rgba').replace(')', ', 0.2)'))
  gradient.addColorStop(1, props.color.replace('rgb', 'rgba').replace(')', ', 0.02)'))
  ctx.fillStyle = gradient
  ctx.fill()

  // Draw line
  ctx.beginPath()
  data.forEach((value, i) => {
    const x = i * step
    const y = height - (value / max) * height
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.strokeStyle = props.color
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}

const alignPreviousData = (previous: number[], next: number[]) => {
  if (previous.length === 0) return [...next]

  const offset = previous.length - next.length
  return next.map((value, index) => {
    const previousIndex = index + offset
    if (previousIndex < 0) return previous[0] ?? value
    return previous[previousIndex] ?? previous.at(-1) ?? value
  })
}

const animateTo = (next: number[]) => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const previous = alignPreviousData(renderedData.value, next)

  if (prefersReducedMotion || renderedData.value.length === 0) {
    renderedData.value = [...next]
    draw()
    animationFrame = null
    return
  }

  const startedAt = performance.now()
  const animate = (now: number) => {
    const progress = Math.min((now - startedAt) / animationDuration, 1)
    renderedData.value = next.map((value, index) => {
      const start = previous[index] ?? value
      return start + (value - start) * progress
    })
    draw()

    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate)
      return
    }

    animationFrame = null
  }

  animationFrame = requestAnimationFrame(animate)
}

const handleResize = () => draw()

watch(() => props.data, (data) => animateTo([...data]), { deep: true })
watch(() => [props.color, props.max], () => draw())

onMounted(() => {
  renderedData.value = [...props.data]
  draw()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    :style="{ height: `${height}px` }"
    class="w-full"
  />
</template>
