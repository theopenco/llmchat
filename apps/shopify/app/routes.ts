import { flatRoutes } from "@react-router/fs-routes";

// Vitest specs are colocated with the route files they cover — they are not
// routes, so keep the fs-router from bundling them.
export default flatRoutes({
	ignoredRouteFiles: ["**/*.test.{ts,tsx}"],
});
