// jspdf's package "exports" only map "." for the node/browser conditions, which
// the Cloudflare worker (SSR) build can't resolve. The /dist/* subpath is
// exported unconditionally, so we import the browser build directly and reuse
// jspdf's own types for it.
declare module "jspdf/dist/jspdf.es.min.js" {
  export * from "jspdf";
}