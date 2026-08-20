<script setup lang="ts">
interface Props {
  data: number[];
  color?: string;
  max?: number;
  height?: number;
  capacity?: number;
}

const props = withDefaults(defineProps<Props>(), {
  color: "rgb(34, 197, 94)",
  max: 100,
  height: 40,
  capacity: 30,
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
const renderedData = ref<number[]>([]);
const animationDuration = 480;
let animationFrame: number | null = null;
let canvasWidth = 0;
let canvasHeight = 0;

const resizeCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) return false;

  const rect = canvas.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width === canvasWidth && height === canvasHeight) return false;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvasWidth = width;
  canvasHeight = height;
  return true;
};

const draw = (data = renderedData.value, scrollOffset = 0) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  resizeCanvas();

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = canvasWidth;
  const height = canvasHeight;
  const max = props.max;
  const step = width / Math.max(props.capacity - 1, 1);
  const visibleData = data.slice(-props.capacity);
  const startX = width - (visibleData.length - 1) * step + scrollOffset;

  const traceSteps = (values: number[], connectFromBaseline = false) => {
    values.forEach((value, index) => {
      const x = startX + index * step;
      const y = height - (value / max) * height;

      if (index === 0) {
        if (connectFromBaseline) {
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x, y);
        }
        return;
      }

      ctx.lineTo(x, height - ((values[index - 1] ?? value) / max) * height);
      ctx.lineTo(x, y);
    });
  };

  if (visibleData.length < 2) {
    // Draw a flat line if we have less than 2 points
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = props.color;
    ctx.lineWidth = 1.5;
    const y =
      visibleData.length === 1
        ? height - ((visibleData[0] ?? 0) / max) * height
        : height / 2;
    ctx.moveTo(startX, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    return;
  }

  ctx.clearRect(0, 0, width, height);

  // Draw fill
  ctx.beginPath();
  ctx.moveTo(startX, height);
  traceSteps(visibleData, true);
  ctx.lineTo(width, height);
  ctx.closePath();

  // Create gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(
    0,
    props.color.replace("rgb", "rgba").replace(")", ", 0.2)"),
  );
  gradient.addColorStop(
    1,
    props.color.replace("rgb", "rgba").replace(")", ", 0.02)"),
  );
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  traceSteps(visibleData);
  ctx.strokeStyle = props.color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
};

const animateTo = (next: number[]) => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion || renderedData.value.length === 0) {
    renderedData.value = [...next];
    draw();
    animationFrame = null;
    return;
  }

  const startedAt = performance.now();
  const step = canvasWidth / Math.max(props.capacity - 1, 1);
  const animate = (now: number) => {
    const progress = Math.min((now - startedAt) / animationDuration, 1);
    renderedData.value = next;
    draw(next, step * (1 - progress));

    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
      return;
    }

    animationFrame = null;
  };

  animationFrame = requestAnimationFrame(animate);
};

const handleResize = () => {
  resizeCanvas();
  draw();
};

watch(
  () => props.data,
  (data) => animateTo([...data]),
  { deep: true },
);
watch(
  () => [props.color, props.max],
  () => draw(),
);

onMounted(() => {
  renderedData.value = [...props.data];
  draw();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  window.removeEventListener("resize", handleResize);
});
</script>

<template>
  <canvas ref="canvasRef" :style="{ height: `${height}px` }" class="w-full" />
</template>
