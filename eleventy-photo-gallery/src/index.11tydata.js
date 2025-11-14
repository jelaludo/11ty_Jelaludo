module.exports = {
  eleventyComputed: {
    heroImages: (data) => {
      const images = Array.isArray(data.gallery) ? data.gallery : [];
      return images.map((item) => {
        // Ensure proper path construction - use original image path for hero
        const imgDir = item.imgDir || "/images/";
        const imgSrc = item.src || "";
        // Ensure path starts with / and has proper formatting
        let fullPath = imgDir.endsWith("/") ? `${imgDir}${imgSrc}` : `${imgDir}/${imgSrc}`;
        // Ensure path starts with /
        if (!fullPath.startsWith("/")) {
          fullPath = "/" + fullPath;
        }
        return {
          src: fullPath,
          alt: item.alt || item.title || "",
          title: item.title || "",
        };
      });
    },
  },
};

