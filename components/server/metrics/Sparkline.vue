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

const draw = () => {
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
  const data = props.data
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

watch(() => props.data, draw, { deep: true })

onMounted(() => {
  draw()
  window.addEventListener('resize', draw)
})

onUnmounted(() => {
  window.removeEventListener('resize', draw)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    :style="{ height: `${height}px` }"
    class="w-full"
  />
</template>
