const path = require("path");

const coerceBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  const normalised = String(value).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalised)
    ? true
    : ["0", "false", "no", "off"].includes(normalised)
    ? false
    : undefined;
};

const forcedFlag = coerceBoolean(process.env.KANRI_ENABLE);
const eleventyEnv = (process.env.ELEVENTY_ENV || process.env.NODE_ENV || "development").toLowerCase();
const context = (process.env.CONTEXT || "").toLowerCase();
const runningOnPages = Boolean(process.env.CF_PAGES);
const isProductionContext =
  eleventyEnv === "production" ||
  context === "production" ||
  runningOnPages;
const isDev = forcedFlag !== undefined ? forcedFlag : !isProductionContext;
const adminPort = process.env.KANRI_PORT ? Number(process.env.KANRI_PORT) : 8686;
const adminBase = process.env.KANRI_BASE_URL || `http://localhost:${adminPort}`;

module.exports = {
  isDev,
  admin: {
    port: adminPort,
    baseUrl: adminBase,
    uploadDir: path.join("src", "images"),
  },
};

