module.exports = {
  eleventyComputed: {
    permalink: (data) => (data.env && data.env.isDev ? "/kanri/index.html" : false),
    eleventyExcludeFromCollections: (data) => !(data.env && data.env.isDev),
    layout: () => "main.njk",
    title: () => "Kanri",
  },
};

