// Apply bokeh-focus animation to first gallery slide
(function() {
  const applyBokehFocus = () => {
    const gallery = document.querySelector('[data-gallery]');
    if (!gallery) return;
    
    const firstSlide = gallery.querySelector('.gallery-slide--first');
    if (!firstSlide) {
      // If no first slide found, try the first slide in DOM order
      const firstSlideInDOM = gallery.querySelector('.gallery-slide');
      if (!firstSlideInDOM) return;
      
      // Try multiple selectors to find the image
      const img = firstSlideInDOM.querySelector('.gallery-slide__img') || 
                  firstSlideInDOM.querySelector('.gallery-slide__media img') ||
                  firstSlideInDOM.querySelector('img');
      if (!img) return;
      
      // Only apply if not already applied
      if (!img.classList.contains('gallery-slide__img--focus')) {
        img.classList.add('gallery-slide__img--focus');
      }
      return;
    }
    
    // Try multiple selectors to find the image
    const img = firstSlide.querySelector('.gallery-slide__img') || 
                firstSlide.querySelector('.gallery-slide__media img') ||
                firstSlide.querySelector('img');
    if (!img) return;
    
    // Only apply if not already applied (to avoid restarting animation)
    if (!img.classList.contains('gallery-slide__img--focus')) {
      img.classList.add('gallery-slide__img--focus');
    }
  };
  
  // Listen for gallery randomization event (this happens first)
  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    gallery.addEventListener('galleryRandomized', () => {
      // Wait a tiny bit for DOM to update, then apply animation
      setTimeout(applyBokehFocus, 50);
    });
  }
  
  // Also try on DOMContentLoaded as fallback
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(applyBokehFocus, 100);
    });
  } else {
    // If DOM already loaded, try after a short delay
    setTimeout(applyBokehFocus, 200);
  }
})();

