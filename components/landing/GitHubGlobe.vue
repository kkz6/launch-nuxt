<script setup lang="ts">
import createGlobe, { type COBEOptions } from "cobe";

interface Props {
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  className: "",
});

const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [0.3, 0.3, 0.3],
  markerColor: [52 / 255, 211 / 255, 153 / 255], // emerald-400
  glowColor: [0.1, 0.1, 0.1],
  markers: [
    // Cloud provider locations
    { location: [37.7749, -122.4194], size: 0.1 }, // San Francisco (AWS US West)
    { location: [39.0438, -77.4874], size: 0.1 }, // Virginia (AWS US East)
    { location: [51.5074, -0.1278], size: 0.08 }, // London (AWS EU)
    { location: [35.6762, 139.6503], size: 0.08 }, // Tokyo (AWS Asia)
    { location: [1.3521, 103.8198], size: 0.08 }, // Singapore (DigitalOcean)
    { location: [52.52, 13.405], size: 0.08 }, // Berlin (Hetzner)
    { location: [50.1109, 8.6821], size: 0.08 }, // Frankfurt (Hetzner)
    { location: [40.7128, -74.006], size: 0.1 }, // New York (Vultr)
    { location: [34.0522, -118.2437], size: 0.08 }, // Los Angeles (Linode)
    { location: [-33.8688, 151.2093], size: 0.06 }, // Sydney
    { location: [19.076, 72.8777], size: 0.06 }, // Mumbai
  ],
};

const canvasRef = ref<HTMLCanvasElement | null>(null);
const phiRef = ref(0);
const widthRef = ref(0);
const pointerInteracting = ref<number | null>(null);
const pointerInteractionMovement = ref(0);
const r = ref(0);

const updatePointerInteraction = (value: number | null) => {
  pointerInteracting.value = value;
  if (canvasRef.value) {
    canvasRef.value.style.cursor = value ? "grabbing" : "grab";
  }
};

const updateMovement = (clientX: number) => {
  if (pointerInteracting.value !== null) {
    const delta = clientX - pointerInteracting.value;
    pointerInteractionMovement.value = delta;
    r.value = delta / 200;
  }
};

onMounted(() => {
  if (!canvasRef.value) return;

  const onResize = () => {
    if (canvasRef.value) {
      widthRef.value = canvasRef.value.offsetWidth;
    }
  };

  const onRender = (state: Record<string, unknown>) => {
    if (!pointerInteracting.value) phiRef.value += 0.005;
    state.phi = phiRef.value + r.value;
    state.width = widthRef.value * 2;
    state.height = widthRef.value * 2;
  };

  window.addEventListener("resize", onResize);
  onResize();

  const globe = createGlobe(canvasRef.value, {
    ...GLOBE_CONFIG,
    width: widthRef.value * 2,
    height: widthRef.value * 2,
    onRender,
  });

  setTimeout(() => {
    if (canvasRef.value) {
      canvasRef.value.style.opacity = "1";
    }
  });

  onUnmounted(() => {
    globe.destroy();
    window.removeEventListener("resize", onResize);
  });
});
</script>

<template>
  <div
    :class="[
      'absolute inset-0 mx-auto aspect-[1/1] w-full max-w-[600px]',
      props.className,
    ]"
  >
    <canvas
      ref="canvasRef"
      class="size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]"
      @pointerdown="
        (e) => updatePointerInteraction(e.clientX - pointerInteractionMovement)
      "
      @pointerup="() => updatePointerInteraction(null)"
      @pointerout="() => updatePointerInteraction(null)"
      @mousemove="(e) => updateMovement(e.clientX)"
      @touchmove="(e) => e.touches[0] && updateMovement(e.touches[0].clientX)"
    />
  </div>
</template>
