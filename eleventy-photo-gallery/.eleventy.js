const CleanCSS = require("clean-css");
const { minify } = require("terser");
const metagen = require("eleventy-plugin-metagen");
const eleventyNavigation = require("@11ty/eleventy-navigation");
const Image = require("@11ty/eleventy-img");

module.exports = (eleventyConfig) => {

  eleventyConfig.addPlugin(metagen);
  eleventyConfig.addPlugin(eleventyNavigation);

  // Perform manual passthrough file copy to include directories in the build output _site
  eleventyConfig.addPassthroughCopy("./src/photos");
  eleventyConfig.addPassthroughCopy("./src/css");
  eleventyConfig.addPassthroughCopy("./src/js");
  eleventyConfig.addPassthroughCopy("./src/favicon_data");
  eleventyConfig.addPassthroughCopy({ "./src/sw.js": "/sw.js" });
  eleventyConfig.addPassthroughCopy({ "./src/offline.html": "/offline.html" });

  // Create css-clean CSS Minifier filter
  eleventyConfig.addFilter("cssmin", function (code) {
    return new CleanCSS({}).minify(code).styles;
  });

  // Create terser JS Minifier async filter (Nunjucks)
  eleventyConfig.addNunjucksAsyncFilter("jsmin", async function (
    code,
    callback
  ) {
    try {
      const minified = await minify(code);
      callback(null, minified.code);
    } catch (err) {
      console.log(`Terser error: ${err}`);
      callback(null, code);
    }
  });

  // Get the current year
  eleventyConfig.addShortcode("getYear", function () {
    const year = new Date().getFullYear();
    return year.toString();
  });

  // Custom slug filter that properly handles apostrophes
  eleventyConfig.addFilter("slug", function (value) {
    if (!value) return '';
    return value
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[''"]/g, '') // Remove apostrophes and quotes
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  });

  eleventyConfig.addShortcode("img", async function ({ src, alt, width, height, widths, className, imgDir, sizes = "100vw"}) {
    if (alt === undefined) {
      throw new Error(`Missing \`alt\` on responsive image from: ${src}`);
    }

    const IMAGE_DIR = imgDir || "./src/images/";
    const metadata = await Image(IMAGE_DIR + src, {
      widths: widths || [300, 480, 640, 1024, 1920, 2560],
      formats: ["webp", "jpeg"],
      urlPath: "/img/",
      outputDir: "_site/img",
      defaultAttributes: {
        loading: "lazy",
        decoding: "async"
      }
    });

    let lowsrc = metadata.jpeg[0];
    let highsrc = metadata.jpeg[metadata.jpeg.length - 1];

    const sources = Object.values(metadata).map((imageFormat) => {
      const srcType = imageFormat[0].sourceType;
      const srcset = imageFormat.map(entry => entry.srcset).join(", ");
      return `<source type="${srcType}" srcset="${srcset}" sizes="${sizes}">`
    }).join("\n");

    const img = `
      <img
        src="${lowsrc.url}"
        width="${highsrc.width}"
        height="${highsrc.height}"
        alt="${alt}"
        loading="lazy"
        decoding="async"
        class="${className || ''}"
        data-orientation-watch="true"
      >`;

    return `<picture>\n\t${sources}\n\t${img}</picture>`;
  });

  // Return the URL of the largest optimized image variant (for lightbox/OG usage)
  eleventyConfig.addShortcode("imgUrl", async function ({ src, format = "webp" }) {
    const metadata = await Image("./src/images/" + src, {
      widths: [2560],
      formats: [format],
      urlPath: "/img/",
      outputDir: "_site/img",
    });

    return metadata[format][0].url;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      layouts: "_includes/layouts",
      includes: "_includes",
    },
    templateFormats: ["md", "liquid", "njk"],
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true
  }
};