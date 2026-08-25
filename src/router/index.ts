import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

// TODO: remove once story maps are ready to launch
// router.beforeEach((to) => {
//   if (to.path.startsWith("/story-map")) {
//     return { name: "/NotFound" };
//   }
// });

export default router;