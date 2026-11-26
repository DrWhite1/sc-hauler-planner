// Lets the tests import lib/*.ts files that import each other without the .ts extension
// (as Next.js does). Usage: node --import ./tests/ts-resolve.mjs tests/x.test.mjs
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) {
    if (specifier.startsWith(".") && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + ".ts", context);
    throw e;
  }
}`));
