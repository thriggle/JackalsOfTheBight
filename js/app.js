// Data state
const AppState = {
    worlds: [],
    articles: [],
    currentView: 'map', // 'map' or 'detail'
    currentEntityId: null,
    currentEntityType: null, // 'world' or 'article'
    distantCategories: {}
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
        const [worldsResponse, articlesResponse, distantCategoriesResponse] = await Promise.all([
            fetch('data/worlds.json'),
            fetch('data/articles.json'),
            fetch('data/distant-categories.json')
        ]);

        AppState.worlds = await worldsResponse.json();
        AppState.articles = await articlesResponse.json();
        AppState.distantCategories = await distantCategoriesResponse.json();

        populateSidebar();
        buildAutoLinker();
        setupEventListeners();

        // Check URL Hash for initial route
        handleRouting();

        // Initialize map if on map view
        if (window.initMap) {
            window.initMap(AppState.worlds, AppState.distantCategories);
        }

    } catch (e) {
        console.error("Failed to load application data.", e);
    }
}

function populateSidebar() {
    // Sort articles: by sortOrder (nulls last) then alphabetically by title
    const sorted = [...AppState.articles].sort((a, b) => {
        const aOrder = a.sortOrder ?? Infinity;
        const bOrder = b.sortOrder ?? Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.title.localeCompare(b.title);
    });

    // Clear existing
    els.navHistory.innerHTML = '';
    els.navSophont.innerHTML = '';
    els.navFaction.innerHTML = '';
    els.navPentarchy.innerHTML = '';
    els.navCulture.innerHTML = '';
    els.navDocument.innerHTML = '';

    sorted.forEach(article => {
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

    // Index button
    const indexBtn = document.getElementById('nav-index-btn');
    if (indexBtn) {
        indexBtn.addEventListener('click', () => {
            window.location.hash = '#index';
        });
    }

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

    // Global Escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // First check if any modal is open
            const microfilmModal = document.getElementById('microfilm-modal');
            const audioModal = document.getElementById('audio-modal');
            const imageModal = document.getElementById('image-modal');
            const settingsModal = document.getElementById('settings-modal');
            
            let modalClosed = false;
            
            if (microfilmModal && !microfilmModal.classList.contains('hidden')) {
                if (window.closeMicrofilm) window.closeMicrofilm();
                modalClosed = true;
            }
            if (audioModal && !audioModal.classList.contains('hidden')) {
                if (window.closeAudioArchive) window.closeAudioArchive();
                modalClosed = true;
            }
            if (imageModal && !imageModal.classList.contains('hidden')) {
                if (window.closeImageArchive) window.closeImageArchive();
                modalClosed = true;
            }
            if (settingsModal && !settingsModal.classList.contains('hidden')) {
                if (window.closeSettings) window.closeSettings();
                modalClosed = true;
            }
            
            // If no modal was closed and we are on an article/world/index, go back to map
            if (!modalClosed) {
                const hash = window.location.hash;
                if (hash.startsWith('#article/') || hash.startsWith('#world/') || hash === '#index') {
                    window.location.hash = ''; // Clear hash returns to map
                }
            }
        }
    });
}

function handleRouting() {
    const hash = window.location.hash.substring(1); // remove '#'

    if (!hash || hash === '') {
        showView('map');
    } else if (hash === 'index') {
        renderIndex();
        showView('index');
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
    const indexBtn = document.getElementById('nav-index-btn');
    if (viewId === 'map') {
        updateActiveSidebarState(null);
        els.viewMap.classList.remove('hidden');
        els.viewDetail.classList.add('hidden');
        document.querySelector('[data-view="map"]').classList.add('active');
        if (indexBtn) indexBtn.classList.remove('active');
        const overlay = document.getElementById('map-overlay');
        if (overlay) overlay.classList.add('hidden');
        if (window._mapInstance) {
            window._mapInstance.resize();
        }
    } else if (viewId === 'index') {
        updateActiveSidebarState(null);
        els.viewMap.classList.add('hidden');
        els.viewDetail.classList.remove('hidden');
        document.querySelector('[data-view="map"]').classList.remove('active');
        if (indexBtn) indexBtn.classList.add('active');
    } else if (viewId === 'detail') {
        els.viewMap.classList.add('hidden');
        els.viewDetail.classList.remove('hidden');
        document.querySelector('[data-view="map"]').classList.remove('active');
        if (indexBtn) indexBtn.classList.remove('active');
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
        if (w.name) entities.push({ name: w.name, link: `#world/${w.id}` });
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



    let htmlContent = `
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
    `;

    const rawRelated = [];
    AppState.articles.forEach(a => {
        if (a.tags && a.tags.includes(world.name)) {
            rawRelated.push({
                type: 'article',
                id: a.id,
                title: a.title,
                sharedTags: [world.name]
            });
        }
    });

    if (rawRelated.length > 0) {
        htmlContent += `<div style="margin-top: 2rem; border-top: 1px dashed var(--border-color); padding-top: 1.5rem;">
            <h3 style="color: var(--text-accent); margin-bottom: 1rem;">Related</h3>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">`;
        
        rawRelated.sort((a, b) => a.title.localeCompare(b.title));
        
        rawRelated.forEach(r => {
            const sharedTagsHtml = r.sharedTags
                .map(t => `<span class="badge" style="background:rgba(255,255,255,0.05); color: var(--text-muted); border-color: transparent;">#${t}</span>`)
                .join('');
                                     
            const linkHref = `#article/${r.id}`;
            
            htmlContent += `
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.75rem 1rem;">
                    <div style="display:flex; align-items: baseline; gap: 0.75rem;">
                        <a href="${linkHref}" class="inline-link" style="font-size: 1rem; border-bottom: none;">${r.title}</a>
                    </div>
                    <div style="display: flex; gap: 0.3rem;">
                        ${sharedTagsHtml}
                    </div>
                </div>
            `;
        });
        htmlContent += `</div></div>`;
    }

    htmlContent += `</div>`;
    els.detailContent.innerHTML = htmlContent;
}

function renderIndex() {
    updateActiveSidebarState(null);

    // Helper: sort key strips leading "The "
    const sortKey = title => title.replace(/^The\s+/i, '').trim();

    // Build combined list of all articles and worlds
    const entries = [];
    AppState.articles.forEach(a => {
        entries.push({
            label: a.title,
            key: sortKey(a.title),
            badge: a.category,
            href: `#article/${a.id}`
        });
    });
    AppState.worlds.forEach(w => {
        if (!w.name) return;
        entries.push({
            label: w.name,
            key: sortKey(w.name),
            badge: 'World',
            href: `#world/${w.id}`
        });
    });

    // Sort alphabetically by key
    entries.sort((a, b) => a.key.localeCompare(b.key));

    // Group by first letter of sort key
    const groups = {};
    entries.forEach(e => {
        const letter = e.key[0].toUpperCase();
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(e);
    });

    const letters = Object.keys(groups).sort();

    // Render letter jump bar
    const jumpBar = letters.map(l =>
        `<a href="#" onclick="document.getElementById('idx-${l}').scrollIntoView({behavior:'smooth'});return false;"
            style="color:var(--text-accent);text-decoration:none;font-weight:600;font-size:0.9rem;">${l}</a>`
    ).join('<span style="color:var(--border-color)"> · </span>');

    let html = `
    <h1 class="article-title">Index</h1>
    <div style="margin-bottom:1.5rem;line-height:2;letter-spacing:0.05em;">${jumpBar}</div>
    <div class="article-content">`;

    letters.forEach(letter => {
        html += `<div id="idx-${letter}" style="margin-top:2rem;">
            <h2 style="color:var(--text-accent);border-bottom:1px solid var(--border-color);padding-bottom:0.5rem;margin-bottom:0.75rem;font-size:1.4rem;">${letter}</h2>
            <div style="display:flex;flex-direction:column;gap:0.4rem;">`;
        groups[letter].forEach(e => {
            html += `<div style="display:flex;align-items:baseline;gap:0.75rem;">
                <a href="${e.href}" class="inline-link" style="font-size:1rem;">${e.label}</a>
                <span class="badge" style="font-size:0.65rem;padding:0.15rem 0.5rem;background:rgba(255,255,255,0.07);flex-shrink:0;">${e.badge}</span>
            </div>`;
        });
        html += `</div></div>`;
    });

    html += `</div>`;
    els.detailContent.innerHTML = html;
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

    if (article.imageFiles && article.imageFiles.length > 0) {
        htmlContent += `<div style="margin-top: 2rem; border-top: 1px dashed var(--border-color); padding-top: 1.5rem;">
            <h3 style="color: var(--text-accent); margin-bottom: 1rem;">Image Archives</h3>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">`;
        article.imageFiles.forEach((file, index) => {
            htmlContent += `
                <button class="nav-item active" style="justify-content: flex-start; display: flex; width: 100%; padding: 0.75rem 1.5rem;" onclick="openImageArchive('${article.id}', ${index})">
                    <span class="icon" style="margin-right: 0.5rem;">🖼️</span> View: ${file.title}
                </button>
            `;
        });
        htmlContent += `</div></div>`;
    }

    if (article.tags && article.tags.length > 0) {
        const rawRelated = [];
        
        AppState.articles.forEach(a => {
            if (a.id !== article.id && a.tags && a.tags.some(t => article.tags.includes(t))) {
                rawRelated.push({
                    type: 'article',
                    id: a.id,
                    title: a.title,
                    sharedTags: a.tags.filter(t => article.tags.includes(t))
                });
            }
        });
        
        AppState.worlds.forEach(w => {
            if (article.tags.includes(w.name)) {
                rawRelated.push({
                    type: 'world',
                    id: w.id,
                    title: w.name,
                    sharedTags: [w.name]
                });
            }
        });
        
        if (rawRelated.length > 0) {
            htmlContent += `<div style="margin-top: 2rem; border-top: 1px dashed var(--border-color); padding-top: 1.5rem;">
                <h3 style="color: var(--text-accent); margin-bottom: 1rem;">Related</h3>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">`;
            
            rawRelated.sort((a, b) => a.title.localeCompare(b.title));
            
            rawRelated.forEach(r => {
                const sharedTagsHtml = r.sharedTags
                    .map(t => `<span class="badge" style="background:rgba(255,255,255,0.05); color: var(--text-muted); border-color: transparent;">#${t}</span>`)
                    .join('');
                                         
                const linkHref = r.type === 'article' ? `#article/${r.id}` : `#world/${r.id}`;
                const badgeLabel = r.type === 'world' ? `<span class="badge" style="background:rgba(255,255,255,0.1); font-size: 0.65rem; padding: 0.15rem 0.4rem; border-color: transparent; margin-right: 0.5rem;">World</span>` : '';
                
                htmlContent += `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.75rem 1rem;">
                        <div style="display:flex; align-items: baseline; gap: 0.75rem;">
                            ${badgeLabel}
                            <a href="${linkHref}" class="inline-link" style="font-size: 1rem; border-bottom: none;">${r.title}</a>
                        </div>
                        <div style="display: flex; gap: 0.3rem;">
                            ${sharedTagsHtml}
                        </div>
                    </div>
                `;
            });
            htmlContent += `</div></div>`;
        }
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
    const tabsWrapper = document.getElementById('audio-subtext-tabs-container');
    const contentContainer = document.getElementById('audio-subtext-content');

    if (file.subtext && file.subtext.length > 0) {
        subtextContainer.style.display = 'block';
        if (tabsWrapper) tabsWrapper.style.display = 'block';
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
        if (tabsWrapper) tabsWrapper.style.display = 'none';
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

// ── Image Archive ─────────────────────────────────────────────────────────────

const _img = {
    scale: 1,
    tx: 0,
    ty: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    MIN: 0.25,
    MAX: 8,
    STEP: 0.25,
};

function _imgApplyTransform() {
    const img = document.getElementById('image-viewer');
    if (!img) return;
    img.style.transform = `translate(${_img.tx}px, ${_img.ty}px) scale(${_img.scale})`;
    const label = document.getElementById('image-zoom-label');
    if (label) label.textContent = Math.round(_img.scale * 100) + '%';
}

function _imgResetState() {
    _img.scale = 1;
    _img.tx = 0;
    _img.ty = 0;
    _img.dragging = false;
    _imgApplyTransform();
}

function _imgSetupInteractions() {
    const container = document.getElementById('image-zoom-container');
    if (!container || container._zoomBound) return;
    container._zoomBound = true;

    // Wheel zoom – zoom toward the cursor position (transform-origin: center center)
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        // Mouse position relative to the container center (which is transform-origin)
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top  - rect.height / 2;

        const delta = e.deltaY < 0 ? _img.STEP : -_img.STEP;
        const newScale = Math.min(_img.MAX, Math.max(_img.MIN, _img.scale + delta));
        if (newScale === _img.scale) return;

        // Adjust translate so the point under the cursor stays fixed
        const ratio = newScale / _img.scale;
        _img.tx = mouseX - ratio * (mouseX - _img.tx);
        _img.ty = mouseY - ratio * (mouseY - _img.ty);
        _img.scale = newScale;
        _imgApplyTransform();
    }, { passive: false });

    // Pinch-to-zoom (touch) ── track two fingers
    let _pinchDist = null; // distance between two fingers at last touchmove

    function _getTouchDist(t) {
        const dx = t[0].clientX - t[1].clientX;
        const dy = t[0].clientY - t[1].clientY;
        return Math.hypot(dx, dy);
    }
    function _getTouchMid(t, rect) {
        return {
            x: (t[0].clientX + t[1].clientX) / 2 - rect.left - rect.width  / 2,
            y: (t[0].clientY + t[1].clientY) / 2 - rect.top  - rect.height / 2,
        };
    }

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            _pinchDist = _getTouchDist(e.touches);
            _img.dragging = false; // suspend single-finger drag while pinching
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && _pinchDist !== null) {
            e.preventDefault();
            const newDist = _getTouchDist(e.touches);
            if (newDist === 0) return;

            const rect = container.getBoundingClientRect();
            const mid  = _getTouchMid(e.touches, rect);
            const ratio = newDist / _pinchDist;
            const newScale = Math.min(_img.MAX, Math.max(_img.MIN, _img.scale * ratio));

            const scaleRatio = newScale / _img.scale;
            _img.tx = mid.x - scaleRatio * (mid.x - _img.tx);
            _img.ty = mid.y - scaleRatio * (mid.y - _img.ty);
            _img.scale = newScale;
            _pinchDist = newDist;
            _imgApplyTransform();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            _pinchDist = null;
        }
    });

    // Pointer drag pan (single finger / mouse)
    container.addEventListener('pointerdown', (e) => {
        // Don't start a drag if we're in a pinch gesture
        if (e.pointerType === 'touch' && _pinchDist !== null) return;
        if (e.button !== 0 && e.pointerType !== 'touch') return;
        _img.dragging = true;
        _img.lastX = e.clientX;
        _img.lastY = e.clientY;
        container.setPointerCapture(e.pointerId);
        container.style.cursor = 'grabbing';
    });

    container.addEventListener('pointermove', (e) => {
        if (!_img.dragging || _pinchDist !== null) return;
        _img.tx += e.clientX - _img.lastX;
        _img.ty += e.clientY - _img.lastY;
        _img.lastX = e.clientX;
        _img.lastY = e.clientY;
        _imgApplyTransform();
    });

    container.addEventListener('pointerup', () => {
        _img.dragging = false;
        container.style.cursor = 'grab';
    });

    container.addEventListener('pointercancel', () => {
        _img.dragging = false;
        container.style.cursor = 'grab';
    });
}

window.imageZoomIn    = () => { _img.scale = Math.min(_img.MAX, _img.scale + _img.STEP); _imgApplyTransform(); };
window.imageZoomOut   = () => { _img.scale = Math.max(_img.MIN, _img.scale - _img.STEP); _imgApplyTransform(); };
window.imageZoomReset = () => _imgResetState();

window.openImageArchive = function (articleId, fileIndex) {
    const article = AppState.articles.find(a => a.id === articleId);
    if (!article || !article.imageFiles || !article.imageFiles[fileIndex]) return;

    const file = article.imageFiles[fileIndex];
    document.getElementById('image-title').textContent = file.title;
    const modal = document.getElementById('image-modal');
    modal.classList.remove('hidden');

    const imgEl = document.getElementById('image-viewer');
    imgEl.src = 'data/artifacts/' + file.file;
    imgEl.alt = file.title;

    // Reset pan/zoom state whenever a new image is opened
    _imgResetState();
    _imgSetupInteractions();

    // Setup Subtext
    const subtextContainer = document.getElementById('image-subtext-container');
    const tabsContainer = document.getElementById('image-subtext-tabs');
    const tabsWrapper = document.getElementById('image-subtext-tabs-container');
    const contentContainer = document.getElementById('image-subtext-content');

    if (file.subtext && file.subtext.length > 0) {
        subtextContainer.style.display = 'block';
        if (tabsWrapper) tabsWrapper.style.display = 'block';
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = '';

        file.subtext.forEach((sub, i) => {
            const btn = document.createElement('button');
            btn.className = 'nav-item active';
            btn.style.cssText = 'padding: 0.5rem 1rem; width: auto; justify-content: center;';
            btn.textContent = sub.label;
            btn.onclick = () => {
                Array.from(tabsContainer.children).forEach(c => c.style.opacity = '0.5');
                btn.style.opacity = '1';
                if (sub.content) {
                    // Render markdown-style bold (**text**) and headers (## text)
                    let rendered = sub.content
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/^## (.+)$/gm, '<h3 style="color:#7dd3fc;margin:1rem 0 0.5rem;">$1</h3>')
                        .replace(/^---$/gm, '<hr style="border-color:rgba(16,185,129,0.3);margin:1rem 0;">')
                        .replace(/\n/g, '<br>');
                    contentContainer.innerHTML = rendered;
                }
            };
            tabsContainer.appendChild(btn);
            if (i === 0) btn.click();
            else btn.style.opacity = '0.5';
        });
    } else {
        subtextContainer.style.display = 'none';
        if (tabsWrapper) tabsWrapper.style.display = 'none';
    }
};

window.closeImageArchive = function () {
    const modal = document.getElementById('image-modal');
    modal.classList.add('hidden');
    document.getElementById('image-viewer').src = '';
    document.getElementById('image-subtext-content').innerHTML = '';
    document.getElementById('image-subtext-tabs').innerHTML = '';
    _imgResetState();
};

// ── Settings Archive ──────────────────────────────────────────────────────────

window.openSettings = function () {
    document.getElementById('settings-modal').classList.remove('hidden');
};

window.closeSettings = function () {
    document.getElementById('settings-modal').classList.add('hidden');
};

window.toggleAnimations = function (enabled) {
    if (window._mapInstance) {
        if (enabled) {
            window._mapInstance.startTangleAnimation();
        } else {
            window._mapInstance.stopTangleAnimation();
        }
    }
};

// Global start
document.addEventListener('DOMContentLoaded', initApp);
