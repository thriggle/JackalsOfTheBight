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
        this.tangleTime = 0;
        this.isAnimating = false;

        this.colors = {
            text: '#e2e8f0',
            textMuted: '#94a3b8',
            hexBorder: 'rgba(56, 189, 248, 0.1)',
            bg: '#030407',
            // Factions/Hazards
            arnyl: '#ef4444',
            wilds: '#f59e0b',
            qevar: '#10b981',
            dekha: '#0ea5e9',
            dieback: '#64748b',
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
        const distantCategories = {
            coreward: [
                'vincennes', 'hrd', 'borlund',
                {
                    id: 'limmu-bukara',
                    title: 'The Limmu Bukara',
                    worlds: ['kubishush', 'magash', 'liiri']
                },
                'rhinom'
            ],
            rimward: ['agdarmi', 'jecife', 'lilad'],
            spinward: ['mora', 'regina'],
            trailing: ['deneb']
        };

        const mapWorlds = [];
        const distantWorlds = { coreward: [], rimward: [], spinward: [], trailing: [] };

        this.minCol = 99; this.maxCol = 0;
        this.minRow = 99; this.maxRow = 0;

        worlds.forEach(w => {
            const nameLower = w.name.toLowerCase();
            let isDistant = false;

            for (const [dir, items] of Object.entries(distantCategories)) {
                for (const item of items) {
                    if (typeof item === 'string') {
                        if (item === nameLower) {
                            distantWorlds[dir].push(w);
                            isDistant = true;
                            break;
                        }
                    } else if (item.worlds) {
                        if (item.worlds.includes(nameLower)) {
                            let group = distantWorlds[dir].find(g => g.id === item.id);
                            if (!group) {
                                group = { isGroup: true, ...item, worldData: [] };
                                distantWorlds[dir].push(group);
                            }
                            group.worldData.push(w);
                            isDistant = true;
                            break;
                        }
                    }
                }
                if (isDistant) break;
            }

            if (!isDistant && w.hex && w.hex.length === 4) {
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
        this.startTangleAnimation();
    }

    startTangleAnimation() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        const animate = (ts) => {
            if (!this.isAnimating) return;
            this.tangleTime = ts * 0.001;
            this.draw();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    stopTangleAnimation() {
        this.isAnimating = false;
        this.draw();
    }

    drawTangle(ctx) {
        const t = this.tangleTime;
        const R = this.hexRadius;

        // The 7 hexes that form the tangle footprint
        const tangleHexes = [
            { col: 14, row: 31 }, // 1431 – empty, coreward of Pashus
            { col: 13, row: 32 }, // 1332 – Giffert
            { col: 14, row: 32 }, // 1432 – Pashus (centre)
            { col: 15, row: 32 }, // 1532 – Rajan
            { col: 13, row: 33 }, // 1333 – Shiiku
            { col: 14, row: 33 }, // 1433 – Atab
            { col: 15, row: 33 }, // 1533 – empty, rimward of Rajan
        ];

        const centers = tangleHexes.map(h => this.getHexCenter(h.col, h.row));
        const cx = centers.reduce((s, c) => s + c.x, 0) / centers.length;
        const cy = centers.reduce((s, c) => s + c.y, 0) / centers.length;

        const blobR  = R * 1.18;   // base blob radius per hex
        const amp1   = R * 0.13;   // primary wave amplitude
        const amp2   = R * 0.06;   // secondary wave amplitude
        const N      = 60;         // path resolution

        // Colour tokens
        const fillA   = 'rgba(245, 158, 11, 0.09)';
        const fillB   = 'rgba(245, 158, 11, 0.06)';
        const fillC   = 'rgba(245, 158, 11, 0.04)';
        const strokeC = 'rgba(245, 158, 11, 0.28)';

        ctx.save();

        // Helper: draw one wavy circle around a centre point
        const wavyPath = (cx, cy, rBase, timeOffset, sizeScale) => {
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
                const ang = (i / N) * Math.PI * 2;
                const wave = amp1 * Math.sin(3 * ang + t * 1.6 + timeOffset)
                           + amp2 * Math.sin(7 * ang - t * 0.9 + timeOffset * 1.4);
                const r = rBase * sizeScale + wave;
                const px = cx + r * Math.cos(ang);
                const py = cy + r * Math.sin(ang);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
        };

        // Three fill passes – progressively larger and more transparent
        const passes = [
            { fill: fillA, scale: 1.00 },
            { fill: fillB, scale: 1.10 },
            { fill: fillC, scale: 1.22 },
        ];
        for (const { fill, scale } of passes) {
            ctx.fillStyle = fill;
            for (const c of centers) {
                const phase = (c.x * 0.008 + c.y * 0.006);
                wavyPath(c.x, c.y, blobR, phase, scale);
                ctx.fill();
            }
        }

        // Glowing edge stroke
        ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
        ctx.shadowBlur  = 18;
        ctx.strokeStyle = strokeC;
        ctx.lineWidth   = 1.5;
        for (const c of centers) {
            const phase = (c.x * 0.008 + c.y * 0.006);
            wavyPath(c.x, c.y, blobR, phase, 1.0);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Label – offset coreward-spinward, gently rotated
        const labelOpacity = 0.60 + 0.18 * Math.sin(t * 0.7);
        const labelX = cx - R * 1.55;
        const labelY = cy - R * 1.40;
        ctx.save();
        ctx.translate(labelX, labelY);
        ctx.rotate(-Math.PI / 7.5);
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(R * 0.40)}px Outfit`;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = `rgba(245, 158, 11, ${labelOpacity})`;
        ctx.fillText('Pashus Tangle', 0, 0);
        ctx.restore();

        ctx.restore();
    }

    populateDistantWorlds(distantWorlds) {
        const directions = ['coreward', 'rimward', 'spinward', 'trailing'];

        directions.forEach(dir => {
            const block = document.getElementById(`distant-${dir}`);
            const listContainer = document.getElementById(`list-${dir}`);

            if (!block || !listContainer) return;

            const itemsInDir = distantWorlds[dir];

            if (itemsInDir && itemsInDir.length > 0) {
                block.classList.remove('hidden');
                listContainer.innerHTML = '';

                itemsInDir.forEach(item => {
                    if (item.isGroup) {
                        const groupDiv = document.createElement('div');
                        groupDiv.className = 'distant-group closed';

                        const header = document.createElement('div');
                        header.className = 'distant-group-header';

                        const titleBtn = document.createElement('button');
                        titleBtn.className = 'group-title';
                        titleBtn.textContent = item.title;
                        titleBtn.onclick = () => window.location.hash = '#article/' + item.id;

                        const toggleBtn = document.createElement('button');
                        toggleBtn.className = 'group-toggle';
                        toggleBtn.innerHTML = '▼';
                        toggleBtn.onclick = () => {
                            groupDiv.classList.toggle('closed');
                        };

                        header.appendChild(titleBtn);
                        header.appendChild(toggleBtn);
                        groupDiv.appendChild(header);

                        const groupList = document.createElement('div');
                        groupList.className = 'distant-group-list';
                        item.worldData.forEach(w => {
                            const btn = document.createElement('button');
                            btn.className = 'distant-world-btn nested';
                            btn.innerHTML = `<span>${w.name}</span> <span class="hex-badge">${w.hex || ''}</span>`;
                            btn.onclick = () => this.handleWorldClick(w);
                            groupList.appendChild(btn);
                        });

                        groupDiv.appendChild(groupList);
                        listContainer.appendChild(groupDiv);
                    } else {
                        const btn = document.createElement('button');
                        btn.className = 'distant-world-btn';
                        btn.innerHTML = `<span>${item.name}</span> <span class="hex-badge">${item.hex || ''}</span>`;
                        btn.onclick = () => this.handleWorldClick(item);
                        listContainer.appendChild(btn);
                    }
                });
            } else {
                block.classList.add('hidden');
            }
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
      <button class="overlay-close" onclick="document.getElementById('map-overlay').classList.add('hidden')">&times;</button>
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
        if (haz.includes('wild')) return this.colors.wilds;

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

        // Draw tangle overlay (beneath world dots)
        this.drawTangle(this.ctx);

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
        this.updateDistantBlocksPositions();
    }

    updateDistantBlocksPositions() {
        if (this.worlds.length === 0) return;

        const midCol = (this.minCol + this.maxCol) / 2;
        const midRow = (this.minRow + this.maxRow) / 2;

        const anchors = {
            coreward: this.getHexCenter(midCol, this.minRow - 1),
            rimward: this.getHexCenter(midCol, this.maxRow + 0),
            spinward: this.getHexCenter(this.minCol - 2, midRow),
            trailing: this.getHexCenter(this.maxCol + 2, midRow)
        };

        for (const [dir, pos] of Object.entries(anchors)) {
            const block = document.getElementById(`distant-${dir}`);
            if (block && !block.classList.contains('hidden')) {
                const screenX = pos.x * this.scale + this.offsetX;
                const screenY = pos.y * this.scale + this.offsetY;

                if (dir === 'coreward') {
                    block.style.left = `${screenX}px`;
                    block.style.top = `${screenY}px`;
                    block.style.transform = 'translate(-50%, -100%)';
                } else if (dir === 'rimward') {
                    block.style.left = `${screenX}px`;
                    block.style.top = `${screenY}px`;
                    block.style.transform = 'translate(-50%, 0%)';
                } else if (dir === 'spinward') {
                    block.style.left = `${screenX}px`;
                    block.style.top = `${screenY}px`;
                    block.style.transform = 'translate(-100%, -50%)';
                } else if (dir === 'trailing') {
                    block.style.left = `${screenX}px`;
                    block.style.top = `${screenY}px`;
                    block.style.transform = 'translate(0%, -50%)';
                }
            }
        }
    }
}

window.initMap = (worldsData) => {
    const mapArr = window._mapInstance || new StarMap('hexMapCanvas');
    window._mapInstance = mapArr;
    mapArr.loadData(worldsData);
};
