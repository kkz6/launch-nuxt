<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { certificateService } from '~/services/certificateService'
import type { CertificateUsage, StoredCertificate } from '~/types'

interface Props {
  certificate: StoredCertificate
}
const props = defineProps<Props>()
const emit = defineEmits<{ updated: [cert: StoredCertificate] }>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)

// Edit form mirrors AddCertificate's fields but the two PEM textareas
// start empty. Server never returns the private_key (json:"-"), so we
// treat "both PEMs typed" as a rotation request. If only name/notes
// changed, we PATCH just those — the backend skips the parse-and-rotate
// path entirely and no redeploys are queued.
const name = ref(props.certificate.name)
const notes = ref(props.certificate.notes ?? '')
const certificatePem = ref('')
const privateKey = ref('')
const errors = ref<Record<string, string>>({})

// Usages — fetched on open so the rotation warning can quote the exact
// number of sites + docker domains that'll redeploy. The list is also
// useful as an "are you sure?" data point when the user rotates.
const usages = ref<CertificateUsage[]>([])
const usagesLoaded = ref(false)

const siteUsageCount = computed(
  () => usages.value.filter((u) => u.kind === 'site').length,
)
const domainUsageCount = computed(
  () => usages.value.filter((u) => u.kind === 'docker_domain').length,
)
const totalUsageCount = computed(() => usages.value.length)

const certTouched = computed(
  () => certificatePem.value.trim().length > 0 || privateKey.value.trim().length > 0,
)

const resetForm = () => {
  name.value = props.certificate.name
  notes.value = props.certificate.notes ?? ''
  certificatePem.value = ''
  privateKey.value = ''
  errors.value = {}
}

watch(open, async (isOpen) => {
  if (isOpen) {
    resetForm()
    if (!usagesLoaded.value) {
      try {
        const res = await certificateService.usages(props.certificate.id)
        usages.value = res.data
      } catch {
        // Non-fatal — the warning just won't show counts. We don't
        // toast here because the user opened the edit sheet, not a
        // usages-listing affordance.
      } finally {
        usagesLoaded.value = true
      }
    }
  }
})

// Re-fetch fresh form values whenever the certificate prop changes (e.g.
// parent re-uses a single Edit instance across multiple rows).
watch(
  () => props.certificate.id,
  () => {
    usagesLoaded.value = false
    usages.value = []
    resetForm()
  },
)

const validate = () => {
  errors.value = {}
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    errors.value.name = 'Name is required'
  } else if (trimmedName.length > 255) {
    errors.value.name = 'Name must be 255 characters or fewer'
  }
  // Rotation requires both PEMs together. We refuse to send a half-
  // rotation request even though the backend would 422 it — surfacing
  // the requirement client-side avoids one round-trip.
  if (certificatePem.value.trim() && !privateKey.value.trim()) {
    errors.value.private_key = 'Private key required to rotate the certificate'
  }
  if (privateKey.value.trim() && !certificatePem.value.trim()) {
    errors.value.certificate = 'Certificate PEM required to rotate the private key'
  }
  return Object.keys(errors.value).length === 0
}

const onSubmit = async () => {
  if (!validate()) return
  isLoading.value = true

  const body: {
    name?: string
    notes?: string
    certificate?: string
    private_key?: string
  } = {}

  const trimmedName = name.value.trim()
  if (trimmedName !== props.certificate.name) body.name = trimmedName

  const trimmedNotes = notes.value.trim()
  const originalNotes = props.certificate.notes ?? ''
  if (trimmedNotes !== originalNotes) body.notes = trimmedNotes

  if (certTouched.value) {
    body.certificate = certificatePem.value
    body.private_key = privateKey.value
  }

  if (Object.keys(body).length === 0) {
    toast.info('No changes to save')
    open.value = false
    isLoading.value = false
    return
  }

  try {
    // Use updateRaw when the cert content is changing so we can surface
    // the X-Pending-Redeploys count in the success toast.
    if (body.certificate) {
      const { data, pendingRedeploys } = await certificateService.updateRaw(
        props.certificate.id,
        body,
      )
      if (pendingRedeploys > 0) {
        toast.success(
          `Certificate updated — ${pendingRedeploys} redeploy${pendingRedeploys === 1 ? '' : 's'} queued`,
        )
      } else {
        toast.success('Certificate updated')
      }
      emit('updated', data.data)
    } else {
      const res = await certificateService.update(props.certificate.id, body)
      toast.success('Certificate updated')
      emit('updated', res.data)
    }
    open.value = false
    resetForm()
  } catch (err: unknown) {
    const e = err as {
      response?: { status?: number }
      data?: { message?: string; errors?: Record<string, string[]> }
    }
    if (e.response?.status === 422 && e.data?.errors) {
      for (const [field, messages] of Object.entries(e.data.errors)) {
        errors.value[field] = messages[0]
      }
    } else {
      toast.error(e.data?.message || 'Failed to update certificate')
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>Edit SSL Certificate</SheetTitle>
        <SheetDescription>
          Update the name or notes, or paste a new PEM bundle to rotate the
          stored certificate. The private key is never returned by the API,
          so the PEM fields start empty — paste both to rotate.
        </SheetDescription>
      </SheetHeader>

      <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="cert-edit-name">Name</Label>
          <Input
            id="cert-edit-name"
            v-model="name"
            placeholder="example.com wildcard"
            autocomplete="off"
            maxlength="255"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="cert-edit-notes">
            Notes
            <span class="text-[11px] font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="cert-edit-notes"
            v-model="notes"
            placeholder="Where this came from, who issued it, renewal cadence, etc."
            class="h-20 text-sm"
          />
          <p v-if="errors.notes" class="text-sm text-destructive">
            {{ errors.notes }}
          </p>
        </div>

        <!--
          Rotation block. The two PEM textareas live behind a divider so
          users understand they can leave them empty when only changing
          metadata. The warning below them only renders when the user has
          actually started typing into one of the PEM fields.
        -->
        <div class="space-y-3 rounded-md border border-dashed p-4">
          <div class="space-y-1">
            <p class="text-sm font-medium">Rotate Certificate</p>
            <p class="text-[11px] text-muted-foreground">
              Optional. Leave both fields empty to keep the stored
              certificate as-is. Paste both PEMs to rotate.
            </p>
          </div>

          <div class="space-y-1.5">
            <Label for="cert-edit-pem">Certificate PEM</Label>
            <Textarea
              id="cert-edit-pem"
              v-model="certificatePem"
              placeholder="-----BEGIN CERTIFICATE-----"
              class="h-40 font-mono text-xs"
              spellcheck="false"
            />
            <p v-if="errors.certificate" class="text-sm text-destructive">
              {{ errors.certificate }}
            </p>
          </div>

          <div class="space-y-1.5">
            <Label for="cert-edit-key">Private Key PEM</Label>
            <Textarea
              id="cert-edit-key"
              v-model="privateKey"
              placeholder="-----BEGIN PRIVATE KEY-----"
              class="h-40 font-mono text-xs"
              spellcheck="false"
            />
            <p v-if="errors.private_key" class="text-sm text-destructive">
              {{ errors.private_key }}
            </p>
          </div>

          <div
            v-if="certTouched && usagesLoaded && totalUsageCount > 0"
            class="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
          >
            <Icon
              name="lucide:triangle-alert"
              class="mt-0.5 h-4 w-4 flex-shrink-0"
            />
            <span>
              Rotating this certificate will redeploy
              <strong>{{ siteUsageCount }}</strong>
              site{{ siteUsageCount === 1 ? '' : 's' }} and
              <strong>{{ domainUsageCount }}</strong>
              docker domain{{ domainUsageCount === 1 ? '' : 's' }} that use
              this cert.
            </span>
          </div>
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Save Changes
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  </Sheet>
</template>
