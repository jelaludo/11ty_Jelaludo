/* eslint-disable no-console */
const path = require('path');
const fs = require('fs/promises');
const exifr = require('exifr');

const projectRoot = path.join(__dirname, '..');
const galleryDataPath = path.join(projectRoot, 'src', '_data', 'gallery.json');
const imagesRoot = path.join(projectRoot, 'src');
const outputPath = path.join(projectRoot, 'src', '_data', 'exif.json');

const exposureProgramMap = {
    0: 'Not defined',
    1: 'Manual',
    2: 'Normal Program',
    3: 'Aperture Priority',
    4: 'Shutter Priority',
    5: 'Creative Program',
    6: 'Action Program',
    7: 'Portrait Mode',
    8: 'Landscape Mode',
};

const meteringModeMap = {
    0: 'Unknown',
    1: 'Average',
    2: 'Center-weighted average',
    3: 'Spot',
    4: 'Multi-spot',
    5: 'Pattern',
    6: 'Partial',
    255: 'Other',
};

const resolutionUnitMap = {
    1: 'px',
    2: 'ppi',
    3: 'ppcm',
};

const fraction = (value) => {
    if (!value || typeof value !== 'number') {
        return undefined;
    }

    if (value >= 1) {
        return `${Number(value.toFixed(1))} s`;
    }

    const denominator = Math.round(1 / value);
    return `1/${denominator}`;
};

const formatFNumber = (fNumber) => {
    if (!fNumber) {
        return undefined;
    }
    const precision = fNumber < 10 ? 1 : 0;
    return `f/${Number(fNumber.toFixed(precision))}`;
};

const formatFocalLength = (focalLength) => {
    if (!focalLength) {
        return undefined;
    }
    return `${Math.round(focalLength)}mm`;
};

const formatExposure = (meta) => {
    const parts = [];

    const shutter = fraction(meta.ExposureTime);
    if (shutter) parts.push(shutter);

    const aperture = formatFNumber(meta.FNumber);
    if (aperture) parts.push(aperture);

    if (meta.ISO) parts.push(`ISO ${meta.ISO}`);

    const exposureProgram = exposureProgramMap[meta.ExposureProgram];
    if (exposureProgram && exposureProgram !== 'Not defined') {
        parts.push(exposureProgram);
    }

    const meteringMode = meteringModeMap[meta.MeteringMode];
    if (meteringMode && meteringMode !== 'Unknown') {
        parts.push(meteringMode);
    }

    return parts.join(', ') || undefined;
};

const formatImageSize = (meta) => {
    const width = meta.ExifImageWidth || meta.ImageWidth;
    const height = meta.ExifImageHeight || meta.ImageHeight;

    if (!width || !height) {
        return undefined;
    }

    return `${width} x ${height}`;
};

const formatResolution = (meta) => {
    const resolution = meta.XResolution || meta.YResolution;
    const unit = resolutionUnitMap[meta.ResolutionUnit] || 'ppi';

    if (!resolution) {
        return undefined;
    }

    const value = Array.isArray(resolution)
        ? Number((resolution[0] / resolution[1]).toFixed(0))
        : Number(resolution.toFixed(0));

    if (Number.isNaN(value)) {
        return undefined;
    }

    return `${value} ${unit}`;
};

const stripLeadingSlash = (value = '') => value.replace(/^\/+/, '');

async function main() {
    try {
        const galleryRaw = await fs.readFile(galleryDataPath, 'utf-8');
        const gallery = JSON.parse(galleryRaw);

        const exifData = {};

        for (const item of gallery) {
            if (!item?.src) {
                continue;
            }

            const relativeDir = stripLeadingSlash(item.imgDir || 'images');
            const imagePath = path.join(imagesRoot, relativeDir, item.src);

            try {
                const metadata = await exifr.parse(imagePath, {
                    reviveValues: true,
                    translateValues: true,
                });

                if (!metadata) {
                    console.warn(`No EXIF metadata found for ${item.src}`);
                    continue;
                }

                exifData[item.src] = {
                    model: metadata.Model || null,
                    lens: metadata.LensModel || metadata.LensMake || null,
                    focalLength: formatFocalLength(metadata.FocalLength),
                    exposure: formatExposure(metadata),
                    imageSize: formatImageSize(metadata),
                    resolution: formatResolution(metadata),
                    flash: metadata.Flash || null,
                };
            } catch (error) {
                console.warn(`Failed to extract EXIF for ${item.src}: ${error.message}`);
            }
        }

        await fs.writeFile(outputPath, JSON.stringify(exifData, null, 2));
        console.log(`EXIF data extracted to ${path.relative(projectRoot, outputPath)}`);
    } catch (error) {
        console.error('Failed to generate EXIF data', error);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = main;

