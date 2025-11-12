const path = require('path');

const gallery = require('./gallery.json');

let exif = {};
try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    exif = require('./exif.json');
} catch (error) {
    exif = {};
}

const slugify = (value = '') =>
    value
        .toString()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');

module.exports = () => {
    const tagMap = new Map();
    const lensMap = new Map();
    const imageLens = {};

    gallery.forEach((item) => {
        const tags = Array.isArray(item.tags) ? item.tags : [];
        tags.forEach((tagRaw) => {
            const tag = tagRaw.trim();
            if (!tag) return;
            if (!tagMap.has(tag)) {
                tagMap.set(tag, { tag, count: 0 });
            }
            tagMap.get(tag).count += 1;
        });

        const lensLabel = exif[item.src]?.lens || null;
        if (lensLabel) {
            const lensSlug = slugify(lensLabel);

            if (!lensMap.has(lensLabel)) {
                lensMap.set(lensLabel, { lens: lensLabel, slug: lensSlug, count: 0 });
            }
            lensMap.get(lensLabel).count += 1;
            imageLens[item.src] = { label: lensLabel, slug: lensSlug };
        }
    });

    const tags = Array.from(tagMap.values())
        .map((entry) => ({
            tag: entry.tag,
            slug: slugify(entry.tag),
            count: entry.count,
        }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

    const lenses = Array.from(lensMap.values()).sort((a, b) => b.count - a.count || a.lens.localeCompare(b.lens));

    return {
        tags,
        lenses,
        imageLens,
        lastGenerated: new Date().toISOString(),
        source: path.basename(__filename),
    };
};

