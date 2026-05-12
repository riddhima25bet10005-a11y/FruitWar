// game.js
class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scoreDisplay = document.getElementById('current-score');
        this.livesDisplay = document.getElementById('lives-display');
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        
        this.renderer.localClippingEnabled = true;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
        
        // Blade Trail Canvas
        this.bladeCanvas = document.getElementById('blade-canvas');
        this.bladeCanvas.width = window.innerWidth;
        this.bladeCanvas.height = window.innerHeight;
        this.bladeCtx = this.bladeCanvas.getContext('2d');
        
        this.camera.position.z = 10;
        
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.ambientLight);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(0, 10, 10);
        this.scene.add(this.dirLight);

        this.fruits = [];
        this.slicedHalves = [];
        this.particles = [];
        this.atmosphereParticles = [];
        this.backgroundScenery = []; // New array for static scenery
        this.bladeSparks = []; // New array for blade trail particles
        this.shakeIntensity = 0; // Screen shake
        this.currentTheme = 'default';
        
        this.initFruitData();
        
        this.isPlaying = false;
        this.isPaused = false;
        this.score = 0;
        this.lives = 3;
        this.mode = 'classic';
        this.timeLeft = 0;
        this.timerInterval = null;
        this.timerDisplay = document.getElementById('timer-display');
        this.baseSpawnRate = 1500; // Initialize base spawn rate

        
        // Blade tracking
        this.bladePoints = [];
        this.raycaster = new THREE.Raycaster();
        
        this.cursorElement = document.createElement('div');
        this.cursorElement.style.position = 'absolute';
        this.cursorElement.style.width = '40px';
        this.cursorElement.style.height = '40px';
        this.cursorElement.style.borderRadius = '50%';
        this.cursorElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        this.cursorElement.style.boxShadow = '0 0 15px 5px rgba(255, 255, 255, 0.5)';
        this.cursorElement.style.pointerEvents = 'none';
        this.cursorElement.style.zIndex = '1000';
        this.cursorElement.style.display = 'none';
        document.body.appendChild(this.cursorElement);
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Mouse fallback
        window.addEventListener('mousemove', (e) => {
            if(this.isPlaying && !document.getElementById('camera-enabled').checked) {
                this.updateBlade(e.clientX, e.clientY);
            }
        });
        window.addEventListener('mouseup', () => this.endBlade());
        
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }
    
    setTheme(themeName) {
        this.currentTheme = themeName;
        
        // --- 1. LIGHTING ---
        let ambColor = 0xffffff, dirColor = 0xffffff, ambIntensity = 0.6;
        if (themeName === 'ocean') { ambColor = 0x006994; dirColor = 0xaaddff; ambIntensity = 0.8; }
        else if (themeName === 'cyberpunk') { ambColor = 0xff00ff; dirColor = 0x00e5ff; ambIntensity = 0.7; }
        else if (themeName === 'neon') { ambColor = 0x2d004d; dirColor = 0xff00ff; ambIntensity = 0.8; }
        else if (themeName === 'sunset') { ambColor = 0xff7e5f; dirColor = 0xffd700; ambIntensity = 0.9; }
        else if (themeName === 'sakura') { ambColor = 0xffb7c5; dirColor = 0xffffff; }
        else if (themeName === 'lava') { ambColor = 0xff2200; dirColor = 0xffaa00; }
        else if (themeName === 'galaxy') { ambColor = 0x1b003a; dirColor = 0xaa55ff; ambIntensity = 0.8; }
        else if (themeName === 'toxic') { ambColor = 0x1c3b1c; dirColor = 0x66ff33; ambIntensity = 0.7; }
        else if (themeName === 'ice') { ambColor = 0xa0e6ff; dirColor = 0xffffff; ambIntensity = 0.8; }
        else if (themeName === 'inferno') { ambColor = 0x4d0a00; dirColor = 0xff2200; }
        else if (themeName === 'jungle') { ambColor = 0x132d13; dirColor = 0x2ed573; }
        else if (themeName === 'storm') { ambColor = 0x1a1a2e; dirColor = 0x4a4a8a; }
        else if (themeName === 'gold') { ambColor = 0x4d3d00; dirColor = 0xffd700; }
        else if (themeName === 'midnight') { ambColor = 0x00001a; dirColor = 0x3333ff; }
        else if (themeName === 'candy') { ambColor = 0xff80b3; dirColor = 0xffffff; }
        else if (themeName === 'deepsea') { ambColor = 0x000033; dirColor = 0x00ffff; }
        else if (themeName === 'desert') { ambColor = 0x4d2600; dirColor = 0xffa500; }
        else if (themeName === 'matrix') { ambColor = 0x001a00; dirColor = 0x00ff00; }
        else if (themeName === 'zen') { ambColor = 0xe0e0e0; dirColor = 0xffffff; }
        else if (themeName === 'steampunk') { ambColor = 0x3d2613; dirColor = 0xcd7f32; }
        else if (themeName === 'rainbow') { ambColor = 0x330033; dirColor = 0xffffff; }
        else if (themeName === 'void') { ambColor = 0x1a0033; dirColor = 0x8a2be2; }
        else if (themeName === 'emerald') { ambColor = 0x00331a; dirColor = 0x00ff80; }
        else if (themeName === 'solar') { ambColor = 0x4d4d00; dirColor = 0xffff00; }

        this.ambientLight.color.setHex(ambColor);
        this.ambientLight.intensity = ambIntensity;
        this.dirLight.color.setHex(dirColor);

        // --- 2. FOG & CLEANUP ---
        this.scene.fog = null;
        if (['lava', 'inferno', 'toxic', 'storm', 'deepsea', 'void'].includes(themeName)) {
            this.scene.fog = new THREE.FogExp2(ambColor, 0.02);
        }

        this.backgroundScenery.forEach(obj => this.scene.remove(obj));
        this.backgroundScenery = [];
        this.atmosphereParticles.forEach(p => this.scene.remove(p.mesh));
        this.atmosphereParticles = [];

        if (!this.bgLight) {
            this.bgLight = new THREE.PointLight(0xffffff, 2, 100);
            this.bgLight.position.set(0, 0, -10);
            this.scene.add(this.bgLight);
        }
        this.bgLight.intensity = 8;

        // --- 3. 3D SCENERY ---
        if (themeName === 'default') {
            const pillarGeo = new THREE.BoxGeometry(2, 40, 2);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, metalness: 0.5, roughness: 0.2 });
            for(let x of [-15, 15]) {
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(x, 0, -15);
                this.scene.add(pillar);
                this.backgroundScenery.push(pillar);
            }
        } else if (themeName === 'gold') {
            const pillarGeo = new THREE.BoxGeometry(3, 50, 3);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.1 });
            for(let x of [-20, 20]) {
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(x, 0, -25);
                this.scene.add(pillar);
                this.backgroundScenery.push(pillar);
            }
            const gemGeo = new THREE.OctahedronGeometry(1.5);
            for(let i=0; i<10; i++) {
                const gem = new THREE.Mesh(gemGeo, pillarMat);
                gem.position.set((Math.random()-0.5)*30, (Math.random()-0.5)*20, -20);
                gem.rotation.set(Math.random(), Math.random(), Math.random());
                this.scene.add(gem);
                this.backgroundScenery.push(gem);
            }
        } else if (themeName === 'midnight') {
            const moonGeo = new THREE.SphereGeometry(8, 32, 32);
            const moonMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 2 });
            const moon = new THREE.Mesh(moonGeo, moonMat);
            moon.position.set(15, 12, -40);
            this.scene.add(moon);
            this.backgroundScenery.push(moon);
            const cloudGeo = new THREE.SphereGeometry(3, 16, 16);
            const cloudMat = new THREE.MeshStandardMaterial({ color: 0x000033, transparent: true, opacity: 0.5 });
            for(let i=0; i<15; i++) {
                const cloud = new THREE.Mesh(cloudGeo, cloudMat);
                cloud.position.set((Math.random()-0.5)*50, (Math.random()-0.5)*30, -30);
                cloud.scale.set(2, 0.5, 1);
                this.scene.add(cloud);
                this.backgroundScenery.push(cloud);
            }
        } else if (themeName === 'candy') {
            const caneGeo = new THREE.CylinderGeometry(0.8, 0.8, 15);
            const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            for(let x of [-15, 15]) {
                const group = new THREE.Group();
                for(let i=0; i<10; i++) {
                    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5), i%2===0 ? redMat : whiteMat);
                    seg.position.y = i * 1.5 - 7.5;
                    group.add(seg);
                }
                group.position.set(x, 0, -20);
                group.rotation.z = x > 0 ? -0.2 : 0.2;
                this.scene.add(group);
                this.backgroundScenery.push(group);
            }
        } else if (themeName === 'deepsea') {
            const kelpGeo = new THREE.CylinderGeometry(0.3, 0.5, 25);
            const kelpMat = new THREE.MeshStandardMaterial({ color: 0x006400, transparent: true, opacity: 0.7 });
            for(let i=0; i<15; i++) {
                const kelp = new THREE.Mesh(kelpGeo, kelpMat);
                kelp.position.set((Math.random()-0.5)*40, -5, -25);
                kelp.rotation.z = (Math.random()-0.5)*0.5;
                this.scene.add(kelp);
                this.backgroundScenery.push(kelp);
            }
            const coralGeo = new THREE.TorusKnotGeometry(2, 0.5, 64, 8);
            const coralMat = new THREE.MeshStandardMaterial({ color: 0xff7f50, emissive: 0xff4500, emissiveIntensity: 0.5 });
            for(let x of [-18, 18]) {
                const coral = new THREE.Mesh(coralGeo, coralMat);
                coral.position.set(x, -8, -15);
                this.scene.add(coral);
                this.backgroundScenery.push(coral);
            }
        } else if (themeName === 'desert') {
            const cactusGeo = new THREE.CylinderGeometry(1, 1, 10);
            const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
            for(let x of [-15, 0, 15]) {
                if (x === 0) continue;
                const group = new THREE.Group();
                const body = new THREE.Mesh(cactusGeo, cactusMat);
                group.add(body);
                const armGeo = new THREE.CylinderGeometry(0.6, 0.6, 4);
                const lArm = new THREE.Mesh(armGeo, cactusMat);
                lArm.position.set(-1.5, 2, 0);
                lArm.rotation.z = Math.PI/4;
                group.add(lArm);
                const rArm = new THREE.Mesh(armGeo, cactusMat);
                rArm.position.set(1.5, 0, 0);
                rArm.rotation.z = -Math.PI/4;
                group.add(rArm);
                group.position.set(x + (Math.random()-0.5)*5, -5, -20);
                this.scene.add(group);
                this.backgroundScenery.push(group);
            }
        } else if (themeName === 'ocean') {
            const floorGeo = new THREE.PlaneGeometry(100, 100);
            const floorMat = new THREE.MeshStandardMaterial({ color: 0x006994, transparent: true, opacity: 0.8, metalness: 1, roughness: 0.1 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI/2;
            floor.position.y = -12;
            this.scene.add(floor);
            this.backgroundScenery.push(floor);
        } else if (themeName === 'jungle') {
            const vineGeo = new THREE.CylinderGeometry(0.15, 0.15, 40);
            const vineMat = new THREE.MeshStandardMaterial({ color: 0x228b22, emissive: 0x0a220a });
            for(let i=0; i<12; i++) {
                const vine = new THREE.Mesh(vineGeo, vineMat);
                vine.position.set((Math.random()-0.5)*40, 0, -18);
                vine.rotation.z = (Math.random()-0.5)*0.3;
                this.scene.add(vine);
                this.backgroundScenery.push(vine);
            }
        } else if (themeName === 'matrix') {
            const wallGeo = new THREE.PlaneGeometry(20, 60);
            const wallMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00ff00, emissiveIntensity: 0.5, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
            for(let x of [-20, 20]) {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(x, 0, -12);
                wall.rotation.y = (x > 0 ? -1 : 1) * Math.PI/3;
                this.scene.add(wall);
                this.backgroundScenery.push(wall);
            }
        } else if (themeName === 'solar') {
            const sunGeo = new THREE.SphereGeometry(25, 32, 32);
            const sunMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffcc00, emissiveIntensity: 5 });
            const sun = new THREE.Mesh(sunGeo, sunMat);
            sun.position.set(0, 0, -40);
            this.scene.add(sun);
            this.backgroundScenery.push(sun);
        } else if (themeName === 'zen') {
            const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x111111 });
            const pagoda = new THREE.Group();
            const layers = [ {w:12, h:3, y:-8}, {w:9, h:3, y:-5}, {w:6, h:3, y:-2}, {w:3, h:3, y:1} ];
            layers.forEach(l => {
                const m = new THREE.Mesh(new THREE.BoxGeometry(l.w, l.h, l.w), mat);
                m.position.y = l.y;
                pagoda.add(m);
            });
            pagoda.position.set(0, 0, -25);
            this.scene.add(pagoda);
            this.backgroundScenery.push(pagoda);
        } else if (themeName === 'steampunk') {
            const gearGeo = new THREE.TorusGeometry(12, 3, 12, 30);
            const gearMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, metalness: 1, roughness: 0.1 });
            const gear = new THREE.Mesh(gearGeo, gearMat);
            gear.position.set(0, 0, -30);
            this.scene.add(gear);
            this.backgroundScenery.push(gear);
        } else if (themeName === 'ice') {
            const iceGeo = new THREE.TetrahedronGeometry(15);
            const iceMat = new THREE.MeshStandardMaterial({ color: 0xccffff, transparent: true, opacity: 0.7, metalness: 1, roughness: 0, emissive: 0x00ffff, emissiveIntensity: 0.5 });
            for(let x of [-20, 20]) {
                const ice = new THREE.Mesh(iceGeo, iceMat);
                ice.position.set(x, -5, -25);
                ice.rotation.set(Math.random(), Math.random(), Math.random());
                this.scene.add(ice);
                this.backgroundScenery.push(ice);
            }
        } else if (themeName === 'rainbow') {
            const torusGeo = new THREE.TorusGeometry(20, 0.4, 16, 100, Math.PI);
            for(let i=0; i<7; i++) {
                const col = new THREE.Color().setHSL(i/7, 1, 0.5);
                const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2, transparent: true, opacity: 0.6 });
                const mesh = new THREE.Mesh(torusGeo, mat);
                mesh.position.set(0, -12, -25 - i*1.2);
                this.scene.add(mesh);
                this.backgroundScenery.push(mesh);
            }
        } else if (themeName === 'emerald') {
            const crystalGeo = new THREE.CylinderGeometry(0, 1.5, 8, 6);
            const crystalMat = new THREE.MeshStandardMaterial({ color: 0x00ff80, emissive: 0x00ff80, emissiveIntensity: 0.5, transparent: true, opacity: 0.8, flatShading: true, metalness: 0.8, roughness: 0.1 });
            for(let i=0; i<12; i++) {
                const crystal = new THREE.Mesh(crystalGeo, crystalMat);
                const x = (Math.random()-0.5)*40;
                crystal.position.set(x, -10, -15 - Math.random()*15);
                crystal.rotation.set((Math.random()-0.5)*0.5, Math.random()*Math.PI, (Math.random()-0.5)*0.5);
                this.scene.add(crystal);
                this.backgroundScenery.push(crystal);
            }
        }

        // --- 4. PARTICLES ---
        if (themeName === 'neon') {
            const ringCount = 12;
            for(let i=0; i<ringCount; i++) {
                const geo = new THREE.TorusGeometry(0.8, 0.08, 16, 32);
                const mat = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 15, blending: THREE.AdditiveBlending });
                const mesh = new THREE.Mesh(geo, mat);
                const angle = (i / ringCount) * Math.PI * 2;
                mesh.position.set(Math.cos(angle) * 12, Math.sin(angle) * 12, -15);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'ring', speedY: 0, rotX: Math.random()*0.02, rotY: Math.random()*0.02 });
            }
        } else if (themeName === 'ocean' || themeName === 'toxic') {
            const color = themeName === 'ocean' ? 0xffffff : 0x00ff00;
            for(let i=0; i<40; i++) {
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.5 }));
                mesh.position.set((Math.random()-0.5)*30, -15, -5 - Math.random()*10);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'bubble', speedY: 0.03 + Math.random()*0.05, wobble: Math.random()*Math.PI*2 });
            }
        } else if (['sunset', 'lava', 'inferno'].includes(themeName)) {
            const color = themeName === 'sunset' ? 0xffa500 : 0xff4500;
            for(let i=0; i<60; i++) {
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 5 }));
                mesh.position.set((Math.random()-0.5)*30, -15, -5 - Math.random()*10);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'ember', speedY: 0.05 + Math.random()*0.1, speedX: (Math.random()-0.5)*0.02 });
            }
        } else if (themeName === 'sakura') {
            for(let i=0; i<60; i++) {
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xffb7c5, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
                mesh.position.set((Math.random()-0.5)*30, 15, -5 - Math.random()*10);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'petal', speedY: -0.04 - Math.random()*0.04, speedX: (Math.random()-0.5)*0.03, rotSpeed: Math.random()*0.05 });
            }
        } else if (themeName === 'cyberpunk') {
            for(let i=0; i<50; i++) {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 5 }));
                mesh.position.set((Math.random()-0.5)*35, 15, -8 - Math.random()*10);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'data', speedY: -0.15 - Math.random()*0.15 });
            }
        } else if (themeName === 'galaxy') {
            for(let i=0; i<150; i++) {
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.random() * 0.08 + 0.02, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaa88ff, emissiveIntensity: 15, transparent: true, blending: THREE.AdditiveBlending }));
                mesh.position.set((Math.random()-0.5)*40, (Math.random()-0.5)*25, -10 - Math.random()*15);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'star', twinkleSpeed: Math.random() * 0.1 });
            }
        } else if (themeName === 'ice') {
            for(let i=0; i<60; i++) {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xccffff, transparent: true, opacity: 0.8, metalness: 1, roughness: 0 }));
                mesh.position.set((Math.random()-0.5)*30, 15, -10 - Math.random()*10);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'ice_cube', speedY: -0.06 - Math.random()*0.06, rotX: Math.random()*0.05 });
            }
        } else if (themeName === 'matrix') {
            for(let i=0; i<80; i++) {
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.8), new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00ff00, emissiveIntensity: 10, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
                mesh.position.set((Math.random()-0.5)*40, 20, -5 - Math.random()*15);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'code', speedY: -0.2 - Math.random()*0.2, flicker: Math.random() * 0.2 });
            }
        } else if (themeName === 'storm') {
            for(let i=0; i<200; i++) {
                const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2), new THREE.MeshStandardMaterial({ color: 0xccccff, emissive: 0x8888ff, emissiveIntensity: 5, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }));
                mesh.position.set((Math.random()-0.5)*45, Math.random()*35, -5 - Math.random()*20);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'rain', speedY: -0.6 - Math.random()*0.3 });
            }
        } else if (themeName === 'solar') {
            for(let i=0; i<30; i++) {
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xff4400, emissiveIntensity: 25, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
                mesh.position.set((Math.random()-0.5)*45, (Math.random()-0.5)*35, -12 - Math.random()*15);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'flare', scaleSpeed: 0.04, originalScale: Math.random() * 0.6 + 0.6 });
            }
        } else if (themeName === 'void') {
            for(let i=0; i<30; i++) {
                const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0xaa00ff, wireframe: true, emissive: 0xcc00ff, emissiveIntensity: 15, blending: THREE.AdditiveBlending }));
                mesh.position.set((Math.random()-0.5)*35, (Math.random()-0.5)*25, -5 - Math.random()*15);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'shard', speedY: (Math.random()-0.5)*0.03, rotX: 0.05, pulse: Math.random() * Math.PI });
            }
        } else if (themeName === 'gold') {
            for(let i=0; i<60; i++) {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, emissive: 0xffd700, emissiveIntensity: 0.5 }));
                mesh.position.set((Math.random()-0.5)*40, (Math.random()-0.5)*30, -5 - Math.random()*15);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'glitter', speedY: -0.02 - Math.random()*0.02, rotSpeed: Math.random()*0.1, phase: Math.random()*Math.PI });
            }
        } else if (themeName === 'midnight') {
            for(let i=0; i<100; i++) {
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 10 }));
                mesh.position.set((Math.random()-0.5)*50, (Math.random()-0.5)*40, -10 - Math.random()*20);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'firefly', speed: 0.02 + Math.random()*0.02, phase: Math.random()*Math.PI*2 });
            }
        } else if (themeName === 'candy') {
            const colors = [0xff69b4, 0x00ffff, 0xffff00, 0xff00ff, 0x00ff00];
            for(let i=0; i<60; i++) {
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: colors[i%colors.length], emissive: colors[i%colors.length], emissiveIntensity: 0.5 }));
                mesh.position.set((Math.random()-0.5)*35, 15, -5 - Math.random()*10);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'sprinkle', speedY: -0.05 - Math.random()*0.08 });
            }
        } else if (themeName === 'desert') {
            for(let i=0; i<122; i++) {
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd2a6, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
                mesh.position.set((Math.random()-0.5)*50, (Math.random()-0.5)*30, -5 - Math.random()*15);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'sand', speedX: 0.15 + Math.random()*0.3, speedY: (Math.random()-0.5)*0.05 });
            }
        } else if (themeName === 'rainbow') {
            for(let i=0; i<100; i++) {
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
                mesh.position.set((Math.random()-0.5)*40, (Math.random()-0.5)*30, -10 - Math.random()*15);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'rainbow_dust', speedY: -0.05 - Math.random()*0.05, hue: Math.random() });
            }
        } else if (themeName === 'emerald') {
            for(let i=0; i<60; i++) {
                const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0x00ff80, emissive: 0x00ff80, emissiveIntensity: 5 }));
                mesh.position.set((Math.random()-0.5)*35, (Math.random()-0.5)*25, -8 - Math.random()*12);
                this.scene.add(mesh);
                this.atmosphereParticles.push({ mesh, type: 'gem', speedY: 0.03 + Math.random()*0.05, rotY: Math.random()*0.1 });
            }
        }
    }
    
    initFruitData() {
        this.fruitData = [
            { name: 'apple', color: 0xff0000 },
            { name: 'watermelon', color: 0xff3333 },
            { name: 'melon', color: 0xccffcc },
            { name: 'mango', color: 0xffcc00 },
            { name: 'grapes', color: 0x800080 },
            { name: 'orange', color: 0xffa500 },
            { name: 'papaya', color: 0xffaa00 },
            { name: 'kiwi', color: 0x00ff00 },
            { name: 'banana', color: 0xffff00 },
            { name: 'pineapple', color: 0xffff00 }
        ];
    }
    
    create3DFruitMesh(fruitName) {
        const group = new THREE.Group();
        let mainMesh;
        
        switch(fruitName) {
            case 'apple': {
                const geo = new THREE.SphereGeometry(1, 32, 32);
                const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.2, metalness: 0.1 });
                mainMesh = new THREE.Mesh(geo, mat);
                mainMesh.scale.set(1, 0.9, 1);
                const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4);
                const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a2e00, roughness: 0.8 });
                const stem = new THREE.Mesh(stemGeo, stemMat);
                stem.position.y = 0.95;
                group.add(stem);
                group.add(mainMesh);
                break;
            }
            case 'orange': {
                const geo = new THREE.SphereGeometry(1, 32, 32);
                const mat = new THREE.MeshStandardMaterial({ color: 0xffa500, roughness: 0.6, metalness: 0.0 });
                mainMesh = new THREE.Mesh(geo, mat);
                group.add(mainMesh);
                break;
            }
            case 'watermelon': {
                const geo = new THREE.SphereGeometry(1.2, 32, 32);
                const mat = new THREE.MeshStandardMaterial({ color: 0x005500, roughness: 0.3, metalness: 0.1 }); 
                mainMesh = new THREE.Mesh(geo, mat);
                mainMesh.scale.set(1.2, 1, 1);
                const stripeGeo = new THREE.TorusGeometry(1.21, 0.05, 8, 32);
                const stripeMat = new THREE.MeshStandardMaterial({ color: 0x002200, roughness: 0.3 });
                const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
                stripe1.rotation.y = Math.PI / 4;
                const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
                stripe2.rotation.y = -Math.PI / 4;
                group.add(stripe1);
                group.add(stripe2);
                group.add(mainMesh);
                break;
            }
            case 'melon': {
                const geo = new THREE.SphereGeometry(1.1, 32, 32);
                const mat = new THREE.MeshStandardMaterial({ color: 0xccffcc, roughness: 0.5, metalness: 0.0 }); 
                mainMesh = new THREE.Mesh(geo, mat);
                group.add(mainMesh);
                break;
            }
            case 'mango': {
                const geo = new THREE.SphereGeometry(1, 32, 32);
                const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.4, metalness: 0.1 }); 
                mainMesh = new THREE.Mesh(geo, mat);
                mainMesh.scale.set(0.8, 1.3, 0.6);
                group.add(mainMesh);
                break;
            }
            case 'grapes': {
                const mat = new THREE.MeshStandardMaterial({ color: 0x800080, roughness: 0.1, metalness: 0.2 });
                for(let i=0; i<15; i++) {
                    const geo = new THREE.SphereGeometry(0.3, 16, 16);
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(
                        (Math.random()-0.5)*0.8,
                        (Math.random()-0.5)*1.2,
                        (Math.random()-0.5)*0.8
                    );
                    group.add(mesh);
                }
                break;
            }
            case 'papaya': {
                const geo = new THREE.SphereGeometry(1, 32, 32);
                const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5, metalness: 0.0 }); 
                mainMesh = new THREE.Mesh(geo, mat);
                mainMesh.scale.set(0.8, 1.4, 0.8);
                group.add(mainMesh);
                break;
            }
            case 'kiwi': {
                const geo = new THREE.SphereGeometry(0.8, 32, 32);
                const mat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9, metalness: 0.0 }); 
                mainMesh = new THREE.Mesh(geo, mat);
                mainMesh.scale.set(0.8, 1.1, 0.8);
                group.add(mainMesh);
                break;
            }
            case 'banana': {
                const geo = new THREE.TorusGeometry(1.5, 0.3, 16, 32, Math.PI / 2);
                const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.4, metalness: 0.05 }); 
                mainMesh = new THREE.Mesh(geo, mat);
                mainMesh.position.set(-1, -1, 0); 
                group.add(mainMesh);
                break;
            }
            case 'pineapple': {
                const geo = new THREE.SphereGeometry(1, 16, 16); 
                const mat = new THREE.MeshStandardMaterial({ color: 0xcccc00, roughness: 0.7, metalness: 0.1, flatShading: true }); 
                mainMesh = new THREE.Mesh(geo, mat);
                mainMesh.scale.set(0.8, 1.3, 0.8);
                group.add(mainMesh);
                
                const leafMat = new THREE.MeshStandardMaterial({ color: 0x00aa00, roughness: 0.6 });
                for(let i=0; i<4; i++) {
                    const leafGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
                    const leaf = new THREE.Mesh(leafGeo, leafMat);
                    leaf.position.set((Math.random()-0.5)*0.4, 1.3, (Math.random()-0.5)*0.4);
                    leaf.rotation.x = (Math.random()-0.5)*0.5;
                    leaf.rotation.z = (Math.random()-0.5)*0.5;
                    group.add(leaf);
                }
                break;
            }
        }
        return group;
    }

    create3DBombMesh() {
        const group = new THREE.Group();
        const bodyGeo = new THREE.SphereGeometry(1, 32, 32);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        const fuseGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.6);
        const fuseMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const fuse = new THREE.Mesh(fuseGeo, fuseMat);
        fuse.position.y = 1;
        fuse.rotation.z = 0.2;
        group.add(fuse);

        // Animated spark on top
        const sparkGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const sparkMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 10 });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.set(0.12, 1.25, 0);
        group.add(spark);
        group.spark = spark; // Reference for animation

        return group;
    }
    
    start(mode) {
        this.mode = mode;
        this.isPlaying = true;
        this.isPaused = false;
        this.score = 0;
        this.lives = mode === 'classic' ? 3 : 999; 
        this.updateHUD();
        this.fruits.forEach(f => this.scene.remove(f.mesh));
        this.fruits = [];
        
        // Clear any existing timers
        clearTimeout(this.spawnInterval);
        clearInterval(this.timerInterval);
        
        // Dynamic spawn — starts slow, gets faster as score increases
        this.baseSpawnRate = 1500;
        this.scheduleNextSpawn();
        
        // Setup timer for zen and arcade modes
        if (mode === 'zen') {
            this.timeLeft = 90;
            this.timerDisplay.style.display = 'block';
            this.updateTimerDisplay();
            this.timerInterval = setInterval(() => this.tickTimer(), 1000);
        } else if (mode === 'arcade') {
            this.timeLeft = 60;
            this.timerDisplay.style.display = 'block';
            this.updateTimerDisplay();
            this.timerInterval = setInterval(() => this.tickTimer(), 1000);
        } else {
            this.timerDisplay.style.display = 'none';
        }
    }
    
    tickTimer() {
        if (this.isPaused) return;
        this.timeLeft--;
        this.updateTimerDisplay();
        if (this.timeLeft <= 0) {
            this.isPlaying = false;
            clearInterval(this.timerInterval);
            clearTimeout(this.spawnInterval);
            window.endGame(this.score, this.mode);
        }
    }
    
    updateTimerDisplay() {
        const mins = Math.floor(this.timeLeft / 60);
        const secs = this.timeLeft % 60;
        this.timerDisplay.innerText = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }
    
    togglePause() {
        if (!this.isPlaying) return;
        this.isPaused = !this.isPaused;
        document.getElementById('pause-btn').innerText = this.isPaused ? 'Resume' : 'Pause';
    }
    
    reset() {
        this.isPlaying = false;
        this.isPaused = false;
        clearTimeout(this.spawnInterval);
        clearInterval(this.timerInterval);
        
        // Clear all game objects from scene
        this.fruits.forEach(f => this.scene.remove(f.mesh));
        this.slicedHalves.forEach(h => this.scene.remove(h.mesh));
        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.bladeSparks.forEach(s => this.scene.remove(s.mesh));
        
        this.fruits = [];
        this.slicedHalves = [];
        this.particles = [];
        this.bladeSparks = [];
        
        this.timerDisplay.style.display = 'none';
        this.shakeIntensity = 0;
    }
    
    updateHUD() {
        this.scoreDisplay.innerText = this.score;
        if(this.mode === 'classic') {
            this.livesDisplay.innerText = '❤️'.repeat(this.lives);
        } else {
            this.livesDisplay.innerText = 'Zen Mode';
        }
    }
    
    scheduleNextSpawn() {
        if (!this.isPlaying) return;
        // Speed up very gently as score increases: min 800ms at high scores
        const delay = Math.max(800, this.baseSpawnRate - this.score * 0.5);
        this.spawnInterval = setTimeout(() => {
            this.spawnFruit();
            this.scheduleNextSpawn();
        }, delay);
    }
    
    spawnFruit() {
        if(!this.isPlaying || this.isPaused) return;
        
        // Hard limit: never have more than 3 fruits on the screen at once
        if (this.fruits.length >= 3) return;
        
        // Throw 1-3 fruits at once based on score (much higher thresholds for easier difficulty)
        let count = this.score >= 500 ? 3 : (this.score >= 250 ? 2 : 1);
        
        // Make sure we don't exceed the 3-fruit maximum
        count = Math.min(count, 3 - this.fruits.length);
        
        for (let n = 0; n < count; n++) {
            // Bomb spawn chance: 15% in classic/arcade, 0% in zen
            const isBomb = (this.mode !== 'zen' && Math.random() < 0.15);
            
            let mesh, color, name;
            
            if (isBomb) {
                mesh = this.create3DBombMesh();
                color = 0x333333;
                name = 'bomb';
            } else {
                const fruitDef = this.fruitData[Math.floor(Math.random() * this.fruitData.length)];
                mesh = this.create3DFruitMesh(fruitDef.name);
                color = fruitDef.color;
                name = fruitDef.name;
            }
            
            mesh.position.x = (Math.random() - 0.5) * 15;
            mesh.position.y = -8;
            mesh.position.z = (Math.random() - 0.5) * 4;
            mesh.rotation.z = Math.random() * Math.PI;
            
            this.scene.add(mesh);
            
            this.fruits.push({
                mesh: mesh,
                name: name,
                isBomb: isBomb,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.15, 
                    0.3 + Math.random() * 0.15, 
                    (Math.random() - 0.5) * 0.05
                ),
                color: color
            });
        }
    }
    
    updateBlade(x, y) {
        this.bladePoints.push({x, y});
        if(this.bladePoints.length > 5) {
            this.bladePoints.shift();
        }
        
        if (this.cursorElement) {
            this.cursorElement.style.display = 'block';
            this.cursorElement.style.left = (x - 10) + 'px';
            this.cursorElement.style.top = (y - 10) + 'px';
        }

        // Spawn sparks
        const sparkGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const sparkMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0xffffff, 
            emissiveIntensity: 2,
            blending: THREE.AdditiveBlending 
        });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        
        // Convert screen to world
        const v = new THREE.Vector3((x/window.innerWidth)*2-1, -(y/window.innerHeight)*2+1, 0.5);
        v.unproject(this.camera);
        const dir = v.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
        
        spark.position.copy(pos);
        this.scene.add(spark);
        this.bladeSparks.push({
            mesh: spark,
            velocity: new THREE.Vector3((Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1),
            life: 1.0
        });
        
        const sliceRadiusPixels = 100; // Balanced radius for slicing
        
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const fruit = this.fruits[i];
            
            // Project fruit 3D position to 2D screen coordinates
            const pos = fruit.mesh.position.clone();
            pos.project(this.camera);
            
            const screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
            
            const dist = Math.hypot(screenX - x, screenY - y);
            
            if (dist < sliceRadiusPixels) {
                this.sliceFruit(i);
            }
        }
    }
    
    endBlade() {
        this.bladePoints = [];
        if (this.cursorElement) {
            this.cursorElement.style.display = 'none';
        }
    }
    
    sliceFruit(index) {
        const fruit = this.fruits[index];
        
        if (fruit.isBomb) {
            this.explodeBomb(fruit);
            return;
        }

        this.playSwordSound();
        this.scene.remove(fruit.mesh);
        this.fruits.splice(index, 1);
        
        this.score += 10;
        this.updateHUD();
        this.shakeIntensity = 0.15; // Jitter camera
        
        // Calculate cut direction 
        let cutNormal = new THREE.Vector3(1, 0, 0);
        let swipeVelocity = new THREE.Vector3((Math.random()-0.5)*0.1, 0, 0); 
        if (this.bladePoints.length >= 2) {
            const p1 = this.bladePoints[this.bladePoints.length - 2];
            const p2 = this.bladePoints[this.bladePoints.length - 1];
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y; 
            
            const dir = new THREE.Vector2(dx, -dy).normalize();
            cutNormal.set(-dir.y, dir.x, 0).normalize();
            swipeVelocity.set(dir.x * 0.4, dir.y * 0.4, 0);
        }

        // Create world-space clipping planes passing through the fruit's center
        const plane = new THREE.Plane(cutNormal, 0);
        plane.translate(fruit.mesh.position);
        const invertedPlane = plane.clone().negate();

        // Clone the fruit to create the two physical halves
        const half1 = fruit.mesh.clone();
        const half2 = fruit.mesh.clone();
        
        // Ensure materials are uniquely cloned and assign clipping planes
        half1.traverse((child) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.clippingPlanes = [plane];
            }
        });
        
        half2.traverse((child) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.clippingPlanes = [invertedPlane];
            }
        });

        this.scene.add(half1);
        this.scene.add(half2);

        // Add to array with independent separating velocities
        const sepSpeed = 0.08;
        
        // Force the halves to immediately fall down if they were still moving up
        let fallY1 = fruit.velocity.y + cutNormal.y * sepSpeed;
        if (fallY1 > 0) fallY1 = -0.05;
        
        let fallY2 = fruit.velocity.y - cutNormal.y * sepSpeed;
        if (fallY2 > 0) fallY2 = -0.05;

        this.slicedHalves.push({
            mesh: half1,
            plane: plane, // store plane so we can translate it with the mesh
            velocity: new THREE.Vector3(
                fruit.velocity.x + cutNormal.x * sepSpeed,
                fallY1,
                fruit.velocity.z + cutNormal.z * sepSpeed
            )
        });

        this.slicedHalves.push({
            mesh: half2,
            plane: invertedPlane,
            velocity: new THREE.Vector3(
                fruit.velocity.x - cutNormal.x * sepSpeed,
                fallY2,
                fruit.velocity.z - cutNormal.z * sepSpeed
            )
        });

        // Create particles (juice)
        const numParticles = 15;
        for(let i = 0; i < numParticles; i++) {
            const size = Math.random() > 0.8 ? 0.3 : 0.15;
            const pGeo = new THREE.BoxGeometry(size, size, size);
            
            const pMat = new THREE.MeshPhongMaterial({
                color: fruit.color, 
                shininess: 100,
                emissive: fruit.color,
                emissiveIntensity: 0.2
            });
            const pMesh = new THREE.Mesh(pGeo, pMat);
            
            pMesh.position.copy(fruit.mesh.position);
            pMesh.position.x += (Math.random() - 0.5) * 1.0;
            pMesh.position.y += (Math.random() - 0.5) * 1.0;
            pMesh.position.z += (Math.random() - 0.5) * 1.0;
            
            this.scene.add(pMesh);
            
            const explodeVel = new THREE.Vector3(
                (Math.random()-0.5) * 0.3, 
                (Math.random()-0.5) * 0.3, 
                (Math.random()-0.5) * 0.3
            );
            
            this.particles.push({
                mesh: pMesh,
                velocity: new THREE.Vector3().addVectors(explodeVel, swipeVelocity).add(fruit.velocity)
            });
        }
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        
        if (this.isPaused) return; // Full pause: stop everything

        // Apply Screen Shake
        if (this.shakeIntensity > 0) {
            this.camera.position.x = (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9;
            if (this.shakeIntensity < 0.01) {
                this.shakeIntensity = 0;
                this.camera.position.x = 0;
                this.camera.position.y = 0;
            }
        }

        if (this.isPlaying && !this.isPaused) {
            for(let i = this.fruits.length - 1; i >= 0; i--) {
                let f = this.fruits[i];
                f.mesh.position.add(f.velocity);
                f.velocity.y -= 0.005; // gravity
                
                f.mesh.rotation.x += 0.02;
                f.mesh.rotation.y += 0.03;
                f.mesh.rotation.z += 0.01;

                // Animate bomb spark
                if (f.isBomb && f.mesh.spark) {
                    const s = 1 + Math.sin(Date.now() * 0.02) * 0.3;
                    f.mesh.spark.scale.set(s, s, s);
                    f.mesh.spark.material.emissiveIntensity = 5 + Math.sin(Date.now() * 0.02) * 5;
                }
                
                // Missed fruit
                if(f.mesh.position.y < -10) {
                    this.scene.remove(f.mesh);
                    this.fruits.splice(i, 1);
                    if(this.mode === 'classic' && !f.isBomb) {
                        this.lives--;
                        this.updateHUD();
                        if(this.lives <= 0) {
                            this.isPlaying = false;
                            window.endGame(this.score, this.mode);
                        }
                    }
                }
            }
            
            // Update particles
            for(let i = this.particles.length - 1; i >= 0; i--) {
                let p = this.particles[i];
                p.mesh.position.add(p.velocity);
                p.velocity.y -= 0.01;
                p.mesh.scale.multiplyScalar(0.95);
                if(p.mesh.scale.x < 0.01) {
                    this.scene.remove(p.mesh);
                    this.particles.splice(i, 1);
                }
            }
            
            // Update sliced halves
            for(let i = this.slicedHalves.length - 1; i >= 0; i--) {
                let h = this.slicedHalves[i];
                
                // Move mesh and perfectly sync the clipping plane
                h.mesh.position.add(h.velocity);
                h.plane.translate(h.velocity);
                
                h.velocity.y -= 0.006; 
                
                // Do NOT rotate the mesh, so the plane stays perfectly aligned visually
                
                if(h.mesh.position.y < -12) {
                    this.scene.remove(h.mesh);
                    this.slicedHalves.splice(i, 1);
                }
            }

            // Update Blade Sparks
            for(let i = this.bladeSparks.length - 1; i >= 0; i--) {
                let s = this.bladeSparks[i];
                s.mesh.position.add(s.velocity);
                s.life -= 0.05;
                s.mesh.scale.set(s.life, s.life, s.life);
                if(s.life <= 0) {
                    this.scene.remove(s.mesh);
                    this.bladeSparks.splice(i, 1);
                }
            }
        }
        
        // Update background scenery motion
        this.backgroundScenery.forEach(obj => {
            if (this.currentTheme === 'steampunk') {
                obj.rotation.z += 0.005;
            } else if (this.currentTheme === 'matrix') {
                obj.rotation.y += Math.sin(Date.now() * 0.001) * 0.002;
            } else if (this.currentTheme === 'void') {
                obj.rotation.x += 0.01;
                obj.rotation.y += 0.01;
            }
        });

        // Update atmospheric particles (always running, even if paused or game over)
        for(let i = 0; i < this.atmosphereParticles.length; i++) {
            let p = this.atmosphereParticles[i];
            if (p.type === 'star') {
                p.mesh.material.opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.001 + p.twinkleSpeed * 100)) * 0.7;
            } else if (p.type === 'bubble') {
                p.wobble += 0.05;
                p.mesh.position.y += p.speedY;
                p.mesh.position.x += Math.sin(p.wobble) * 0.02;
                if (p.pulse !== undefined) {
                    p.pulse += 0.03;
                    const s = 1 + Math.sin(p.pulse) * 0.2;
                    p.mesh.scale.set(s, s, s);
                }
                if (p.mesh.position.y > 15) {
                    p.mesh.position.y = -15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'flame') {
                p.mesh.position.y += p.speedY;
                p.mesh.rotation.x += p.rotSpeed;
                p.mesh.rotation.y += p.rotSpeed;
                const flicker = 1 + Math.sin(Date.now() * 0.01) * 0.2;
                p.mesh.scale.set(flicker, flicker, flicker);
                if (p.mesh.position.y > 15) {
                    p.mesh.position.y = -12;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'leaf') {
                p.mesh.position.y += p.speedY;
                p.mesh.position.x += p.speedX + Math.sin(Date.now() * 0.002 + p.rotPhase) * 0.05;
                p.mesh.rotation.x += 0.02;
                p.mesh.rotation.z += 0.01;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'rain') {
                p.mesh.position.y += p.speedY;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*40;
                }
            } else if (p.type === 'coin') {
                p.mesh.position.y += p.speedY;
                p.mesh.rotation.y += p.rotY;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'orb') {
                p.mesh.position.x += p.speedX;
                p.mesh.position.y += p.speedY;
                p.phase += 0.02;
                p.mesh.position.y += Math.sin(p.phase) * 0.01;
                if (Math.abs(p.mesh.position.x) > 20) p.speedX *= -1;
                if (Math.abs(p.mesh.position.y) > 15) p.speedY *= -1;
            } else if (p.type === 'sprinkle') {
                p.mesh.position.y += p.speedY;
                p.mesh.rotation.z += 0.05;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'dust') {
                p.mesh.position.x += p.speedX;
                p.mesh.position.y += p.speedY;
                if (p.mesh.position.x > 20) {
                    p.mesh.position.x = -20;
                    p.mesh.position.y = (Math.random()-0.5)*20;
                }
            } else if (p.type === 'code') {
                p.mesh.position.y += p.speedY;
                p.mesh.material.opacity = 0.4 + Math.random() * 0.6;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 20;
                    p.mesh.position.x = (Math.random()-0.5)*35;
                }
            } else if (p.type === 'smoke') {
                p.mesh.position.y += p.speedY;
                p.mesh.position.x += p.speedX;
                p.mesh.scale.multiplyScalar(p.expand);
                p.mesh.material.opacity *= 0.995;
                if (p.mesh.material.opacity < 0.01) {
                    p.mesh.position.set((Math.random()-0.5)*30, -10, -5 - Math.random()*10);
                    p.mesh.material.opacity = 0.15;
                    p.mesh.scale.set(1, 1, 1);
                }
            } else if (p.type === 'gear') {
                p.mesh.rotation.z += p.rotZ;
                p.mesh.position.y += p.speedY;
                if (Math.abs(p.mesh.position.y) > 15) p.speedY *= -1;
            } else if (p.type === 'rainbow_dust') {
                p.mesh.position.y += p.speedY;
                p.hue = (p.hue + 0.005) % 1;
                p.mesh.material.color.setHSL(p.hue, 1, 0.5);
                if (Math.abs(p.mesh.position.y) > 15) p.speedY *= -1;
            } else if (p.type === 'shard') {
                p.mesh.rotation.x += p.rotX;
                p.pulse += 0.05;
                const s = 1 + Math.sin(p.pulse) * 0.3;
                p.mesh.scale.set(s, s, s);
                p.mesh.position.y += p.speedY;
                if (Math.abs(p.mesh.position.y) > 15) p.speedY *= -1;
            } else if (p.type === 'gem') {
                p.mesh.rotation.y += p.rotY;
                p.mesh.position.y += p.speedY;
                if (Math.abs(p.mesh.position.y) > 15) p.speedY *= -1;
            } else if (p.type === 'flare') {
                p.mesh.scale.x = p.originalScale + Math.sin(Date.now()*0.005) * 0.2;
                p.mesh.scale.y = p.mesh.scale.x;
                p.mesh.scale.z = p.mesh.scale.x;
            } else if (p.type === 'snow') {
                p.mesh.position.y += p.speedY;
                p.mesh.position.x += p.speedX;
                p.mesh.rotation.z += 0.01;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'ring') {
                p.mesh.rotation.x += p.rotX;
                p.mesh.rotation.y += p.rotY;
                p.mesh.position.y += p.speedY;
                if (Math.abs(p.mesh.position.y) > 15) p.speedY *= -1;
            } else if (p.type === 'ember') {
                p.mesh.position.y += p.speedY;
                p.mesh.position.x += p.speedX;
                if (p.mesh.position.y > 15) {
                    p.mesh.position.y = -15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'petal') {
                p.mesh.position.y += p.speedY;
                p.mesh.position.x += p.speedX + Math.sin(Date.now() * 0.001) * 0.02;
                p.mesh.rotation.x += p.rotSpeed;
                p.mesh.rotation.z += 0.01;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'data') {
                p.mesh.position.y += p.speedY;
                p.mesh.rotation.x += 0.02;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'ice_cube') {
                p.mesh.position.y += p.speedY;
                p.mesh.rotation.x += p.rotX;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*30;
                }
            } else if (p.type === 'glitter') {
                p.mesh.position.y += p.speedY;
                p.mesh.rotation.y += p.rotSpeed;
                p.mesh.rotation.z += p.rotSpeed * 0.5;
                p.mesh.material.opacity = 0.5 + Math.sin(Date.now() * 0.01 + p.phase) * 0.5;
                if (p.mesh.position.y < -15) {
                    p.mesh.position.y = 15;
                    p.mesh.position.x = (Math.random()-0.5)*40;
                }
            } else if (p.type === 'firefly') {
                p.phase += 0.02;
                p.mesh.position.x += Math.sin(p.phase) * p.speed;
                p.mesh.position.y += Math.cos(p.phase) * p.speed;
                p.mesh.material.emissiveIntensity = 5 + Math.sin(p.phase * 2) * 5;
            } else if (p.type === 'sand') {
                p.mesh.position.x += p.speedX;
                p.mesh.position.y += p.speedY;
                if (p.mesh.position.x > 25) {
                    p.mesh.position.x = -25;
                    p.mesh.position.y = (Math.random()-0.5)*30;
                }
            }
        }

        // Special Storm Lighting Flash
        if (this.currentTheme === 'storm' && Math.random() > 0.995) {
            this.ambientLight.intensity = 5;
            setTimeout(() => {
                if (this.currentTheme === 'storm') this.ambientLight.intensity = 0.5;
            }, 50);
        }
        
        this.drawBladeTrail();
        // Update lighting for "pop"
        if (this.bgLight) {
            if (this.currentTheme === 'solar') {
                this.bgLight.intensity = 15 + Math.sin(Date.now() * 0.005) * 5;
            } else if (this.currentTheme === 'inferno') {
                this.bgLight.intensity = 10 + Math.random() * 5; // Flicker
            } else {
                this.bgLight.intensity = 8; 
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    drawBladeTrail() {
        this.bladeCtx.clearRect(0, 0, this.bladeCanvas.width, this.bladeCanvas.height);
        if (this.bladePoints.length < 3) return;

        // Draw the main "Sword Slash" (Metallic Tapered Path)
        for (let i = 0; i < this.bladePoints.length - 1; i++) {
            const p1 = this.bladePoints[i];
            const p2 = this.bladePoints[i+1];
            
            // Progress from tail (0) to head (1)
            const progress = i / (this.bladePoints.length - 1);
            
            // 1. Main Metallic Blade
            this.bladeCtx.beginPath();
            this.bladeCtx.moveTo(p1.x, p1.y);
            this.bladeCtx.lineTo(p2.x, p2.y);
            
            // Tapered width: starts thin, gets thick towards the head, then sharp at the very tip
            let width = progress * 14; 
            this.bladeCtx.lineWidth = width;
            this.bladeCtx.lineCap = 'round';
            
            // Steel/Chrome Gradient
            const grad = this.bladeCtx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, '#2c3e50'); // Dark steel
            grad.addColorStop(0.5, '#bdc3c7'); // Light chrome
            grad.addColorStop(1, '#ffffff'); // White hot edge
            
            this.bladeCtx.strokeStyle = grad;
            this.bladeCtx.stroke();
            
            // 2. The "Scratch" Detail (Inner sharp line)
            this.bladeCtx.beginPath();
            this.bladeCtx.moveTo(p1.x, p1.y);
            this.bladeCtx.lineTo(p2.x, p2.y);
            this.bladeCtx.lineWidth = width * 0.3;
            this.bladeCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            this.bladeCtx.stroke();
            
            // 3. Scuff/Friction marks (Small offset lines to look like a scratch)
            if (i % 2 === 0) {
                this.bladeCtx.beginPath();
                const offset = (Math.random() - 0.5) * 10;
                this.bladeCtx.moveTo(p1.x + offset, p1.y + offset);
                this.bladeCtx.lineTo(p2.x + offset, p2.y + offset);
                this.bladeCtx.lineWidth = 1;
                this.bladeCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                this.bladeCtx.stroke();
            }
        }

        // Draw the "Shine" at the tip
        const tip = this.bladePoints[this.bladePoints.length - 1];
        this.bladeCtx.fillStyle = '#ffffff';
        this.bladeCtx.shadowBlur = 20;
        this.bladeCtx.shadowColor = '#ffffff';
        this.bladeCtx.beginPath();
        this.bladeCtx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
        this.bladeCtx.fill();
        this.bladeCtx.shadowBlur = 0;
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if(this.bladeCanvas) {
            this.bladeCanvas.width = window.innerWidth;
            this.bladeCanvas.height = window.innerHeight;
        }
    }
    
    playSwordSound() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            
            const now = this.audioCtx.currentTime;

            // 1. THE "SLICE" (Sharp Air Whoosh)
            const noiseBuf = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.1, this.audioCtx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = noiseBuf;
            const noiseFilter = this.audioCtx.createBiquadFilter();
            noiseFilter.type = 'highpass'; // SHARP EDGE
            noiseFilter.frequency.value = 3000;
            
            const noiseGain = this.audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.04, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.audioCtx.destination);
            noise.start(now);

            // 2. THE "BITE" (Rapid Frequency Sweep)
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(4000, now);
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);
            gain.gain.setValueAtTime(0.015, now); // Very low volume for just the "edge"
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.05);

            // 3. THE "THUD" (Soft impact)
            const thud = this.audioCtx.createOscillator();
            const thudGain = this.audioCtx.createGain();
            thud.type = 'sine';
            thud.frequency.setValueAtTime(150, now);
            thudGain.gain.setValueAtTime(0.04, now);
            thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            thud.connect(thudGain);
            thudGain.connect(this.audioCtx.destination);
            thud.start(now);
            thud.stop(now + 0.1);

        } catch (e) {}
    }

    explodeBomb(bomb) {
        // Sound - Smoothed out for less harshness
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'sine'; // Smooth, deep thud instead of harsh buzz
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
        
        gain.gain.setValueAtTime(0.3, now); // Reduced volume
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.4);

        // Visual Explosion
        this.shakeIntensity = 1.0;
        document.body.style.backgroundColor = 'white';
        setTimeout(() => document.body.style.backgroundColor = '', 100);

        // Remove bomb
        this.scene.remove(bomb.mesh);
        const idx = this.fruits.indexOf(bomb);
        if (idx > -1) this.fruits.splice(idx, 1);

        if (this.mode === 'classic') {
            // Game Over
            this.isPlaying = false;
            window.endGame(this.score, this.mode);
        } else if (this.mode === 'arcade') {
            // Penalty
            this.score = Math.max(0, this.score - 50);
            this.timeLeft = Math.max(0, this.timeLeft - 5);
            this.updateHUD();
            this.updateTimerDisplay();
        }
    }

    playBeep(isLow = false) {
        try {
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(isLow ? 440 : 880, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.15);
        } catch(e) {}
    }
}

window.gameInstance = new Game();
