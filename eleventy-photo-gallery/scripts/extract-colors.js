/* eslint-disable no-console */
const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');
const kmeans = require('ml-kmeans');
const { treemap, hierarchy } = require('d3-hierarchy');

const projectRoot = path.join(__dirname, '..');
const galleryDataPath = path.join(projectRoot, 'src', '_data', 'gallery.json');
const imagesRoot = path.join(projectRoot, 'src');
const outputPath = path.join(projectRoot, 'src', '_data', 'colorTreemap.json');

const COLOR_COUNT = 16;
const SAMPLE_SIZE = 5000;

const stripLeadingSlash = (value = '') => value.replace(/^\/+/, '');

const rgbToHex = (r, g, b) =>
    `#${[r, g, b]
        .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;

async function loadPixels(imagePath) {
    const { data, info } = await sharp(imagePath)
        .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const totalPixels = info.width * info.height;
    const channels = info.channels;

    const step = Math.max(1, Math.floor(totalPixels / SAMPLE_SIZE));
    const samples = [];

    for (let i = 0; i < totalPixels; i += step) {
        const offset = i * channels;
        samples.push([data[offset], data[offset + 1], data[offset + 2]]);
    }

    return samples;
}

function computeTreemapLayout(colors) {
    const root = hierarchy({ children: colors }).sum((d) => d.population);

    const layout = treemap()
        .size([1000, 1000])
        .paddingInner(8)
        .round(true);

    layout(root);

    return root
        .leaves()
        .map((leaf) => ({
            hex: leaf.data.hex,
            percentage: leaf.data.percentage,
            population: leaf.data.population,
            x: Number((leaf.x0 / 10).toFixed(2)),
            y: Number((leaf.y0 / 10).toFixed(2)),
            width: Number(((leaf.x1 - leaf.x0) / 10).toFixed(2)),
            height: Number(((leaf.y1 - leaf.y0) / 10).toFixed(2)),
        }))
        .sort((a, b) => b.population - a.population);
}

async function extractImageColors(imagePath) {
    const samples = await loadPixels(imagePath);
    if (samples.length === 0) {
        return null;
    }

    const { centroids } = kmeans(samples, COLOR_COUNT, { initialization: 'kmeans++', maxIterations: 50 });

    const total = centroids.reduce((sum, centroid) => sum + centroid.size, 0);

    if (!total) {
        return null;
    }

    const colors = centroids
        .map((centroid) => {
            const [r, g, b] = centroid.centroid;
            const hex = rgbToHex(r, g, b);
            const population = centroid.size;
            const percentage = Number(((population / total) * 100).toFixed(2));

            return {
                hex,
                population,
                percentage,
            };
        })
        .sort((a, b) => b.percentage - a.percentage);

    return computeTreemapLayout(colors);
}

async function main() {
    try {
        const galleryRaw = await fs.readFile(galleryDataPath, 'utf-8');
        const gallery = JSON.parse(galleryRaw);

        const colorData = {};

        for (const item of gallery) {
            if (!item?.src) continue;

            const relativeDir = stripLeadingSlash(item.imgDir || 'images');
            const imagePath = path.join(imagesRoot, relativeDir, item.src);

            try {
                const layout = await extractImageColors(imagePath);

                if (layout && layout.length > 0) {
                    colorData[item.src] = layout;
                } else {
                    console.warn(`No color data generated for ${item.src}`);
                }
            } catch (error) {
                console.warn(`Failed to extract colors for ${item.src}: ${error.message}`);
            }
        }

        await fs.writeFile(outputPath, JSON.stringify(colorData, null, 2));
        console.log(`Color treemap data written to ${path.relative(projectRoot, outputPath)}`);
    } catch (error) {
        console.error('Failed to generate color data', error);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = main;

