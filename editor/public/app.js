document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        activeTab: 'articles', // 'articles' or 'worlds'
        data: {
            articles: [],
            worlds: []
        },
        selectedItemId: null
    };

    // DOM Elements
    const els = {
        tabs: document.querySelectorAll('.tab-btn'),
        itemList: document.getElementById('item-list'),
        searchInput: document.getElementById('search-input'),
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
        renderList();
    }

    // Data Load/Save
    async function loadData() {
        try {
            const [artRes, worldRes] = await Promise.all([
                fetch('/api/articles.json'),
                fetch('/api/worlds.json')
            ]);
            state.data.articles = await artRes.json();
            state.data.worlds = await worldRes.json();
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

        const endpoint = `/api/${state.activeTab}.json`;
        const dataToSave = state.activeTab === 'articles' ? state.data.articles : state.data.worlds;

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
        els.searchInput.value = '';

        // Update UI
        els.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        renderList();
        showWelcomeState();
    }

    function renderList(filter = '') {
        const items = state.activeTab === 'articles' ? state.data.articles : state.data.worlds;
        const listHtml = items
            .filter(item => {
                const searchStr = `${item.title || item.name} ${item.id}`.toLowerCase();
                return searchStr.includes(filter.toLowerCase());
            })
            .map(item => {
                const label = item.title || item.name || 'Untitled';
                const isSelected = item.id === state.selectedItemId;
                return `<li data-id="${item.id}" class="${isSelected ? 'selected' : ''}">${label}</li>`;
            })
            .join('');
        
        els.itemList.innerHTML = listHtml;
    }

    function selectItem(id) {
        if (state.selectedItemId === id) return;

        // Sync previous form to state
        if (state.selectedItemId) {
            syncFormToState();
        }

        state.selectedItemId = id;
        renderList(els.searchInput.value);
        
        const items = state.activeTab === 'articles' ? state.data.articles : state.data.worlds;
        const item = items.find(i => i.id === id);

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
        } else {
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
        } else {
            state.data.worlds = state.data.worlds.filter(i => i.id !== state.selectedItemId);
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

        const items = state.activeTab === 'articles' ? state.data.articles : state.data.worlds;
        
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
            { id: 'summary', label: 'Summary', type: 'textarea', cssClass: 'textarea-tall' }
        ]
    };

    function renderForm(item) {
        document.getElementById('form-title').textContent = `Edit ${state.activeTab === 'articles' ? 'Article' : 'World'}: ${item.title || item.name || 'New'}`;
        
        const schema = formSchemas[state.activeTab];
        let formHtml = '';

        schema.forEach(field => {
            let value = item[field.id] !== undefined ? item[field.id] : '';
            
            // Format for display
            if (field.isArray && Array.isArray(value)) {
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

        const items = state.activeTab === 'articles' ? state.data.articles : state.data.worlds;
        const itemIndex = items.findIndex(i => i.id === state.selectedItemId);
        if (itemIndex === -1) return;

        const schema = formSchemas[state.activeTab];
        const updatedItem = {};

        // Sync defined schema fields
        schema.forEach(field => {
            const input = document.getElementById(field.id);
            if (!input) return;

            let val = input.value;

            if (field.isArray) {
                updatedItem[field.id] = val.split(',').map(s => s.trim()).filter(s => s);
            } else if (field.isArrayOfHtmlStrings) {
                updatedItem[field.id] = val.split(/\n\s*\n/).map(s => s.trim()).filter(s => s);
            } else if (field.type === 'number') {
                updatedItem[field.id] = val ? parseFloat(val) : undefined;
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

        els.newItemBtn.addEventListener('click', createNewItem);
        els.sortListBtn.addEventListener('click', sortCurrentList);
        
        els.saveAllBtn.addEventListener('click', () => {
            saveData();
        });

        els.deleteItemBtn.addEventListener('click', deleteCurrentItem);

        // Auto-update list title when editing title/name
        els.dataForm.addEventListener('input', (e) => {
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
