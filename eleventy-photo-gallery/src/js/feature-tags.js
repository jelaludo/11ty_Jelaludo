(function () {
    const tagBtns = Array.from(document.querySelectorAll('[data-feature-tag]'));
    const exploreBtn = document.querySelector('[data-feature-explore]');
    const exploreLabel = document.querySelector('[data-feature-explore-label]');

    if (!tagBtns.length || !exploreBtn || !exploreLabel) return;

    let activeSlug = null;

    tagBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            const slug = btn.dataset.featureTag;
            const label = btn.dataset.featureTagLabel;

            if (activeSlug === slug) {
                // Deselect
                btn.classList.remove('is-active');
                btn.setAttribute('aria-pressed', 'false');
                exploreBtn.setAttribute('hidden', '');
                activeSlug = null;
            } else {
                tagBtns.forEach(function (b) {
                    b.classList.remove('is-active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('is-active');
                btn.setAttribute('aria-pressed', 'true');
                exploreLabel.textContent = label;
                exploreBtn.removeAttribute('hidden');
                activeSlug = slug;
            }
        });
    });

    exploreBtn.addEventListener('click', function () {
        if (!activeSlug) return;
        window.location.href = '/gallery/?tag=' + activeSlug + '&view=immersive';
    });
}());
