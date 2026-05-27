import { differenceInDays } from "date-fns";

import { useCertificateEvents } from "~/composables/useChannelEvents";
import { certificateService } from "~/services/certificateService";
import type { StoredCertificate } from "~/types";

// useCertificateAlerts surfaces stored certs expiring in the next 30
// days. The dashboard banner reads from this to nudge users toward
// Settings → Connections.
//
// Two refresh paths layered together so the banner stays live without
// a hard refresh:
//
//   - Initial fetch on mount.
//   - WebSocket subscription: certificate.created / .updated /
//     .deleted / .expiring_soon / .fanout_required all trigger a
//     re-list. The daily warn job emits .expiring_soon once a cert
//     crosses the 30-day threshold; this composable picks that up
//     without re-mounting the page.
export function useCertificateAlerts() {
  const expiringSoon = ref<StoredCertificate[]>([]);
  const isLoading = ref(true);

  const expiryWindowDays = 30;

  const refresh = async () => {
    isLoading.value = true;
    try {
      const response = await certificateService.list();
      const rows = response.data || [];
      expiringSoon.value = rows.filter((c) => {
        const daysUntil = differenceInDays(new Date(c.not_after), new Date());
        // Negative days = already expired; include them so the banner
        // surfaces the urgent case too.
        return daysUntil <= expiryWindowDays;
      });
    } catch {
      expiringSoon.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(refresh);

  // Subscribe to certificate events on the team channel. Any event
  // (created / updated / deleted / expiring_soon / fanout_required)
  // can change the banner contents, so we just re-list on every one
  // — cheap (single small GET) and avoids per-event diffing.
  const { user } = useAuth();
  const teamId = computed(() => user.value?.current_team?.id || "");
  if (teamId.value) {
    useCertificateEvents(teamId, () => {
      refresh();
    });
  }

  return {
    expiringSoon: readonly(expiringSoon),
    isLoading: readonly(isLoading),
    refresh,
  };
}
