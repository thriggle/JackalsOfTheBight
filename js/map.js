// map.js
class StarMap {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.worlds = [];

        // Config
        this.hexRadius = 60;
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };

        this.colors = {
            text: '#e2e8f0',
            textMuted: '#94a3b8',
            hexBorder: 'rgba(56, 189, 248, 0.1)',
            bg: '#030407',
            // Factions/Hazards
            dieback: '#ef4444',
            arnyl: '#f59e0b',
            qevar: '#10b981',
            dekha: '#0ea5e9',
            wilds: '#64748b',
            strong: '#d946ef',
            independent: '#8b5cf6'
        };

        // Determine bounds
        this.minCol = 99;
        this.maxCol = 0;
        this.minRow = 99;
        this.maxRow = 0;

        this.resize = this.resize.bind(this);
        window.addEventListener('resize', this.resize);

        this.setupInteractions();
    }

    loadData(worlds) {
        const distantNames = ['agdarmi', 'borlund', 'magash', 'jecife', 'hrd', 'kubishush', 'liiri', 'rhinom', 'mora', 'regina', 'vincennes'];
        const mapWorlds = [];
        const distantWorlds = [];

        this.minCol = 99; this.maxCol = 0;
        this.minRow = 99; this.maxRow = 0;

        worlds.forEach(w => {
            if (distantNames.includes(w.name.toLowerCase())) {
                distantWorlds.push(w);
            } else if (w.hex && w.hex.length === 4) {
                w.col = parseInt(w.hex.substring(0, 2), 10);
                w.row = parseInt(w.hex.substring(2, 4), 10);
                if (w.col < this.minCol) this.minCol = w.col;
                if (w.col > this.maxCol) this.maxCol = w.col;
                if (w.row < this.minRow) this.minRow = w.row;
                if (w.row > this.maxRow) this.maxRow = w.row;
                mapWorlds.push(w);
            }
        });

        this.worlds = mapWorlds;
        this.populateDistantWorlds(distantWorlds);

        this.resize();
        this.centerMap();
        this.draw();
    }

    populateDistantWorlds(distantWorlds) {
        const listContainer = document.getElementById('distant-worlds-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        distantWorlds.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'distant-world-btn';
            btn.innerHTML = `<span>${w.name}</span> <span class="hex-badge">${w.hex}</span>`;
            btn.onclick = () => {
                window.location.hash = '#world/' + w.id;
            };
            listContainer.appendChild(btn);
        });
    }

    resize() {
        const parent = this.canvas.parentElement;
        const wasHidden = this.canvas.width === 0 || this.canvas.height === 0;

        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;

        if (wasHidden && this.canvas.width > 0) {
            this.centerMap();
        }

        this.draw();
    }

    centerMap() {
        if (this.worlds.length === 0) return;

        // Center of data grid
        const midCol = (this.minCol + this.maxCol) / 2;
        const midRow = (this.minRow + this.maxRow) / 2;

        const centerPos = this.getHexCenter(midCol, midRow);

        this.offsetX = (this.canvas.width / 2) - centerPos.x * this.scale;
        this.offsetY = (this.canvas.height / 2) - centerPos.y * this.scale;
    }

    setupInteractions() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                this.draw();
            } else {
                // Hover state checking could go here
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const zoomDelta = -e.deltaY * zoomSensitivity;

            const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
            const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;

            // Calculate world coordinates of mouse
            const worldX = (mouseX - this.offsetX) / this.scale;
            const worldY = (mouseY - this.offsetY) / this.scale;

            this.scale = Math.max(0.2, Math.min(3, this.scale + zoomDelta));

            // Keep mouse over same world coordinate
            this.offsetX = mouseX - worldX * this.scale;
            this.offsetY = mouseY - worldY * this.scale;

            this.draw();
        });

        // Touch events for panning and zooming
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                this.isDragging = false;
                this.initialPinchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                this.initialScale = this.scale;
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent default browser panning
            if (this.isDragging && e.touches.length === 1) {
                const dx = e.touches[0].clientX - this.lastMouse.x;
                const dy = e.touches[0].clientY - this.lastMouse.y;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                this.draw();
            } else if (e.touches.length === 2) {
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );

                // Calculate zoom based on pinch
                const zoomFactor = currentDistance / this.initialPinchDistance;
                const newScale = Math.max(0.2, Math.min(3, this.initialScale * zoomFactor));

                // Simplified zoom centering (center of the screen)
                const mouseX = this.canvas.width / 2;
                const mouseY = this.canvas.height / 2;
                const worldX = (mouseX - this.offsetX) / this.scale;
                const worldY = (mouseY - this.offsetY) / this.scale;

                this.scale = newScale;
                this.offsetX = mouseX - worldX * this.scale;
                this.offsetY = mouseY - worldY * this.scale;

                this.draw();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                if (e.touches.length === 1) {
                    this.isDragging = true;
                    this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                } else {
                    this.isDragging = false;
                }
            }
        });

        // Click handler for worlds
        this.canvas.addEventListener('click', (e) => {
            // Don't trigger click if we just dragged
            // Simple dragging threshold (could be improved)

            const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
            const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;

            const worldX = (mouseX - this.offsetX) / this.scale;
            const worldY = (mouseY - this.offsetY) / this.scale;

            // Check collision with worlds (simple circle hit test)
            for (const w of this.worlds) {
                const pos = this.getHexCenter(w.col, w.row);
                const dist = Math.sqrt(Math.pow(pos.x - worldX, 2) + Math.pow(pos.y - worldY, 2));
                if (dist <= 20) { // 20 is hit radius
                    this.handleWorldClick(w);
                    break;
                }
            }
        });
    }

    handleWorldClick(world) {
        const overlay = document.getElementById('map-overlay');

        // Find matching tags / colors
        let allegianceColor = this.colors.wilds;
        if (world.allegiance.includes('Arnyl')) allegianceColor = this.colors.arnyl;
        else if (world.allegiance.includes('Qevar') || world.allegiance.includes('Sigka')) allegianceColor = this.colors.qevar;
        else if (world.allegiance.includes('Dekha') || world.allegiance.includes('Pentarchy')) allegianceColor = this.colors.dekha;

        overlay.innerHTML = `
      <h2 class="overlay-title" style="color: ${allegianceColor}">${world.name}</h2>
      <div class="overlay-uwp">${world.uwp} | ${world.hex}</div>
      <div class="overlay-badges">
        <span class="badge faction">${world.allegiance}</span>
        <span class="badge hazard">${world.hazardLevel}</span>
      </div>
      <p class="overlay-desc">${world.summary.substring(0, 150)}...</p>
      <button class="btn-primary" onclick="window.location.hash='#world/${world.id}'">View Dossier</button>
    `;
        overlay.classList.remove('hidden');
    }

    getHexCenter(col, row) {
        // Flat-topped hexagons (columns are vertical, rows are horizontal zig-zags)
        const size = this.hexRadius;

        // Horizontal distance between adjacent hex centers is 1.5 * radius
        const width = 1.5 * size;

        // Vertical distance is sqrt(3) * radius
        const height = Math.sqrt(3) * size;

        // In Traveller maps, odd columns are shifted UP by half a hex height
        // Because of coordinate 0626 vs 0727 vs 0826 geometry
        const x = col * width;
        const y = row * height - (col % 2 === 1 ? height / 2 : 0);

        return { x, y };
    }

    drawHexPath(ctx, x, y, size) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            // Flat-topped hexes have vertices at 0, 60, 120, 180, 240, 300 degrees
            const angle_deg = 60 * i;
            const angle_rad = Math.PI / 180 * angle_deg;
            const px = x + size * Math.cos(angle_rad);
            const py = y + size * Math.sin(angle_rad);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    getColorForWorld(w) {
        const haz = (w.hazardLevel || '').toLowerCase();
        const all = (w.allegiance || '').toLowerCase();

        if (haz.includes('dieback')) return this.colors.dieback;
        if (all.includes('arnyl')) return this.colors.arnyl;
        if (all.includes('qevar') || all.includes('sigka')) return this.colors.qevar;
        if (all.includes('dekha') || all.includes('pentarchy')) return this.colors.dekha;
        if (haz.includes('strong')) return this.colors.strong;
        if (all.includes('independent')) return this.colors.independent;

        return this.colors.textMuted;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();

        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        const size = this.hexRadius;

        // Draw background grid (optional, we could just draw all hexes in range)
        this.ctx.strokeStyle = this.colors.hexBorder;
        this.ctx.lineWidth = 1;

        // Draw the hexes that exist
        for (const w of this.worlds) {
            const { x, y } = this.getHexCenter(w.col, w.row);
            this.drawHexPath(this.ctx, x, y, size);
            this.ctx.stroke();

            // Draw hex coord
            this.ctx.fillStyle = this.colors.textMuted;
            this.ctx.font = '10px JetBrains Mono';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(w.hex, x, y - size + 15);
        }

        // Draw connectors/links if any (Skipping complex routing for now)

        // Draw worlds
        for (const w of this.worlds) {
            const { x, y } = this.getHexCenter(w.col, w.row);
            const color = this.getColorForWorld(w);

            // Outer glow
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 10;

            // Dot
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.fill();

            this.ctx.shadowBlur = 0; // reset

            // Name
            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = 'bold 14px Outfit';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(w.name, x, y + 20);

            // Small starport UWP indicator
            if (w.uwp && w.uwp !== 'Unknown') {
                const sp = w.uwp.charAt(0);
                this.ctx.fillStyle = this.colors.textMuted;
                this.ctx.font = '10px JetBrains Mono';
                this.ctx.fillText(sp, x, y - 10);
            }
        }

        this.ctx.restore();
    }
}

window.initMap = (worldsData) => {
    const mapArr = window._mapInstance || new StarMap('hexMapCanvas');
    window._mapInstance = mapArr;
    mapArr.loadData(worldsData);
};
