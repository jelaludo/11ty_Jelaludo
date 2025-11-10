const path = require("path");

const isDev = process.env.ELEVENTY_ENV !== "production";
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

