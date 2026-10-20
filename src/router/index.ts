import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  // Without this the new page keeps the previous page's scroll position (e.g. a story map
  // opened from far down the overview started in the middle).
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition; // back/forward: where the user was
    if (to.path !== from.path) return { top: 0 }; // another page: start at the top
    return false; // same page, only the query changed (dashboard filters): don't scroll
  },
});

export default router;
