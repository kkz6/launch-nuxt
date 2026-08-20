import type { User } from "~/types";

export default defineNuxtPlugin(async () => {
  const user = useState<User | null>("auth_user", () => null);
  const { initializeLocale } = useLocalePreference();

  await initializeLocale(user.value?.locale ?? null);
});
