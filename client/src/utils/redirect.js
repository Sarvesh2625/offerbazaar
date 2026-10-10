/**
 * Calculates the post-login destination URL based on the authenticated user's role
 * and sanitizes any candidate redirect location (e.g. from react-router location.state).
 *
 * Prevents cross-role redirect poisoning where a user of one role (e.g. admin)
 * was redirected to another role's dashboard (e.g. /vendor) due to leftover route state.
 *
 * @param {Object} user - Authenticated user object containing role
 * @param {Object} [locationState] - Optional react-router location.state
 * @returns {string} - Target route pathname
 */
export function getPostLoginRedirect(user, locationState) {
  const role = user?.role;
  const rawFrom = locationState?.from?.pathname;

  let defaultDestination = '/customer';
  if (role === 'admin') {
    defaultDestination = '/admin';
  } else if (role === 'vendor') {
    defaultDestination = '/vendor';
  }

  // Only honor 'from' if it is a sub-page permitted strictly for the authenticated role
  if (
    rawFrom &&
    rawFrom !== '/login' &&
    rawFrom !== '/signup' &&
    rawFrom !== '/'
  ) {
    const isAllowedForRole =
      (role === 'admin' && rawFrom.startsWith('/admin')) ||
      (role === 'vendor' && rawFrom.startsWith('/vendor')) ||
      (role === 'customer' &&
        !rawFrom.startsWith('/admin') &&
        !rawFrom.startsWith('/vendor'));

    if (isAllowedForRole) {
      return rawFrom;
    }
  }

  return defaultDestination;
}
