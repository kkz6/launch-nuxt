<script setup lang="ts">
import AOS from "aos";
import "aos/dist/aos.css";

onMounted(() => {
  const element = document.querySelector("html");
  if (element) {
    element.classList.remove("overflow-hidden");
  }
  AOS.init({
    once: true,
    disable: "phone",
    duration: 700,
    easing: "ease-out-cubic",
  });
});
</script>

<template>
  <div
    class="flex min-h-screen flex-col overflow-hidden bg-[hsl(var(--site-bg))] supports-[overflow:clip]:overflow-clip"
  >
    <LandingSiteHeader />
    <main class="grow">
      <slot />
    </main>
    <LandingSiteFooter />
  </div>
</template>
