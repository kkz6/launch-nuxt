export default defineNuxtPlugin(async () => {
  const { initAuth, token, fetchUser } = useAuth()

  // Initialize auth from cookies
  initAuth()

  // If we have a token, fetch the user data
  if (token.value) {
    await fetchUser()
  }
})
