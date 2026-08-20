<script setup lang="ts">
// Custom cell for the admin Users table's `teams` column. The backend sends
// the value as a nested array `[{ id, name, personal_team, subscription }]`
// which the generic CellRenderer can't render, so the Users page wires this
// component into the DataTable's `#cell-teams` slot.
//
// Each team renders as a chip: the team name plus a small subscription badge.
// The subscription → badge mapping is ported from the old hand-rolled admin
// Users page (v2-T13).

import { differenceInCalendarDays } from "date-fns";
import { Badge } from "~/components/ui/badge";
import type { BadgeVariants } from "~/components/ui/badge";
import type { AdminTeam } from "~/types";

defineProps<{ value: AdminTeam[] | null | undefined }>();
const { t } = useI18n();

interface SubBadge {
  variant: BadgeVariants["variant"];
  label: string;
}

const subscriptionBadge = (team: AdminTeam): SubBadge => {
  const sub = team.subscription;
  if (!sub || !sub.status) {
    return { variant: "blank", label: t("data.subscription.free") };
  }

  switch (sub.status) {
    case "active":
      return { variant: "green", label: t("data.subscription.active") };
    case "on_trial": {
      let label = t("data.subscription.trial");
      if (sub.trial_ends_at) {
        const days = differenceInCalendarDays(
          new Date(sub.trial_ends_at),
          new Date(),
        );
        if (days >= 0) {
          label = t("data.subscription.trialDaysLeft", { days });
        }
      }
      return { variant: "blue", label };
    }
    case "past_due":
      return { variant: "orange", label: t("data.subscription.pastDue") };
    case "unpaid":
      return { variant: "orange", label: t("data.subscription.unpaid") };
    case "cancelled":
    case "canceled":
      return { variant: "blank", label: t("data.subscription.cancelled") };
    case "expired":
      return { variant: "blank", label: t("data.subscription.expired") };
    default:
      return { variant: "secondary", label: sub.status };
  }
};
</script>

<template>
  <div class="flex max-w-xs flex-wrap gap-1.5">
    <span
      v-for="team in value ?? []"
      :key="team.id"
      class="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs"
    >
      <span class="font-medium">{{ team.name }}</span>
      <Badge :variant="subscriptionBadge(team).variant">
        {{ subscriptionBadge(team).label }}
      </Badge>
    </span>
    <span
      v-if="!value || value.length === 0"
      class="text-xs text-muted-foreground"
    >
      —
    </span>
  </div>
</template>
