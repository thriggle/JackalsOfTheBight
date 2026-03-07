// ui.js (Search capabilities and general event handling)
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    if (searchInput && searchResults) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length < 2) {
                searchResults.classList.add('hidden');
                return;
            }

            const wResults = AppState.worlds.filter(w =>
                w.name.toLowerCase().includes(query) ||
                (w.hazardLevel && w.hazardLevel.toLowerCase().includes(query)) ||
                (w.allegiance && w.allegiance.toLowerCase().includes(query))
            );

            const aResults = AppState.articles.filter(a =>
                a.title.toLowerCase().includes(query) ||
                (a.tags && a.tags.some(t => t.toLowerCase().includes(query)))
            );

            renderSearchResults(wResults, aResults);
        });
    }
});

function renderSearchResults(worlds, articles) {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '';

    if (worlds.length === 0 && articles.length === 0) {
        searchResults.innerHTML = '<div class="no-results" style="padding: 1rem; color: #94a3b8;">No results found</div>';
    } else {
        worlds.forEach(w => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<span class="icon">🌌</span> ${w.name}`;
            div.onclick = () => {
                window.location.hash = '#world/' + w.id;
                searchResults.classList.add('hidden');
                document.getElementById('searchInput').value = '';
            };
            searchResults.appendChild(div);
        });

        articles.forEach(a => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<span class="icon">${a.category === 'Document' ? '📜' : '📄'}</span> ${a.title}`;
            div.onclick = () => {
                window.location.hash = '#article/' + a.id;
                searchResults.classList.add('hidden');
                document.getElementById('searchInput').value = '';
            };
            searchResults.appendChild(div);
        });
    }

    searchResults.classList.remove('hidden');
}

// Close search when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        const searchResults = document.getElementById('searchResults');
        if (searchResults) searchResults.classList.add('hidden');
    }
});
