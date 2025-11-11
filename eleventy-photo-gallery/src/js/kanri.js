const appRoot = document.querySelector("#kanri-app");
const template = document.getElementById("kanri-image-row");

if (!appRoot || !template) {
  console.warn("[Kanri] Admin shell not found. Did you build in production?");
} else {
  const ADMIN_BASE = appRoot.dataset.adminBase || "http://localhost:8686";
  const state = {
    images: [],
    selected: new Set(),
    editing: null,
    loading: false,
  };

  const AUTO_MARK = {
    autoFill: "1",
    manual: "0",
  };

  renderShell();
  attachHandlers();
  refreshImages();

  function renderShell() {
    appRoot.innerHTML = `
      <div class="kanri-grid">
        <section class="kanri-section kanri-section--list">
          <div class="kanri-section__header">
            <h2>Current Images</h2>
            <div class="kanri-actions">
              <button type="button" class="kanri-btn" data-kanri-action="refresh">Refresh</button>
              <button type="button" class="kanri-btn kanri-btn--danger" data-kanri-action="delete" disabled>Delete Selected</button>
            </div>
          </div>
          <div class="kanri-list" aria-live="polite"></div>
        </section>

        <section class="kanri-section">
          <h2>Edit Metadata</h2>
          <form id="kanri-edit-form" class="kanri-form">
            <div class="kanri-form__group">
              <label>Source filename
                <input type="text" name="src" readonly />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Image directory
                <input type="text" name="imgDir" placeholder="/images/" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Title
                <input type="text" name="title" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Date
                <input type="text" name="date" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Alt text
                <input type="text" name="alt" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Credit
                <input type="text" name="credit" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Author link
                <input type="text" name="linkToAuthor" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Tags (comma separated)
                <input type="text" name="tags" placeholder="portrait, tokyo, street" />
              </label>
              <p class="kanri-form__helper">Use commas to separate tags. Example: portrait, tokyo, street.</p>
            </div>
            <div class="kanri-form__actions">
              <button type="submit" class="kanri-btn">Save Changes</button>
            </div>
          </form>
        </section>

        <section class="kanri-section">
          <h2>Add New Image</h2>
          <form id="kanri-add-form" class="kanri-form">
            <div class="kanri-form__group">
              <label>Select image file
                <input type="file" name="file" accept="image/*" required />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Source filename (optional override)
                <input type="text" name="src" placeholder="Defaults to uploaded filename" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Image directory
                <input type="text" name="imgDir" placeholder="/images/" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Title
                <input type="text" name="title" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Date
                <input type="text" name="date" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Alt text
                <input type="text" name="alt" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Credit
                <input type="text" name="credit" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Author link
                <input type="text" name="linkToAuthor" />
              </label>
            </div>
            <div class="kanri-form__group">
              <label>Tags (comma separated)
                <input type="text" name="tags" placeholder="portrait, tokyo, street" />
              </label>
              <p class="kanri-form__helper">Optional. Use commas to separate tags.</p>
            </div>
            <div class="kanri-form__actions">
              <button type="submit" class="kanri-btn">Upload &amp; Generate</button>
            </div>
          </form>
        </section>
      </div>
      <output id="kanri-toast" class="kanri-toast" role="status" aria-live="polite"></output>
    `;
  }

  function attachHandlers() {
    const deleteButton = appRoot.querySelector('[data-kanri-action="delete"]');
    const refreshButton = appRoot.querySelector('[data-kanri-action="refresh"]');
    const editForm = appRoot.querySelector("#kanri-edit-form");
    const addForm = appRoot.querySelector("#kanri-add-form");
    const addFileInput = addForm.querySelector('input[name="file"]');
    const addTitleInput = addForm.querySelector('input[name="title"]');
    const addAltInput = addForm.querySelector('input[name="alt"]');
    const addSrcInput = addForm.querySelector('input[name="src"]');

    refreshButton.addEventListener("click", refreshImages);
    deleteButton.addEventListener("click", handleDeleteSelected);
    editForm.addEventListener("submit", handleEditSubmit);
    addForm.addEventListener("submit", handleAddSubmit);

    addTitleInput.addEventListener("input", () => {
      addTitleInput.dataset.auto = AUTO_MARK.manual;
    });
    addAltInput.addEventListener("input", () => {
      addAltInput.dataset.auto = AUTO_MARK.manual;
    });
    addFileInput.addEventListener("change", () => {
      const file = addFileInput.files && addFileInput.files[0];
      if (!file) {
        return;
      }
      const label = createLabelFromFilename(file.name);
      if (label) {
        if (!addSrcInput.value) {
          addSrcInput.value = file.name;
        }
        if (!addTitleInput.value || addTitleInput.dataset.auto === AUTO_MARK.autoFill) {
          addTitleInput.value = label;
          addTitleInput.dataset.auto = AUTO_MARK.autoFill;
        }
        if (!addAltInput.value || addAltInput.dataset.auto === AUTO_MARK.autoFill) {
          addAltInput.value = label;
          addAltInput.dataset.auto = AUTO_MARK.autoFill;
        }
      }
    });
  }

  async function refreshImages() {
    try {
      state.loading = true;
      toggleListLoading(true);
      const response = await fetch(`${ADMIN_BASE}/admin/images`);
      if (!response.ok) {
        throw new Error(`Failed to load images (${response.status})`);
      }
      const payload = await response.json();
      state.images = (payload.images || []).map(deserialiseImage);
      state.selected.clear();
      state.editing = null;
      renderList();
      clearEditForm();
      syncDeleteButton();
      showToast(`Loaded ${state.images.length} image${state.images.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      state.loading = false;
      toggleListLoading(false);
    }
  }

  function renderList() {
    const list = appRoot.querySelector(".kanri-list");
    list.innerHTML = "";

    if (!state.images.length) {
      list.innerHTML = `<p>No images found. Add one using the form on the right.</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    state.images.forEach((item) => {
      const card = template.content.firstElementChild.cloneNode(true);
      const checkbox = card.querySelector(".kanri-card__checkbox");
      const editButton = card.querySelector(".kanri-card__edit");
      const img = card.querySelector(".kanri-card__img");
      const title = card.querySelector(".kanri-card__title");
      const meta = card.querySelector(".kanri-card__meta");
      const tagList = card.querySelector(".kanri-card__tags");
      const paletteList = card.querySelector(".kanri-card__palette");

      checkbox.checked = state.selected.has(item.src);
      checkbox.dataset.src = item.src;
      editButton.dataset.src = item.src;

      checkbox.addEventListener("change", handleSelectToggle);
      editButton.addEventListener("click", () => startEditing(item.src));

      const displayDir = item.imgDir || "/images/";
      const previewPath = `${displayDir.replace(/\\+/g, "/")}${item.src}`;
      img.src = previewPath;
      img.alt = item.alt || "";

      title.textContent = item.title || item.alt || item.src;
      meta.innerHTML = buildMetadataList(item);
      renderTagList(tagList, item.tags);
      renderPalette(paletteList, item.palette);

      fragment.appendChild(card);
    });

    list.appendChild(fragment);
  }

  function buildMetadataList(item) {
    const tagsDisplay = formatTagsText(item.tags);
    const entries = [
      ["Source", item.src],
      ["Directory", item.imgDir || "/images/"],
      ["Date", item.date || "—"],
      ["Alt", item.alt || "—"],
      ["Credit", item.credit || "—"],
      ["Author Link", item.linkToAuthor || "—"],
      ["Tags", tagsDisplay],
    ];

    return entries
      .map(
        ([label, value]) => `
        <div>
          <dt>${label}</dt>
          <dd>${value || "—"}</dd>
        </div>
      `
      )
      .join("");
  }

  function handleSelectToggle(event) {
    const { checked, dataset } = event.currentTarget;
    const src = dataset.src;
    if (!src) return;
    if (checked) {
      state.selected.add(src);
    } else {
      state.selected.delete(src);
    }
    syncDeleteButton();
  }

  function syncDeleteButton() {
    const deleteButton = appRoot.querySelector('[data-kanri-action="delete"]');
    deleteButton.disabled = state.selected.size === 0;
  }

  async function handleDeleteSelected() {
    if (state.selected.size === 0) return;
    const confirmed = window.confirm(`Delete ${state.selected.size} selected image(s)? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${ADMIN_BASE}/admin/images`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: Array.from(state.selected) }),
      });
      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }
      showToast("Images removed.");
      await refreshImages();
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    }
  }

  function startEditing(src) {
    const item = state.images.find((entry) => entry.src === src);
    if (!item) {
      showToast("Image not found in current list.", "error");
      return;
    }
    state.editing = item;
    const form = appRoot.querySelector("#kanri-edit-form");
    form.src.value = item.src;
    form.imgDir.value = item.imgDir || "/images/";
    form.title.value = item.title || "";
    form.date.value = item.date || "";
    form.alt.value = item.alt || "";
    form.credit.value = item.credit || "";
    form.linkToAuthor.value = item.linkToAuthor || "";
    form.tags.value = tagsToInput(item.tags);
    showToast(`Editing ${item.src}.`);
  }

  function clearEditForm() {
    const form = appRoot.querySelector("#kanri-edit-form");
    form.reset();
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = Object.fromEntries(data.entries());
    if (!payload.src) {
      showToast("Source filename missing.", "error");
      return;
    }

    try {
      const response = await fetch(`${ADMIN_BASE}/admin/images/${encodeURIComponent(payload.src)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: payload.title || "",
          date: payload.date || "",
          alt: payload.alt || "",
          credit: payload.credit || "",
          linkToAuthor: payload.linkToAuthor || "",
          tags: parseTagsInput(payload.tags),
          imgDir: normaliseDir(payload.imgDir),
        }),
      });
      if (!response.ok) {
        throw new Error(`Update failed (${response.status})`);
      }
      showToast("Metadata updated.");
      await refreshImages();
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    }
  }

  async function handleAddSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File)) {
      showToast("Please choose an image file.", "error");
      return;
    }

    formData.set("imgDir", normaliseDir(formData.get("imgDir")));
    const tags = parseTagsInput(formData.get("tags"));
    formData.set("tags", JSON.stringify(tags));

    try {
      const response = await fetch(`${ADMIN_BASE}/admin/images`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Upload failed (${response.status})`);
      }
      form.reset();
      resetAutoMarkers(form);
      showToast("Image uploaded and derivatives generated.");
      await refreshImages();
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    }
  }

  function normaliseDir(dirValue) {
    const fallback = "/images/";
    if (!dirValue) return fallback;
    let trimmed = dirValue.trim();
    if (!trimmed.startsWith("/")) trimmed = `/${trimmed}`;
    if (!trimmed.endsWith("/")) trimmed = `${trimmed}/`;
    return trimmed;
  }

  function toggleListLoading(isLoading) {
    const list = appRoot.querySelector(".kanri-list");
    if (!list) return;
    list.classList.toggle("is-loading", isLoading);
  }

  function showToast(message, level = "info") {
    const toast = appRoot.querySelector("#kanri-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.level = level;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  function createLabelFromFilename(filename) {
    if (typeof filename !== "string") return "";
    const withoutExt = filename.replace(/\.[^/.]+$/, "");
    const words = withoutExt
      .replace(/[-_]+/g, " ")
      .replace(/[^\w\s]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    return words.join(" ");
  }

  function resetAutoMarkers(form) {
    const autoInputs = form.querySelectorAll("[data-auto]");
    autoInputs.forEach((input) => {
      input.dataset.auto = AUTO_MARK.manual;
    });
  }

  function deserialiseImage(raw = {}) {
    return {
      ...raw,
      tags: normaliseTagsValue(raw.tags),
      palette: normalisePaletteValue(raw.palette),
    };
  }

  function normaliseTagsValue(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter(Boolean);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normaliseTagsValue(parsed);
        }
      } catch (error) {
        // not json, fall through to comma split
      }
      return trimmed
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    return [];
  }

  function parseTagsInput(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return normaliseTagsValue(value);
    }
    return normaliseTagsValue(String(value));
  }

  function tagsToInput(tags) {
    const normalised = normaliseTagsValue(tags);
    return normalised.join(", ");
  }

  function formatTagsText(tags) {
    const normalised = normaliseTagsValue(tags);
    return normalised.length ? normalised.join(", ") : "—";
  }

  function renderTagList(container, tags) {
    if (!container) return;
    const normalised = normaliseTagsValue(tags);
    if (!normalised.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = normalised
      .map((tag) => `<li><span class="kanri-card__chip">${tag}</span></li>`)
      .join("");
  }

  function normalisePaletteValue(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((colour) => (typeof colour === "string" ? colour.trim().toUpperCase() : ""))
        .filter(Boolean);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalisePaletteValue(parsed);
        }
      } catch (error) {
        // ignore
      }
      return trimmed
        .split(",")
        .map((colour) => colour.trim().toUpperCase())
        .filter(Boolean);
    }
    return [];
  }

  function renderPalette(container, palette) {
    if (!container) return;
    const normalised = normalisePaletteValue(palette);
    if (!normalised.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = normalised
      .map((colour) => `<li class="kanri-card__swatch" style="--palette-color: ${colour}"><span class="sr-only">${colour}</span></li>`)
      .join("");
  }
}
