import { differenceInDays } from "date-fns";
import { tryOnMounted, useAsyncState } from "@vueuse/core";

import { useCertificateEvents } from "~/composables/useChannelEvents";
import { certificateService } from "~/services/certificateService";
import type { StoredCertificate } from "~/types";

export function useCertificateAlerts() {
  const loadExpiringCertificates = async () => {
    try {
      const response = await certificateService.list();
      const rows = response.data || [];
      return rows.filter((c) => {
        const daysUntil = differenceInDays(new Date(c.not_after), new Date());
        return daysUntil <= 30;
      });
    } catch {
      return [];
    }
  };
  const {
    state: expiringSoon,
    isLoading,
    execute: refresh,
  } = useAsyncState(loadExpiringCertificates, [] as StoredCertificate[], {
    immediate: false,
  });

  tryOnMounted(() => {
    void refresh();
  });

  const { user } = useAuth();
  const teamId = computed(() => user.value?.current_team?.id || "");
  useCertificateEvents(teamId, () => void refresh());

  return {
    expiringSoon: readonly(expiringSoon),
    isLoading: readonly(isLoading),
    refresh,
  };
}
