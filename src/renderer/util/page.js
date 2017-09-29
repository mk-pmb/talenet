/**
 * Util for page related functionality.
 */

/**
 * Render the given title via the given i18n object into a string and set it on the document.
 *
 * @param title
 * @param i18n
 * @param document
 */
export function renderTitle (title, i18n, document) {
  document.title = i18n.t(title)
}

/**
 * Updates the page title from the given route by updating the given store.
 *
 * @param route
 * @param store
 */
export function updateTitleFromRoute (route, store) {
  let title
  if (route.meta && route.meta.title) {
    title = route.meta.title
  } else {
    title = 'page.default.title'
  }
  store.dispatch('page/setTitle', title)
}