(function () {
    function insertDisclaimer() {
        const currentYear = new Date().getFullYear();
        const disclaimerHtml = `The Traveller game in all forms is owned by Mongoose Publishing. Copyright ${currentYear} Mongoose Publishing.`;
        const settingsHtml = `<button onclick="openSettings()" title="Settings" style="background:none; border:none; color:inherit; cursor:pointer; font-size:1.1rem; vertical-align:middle; margin-left:1rem; padding: 0.2rem;">⚙️</button>`;

        let footer = document.querySelector('.footer');
        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'footer';
            document.body.appendChild(footer);
        }
        footer.innerHTML = `<span>${disclaimerHtml}</span>${settingsHtml}`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', insertDisclaimer);
    } else {
        insertDisclaimer();
    }
})();
