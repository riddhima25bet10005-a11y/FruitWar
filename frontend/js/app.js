// app.js
const API_URL = '/api';
let currentUser = null;

// Screens
const loginScreen = document.getElementById('login-screen');
const mainMenu = document.getElementById('main-menu');
const inGameUi = document.getElementById('in-game-ui');
const gameOverScreen = document.getElementById('game-over-screen');

// Switch screen utility
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Auth
document.getElementById('login-btn').addEventListener('click', async () => {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const msg = document.getElementById('auth-message');
    
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true'},
            body: JSON.stringify({username: user, password: pass})
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data;
            // DEV: Save session
            localStorage.setItem('fruitwar_user', user);
            localStorage.setItem('fruitwar_pass', pass);
            updateMenuStats();
            showScreen(mainMenu);
        } else {
            msg.innerText = data.detail || 'Login failed';
        }
    } catch (e) {
        msg.innerText = 'Server error. Is the backend running?';
    }
});

document.getElementById('register-btn').addEventListener('click', async () => {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const msg = document.getElementById('auth-message');
    
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true'},
            body: JSON.stringify({username: user, password: pass})
        });
        const data = await res.json();
        if (res.ok) {
            msg.style.color = '#2ed573';
            msg.innerText = 'Registered! Please login.';
        } else {
            msg.style.color = '#ff4757';
            msg.innerText = data.detail || 'Registration failed';
        }
    } catch (e) {
        msg.innerText = 'Server error.';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('fruitwar_user');
    localStorage.removeItem('fruitwar_pass');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showScreen(loginScreen);
});

document.getElementById('reset-progress-btn').addEventListener('click', async () => {
    if (confirm("⚠️ ARE YOU SURE? \n\nThis will permanently delete your scores, coins, stars, and theme unlocks. This cannot be undone!")) {
        try {
            const response = await fetch(`${API_URL}/reset_progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                body: JSON.stringify({ username: currentUser.username })
            });
            
            if (response.ok) {
                const updatedUser = await response.json();
                currentUser = updatedUser;
                updateMenuStats();
                
                // Refresh theme buttons
                const unlocked = currentUser.unlocked_themes.split(",");
                document.querySelectorAll('.theme-btn').forEach(btn => {
                    const theme = btn.dataset.theme;
                    if (unlocked.includes(theme)) {
                        btn.classList.remove('locked');
                        const costSpan = btn.querySelector('.cost');
                        if (costSpan) costSpan.style.display = 'none';
                    } else {
                        btn.classList.add('locked');
                        const costSpan = btn.querySelector('.cost');
                        if (costSpan) costSpan.style.display = 'inline';
                    }
                });
                
                // Switch back to default theme visually
                document.querySelector('[data-theme="default"]').click();
                
                alert("Ninja progress has been wiped clean. Good luck starting over!");
            } else {
                alert("Failed to reset progress.");
            }
        } catch (error) {
            console.error("Error resetting progress:", error);
            alert("Could not connect to server to reset progress.");
        }
    }
});

// Auto-login on load
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('fruitwar_user');
    const savedPass = localStorage.getItem('fruitwar_pass');
    if (savedUser && savedPass) {
        document.getElementById('username').value = savedUser;
        document.getElementById('password').value = savedPass;
        document.getElementById('login-btn').click();
    }
});

function updateMenuStats() {
    if(!currentUser) return;
    document.getElementById('star-count').innerText = currentUser.stars;
    document.getElementById('coin-count').innerText = currentUser.coins;
    
    // Update per-mode levels
    document.getElementById('classic-level').innerText = currentUser.classic_level;
    document.getElementById('zen-level').innerText = currentUser.zen_level;
    document.getElementById('arcade-level').innerText = currentUser.arcade_level;
    
    // Update level goals (threshold = level * 50)
    document.getElementById('classic-goal').innerText = `Next: Score ${currentUser.classic_level * 50}`;
    document.getElementById('zen-goal').innerText = `Next: Score ${currentUser.zen_level * 50}`;
    document.getElementById('arcade-goal').innerText = `Next: Score ${currentUser.arcade_level * 50}`;
    
    if (typeof refreshThemeButtons === 'function') refreshThemeButtons();
}

// Game Flow
document.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const mode = e.target.parentElement.dataset.mode;
        startGame(mode);
    });
});

document.getElementById('home-btn').addEventListener('click', () => {
    showScreen(mainMenu);
    if(window.gameInstance) {
        window.gameInstance.reset();
    }
});

// Pause button
document.getElementById('pause-btn').addEventListener('click', () => {
    if(window.gameInstance) {
        window.gameInstance.togglePause();
        const overlay = document.getElementById('pause-overlay');
        overlay.style.display = window.gameInstance.isPaused ? 'flex' : 'none';
    }
});

// Resume button inside pause overlay
document.getElementById('resume-btn').addEventListener('click', () => {
    if(window.gameInstance && window.gameInstance.isPaused) {
        window.gameInstance.togglePause();
        document.getElementById('pause-overlay').style.display = 'none';
    }
});

// Home button inside pause overlay
document.getElementById('pause-home-btn').addEventListener('click', () => {
    document.getElementById('pause-overlay').style.display = 'none';
    if(window.gameInstance) {
        window.gameInstance.reset();
    }
    showScreen(mainMenu);
});

// Theme switching — persistent unlock system
let currentTheme = 'default';
const THEME_COSTS = {
    default: {type: 'coins', amount: 0},
    neon: {type: 'coins', amount: 100},
    sunset: {type: 'coins', amount: 150},
    ocean: {type: 'coins', amount: 200},
    sakura: {type: 'coins', amount: 250},
    cyberpunk: {type: 'coins', amount: 300},
    lava: {type: 'coins', amount: 350},
    galaxy: {type: 'coins', amount: 400},
    toxic: {type: 'coins', amount: 450},
    ice: {type: 'coins', amount: 500},
    inferno: {type: 'stars', amount: 1},
    jungle: {type: 'stars', amount: 1},
    storm: {type: 'stars', amount: 1},
    gold: {type: 'stars', amount: 1},
    midnight: {type: 'stars', amount: 1},
    candy: {type: 'stars', amount: 1},
    deepsea: {type: 'stars', amount: 1},
    desert: {type: 'stars', amount: 2},
    matrix: {type: 'stars', amount: 2},
    zen: {type: 'stars', amount: 2},
    steampunk: {type: 'stars', amount: 2},
    rainbow: {type: 'stars', amount: 2},
    void: {type: 'stars', amount: 2},
    emerald: {type: 'stars', amount: 2},
    solar: {type: 'stars', amount: 2}
};
const THEME_BACKGROUNDS = {
    default:   'radial-gradient(circle at center, #2f3542, #1e272e)',
    neon:      'radial-gradient(circle at center, #2d004d, #0d001a)',
    sunset:    'radial-gradient(circle at center, #ff7e5f, #764ba2)',
    ocean:     'radial-gradient(circle at center, #006994, #001a33)',
    sakura:    'radial-gradient(circle at center, #d4618c, #3b1f2b)',
    cyberpunk: 'radial-gradient(circle at center, #00e5ff, #0a0a2e)',
    lava:      'radial-gradient(circle at center, #e25822, #1a0500)',
    galaxy:    'radial-gradient(circle at center, #1b003a, #000000)',
    toxic:     'radial-gradient(circle at center, #1c3b1c, #0d1a0d)',
    ice:       'radial-gradient(circle at center, #a0e6ff, #003366)',
    inferno:   'radial-gradient(circle at center, #4d0a00, #000000)',
    jungle:    'radial-gradient(circle at center, #132d13, #000000)',
    storm:     'radial-gradient(circle at center, #1a1a2e, #0a0a1a)',
    gold:      'radial-gradient(circle at center, #4d3d00, #000000)',
    midnight:  'radial-gradient(circle at center, #00001a, #000000)',
    candy:     'radial-gradient(circle at center, #ff80b3, #4d001a)',
    deepsea:   'radial-gradient(circle at center, #000033, #000000)',
    desert:    'radial-gradient(circle at center, #4d2600, #1a0d00)',
    matrix:    'radial-gradient(circle at center, #001a00, #000000)',
    zen:       'radial-gradient(circle at center, #e0e0e0, #4d4d4d)',
    steampunk: 'radial-gradient(circle at center, #3d2613, #000000)',
    rainbow:   'radial-gradient(circle at center, #330033, #000000)',
    void:      'radial-gradient(circle at center, #1a0033, #000000)',
    emerald:   'radial-gradient(circle at center, #00331a, #000000)',
    solar:     'radial-gradient(circle at center, #4d4d00, #000000)',
};

function refreshThemeButtons() {
    if (!currentUser) return;
    const owned = currentUser.unlocked_themes ? currentUser.unlocked_themes.split(',') : ['default']; 
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const theme = btn.dataset.theme;
        btn.classList.remove('locked', 'owned');
        if (owned.includes(theme)) {
            btn.classList.add('owned');
        } else {
            btn.classList.add('locked');
        }
        if (theme === currentTheme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function applyTheme(theme) {
    currentTheme = theme;
    document.getElementById('game-container').style.background = THEME_BACKGROUNDS[theme];
    if (window.gameInstance) {
        if (window.gameInstance.scene) {
            window.gameInstance.scene.background = null; 
        }
        if (typeof window.gameInstance.setTheme === 'function') {
            window.gameInstance.setTheme(theme);
        }
    }
    refreshThemeButtons();
}

document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const theme = btn.dataset.theme;
        if (theme === currentTheme) return;
        if (!currentUser) return;

        const owned = currentUser.unlocked_themes ? currentUser.unlocked_themes.split(',') : ['default']; 

        if (owned.includes(theme)) {
            // Already unlocked — just switch to it
            applyTheme(theme);
            return;
        }

        // Need to unlock — check predefined cost
        const costInfo = THEME_COSTS[theme] || {type: 'coins', amount: 0};
        const currencyType = costInfo.type;
        const costAmount = costInfo.amount;

        if (currentUser[currencyType] < costAmount) {
            alert(`Not enough ${currencyType}! You have ${currentUser[currencyType]}, need ${costAmount}.`);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/unlock_theme`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true'},
                body: JSON.stringify({ 
                    username: currentUser.username, 
                    theme_name: theme,
                    currency: currencyType // Still send for backward compatibility or keep API clean
                })
            });
            if (res.ok) {
                currentUser = await res.json();
                updateMenuStats();
                applyTheme(theme);
            } else {
                const err = await res.json();
                alert(err.detail || 'Failed to unlock theme');
            }
        } catch (e) {
            console.error('Theme unlock error', e);
        }
    });
});

async function endGame(score, mode) {
    showScreen(gameOverScreen);
    document.getElementById('final-score').innerText = score;
    document.getElementById('pause-overlay').style.display = 'none';
    // Keep game-container visible to show theme background in menu
    
    // Calculate rewards
    const coinsEarned = Math.floor(score / 10);
    const starsEarned = score > 100 ? 1 : 0;
    
    document.getElementById('earned-coins').innerText = coinsEarned;
    document.getElementById('earned-stars').innerText = starsEarned;
    
    // Save progress to backend
    if(currentUser) {
        try {
            const res = await fetch(`${API_URL}/update_progress`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true'},
                body: JSON.stringify({
                    username: currentUser.username,
                    coins_gained: coinsEarned,
                    stars_gained: starsEarned
                })
            });
            if(res.ok) {
                currentUser = await res.json();
            }
        } catch (e) {
            console.error('Failed to save progress', e);
        }
        
        // Try to level up
        try {
            const lvlRes = await fetch(`${API_URL}/level_up`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true'},
                body: JSON.stringify({
                    username: currentUser.username,
                    mode: mode,
                    score: score
                })
            });
            if(lvlRes.ok) {
                const updated = await lvlRes.json();
                const oldLevel = currentUser[mode + '_level'];
                currentUser = updated;
                const newLevel = currentUser[mode + '_level'];
                if (newLevel > oldLevel) {
                    document.getElementById('earned-stars').innerText += ` 🎉 Level Up! ${mode} is now Level ${newLevel}`;
                }
            }
        } catch (e) {
            console.error('Level up check failed', e);
        }
        
        updateMenuStats();
    }
}

function startGame(mode) {
    showScreen(inGameUi);
    document.getElementById('pause-overlay').style.display = 'none';
    document.getElementById('pause-btn').innerText = 'Pause';
    // game-container is already visible
    
    // Show current level in HUD
    if (currentUser) {
        const lvl = currentUser[mode + '_level'] || 1;
        document.getElementById('level-hud').innerText = `Level ${lvl}`;
    }
    
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNumber = document.getElementById('countdown-number');
    countdownOverlay.style.display = 'flex';
    
    let count = 3;
    
    const updateCountdown = () => {
        if (count > 0) {
            countdownNumber.innerText = count;
            if (window.gameInstance) window.gameInstance.playBeep(true);
        } else if (count === 0) {
            countdownNumber.innerText = 'GO!';
            if (window.gameInstance) window.gameInstance.playBeep(false);
        } else {
            clearInterval(countInterval);
            countdownOverlay.style.display = 'none';
            
            const cameraEnabled = document.getElementById('camera-enabled').checked;
            if (cameraEnabled && !window.cameraTrackingStarted) {
                startCameraTracking();
                window.cameraTrackingStarted = true;
            }
            
            if (window.gameInstance) window.gameInstance.start(mode);
            return;
        }
        count--;
    };

    // Trigger first count immediately
    updateCountdown();
    const countInterval = setInterval(updateCountdown, 1000);
}
