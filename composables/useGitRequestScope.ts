import { computed, onBeforeUnmount, watch } from "vue";
import type { User } from "~/types";
import { createScopedRequest } from "~/utils/scopedRequest";

export const useGitRequestScope = (onContextChange: () => void) => {
  const user = useState<User | null>("auth_user", () => null);
  const selectedTeam = useCookie<string | null>("current_team_id");
  const ready = computed(() =>
    Boolean(
      user.value?.id &&
      selectedTeam.value &&
      String(user.value.current_team_id) === String(selectedTeam.value),
    ),
  );
  const contextKey = computed(
    () =>
      `${user.value?.id ?? ""}:${user.value?.current_team_id ?? ""}:${selectedTeam.value ?? ""}`,
  );
  const channels: ReturnType<typeof createScopedRequest>[] = [];
  const channel = (selection: () => string = () => "") => {
    const request = createScopedRequest(
      () => `${contextKey.value}:${selection()}`,
    );
    channels.push(request);
    return request;
  };
  const cancel = () => channels.forEach((request) => request.cancel());
  watch(
    contextKey,
    () => {
      cancel();
      onContextChange();
    },
    { flush: "sync" },
  );
  onBeforeUnmount(cancel);
  return { user, ready, contextKey, channel, cancel };
};
