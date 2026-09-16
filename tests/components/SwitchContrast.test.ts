import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import Switch from "../../components/ui/switch/Switch.vue";

describe("Switch contrast", () => {
  it("uses theme-aware contrasting colors for the track and thumb", () => {
    const wrapper = mount(Switch);

    const track = wrapper.get('[role="switch"]');
    const thumb = track.get("span");

    expect(track.classes()).toContain("data-[state=checked]:bg-primary");
    expect(track.classes()).toContain("data-[state=unchecked]:bg-muted-foreground");
    expect(thumb.classes()).toContain("bg-background");
    expect(thumb.classes()).not.toContain("bg-white");
  });
});
