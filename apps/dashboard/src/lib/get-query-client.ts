import { QueryClient } from "@tanstack/react-query";
import { cache } from "react";

/** One QueryClient per server request (deduped via React cache), used to
 * prefetch data that's then dehydrated into the client cache. */
export const getQueryClient = cache(() => new QueryClient());
