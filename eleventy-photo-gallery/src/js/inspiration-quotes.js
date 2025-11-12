const SELECTORS = {
    container: '[data-quote-rotator]',
    dataScript: '#inspiration-quotes-data',
};

const POSITIONS = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const CONFLICT_GROUPS = [
    new Set(['top-left', 'top-right']),
    new Set(['bottom-left', 'bottom-right']),
];

const MIN_VISIBLE = 2;
const MAX_VISIBLE = 3;
const MIN_DURATION = 3500;
const MAX_DURATION = 6200;
const FADE_DURATION = 900;

const pickRandom = (source, count) => {
    const copy = [...source];
    const selection = [];
    for (let i = 0; i < count && copy.length > 0; i += 1) {
        const index = Math.floor(Math.random() * copy.length);
        selection.push(copy.splice(index, 1)[0]);
    }
    return selection;
};

const parseQuotes = () => {
    const script = document.querySelector(SELECTORS.dataScript);
    if (!script) return [];
    try {
        return JSON.parse(script.textContent).filter(Boolean);
    } catch (error) {
        console.warn('Unable to parse inspiration quotes data', error);
        return [];
    }
};

const conflictsWithSelection = (selected, candidate) =>
    CONFLICT_GROUPS.some(
        (group) => group.has(candidate) && selected.some((position) => group.has(position)),
    );

const pickPosition = (selectedPositions) => {
    const available = POSITIONS.filter((pos) => !selectedPositions.includes(pos));
    const pool = available.length ? available : POSITIONS;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    for (const candidate of shuffled) {
        if (!conflictsWithSelection(selectedPositions, candidate)) {
            return candidate;
        }
    }

    return 'center';
};

const createQuoteElement = (quote, className) => {
    const el = document.createElement('div');
    el.className = `inspiration-hero__quote inspiration-hero__quote--${className}`;
    el.textContent = quote;
    return el;
};

const scheduleNextCycle = (fn) => {
    const delay = Math.floor(Math.random() * (MAX_DURATION - MIN_DURATION + 1)) + MIN_DURATION;
    return window.setTimeout(fn, delay);
};

const rotateQuotes = (quotes, container) => {
    let timeoutId = null;

    const renderQuotes = () => {
        const nextCount = Math.floor(Math.random() * (MAX_VISIBLE - MIN_VISIBLE + 1)) + MIN_VISIBLE;
        const nextQuotes = pickRandom(quotes, nextCount);

        const selectedPositions = [];
        const currentQuotes = container.querySelectorAll('.inspiration-hero__quote');

        currentQuotes.forEach((item) => {
            item.classList.add('is-leaving');
            window.setTimeout(() => item.remove(), FADE_DURATION);
        });

        nextQuotes.forEach((quote) => {
            const position = pickPosition(selectedPositions);
            selectedPositions.push(position);

            const quoteEl = createQuoteElement(quote, position);
            quoteEl.classList.add('is-hidden');
            container.appendChild(quoteEl);
            requestAnimationFrame(() => {
                quoteEl.classList.remove('is-hidden');
            });
        });

        timeoutId = scheduleNextCycle(renderQuotes);
    };

    renderQuotes();

    return () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    };
};

const init = () => {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;
    const quotes = parseQuotes();
    if (!quotes.length) return;

    rotateQuotes(quotes, container);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

