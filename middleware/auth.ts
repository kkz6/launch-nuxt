export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated, token, fetchUser, user } = useAuth()

  // If no token, redirect to login
  if (!token.value) {
    return navigateTo('/login')
  }

  // If token exists but no user data, fetch it
  if (token.value && !user.value) {
    const fetchedUser = await fetchUser()
    if (!fetchedUser) {
      return navigateTo('/login')
    }
  }

  // Check if authenticated
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
