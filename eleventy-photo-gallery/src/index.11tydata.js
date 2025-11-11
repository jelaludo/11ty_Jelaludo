module.exports = {
  eleventyComputed: {
    heroImages: (data) => {
      const images = Array.isArray(data.gallery) ? data.gallery : [];
      return images.map((item) => ({
        src: `${item.imgDir || "/images/"}${item.src}`,
        alt: item.alt || item.title || "",
        title: item.title || "",
      }));
    },
  },
};

