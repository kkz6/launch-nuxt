import { differenceInDays } from "date-fns";

import { certificateService } from "~/services/certificateService";
import type { StoredCertificate } from "~/types";

// useCertificateAlerts polls the stored-certificate library and
// surfaces the ones expiring in the next 30 days. The dashboard banner
// reads from this to nudge the user toward Settings → Connections.
//
// Why polling: the backend emits certificate.expiring_soon once a day
// via the certificate:warn_expiring job, but a fresh page load might
// land between two ticks. A lightweight list on mount catches those
// rows; the WebSocket events are then layered on top to keep the
// banner live as new certs cross the 30-day threshold.
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

  return {
    expiringSoon: readonly(expiringSoon),
    isLoading: readonly(isLoading),
    refresh,
  };
}
