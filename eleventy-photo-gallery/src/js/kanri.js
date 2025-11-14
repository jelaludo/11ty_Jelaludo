const appRoot = document.querySelector("#kanri-app");
const template = document.getElementById("kanri-image-row");

if (!appRoot || !template) {
  console.warn("[Kanri] Admin shell not found. Did you build in production?");
} else {
  const ADMIN_BASE = appRoot.dataset.adminBase || "http://localhost:8686";
  const state = {
    images: [],
    filteredImages: [],
    selected: new Set(),
    editing: null,
    editingTags: new Set(),
    addingTags: new Set(),
    loading: false,
    filterTheme: "",
    filterUntagged: false,
  };

  const AUTO_MARK = {
    autoFill: "1",
    manual: "0",
  };

  renderShell();
  attachHandlers();
  refreshImages();
  checkServerStatus();
  // Check server status every 10 seconds
  setInterval(checkServerStatus, 10000);

  function renderShell() {
    appRoot.innerHTML = `
      <section class="kanri-section kanri-section--add">
        <h2>Add New Image</h2>
        <div class="kanri-callout">
          <p><strong>Before uploading</strong></p>
          <div class="kanri-server-status">
            <div class="kanri-server-status__item">
              <span class="kanri-server-status__label">Admin Server:</span>
              <span class="kanri-server-status__indicator" id="kanri-status-admin" data-status="checking">
                <span class="kanri-server-status__dot"></span>
                <span class="kanri-server-status__text">Checking...</span>
              </span>
              <span class="kanri-server-status__url">http://localhost:8686</span>
            </div>
            <div class="kanri-server-status__item">
              <span class="kanri-server-status__label">Eleventy Server:</span>
              <span class="kanri-server-status__indicator" id="kanri-status-eleventy" data-status="checking">
                <span class="kanri-server-status__dot"></span>
                <span class="kanri-server-status__text">Checking...</span>
              </span>
              <span class="kanri-server-status__url">http://localhost:8080</span>
            </div>
          </div>
          <ul>
            <li>Make sure both dev servers are running:</li>
          </ul>
          <pre><code>npm run watch:admin      # Kanri API on http://localhost:8686
npm run watch:eleventy   # 11ty dev server on http://localhost:8080</code></pre>
          <ul>
            <li>After each upload batch, rebuild the site so <code>_site/images</code> and derived data stay in sync:</li>
          </ul>
          <pre><code>npm run build            # build:colors → build:exif → build:sass → build:eleventy</code></pre>
        </div>
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
            <label>Tags</label>
            <div class="kanri-tag-selector">
              <div class="kanri-tag-selector__controls">
                <select id="kanri-add-tag-dropdown" class="kanri-tag-selector__dropdown">
                  <option value="">Select existing tag...</option>
                </select>
                <input type="text" id="kanri-add-tag-input" class="kanri-tag-selector__input" placeholder="Or type new tags (comma separated)" />
                <input type="hidden" name="tags" id="kanri-add-tags-hidden" />
              </div>
              <div class="kanri-tag-selector__selected" id="kanri-add-tags-selected"></div>
              <p class="kanri-form__helper">Select from existing tags or type new ones. Use commas to separate multiple tags.</p>
            </div>
          </div>
          <div class="kanri-form__actions">
            <button type="submit" class="kanri-btn">Upload &amp; Generate</button>
          </div>
        </form>
      </section>

      <section class="kanri-section kanri-section--list">
        <div class="kanri-section__header">
          <h2>Current Images</h2>
          <div class="kanri-actions">
            <button type="button" class="kanri-btn" data-kanri-action="refresh">Refresh</button>
            <button type="button" class="kanri-btn kanri-btn--danger" data-kanri-action="delete" disabled>Delete Selected</button>
          </div>
        </div>
        <div class="kanri-filters">
          <div class="kanri-filter-group">
            <label for="kanri-filter-theme">Filter by Theme:</label>
            <select id="kanri-filter-theme" class="kanri-select" data-kanri-filter="theme">
              <option value="">All Themes</option>
            </select>
          </div>
          <div class="kanri-filter-group">
            <label class="kanri-checkbox-label">
              <input type="checkbox" id="kanri-filter-untagged" class="kanri-checkbox" data-kanri-filter="untagged" />
              <span>Show only untagged images</span>
            </label>
          </div>
        </div>
        <div class="kanri-list" aria-live="polite"></div>
      </section>

      <!-- Edit Modal -->
      <div id="kanri-edit-modal" class="kanri-modal" role="dialog" aria-labelledby="kanri-modal-title" aria-hidden="true">
        <div class="kanri-modal__overlay" data-kanri-modal-close></div>
        <div class="kanri-modal__content">
          <div class="kanri-modal__header">
            <h2 id="kanri-modal-title">Edit Metadata</h2>
            <button type="button" class="kanri-modal__close" data-kanri-modal-close aria-label="Close modal">&times;</button>
          </div>
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
              <label>Tags</label>
              <div class="kanri-tag-selector">
                <div class="kanri-tag-selector__controls">
                  <select id="kanri-tag-dropdown" class="kanri-tag-selector__dropdown">
                    <option value="">Select existing tag...</option>
                  </select>
                  <input type="text" id="kanri-tag-input" class="kanri-tag-selector__input" placeholder="Or type new tags (comma separated)" />
                  <input type="hidden" name="tags" id="kanri-tags-hidden" />
                </div>
                <div class="kanri-tag-selector__selected" id="kanri-tags-selected"></div>
                <p class="kanri-form__helper">Select from existing tags or type new ones. Use commas to separate multiple tags.</p>
              </div>
            </div>
            <div class="kanri-form__actions">
              <button type="button" class="kanri-btn" data-kanri-modal-close>Cancel</button>
              <button type="submit" class="kanri-btn">Save Changes</button>
            </div>
          </form>
        </div>
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
    const modal = appRoot.querySelector("#kanri-edit-modal");
    const modalCloseButtons = appRoot.querySelectorAll('[data-kanri-modal-close]');
    const filterTheme = appRoot.querySelector('[data-kanri-filter="theme"]');
    const filterUntagged = appRoot.querySelector('[data-kanri-filter="untagged"]');

    refreshButton.addEventListener("click", refreshImages);
    deleteButton.addEventListener("click", handleDeleteSelected);
    editForm.addEventListener("submit", handleEditSubmit);
    addForm.addEventListener("submit", handleAddSubmit);

    // Filter handlers
    if (filterTheme) {
      filterTheme.addEventListener("change", (e) => {
        state.filterTheme = e.target.value;
        applyFilters();
      });
    }
    if (filterUntagged) {
      filterUntagged.addEventListener("change", (e) => {
        state.filterUntagged = e.target.checked;
        applyFilters();
      });
    }

    // Tag selector handlers for edit modal
    const tagDropdown = appRoot.querySelector("#kanri-tag-dropdown");
    const tagInput = appRoot.querySelector("#kanri-tag-input");
    
    if (tagDropdown) {
      tagDropdown.addEventListener("change", (e) => {
        if (e.target.value) {
          addTag(e.target.value, "edit");
          e.target.value = ""; // Reset dropdown
        }
      });
    }
    
    if (tagInput) {
      tagInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const value = tagInput.value.trim();
          if (value) {
            // Split by comma and add each tag
            value.split(",").forEach(tag => {
              const trimmed = tag.trim();
              if (trimmed) addTag(trimmed, "edit");
            });
            tagInput.value = "";
          }
        }
      });
      
      tagInput.addEventListener("blur", () => {
        const value = tagInput.value.trim();
        if (value) {
          // Split by comma and add each tag
          value.split(",").forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) addTag(trimmed, "edit");
          });
          tagInput.value = "";
        }
      });
    }

    // Tag selector handlers for add form
    const addTagDropdown = appRoot.querySelector("#kanri-add-tag-dropdown");
    const addTagInput = appRoot.querySelector("#kanri-add-tag-input");
    
    if (addTagDropdown) {
      addTagDropdown.addEventListener("change", (e) => {
        if (e.target.value) {
          addTag(e.target.value, "add");
          e.target.value = ""; // Reset dropdown
        }
      });
    }
    
    if (addTagInput) {
      addTagInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const value = addTagInput.value.trim();
          if (value) {
            // Split by comma and add each tag
            value.split(",").forEach(tag => {
              const trimmed = tag.trim();
              if (trimmed) addTag(trimmed, "add");
            });
            addTagInput.value = "";
          }
        }
      });
      
      addTagInput.addEventListener("blur", () => {
        const value = addTagInput.value.trim();
        if (value) {
          // Split by comma and add each tag
          value.split(",").forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) addTag(trimmed, "add");
          });
          addTagInput.value = "";
        }
      });
    }

    // Initialize add form tag dropdown
    initializeAddTagDropdown();

    // Modal close handlers
    modalCloseButtons.forEach(button => {
      button.addEventListener("click", closeEditModal);
    });

    // Close modal on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.getAttribute("aria-hidden") === "false") {
        closeEditModal();
      }
    });

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
      updateThemeFilter();
      initializeAddTagDropdown();
      syncFilterUI();
      applyFilters();
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

  function updateThemeFilter() {
    const filterSelect = appRoot.querySelector('[data-kanri-filter="theme"]');
    if (!filterSelect) return;

    // Collect all unique tags
    const allTags = new Set();
    state.images.forEach((img) => {
      const tags = normaliseTagsValue(img.tags);
      tags.forEach((tag) => allTags.add(tag));
    });

    // Sort tags alphabetically
    const sortedTags = Array.from(allTags).sort();

    // Store current selection
    const currentValue = filterSelect.value;

    // Clear existing options except "All Themes"
    filterSelect.innerHTML = '<option value="">All Themes</option>';

    // Add tag options
    sortedTags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      filterSelect.appendChild(option);
    });

    // Restore selection if it still exists
    if (currentValue && sortedTags.includes(currentValue)) {
      filterSelect.value = currentValue;
      state.filterTheme = currentValue;
    }
  }

  function syncFilterUI() {
    const filterTheme = appRoot.querySelector('[data-kanri-filter="theme"]');
    const filterUntagged = appRoot.querySelector('[data-kanri-filter="untagged"]');
    
    if (filterTheme) {
      filterTheme.value = state.filterTheme || "";
    }
    if (filterUntagged) {
      filterUntagged.checked = state.filterUntagged;
    }
  }

  function applyFilters() {
    let filtered = [...state.images];

    // Filter by theme
    if (state.filterTheme) {
      filtered = filtered.filter((img) => {
        const tags = normaliseTagsValue(img.tags);
        return tags.includes(state.filterTheme);
      });
    }

    // Filter by untagged
    if (state.filterUntagged) {
      filtered = filtered.filter((img) => {
        const tags = normaliseTagsValue(img.tags);
        return tags.length === 0;
      });
    }

    state.filteredImages = filtered;
    renderList();
  }

  function renderList() {
    const list = appRoot.querySelector(".kanri-list");
    list.innerHTML = "";

    // Use filtered images if filters are active, otherwise show all
    const hasActiveFilters = state.filterTheme || state.filterUntagged;
    const imagesToRender = hasActiveFilters ? state.filteredImages : state.images;

    if (!imagesToRender.length) {
      if (state.filterTheme || state.filterUntagged) {
        list.innerHTML = `<p>No images match the current filters.</p>`;
      } else {
        list.innerHTML = `<p>No images found. Add one using the form above.</p>`;
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    imagesToRender.forEach((item) => {
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
    
    // Initialize tag selector
    initializeTagSelector(item.tags);
    openEditModal();
  }

  function initializeAddTagDropdown() {
    const dropdown = appRoot.querySelector("#kanri-add-tag-dropdown");
    if (!dropdown) return;

    // Collect all unique tags from all images
    const allTags = new Set();
    state.images.forEach((img) => {
      const tags = normaliseTagsValue(img.tags);
      tags.forEach((tag) => allTags.add(tag));
    });
    const sortedTags = Array.from(allTags).sort();

    // Populate dropdown
    dropdown.innerHTML = '<option value="">Select existing tag...</option>';
    sortedTags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      dropdown.appendChild(option);
    });
  }

  function initializeTagSelector(currentTags) {
    const dropdown = appRoot.querySelector("#kanri-tag-dropdown");
    const input = appRoot.querySelector("#kanri-tag-input");
    const selectedContainer = appRoot.querySelector("#kanri-tags-selected");
    const hiddenInput = appRoot.querySelector("#kanri-tags-hidden");
    
    if (!dropdown || !input || !selectedContainer || !hiddenInput) return;

    // Collect all unique tags from all images
    const allTags = new Set();
    state.images.forEach((img) => {
      const tags = normaliseTagsValue(img.tags);
      tags.forEach((tag) => allTags.add(tag));
    });
    const sortedTags = Array.from(allTags).sort();

    // Populate dropdown
    dropdown.innerHTML = '<option value="">Select existing tag...</option>';
    sortedTags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      dropdown.appendChild(option);
    });

    // Set current tags
    const tags = normaliseTagsValue(currentTags);
    state.editingTags = new Set(tags);
    renderSelectedTags();
    updateHiddenInput();
  }

  function renderSelectedTags(context = "edit") {
    const containerId = context === "add" ? "#kanri-add-tags-selected" : "#kanri-tags-selected";
    const selectedContainer = appRoot.querySelector(containerId);
    if (!selectedContainer) return;

    const tagsSet = context === "add" ? state.addingTags : state.editingTags;
    selectedContainer.innerHTML = "";
    if (!tagsSet || tagsSet.size === 0) return;

    Array.from(tagsSet).sort().forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "kanri-tag-chip";
      chip.dataset.tag = tag;
      
      const tagText = document.createTextNode(tag);
      chip.appendChild(tagText);
      
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "kanri-tag-chip__remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.setAttribute("aria-label", `Remove ${tag}`);
      removeBtn.addEventListener("click", () => removeTag(tag, context));
      
      chip.appendChild(removeBtn);
      selectedContainer.appendChild(chip);
    });
  }

  function addTag(tag, context = "edit") {
    if (!tag || !tag.trim()) return;
    const normalizedTag = tag.trim();
    
    if (context === "add") {
      if (!state.addingTags) {
        state.addingTags = new Set();
      }
      state.addingTags.add(normalizedTag);
      renderSelectedTags("add");
      updateHiddenInput("add");
    } else {
      if (!state.editingTags) {
        state.editingTags = new Set();
      }
      state.editingTags.add(normalizedTag);
      renderSelectedTags("edit");
      updateHiddenInput("edit");
    }
  }

  function removeTag(tag, context = "edit") {
    if (context === "add") {
      if (!state.addingTags) return;
      state.addingTags.delete(tag);
      renderSelectedTags("add");
      updateHiddenInput("add");
    } else {
      if (!state.editingTags) return;
      state.editingTags.delete(tag);
      renderSelectedTags("edit");
      updateHiddenInput("edit");
    }
  }

  function updateHiddenInput(context = "edit") {
    const inputId = context === "add" ? "#kanri-add-tags-hidden" : "#kanri-tags-hidden";
    const hiddenInput = appRoot.querySelector(inputId);
    if (!hiddenInput) return;
    
    const tagsSet = context === "add" ? state.addingTags : state.editingTags;
    if (!tagsSet) {
      hiddenInput.value = "";
      return;
    }
    
    const tagsArray = Array.from(tagsSet);
    hiddenInput.value = tagsArray.join(", ");
  }

  function openEditModal() {
    const modal = appRoot.querySelector("#kanri-edit-modal");
    if (modal) {
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      // Focus first input
      const firstInput = modal.querySelector('input:not([readonly])');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  }

  function closeEditModal() {
    const modal = appRoot.querySelector("#kanri-edit-modal");
    if (modal) {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      state.editing = null;
      clearEditForm();
    }
  }

  function clearEditForm() {
    const form = appRoot.querySelector("#kanri-edit-form");
    form.reset();
    state.editingTags = new Set();
    const selectedContainer = appRoot.querySelector("#kanri-tags-selected");
    if (selectedContainer) {
      selectedContainer.innerHTML = "";
    }
    const tagInput = appRoot.querySelector("#kanri-tag-input");
    if (tagInput) {
      tagInput.value = "";
    }
  }

  function clearAddForm() {
    const form = appRoot.querySelector("#kanri-add-form");
    if (form) {
      form.reset();
    }
    state.addingTags = new Set();
    const selectedContainer = appRoot.querySelector("#kanri-add-tags-selected");
    if (selectedContainer) {
      selectedContainer.innerHTML = "";
    }
    const tagInput = appRoot.querySelector("#kanri-add-tag-input");
    if (tagInput) {
      tagInput.value = "";
    }
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

    // Get tags from hidden input (which contains selected tags)
    const tagsValue = payload.tags || "";
    const tagsArray = parseTagsInput(tagsValue);

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
          tags: tagsArray,
          imgDir: normaliseDir(payload.imgDir),
        }),
      });
      if (!response.ok) {
        throw new Error(`Update failed (${response.status})`);
      }
      showToast("Metadata updated.");
      closeEditModal();
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
    
    // Get tags from hidden input (which contains selected tags)
    const tagsValue = formData.get("tags") || "";
    const tagsArray = parseTagsInput(tagsValue);
    formData.set("tags", JSON.stringify(tagsArray));

    try {
      const response = await fetch(`${ADMIN_BASE}/admin/images`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Upload failed (${response.status})`);
      }
      clearAddForm();
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
      .map(
        (colour) =>
          `<li class="kanri-card__swatch" style="--palette-color: ${colour}"><span class="kanri-card__swatch-label">${colour}</span></li>`
      )
      .join("");
  }

  async function checkServerStatus() {
    const adminIndicator = appRoot.querySelector("#kanri-status-admin");
    const eleventyIndicator = appRoot.querySelector("#kanri-status-eleventy");

    if (!adminIndicator || !eleventyIndicator) return;

    // Check Admin Server (8686)
    try {
      const adminResponse = await fetch(`${ADMIN_BASE}/admin/images`, {
        method: "HEAD",
        signal: AbortSignal.timeout(2000),
      });
      updateServerStatus(adminIndicator, adminResponse.ok);
    } catch (err) {
      updateServerStatus(adminIndicator, false);
    }

    // Check Eleventy Server (8080)
    // Use a simple fetch - if it fails, server is likely down
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const eleventyResponse = await fetch("http://localhost:8080", {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // no-cors mode returns opaque response, but if no error, server is likely up
      updateServerStatus(eleventyIndicator, true);
    } catch (err) {
      // Server is not responding
      updateServerStatus(eleventyIndicator, false);
    }
  }

  function updateServerStatus(indicator, isRunning) {
    if (!indicator) return;
    
    const dot = indicator.querySelector(".kanri-server-status__dot");
    const text = indicator.querySelector(".kanri-server-status__text");
    
    if (isRunning) {
      indicator.setAttribute("data-status", "running");
      if (text) text.textContent = "Running";
    } else {
      indicator.setAttribute("data-status", "stopped");
      if (text) text.textContent = "Stopped";
    }
  }
}
