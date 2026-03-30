document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        activeTab: 'articles', // 'articles' or 'worlds'
        data: {
            articles: [],
            worlds: [],
            distantCategories: []
        },
        selectedItemId: null,
        selectedTagFilter: null
    };

    // DOM Elements
    const els = {
        tabs: document.querySelectorAll('.tab-btn'),
        itemList: document.getElementById('item-list'),
        searchInput: document.getElementById('search-input'),
        categoryFilter: document.getElementById('category-filter'),
        wordcloudBtn: document.getElementById('wordcloud-btn'),
        wordcloudContainer: document.getElementById('wordcloud-container'),
        newItemBtn: document.getElementById('new-item-btn'),
        sortListBtn: document.getElementById('sort-list-btn'),
        saveAllBtn: document.getElementById('save-all-btn'),
        deleteItemBtn: document.getElementById('delete-item-btn'),
        welcomeState: document.getElementById('welcome-state'),
        formState: document.getElementById('editor-form-state'),
        dataForm: document.getElementById('data-form'),
        toast: document.getElementById('toast')
    };

    // Initialize
    async function init() {
        await loadData();
        setupEventListeners();
        els.categoryFilter.style.display = 'block';
        els.wordcloudBtn.style.display = 'block';
        renderList();
    }

    // Data Load/Save
    async function loadData() {
        try {
            const [artRes, worldRes, distRes] = await Promise.all([
                fetch('/api/articles.json'),
                fetch('/api/worlds.json'),
                fetch('/api/distant-categories.json')
            ]);
            state.data.articles = await artRes.json();
            state.data.worlds = await worldRes.json();
            const distData = await distRes.json();
            state.data.distantCategories = [{ id: 'map-distant', name: 'Map Distant Categories', ...distData }];
            updateCategoryDropdown();
        } catch (e) {
            console.error("Failed to load data", e);
            showToast("Failed to load data. Check console.", true);
        }
    }

    async function saveData() {
        // Sync current form to state before saving
        if (state.selectedItemId) {
            syncFormToState();
        }

        let endpoint = `/api/${state.activeTab}.json`;
        if (state.activeTab === 'distantCategories') endpoint = '/api/distant-categories.json';

        let dataToSave = {};
        if (state.activeTab === 'articles') dataToSave = state.data.articles;
        else if (state.activeTab === 'worlds') dataToSave = state.data.worlds;
        else {
            dataToSave = { ...state.data.distantCategories[0] };
            delete dataToSave.id;
            delete dataToSave.name;
        }

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave)
            });
            const result = await res.json();
            if (result.success) {
                showToast('Saved successfully to disk!');
            } else {
                throw new Error(result.error);
            }
        } catch (e) {
            console.error("Save failed", e);
            showToast('Failed to save! Check console.', true);
        }
    }

    // UI Updates
    function switchTab(tab) {
        if (state.activeTab === tab) return;

        // Save current form silently to memory before switching
        if (state.selectedItemId) {
            syncFormToState();
        }

        state.activeTab = tab;
        state.selectedItemId = null;
        state.selectedTagFilter = null;
        els.searchInput.value = '';

        if (tab === 'articles') {
            els.categoryFilter.style.display = 'block';
            els.wordcloudBtn.style.display = 'block';
            updateCategoryDropdown();
        } else {
            els.categoryFilter.style.display = 'none';
            els.wordcloudBtn.style.display = 'none';
            els.wordcloudContainer.classList.add('hidden');
            els.categoryFilter.value = '';
        }

        // Update UI
        els.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        renderList();
        showWelcomeState();
    }

    function renderList(filter = '') {
        const items = state.activeTab === 'articles' ? state.data.articles :
            state.activeTab === 'worlds' ? state.data.worlds : state.data.distantCategories;
            
        const selectedCategory = els.categoryFilter.value;

        const filteredItems = items.filter(item => {
            const searchStr = `${item.title || item.name} ${item.id}`.toLowerCase();
            const matchesSearch = searchStr.includes(filter.toLowerCase());
            
            let matchesCategory = true;
            if (state.activeTab === 'articles' && selectedCategory) {
                matchesCategory = item.category === selectedCategory;
            }
            
            let matchesTag = true;
            if (state.activeTab === 'articles' && state.selectedTagFilter) {
                if (!item.tags || !Array.isArray(item.tags)) {
                    matchesTag = false;
                } else {
                    matchesTag = item.tags.map(t => t.trim()).includes(state.selectedTagFilter);
                }
            }
            
            return matchesSearch && matchesCategory && matchesTag;
        });

        const listHtml = filteredItems.map(item => {
            const label = item.title || item.name || 'Untitled';
            const isSelected = item.id === state.selectedItemId;
            return `<li data-id="${item.id}" class="${isSelected ? 'selected' : ''}">${label}</li>`;
        }).join('');

        els.itemList.innerHTML = listHtml;
        
        if (!els.wordcloudContainer.classList.contains('hidden')) {
            renderWordcloud(filteredItems);
        }
    }

    function updateCategoryDropdown() {
        if (state.activeTab !== 'articles') return;
        
        const categories = new Set();
        state.data.articles.forEach(a => {
            if (a.category) categories.add(a.category);
        });

        const currentVal = els.categoryFilter.value;
        const sortedCats = Array.from(categories).sort();
        
        let html = '<option value="">All Categories</option>';
        sortedCats.forEach(cat => {
            html += `<option value="${cat}">${cat}</option>`;
        });
        
        els.categoryFilter.innerHTML = html;
        els.categoryFilter.value = currentVal;
    }

    function renderWordcloud(filteredItems) {
        if (state.activeTab !== 'articles') {
            els.wordcloudContainer.innerHTML = '';
            return;
        }

        const tagCounts = {};
        let totalTags = 0;
        filteredItems.forEach(item => {
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(tag => {
                    const t = String(tag).trim();
                    if (t) {
                        tagCounts[t] = (tagCounts[t] || 0) + 1;
                        totalTags++;
                    }
                });
            }
        });

        if (totalTags === 0) {
            els.wordcloudContainer.innerHTML = '<div style="padding:1rem;color:var(--text-muted);text-align:center;">No tags found</div>';
            return;
        }

        const maxCount = Math.max(...Object.values(tagCounts));
        const sortedTags = Object.keys(tagCounts).sort((a,b) => a.localeCompare(b));
        
        let html = '<div style="padding:1rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border-color); display:flex; flex-wrap:wrap; gap:0.6rem; justify-content:center; max-height: 250px; overflow-y: auto;">';
        
        sortedTags.forEach(tag => {
            const count = tagCounts[tag];
            const isSelected = tag === state.selectedTagFilter;
            const bg = isSelected ? 'var(--accent-primary)' : 'var(--bg-surface-hover)';
            const color = isSelected ? 'var(--bg-color)' : 'var(--text-primary)';
            html += `<span class="tag-cloud-item" data-tag="${tag.replace(/"/g, '&quot;')}" style="font-size:0.85rem; color:${color}; background: ${bg}; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--border-color); cursor: pointer;">${tag} (${count})</span>`;
        });
        
        html += '</div>';
        els.wordcloudContainer.innerHTML = html;
    }

    function selectItem(id) {
        if (state.selectedItemId === id) return;

        // Sync previous form to state
        if (state.selectedItemId) {
            syncFormToState();
        }

        state.selectedItemId = id;
        renderList(els.searchInput.value);

        const items = state.activeTab === 'articles' ? state.data.articles :
            state.activeTab === 'worlds' ? state.data.worlds : state.data.distantCategories;
        const item = items.find(i => String(i.id) === String(id));

        if (item) {
            renderForm(item);
            showFormState();
        }
    }

    function createNewItem() {
        if (state.selectedItemId) {
            syncFormToState();
        }

        const newId = `new-${state.activeTab}-${Date.now()}`;
        let newItem = { id: newId };

        if (state.activeTab === 'articles') {
            newItem = {
                id: newId,
                title: 'New Article',
                category: '',
                tags: [],
                content: []
            };
            state.data.articles.push(newItem);
        } else if (state.activeTab === 'worlds') {
            newItem = {
                id: newId,
                name: 'New World',
                uwp: '',
                hazardLevel: '',
                allegiance: '',
                summary: '',
                hex: ''
            };
            state.data.worlds.push(newItem);
        } else {
            return; // Cannot create new distant categories block
        }

        state.selectedItemId = newId;
        renderList();
        renderForm(newItem);
        showFormState();
    }

    function deleteCurrentItem() {
        if (!state.selectedItemId) return;

        if (!confirm('Are you sure you want to delete this item? This cannot be undone once saved to disk.')) {
            return;
        }

        if (state.activeTab === 'articles') {
            state.data.articles = state.data.articles.filter(i => i.id !== state.selectedItemId);
        } else if (state.activeTab === 'worlds') {
            state.data.worlds = state.data.worlds.filter(i => i.id !== state.selectedItemId);
        } else {
            return; // Cannot delete the singleton distant categories
        }

        state.selectedItemId = null;
        renderList();
        showWelcomeState();
    }

    // Sorting
    function getSortableName(item) {
        let name = item.title || item.name || '';
        name = name.trim().toLowerCase();
        if (name.startsWith('the ')) {
            return name.substring(4).trim();
        }
        return name;
    }

    function sortCurrentList() {
        if (state.selectedItemId) {
            syncFormToState();
        }

        const items = state.activeTab === 'articles' ? state.data.articles :
            state.activeTab === 'worlds' ? state.data.worlds : state.data.distantCategories;

        items.sort((a, b) => {
            const nameA = getSortableName(a);
            const nameB = getSortableName(b);
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });

        renderList(els.searchInput.value);
        showToast('List sorted! Click "Save to Disk" to keep changes.');
    }

    // Form Rendering & Parsing
    const formSchemas = {
        articles: [
            { id: 'id', label: 'ID', type: 'text', help: 'Unique identifier, usually dash-case.' },
            { id: 'title', label: 'Title', type: 'text' },
            { id: 'category', label: 'Category', type: 'text' },
            { id: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Optional numerical order.' },
            { id: 'tags', label: 'Tags', type: 'text', help: 'Comma separated list of tags.', isArray: true },
            { id: 'summary', label: 'Summary', type: 'textarea', help: 'Optional short summary text.' },
            { id: 'content', label: 'Content', type: 'textarea', cssClass: 'textarea-tall', help: 'Paragraphs separated by double newlines.', isArrayOfHtmlStrings: true }
        ],
        worlds: [
            { id: 'id', label: 'ID', type: 'text', help: 'Unique identifier, usually dash-case.' },
            { id: 'name', label: 'Name', type: 'text' },
            { id: 'hex', label: 'Hex', type: 'text', help: 'Starmap coordinates (e.g. 1910).' },
            { id: 'uwp', label: 'UWP', type: 'text', help: 'Universal World Profile code.' },
            { id: 'hazardLevel', label: 'Hazard Level', type: 'text' },
            { id: 'allegiance', label: 'Allegiance', type: 'text' },
            { id: 'hasTangle', label: 'Has Tangle', type: 'checkbox', help: 'Check if this hex should render a Tangle anomaly.' },
            { id: 'summary', label: 'Summary', type: 'textarea', cssClass: 'textarea-tall' }
        ],
        distantCategories: [
            { id: 'coreward', label: 'Coreward (Raw JSON)', type: 'textarea', cssClass: 'textarea-tall', isJson: true, help: 'JSON array of string or object IDs.' },
            { id: 'rimward', label: 'Rimward (Raw JSON)', type: 'textarea', cssClass: 'textarea-tall', isJson: true },
            { id: 'spinward', label: 'Spinward (Raw JSON)', type: 'textarea', cssClass: 'textarea-tall', isJson: true },
            { id: 'trailing', label: 'Trailing (Raw JSON)', type: 'textarea', cssClass: 'textarea-tall', isJson: true }
        ]
    };

    function renderForm(item) {
        document.getElementById('form-title').textContent = `Edit ${state.activeTab === 'articles' ? 'Article' : 'World'}: ${item.title || item.name || 'New'}`;

        const schema = formSchemas[state.activeTab];
        let formHtml = '';

        schema.forEach(field => {
            let value = item[field.id] !== undefined ? item[field.id] : '';

            // Format for display
            if (field.isJson && typeof value === 'object') {
                value = JSON.stringify(value, null, 4);
            } else if (field.isArray && Array.isArray(value)) {
                value = value.join(', ');
            } else if (field.isArrayOfHtmlStrings && Array.isArray(value)) {
                value = value.join('\n\n');
            }

            // Escape HTML for text inputs
            if (typeof value === 'string') {
                value = value.replace(/"/g, '&quot;');
            }

            formHtml += `<div class="form-group">`;
            formHtml += `<label for="${field.id}">${field.label}</label>`;

            if (field.type === 'textarea') {
                formHtml += `<textarea id="${field.id}" name="${field.id}" class="${field.cssClass || ''}">${value}</textarea>`;
            } else if (field.type === 'number') {
                formHtml += `<input type="number" id="${field.id}" name="${field.id}" value="${value}">`;
            } else if (field.type === 'checkbox') {
                formHtml += `<input type="checkbox" id="${field.id}" name="${field.id}" ${value ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;" />`;
            } else {
                formHtml += `<input type="text" id="${field.id}" name="${field.id}" value="${value}">`;
            }

            if (field.help) {
                formHtml += `<span class="help-text">${field.help}</span>`;
            }
            formHtml += `</div>`;
        });

        // Handle complex/rare fields like imageFiles/audioFiles by storing them in a hidden raw JSON block for safekeeping, 
        // to not lose them when saving. OR we edit them as raw JSON.
        const otherKeys = Object.keys(item).filter(k => !schema.find(s => s.id === k));
        if (otherKeys.length > 0) {
            let rawDataMap = {};
            otherKeys.forEach(k => rawDataMap[k] = item[k]);

            formHtml += `<div class="form-group">
                <label for="_raw_json">Other Properties (Raw JSON)</label>
                <textarea id="_raw_json" name="_raw_json" class="textarea-tall">${JSON.stringify(rawDataMap, null, 4)}</textarea>
                <span class="help-text">Edit advanced properties here like imageFiles or audioFiles as raw JSON. Be careful to use valid JSON.</span>
            </div>`;
        } else {
            // Empty raw json so the sync mechanism can still add fields if the user types them
            formHtml += `<div class="form-group">
                <label for="_raw_json">Other Properties (Raw JSON)</label>
                <textarea id="_raw_json" name="_raw_json" class="textarea-tall">{}</textarea>
                <span class="help-text">Add advanced properties here like imageFiles or audioFiles as raw JSON. Must be valid JSON.</span>
            </div>`;
        }

        els.dataForm.innerHTML = formHtml;
    }

    function syncFormToState() {
        if (!state.selectedItemId) return;

        const items = state.activeTab === 'articles' ? state.data.articles : 
                      state.activeTab === 'worlds' ? state.data.worlds : state.data.distantCategories;
        const itemIndex = items.findIndex(i => String(i.id) === String(state.selectedItemId));
        if (itemIndex === -1) return;

        const schema = formSchemas[state.activeTab];
        const updatedItem = {};

        // Sync defined schema fields
        schema.forEach(field => {
            const input = document.getElementById(field.id);
            if (!input) return;

            let val = input.value;

            if (field.isJson) {
                try {
                    updatedItem[field.id] = JSON.parse(val || '[]');
                } catch (e) { }
            } else if (field.isArray) {
                updatedItem[field.id] = val.split(',').map(s => s.trim()).filter(s => s);
            } else if (field.isArrayOfHtmlStrings) {
                updatedItem[field.id] = val.split(/\n\s*\n/).map(s => s.trim()).filter(s => s);
            } else if (field.type === 'number') {
                updatedItem[field.id] = val ? parseFloat(val) : undefined;
            } else if (field.type === 'checkbox') {
                updatedItem[field.id] = input.checked;
                if (!updatedItem[field.id]) delete updatedItem[field.id]; // Don't bloat JSON with false
            } else {
                updatedItem[field.id] = val;
            }

            // Clean up undefined
            if (updatedItem[field.id] === undefined || updatedItem[field.id] === '') {
                delete updatedItem[field.id];
            }
        });

        // Sync raw json fields
        const rawJsonInput = document.getElementById('_raw_json');
        if (rawJsonInput && rawJsonInput.value.trim()) {
            try {
                const parsedRaw = JSON.parse(rawJsonInput.value);
                Object.assign(updatedItem, parsedRaw);
            } catch (e) {
                console.error("Failed to parse raw json", e);
                // We won't block, but maybe we should show an alert if it's bad JSON?
                // Keeping it simple: it just drops the raw changes if invalid
            }
        }

        // Replace item in state
        items[itemIndex] = updatedItem;
        state.selectedItemId = updatedItem.id; // in case ID changed
    }

    // View Toggles
    function showWelcomeState() {
        els.welcomeState.classList.add('active');
        els.formState.classList.remove('active');
    }

    function showFormState() {
        els.welcomeState.classList.remove('active');
        els.formState.classList.add('active');
    }

    function showToast(msg, isError = false) {
        els.toast.textContent = msg;
        els.toast.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        els.toast.classList.add('show');
        setTimeout(() => els.toast.classList.remove('show'), 3000);
    }

    // Event Listeners
    function setupEventListeners() {
        els.tabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        els.itemList.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (li && li.dataset.id) {
                selectItem(li.dataset.id);
            }
        });

        els.searchInput.addEventListener('input', (e) => {
            renderList(e.target.value);
        });

        if (els.categoryFilter) {
            els.categoryFilter.addEventListener('change', () => {
                renderList(els.searchInput.value);
            });
        }

        if (els.wordcloudBtn) {
            els.wordcloudBtn.addEventListener('click', () => {
                els.wordcloudContainer.classList.toggle('hidden');
                renderList(els.searchInput.value);
            });
        }
        
        if (els.wordcloudContainer) {
            els.wordcloudContainer.addEventListener('click', (e) => {
                const span = e.target.closest('.tag-cloud-item');
                if (!span) return;
                
                const tag = span.dataset.tag;
                if (state.selectedTagFilter === tag) {
                    state.selectedTagFilter = null;
                } else {
                    state.selectedTagFilter = tag;
                }
                renderList(els.searchInput.value);
            });
        }

        els.newItemBtn.addEventListener('click', createNewItem);
        els.sortListBtn.addEventListener('click', sortCurrentList);

        els.saveAllBtn.addEventListener('click', () => {
            saveData();
        });

        els.deleteItemBtn.addEventListener('click', deleteCurrentItem);

        // Auto-update list title when editing title/name/category
        els.dataForm.addEventListener('input', (e) => {
            if (e.target.id === 'category') {
                updateCategoryDropdown();
            }
            if (e.target.id === 'tags' && !els.wordcloudContainer.classList.contains('hidden')) {
                // Throttle maybe? It's fine for small lists
                renderList(els.searchInput.value);
            }
            if (e.target.id === 'title' || e.target.id === 'name') {
                const li = els.itemList.querySelector(`li[data-id="${state.selectedItemId}"]`);
                if (li) li.textContent = e.target.value || 'Untitled';
                document.getElementById('form-title').textContent = `Edit: ${e.target.value || 'Untitled'}`;
            }
        });
    }

    // Run
    init();
});
