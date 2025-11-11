const heroSection = document.querySelector("[data-hero]");

if (heroSection) {
  const siteNav = document.querySelector("[data-site-nav]");
  const imageData = parseImageData(heroSection.dataset.images);
  const heroImg = heroSection.querySelector(".splash-hero__img");
  const cta = heroSection.querySelector(".splash-hero__cta");
  const scrollButton = heroSection.querySelector("[data-scroll-gallery]");

  if (imageData.length && heroImg) {
    const chosen = pickRandom(imageData);
    heroImg.src = chosen.src;
    heroImg.alt = chosen.alt || chosen.title || "";
    heroSection.dataset.currentTitle = chosen.title || "";
  }

  if (siteNav && siteNav.classList.contains("top-nav--hidden")) {
    const revealNav = () => {
      siteNav.classList.remove("top-nav--hidden");
      siteNav.classList.add("top-nav--revealed");
      document.removeEventListener("click", handlePictureClick, true);
    };

    const handlePictureClick = (event) => {
      const isHeroImage = Boolean(event.target.closest(".splash-hero__img"));
      const isGalleryImage = Boolean(
        event.target.closest("[data-gallery] .grid-image")
      );
      if (isHeroImage || isGalleryImage) {
        revealNav();
      }
    };

    document.addEventListener("click", handlePictureClick, true);
  }

  if (scrollButton) {
    scrollButton.addEventListener("click", () => {
      const gallery = document.querySelector("[data-gallery]");
      if (gallery) {
        gallery.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (cta) {
    heroSection.addEventListener("mousemove", () => {
      cta.classList.add("is-visible");
    });
    heroSection.addEventListener("mouseleave", () => {
      cta.classList.remove("is-visible");
    });
  }
}

function parseImageData(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item?.src === "string");
    }
  } catch (error) {
    console.warn("[Splash] Failed to parse hero image data:", error);
  }
  return [];
}

function pickRandom(list) {
  if (!list.length) return {};
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

