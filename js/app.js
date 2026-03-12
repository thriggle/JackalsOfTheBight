// Data state
const AppState = {
    worlds: [],
    articles: [],
    currentView: 'map', // 'map' or 'detail'
    currentEntityId: null,
    currentEntityType: null // 'world' or 'article'
};

// DOM Elements
const els = {
    sidebar: document.getElementById('sidebar'),
    viewMap: document.getElementById('view-map'),
    viewDetail: document.getElementById('view-detail'),
    detailContent: document.getElementById('detail-content'),
    backToMapBtn: document.getElementById('backToMapBtn'),
    navItems: document.querySelectorAll('.nav-item'),


    // Dynamic Nav containers
    navHistory: document.getElementById('nav-history'),
    navSophont: document.getElementById('nav-sophont'),
    navFaction: document.getElementById('nav-faction'),
    navPentarchy: document.getElementById('nav-pentarchy'),
    navCulture: document.getElementById('nav-culture'),
    navDocument: document.getElementById('nav-document')
};

async function initApp() {
    // Fetch data
    try {
        const [worldsResponse, articlesResponse] = await Promise.all([
            fetch('data/worlds.json'),
            fetch('data/articles.json')
        ]);

        AppState.worlds = await worldsResponse.json();
        AppState.articles = await articlesResponse.json();

        populateSidebar();
        buildAutoLinker();
        setupEventListeners();

        // Check URL Hash for initial route
        handleRouting();

        // Initialize map if on map view
        if (window.initMap) {
            window.initMap(AppState.worlds);
        }

    } catch (e) {
        console.error("Failed to load application data.", e);
    }
}

function populateSidebar() {
    // Clear existing
    els.navHistory.innerHTML = '';
    els.navSophont.innerHTML = '';
    els.navFaction.innerHTML = '';
    els.navPentarchy.innerHTML = '';
    els.navCulture.innerHTML = '';
    els.navDocument.innerHTML = '';

    AppState.articles.forEach(article => {
        const btn = document.createElement('button');
        btn.className = 'nav-subitem';
        btn.textContent = article.title;
        btn.dataset.articleId = article.id;
        btn.onclick = () => {
            window.location.hash = `#article/${article.id}`;
            if (window.innerWidth <= 900) {
                document.querySelectorAll('.nav-subitems').forEach(nav => nav.classList.add('hidden'));
            }
        };

        if (article.category === "History") els.navHistory.appendChild(btn);
        else if (article.category === "Sophont") els.navSophont.appendChild(btn);
        else if (article.category === "Faction") els.navFaction.appendChild(btn);
        else if (article.category === "Pentarchy") els.navPentarchy.appendChild(btn);
        else if (article.category === "Culture") els.navCulture.appendChild(btn);
        else if (article.category === "Document") els.navDocument.appendChild(btn);
    });
}

function setupEventListeners() {
    // Back to Map
    els.backToMapBtn.addEventListener('click', () => {
        window.location.hash = ''; // Clear hash returns to map
    });

    // Accordion toggles on sidebar headings
    els.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // If it's the Map link
            if (item.dataset.view === 'map') {
                window.location.hash = '';
                if (window.innerWidth <= 900) {
                    document.querySelectorAll('.nav-subitems').forEach(nav => nav.classList.add('hidden'));
                }
                return;
            }

            // Expand/Collapse subitems
            const category = item.dataset.category;
            if (category) {
                const subnav = document.getElementById(`nav-${category.toLowerCase()}`);
                if (subnav) {
                    const isOpening = subnav.classList.contains('hidden');
                    if (window.innerWidth <= 900 && isOpening) {
                        document.querySelectorAll('.nav-subitems').forEach(nav => nav.classList.add('hidden'));
                    }
                    subnav.classList.toggle('hidden');
                }
            }
        });
    });

    // Window hash change
    window.addEventListener('hashchange', handleRouting);

}

function handleRouting() {
    const hash = window.location.hash.substring(1); // remove '#'

    if (!hash || hash === '') {
        showView('map');
    } else if (hash.startsWith('world/')) {
        const id = hash.split('/')[1];
        renderWorld(id);
        showView('detail');
    } else if (hash.startsWith('article/')) {
        const id = hash.split('/')[1];
        renderArticle(id);
        showView('detail');
    }
}

function showView(viewId) {
    if (viewId === 'map') {
        updateActiveSidebarState(null);
        els.viewMap.classList.remove('hidden');
        els.viewDetail.classList.add('hidden');

        // Update active state in sidebar
        document.querySelector('[data-view="map"]').classList.add('active');

        // Close overlay if open
        const overlay = document.getElementById('map-overlay');
        if (overlay) overlay.classList.add('hidden');

        // Ensure canvas is sized correctly if it was hidden during init
        if (window._mapInstance) {
            window._mapInstance.resize();
        }

    } else if (viewId === 'detail') {
        els.viewMap.classList.add('hidden');
        els.viewDetail.classList.remove('hidden');

        document.querySelector('[data-view="map"]').classList.remove('active');
    }
}

function updateActiveSidebarState(id) {
    document.querySelectorAll('.nav-subitem').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active-parent'));

    if (!id) return;

    const activeBtn = document.querySelector(`.nav-subitem[data-article-id="${id}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');

        const navGroup = activeBtn.closest('.nav-group');
        if (navGroup) {
            const headingBtn = navGroup.querySelector('.nav-item');
            if (headingBtn) {
                headingBtn.classList.add('active-parent');
            }

            // On desktop, auto-expand the section containing the active article
            if (window.innerWidth > 900) {
                const subnav = navGroup.querySelector('.nav-subitems');
                if (subnav) {
                    subnav.classList.remove('hidden');
                }
            }
        }
    }
}

let autolinkerRules = [];

function buildAutoLinker() {
    autolinkerRules = [];
    const entities = [];

    AppState.worlds.forEach(w => {
        entities.push({ name: w.name, link: `#world/${w.id}` });
    });

    AppState.articles.forEach(a => {
        let name = a.title;
        entities.push({ name: name, link: `#article/${a.id}`, isExact: true });
        if (name.startsWith('The ')) {
            entities.push({ name: name.substring(4), link: `#article/${a.id}`, isExact: true });
        }

        if (a.tags) {
            a.tags.forEach(t => {
                const lowerT = t.toLowerCase();
                const lowerName = name.toLowerCase();
                if (lowerT !== lowerName && (!name.startsWith('The ') || lowerT !== name.substring(4).toLowerCase())) {
                    entities.push({ name: t, link: `#article/${a.id}`, isExact: false });
                }
            });
        }
    });

    entities.sort((a, b) => {
        if (b.name.length !== a.name.length) {
            return b.name.length - a.name.length;
        }
        if (a.isExact && !b.isExact) return -1;
        if (!a.isExact && b.isExact) return 1;
        return 0;
    });

    const seen = new Set();
    const uniqueEntities = [];
    entities.forEach(ent => {
        const lowerName = ent.name.toLowerCase();
        if (!seen.has(lowerName)) {
            seen.add(lowerName);
            uniqueEntities.push(ent);
        }
    });

    uniqueEntities.forEach(ent => {
        autolinkerRules.push({
            regex: new RegExp(`\\b(${ent.name.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&')})\\b`, 'gi'),
            link: ent.link
        });
    });
}

function processAutoLinks(text, currentId) {
    let processed = text;
    const tokens = [];
    autolinkerRules.forEach((rule, i) => {
        if (rule.link === `#world/${currentId}` || rule.link === `#article/${currentId}`) {
            return; // prevent self-linking
        }
        processed = processed.replace(rule.regex, (match) => {
            const token = `__LINK${tokens.length}__`;
            tokens.push(`<a href="${rule.link}" class="inline-link">${match}</a>`);
            return token;
        });
    });

    tokens.forEach((val, i) => {
        processed = processed.replace(`__LINK${i}__`, val);
    });

    return processed;
}

function formatContentToHTML(text, currentId) {
    let formatted = text;
    if (typeof formatted === 'string') {
        formatted = formatted.replace(/\\[\\d+(-\\d+)?(,\\s*\\d+)*\\]/g, '');
        return formatted.split('\\n\\n').map(p => `<p>${processAutoLinks(p, currentId)}</p>`).join('');
    } else if (Array.isArray(formatted)) {
        return formatted.map(p => {
            let pStr = p.replace(/\\[\\d+(-\\d+)?(,\\s*\\d+)*\\]/g, '');
            return `<p>${processAutoLinks(pStr, currentId)}</p>`;
        }).join('');
    }
    return formatted;
}

function renderWorld(id) {
    const world = AppState.worlds.find(w => w.id === id);
    if (!world) return;



    els.detailContent.innerHTML = `
    <h1 class="article-title">${world.name}</h1>
    <div class="article-meta">
      <span class="overlay-uwp">${world.uwp}</span>
      <div class="overlay-badges">
        <span class="badge faction">${world.allegiance}</span>
        <span class="badge hazard">${world.hazardLevel}</span>
      </div>
    </div>
    <div class="article-content">
      ${formatContentToHTML(world.summary, id)}
    </div>
  `;
}

function renderArticle(id) {
    updateActiveSidebarState(id);
    const article = AppState.articles.find(a => a.id === id);
    if (!article) return;



    const tagsHtml = article.tags ? article.tags.map(t => `<span class="tag-link">#${t}</span>`).join('') : '';

    let htmlContent = `
    <h1 class="article-title">${article.title}</h1>
    <div class="article-meta">
      <span class="badge" style="background: rgba(255,255,255,0.1);">${article.category}</span>
      <div class="tags-container">
        ${tagsHtml}
      </div>
    </div>
    <div class="article-content">
      ${formatContentToHTML(article.content, id)}
    `;

    if (article.artifactUrl) {
        htmlContent += `
        <div style="margin-top: 2rem; border-top: 1px dashed var(--border-color); padding-top: 1.5rem; text-align: center;">
            <button class="nav-item active" style="justify-content: center; display: inline-flex; width: auto; padding: 0.75rem 1.5rem;" onclick="openMicrofilm('${article.artifactUrl}', '${article.title.replace(/'/g, "\\'")}')">
                <span class="icon" style="margin-right: 0.5rem;">🔍</span> View Archived Document
            </button>
        </div>
        `;
    }

    if (article.audioFiles && article.audioFiles.length > 0) {
        htmlContent += `<div style="margin-top: 2rem; border-top: 1px dashed var(--border-color); padding-top: 1.5rem;">
            <h3 style="color: var(--text-accent); margin-bottom: 1rem;">Audio Archives</h3>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">`;
        article.audioFiles.forEach((file, index) => {
            htmlContent += `
                <button class="nav-item active" style="justify-content: flex-start; display: flex; width: 100%; padding: 0.75rem 1.5rem;" onclick="openAudioArchive('${article.id}', ${index})">
                    <span class="icon" style="margin-right: 0.5rem;">🔊</span> Play: ${file.title}
                </button>
            `;
        });
        htmlContent += `</div></div>`;
    }

    htmlContent += `</div>`;
    els.detailContent.innerHTML = htmlContent;
}

window.openMicrofilm = async function (url, title) {
    document.getElementById('microfilm-title').textContent = title;
    const body = document.getElementById('microfilm-body');
    body.innerHTML = '<div style="text-align:center; padding: 3rem; font-style: italic;">Accessing archival data...</div>';
    document.getElementById('microfilm-modal').classList.remove('hidden');

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch artifact');
        const htmlText = await response.text();
        body.innerHTML = htmlText;
    } catch (err) {
        console.error("Error loading microfilm document:", err);
        body.innerHTML = '<div class="error" style="color: #ef4444; background: rgba(255,0,0,0.1); border: 1px solid #ef4444; border-radius: 4px; padding: 1rem; text-align:center;">Archive irrecoverable or corrupted.<br><br>Error: ' + err.message + '</div>';
    }
};

window.closeMicrofilm = function () {
    document.getElementById('microfilm-modal').classList.add('hidden');
    document.getElementById('microfilm-body').innerHTML = '';
};

let audioCtx = null;
let audioAnalyser = null;
let animationId = null;

window.openAudioArchive = function (articleId, fileIndex) {
    const article = AppState.articles.find(a => a.id === articleId);
    if (!article || !article.audioFiles || !article.audioFiles[fileIndex]) return;

    const file = article.audioFiles[fileIndex];
    document.getElementById('audio-title').textContent = file.title;
    const modal = document.getElementById('audio-modal');
    modal.classList.remove('hidden');

    const audioPlayer = document.getElementById('audio-player');
    const canvas = document.getElementById('oscilloscope');
    const canvasCtx = canvas.getContext('2d');

    const url = 'data/artifacts/' + file.file;
    audioPlayer.src = url;
    audioPlayer.play().catch(e => console.warn("Autoplay prevented:", e));

    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioAnalyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaElementSource(audioPlayer);
        source.connect(audioAnalyser);
        audioAnalyser.connect(audioCtx.destination);
    }

    // Ensure context is not suspended
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    audioAnalyser.fftSize = 2048;
    const bufferLength = audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Setup Subtext
    const subtextContainer = document.getElementById('audio-subtext-container');
    const tabsContainer = document.getElementById('audio-subtext-tabs');
    const contentContainer = document.getElementById('audio-subtext-content');

    if (file.subtext && file.subtext.length > 0) {
        subtextContainer.style.display = 'block';
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = '';

        file.subtext.forEach((sub, i) => {
            const btn = document.createElement('button');
            btn.className = 'nav-item active';
            btn.style.cssText = 'padding: 0.5rem 1rem; width: auto; justify-content: center;';
            btn.textContent = sub.label;
            btn.onclick = async () => {
                // Update active state
                Array.from(tabsContainer.children).forEach(c => c.style.opacity = '0.5');
                btn.style.opacity = '1';
                
                if (sub.content) {
                    contentContainer.innerHTML = sub.content;
                } else if (sub.url) {
                    contentContainer.innerHTML = '<em>Loading...</em>';
                    try {
                        const response = await fetch(sub.url);
                        if (!response.ok) throw new Error('Failed to load subtext');
                        contentContainer.innerHTML = await response.text();
                    } catch (e) {
                        contentContainer.innerHTML = '<span style="color: #ef4444;">Failed to load document.</span>';
                    }
                }
            };
            tabsContainer.appendChild(btn);
            if (i === 0) btn.click();
            else btn.style.opacity = '0.5';
        });
    } else {
        subtextContainer.style.display = 'none';
    }

    function draw() {
        if (modal.classList.contains('hidden')) return; // Stop drawing if closed
        animationId = requestAnimationFrame(draw);

        audioAnalyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = '#051005';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(16, 185, 129)'; // Faction green
        canvasCtx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

    draw();
};

window.closeAudioArchive = function () {
    const modal = document.getElementById('audio-modal');
    modal.classList.add('hidden');
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.pause();
    audioPlayer.src = "";
    if (animationId) cancelAnimationFrame(animationId);
};

// Global start
document.addEventListener('DOMContentLoaded', initApp);
