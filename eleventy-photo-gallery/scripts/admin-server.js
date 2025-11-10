#!/usr/bin/env node
const cors = require("cors");
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const { constants } = require("fs");
const Image = require("@11ty/eleventy-img");

const projectRoot = path.resolve(__dirname, "..");
const galleryPath = path.join(projectRoot, "src", "_data", "gallery.json");
const imagesRoot = path.join(projectRoot, "src", "images");
const outputDir = path.join(projectRoot, "_site", "img");
const port = Number(process.env.KANRI_PORT) || 8686;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const app = express();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      // requests from same origin or curl
      return callback(null, true);
    }
    try {
      const { hostname } = new URL(origin);
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return callback(null, true);
      }
    } catch (error) {
      // fall through
    }
    return callback(new Error("Not allowed by CORS"), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "5mb" }));

function isBlank(value) {
  return typeof value !== "string" || value.trim().length === 0;
}

function cleanText(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length) return trimmed;
  }
  return fallback;
}

function normaliseDir(dir) {
  const fallback = "/images/";
  if (!dir) return fallback;
  let value = dir.trim();
  if (!value.startsWith("/")) value = `/${value}`;
  if (!value.endsWith("/")) value = `${value}/`;
  if (!value.startsWith("/images/")) {
    throw new Error("imgDir must resolve under /images/");
  }
  return value;
}

function resolveImagePath(dir, filename) {
  const normalisedDir = normaliseDir(dir);
  const relativeDir = normalisedDir.replace(/^\//, "");
  const absoluteDir = path.join(projectRoot, "src", relativeDir);

  if (!absoluteDir.startsWith(imagesRoot)) {
    throw new Error("Resolved directory escapes images root.");
  }

  return {
    normalisedDir,
    absoluteDir,
    absolutePath: path.join(absoluteDir, filename),
  };
}

async function readGallery() {
  try {
    const raw = await fs.readFile(galleryPath, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error("gallery.json must export an array");
    }
    return data;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeGallery(entries) {
  const json = `${JSON.stringify(entries, null, 2)}\n`;
  await fs.writeFile(galleryPath, json, "utf8");
}

async function augmentWithStats(entries) {
  return Promise.all(entries.map(async (entry) => {
    try {
      const { absolutePath } = resolveImagePath(entry.imgDir || "/images/", entry.src);
      const stats = await fs.stat(absolutePath);
      return {
        ...entry,
        size: stats.size,
        mtime: stats.mtimeMs,
      };
    } catch {
      return {
        ...entry,
        size: null,
        mtime: null,
      };
    }
  }));
}

async function ensureDirectories() {
  await fs.mkdir(imagesRoot, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
}

async function generateDerivatives(absolutePath) {
  await ensureDirectories();
  const metadata = await Image(absolutePath, {
    widths: [300, 480, 640, 1024],
    formats: ["webp", "jpeg"],
    outputDir,
    urlPath: "/img/",
    sharpJpegOptions: {
      quality: 80,
      progressive: true,
    },
  });
  return metadata;
}

async function removeDerivatives(src) {
  try {
    const files = await fs.readdir(outputDir);
    const base = src.replace(path.extname(src), "");
    const removals = files
      .filter((file) => file.startsWith(`${base}-`) || file.startsWith(`${base}.`))
      .map((file) => fs.unlink(path.join(outputDir, file)).catch(() => null));
    await Promise.all(removals);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`[Kanri] Unable to remove derivatives for ${src}:`, error.message);
    }
  }
}

app.get("/admin/images", async (_req, res) => {
  try {
    const entries = await readGallery();
    const enriched = await augmentWithStats(entries);
    res.json({ images: enriched });
  } catch (error) {
    console.error("[Kanri] Failed to read gallery:", error);
    res.status(500).send("Failed to read gallery.json");
  }
});

app.put("/admin/images/:src", async (req, res) => {
  const targetSrc = decodeURIComponent(req.params.src);
  try {
    const entries = await readGallery();
    const index = entries.findIndex((item) => item.src === targetSrc);
    if (index === -1) {
      return res.status(404).send("Image not found");
    }

    const entry = entries[index];
    const payload = req.body || {};

    const baseName = path.parse(entry.src).name;

    const updated = {
      ...entry,
      title: cleanText(payload.title, entry.title || baseName),
      date: cleanText(payload.date, entry.date || ""),
      alt: cleanText(payload.alt, entry.alt || entry.title || baseName),
      credit: cleanText(payload.credit, entry.credit || ""),
      linkToAuthor: cleanText(payload.linkToAuthor, entry.linkToAuthor || ""),
      imgDir: normaliseDir(payload.imgDir ?? entry.imgDir ?? "/images/"),
    };

    const currentPath = resolveImagePath(entry.imgDir || "/images/", entry.src);
    const desiredPath = resolveImagePath(updated.imgDir, updated.src);

    if (currentPath.absolutePath !== desiredPath.absolutePath) {
      await fs.mkdir(desiredPath.absoluteDir, { recursive: true });
      await fs.copyFile(currentPath.absolutePath, desiredPath.absolutePath);
      await fs.unlink(currentPath.absolutePath);
      await removeDerivatives(entry.src);
      await generateDerivatives(desiredPath.absolutePath);
    }

    entries[index] = updated;
    await writeGallery(entries);

    res.json({ ok: true, image: updated });
  } catch (error) {
    console.error("[Kanri] Failed to update image:", error);
    res.status(500).send(error.message || "Failed to update image metadata.");
  }
});

app.delete("/admin/images", async (req, res) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return res.status(400).send("No image sources supplied.");
  }

  try {
    const entries = await readGallery();
    const remaining = [];

    for (const entry of entries) {
      if (items.includes(entry.src)) {
        try {
          const { absolutePath } = resolveImagePath(entry.imgDir || "/images/", entry.src);
          await fs.unlink(absolutePath);
        } catch (error) {
          if (error.code !== "ENOENT") {
            console.warn(`[Kanri] Failed to remove ${entry.src}:`, error.message);
          }
        }
        await removeDerivatives(entry.src);
      } else {
        remaining.push(entry);
      }
    }

    await writeGallery(remaining);
    res.json({ ok: true, removed: items.length });
  } catch (error) {
    console.error("[Kanri] Failed to delete images:", error);
    res.status(500).send("Failed to remove images.");
  }
});

app.post("/admin/images", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("Missing image file.");
  }

  const payload = req.body || {};
  const filename = (payload.src && payload.src.trim()) || req.file.originalname;

  try {
    const entries = await readGallery();
    if (entries.some((entry) => entry.src === filename)) {
      return res.status(409).send("An image with the same filename already exists.");
    }

    const imgDir = normaliseDir(payload.imgDir);
    const { absoluteDir, absolutePath } = resolveImagePath(imgDir, filename);

    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(absolutePath, req.file.buffer, { flag: "w" });
    await fs.chmod(absolutePath, constants.S_IRUSR | constants.S_IWUSR | constants.S_IRGRP | constants.S_IROTH);

    await generateDerivatives(absolutePath);

    const baseName = path.parse(filename).name;

    const newEntry = {
      title: cleanText(payload.title, cleanText(payload.alt, baseName)),
      date: cleanText(payload.date),
      alt: cleanText(payload.alt, cleanText(payload.title, baseName)),
      credit: cleanText(payload.credit),
      linkToAuthor: cleanText(payload.linkToAuthor),
      src: filename,
      imgDir,
    };

    entries.push(newEntry);
    await writeGallery(entries);

    res.json({ ok: true, image: newEntry });
  } catch (error) {
    console.error("[Kanri] Failed to add image:", error);
    res.status(500).send(error.message || "Failed to add image.");
  }
});

app.listen(port, () => {
  console.log(`[Kanri] Admin server listening on http://localhost:${port}`);
});

