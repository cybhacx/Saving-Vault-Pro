// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyD6A6Jn61-_fUD8FRjC2bbccYNpMIYw3Sk",
    authDomain: "saving-wallet-pro.firebaseapp.com",
    databaseURL: "https://saving-wallet-pro-default-rtdb.firebaseio.com",
    projectId: "saving-wallet-pro",
    storageBucket: "saving-wallet-pro.firebasestorage.app",
    messagingSenderId: "190574060583",
    appId: "1:190574060583:web:eee472df4a0c6be3aa5a02"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

const RAZORPAY_KEY_ID = "rzp_live_TW3Dh4C7B3KHW5";

let currentUser = null;
let allRecordsCache = [];
let currentUserRecordsCache = [];
let currentFilteredRecords = [];
let uploadedProfileBase64 = null;
let adminUploadedProfileBase64 = null;
let currentSigMode = 'draw';
let uploadedSignatureBase64 = null;
let userAnalyticsChart = null;
let adminMasterChart = null;
let currentAppTargetGoal = 100000;

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%2300f0ff' viewBox='0 0 16 16'><path d='M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z'/></svg>";

const canvas = document.getElementById('sig-canvas');
const ctx = canvas?.getContext('2d');
let drawing = false;

// ----------------------------------------------------
// UI STATUS & ERROR HELPERS (INLINE NOTIFICATIONS)
// ----------------------------------------------------
function setAuthMessage(msg, isSuccess = false) {
    const errEl = document.getElementById('auth-error');
    if (!errEl) return;
    errEl.innerText = msg || "";
    errEl.style.color = isSuccess ? "#00ff66" : "#ff3366";
    errEl.style.fontWeight = "bold";
    errEl.style.textAlign = "center";
    errEl.style.margin = "10px 0";
}

// ----------------------------------------------------
// THEME SWITCHER
// ----------------------------------------------------
function initThemeEngine() {
    const savedTheme = localStorage.getItem('cybhacx_app_theme') || 'night';
    if (savedTheme === 'day') {
        document.body.classList.add('day-mode');
        updateThemeButtonUI('day');
    } else {
        document.body.classList.remove('day-mode');
        updateThemeButtonUI('night');
    }
}

function toggleAppTheme() {
    const isDay = document.body.classList.toggle('day-mode');
    const chosenTheme = isDay ? 'day' : 'night';
    localStorage.setItem('cybhacx_app_theme', chosenTheme);
    updateThemeButtonUI(chosenTheme);

    const primaryColor = isDay ? '#0284c7' : '#00ff66';

    if (userAnalyticsChart) {
        userAnalyticsChart.data.datasets[0].borderColor = isDay ? '#d90466' : '#00f0ff';
        userAnalyticsChart.update('none');
    }
    if (adminMasterChart) {
        adminMasterChart.data.datasets[0].borderColor = primaryColor;
        adminMasterChart.update('none');
    }
}

function updateThemeButtonUI(theme) {
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (!icon || !text) return;
    if (theme === 'day') {
        icon.innerText = '🌙';
        text.innerText = 'NIGHT MODE';
    } else {
        icon.innerText = '☀️';
        text.innerText = 'DAY MODE';
    }
}

// ----------------------------------------------------
// AUTH TABS SWITCHER
// ----------------------------------------------------
function switchLoginTab(tabName) {
    const tabSystem = document.getElementById('tab-login-system');
    const tabEmail = document.getElementById('tab-login-email');
    const tabPhone = document.getElementById('tab-login-phone');

    const secSystem = document.getElementById('login-section-system');
    const secEmail = document.getElementById('login-section-email');
    const secPhone = document.getElementById('login-section-phone');

    setAuthMessage("");

    tabSystem?.classList.remove('active');
    tabEmail?.classList.remove('active');
    tabPhone?.classList.remove('active');

    secSystem?.classList.add('hidden');
    secEmail?.classList.add('hidden');
    secPhone?.classList.add('hidden');

    if (tabName === 'system') {
        tabSystem?.classList.add('active');
        secSystem?.classList.remove('hidden');
    } else if (tabName === 'email') {
        tabEmail?.classList.add('active');
        secEmail?.classList.remove('hidden');
    } else if (tabName === 'phone') {
        tabPhone?.classList.add('active');
        secPhone?.classList.remove('hidden');
        setupPhonePasswordField();
    }
}

// Transform Phone OTP layout to direct Password login (Zero Cost)
function setupPhonePasswordField() {
    const otpBox = document.getElementById('phone-otp-box');
    if (otpBox) otpBox.classList.add('hidden');
    const sendOtpBtn = document.getElementById('btn-send-phone-otp') || document.querySelector('#login-section-phone button');
    if (sendOtpBtn) {
        sendOtpBtn.innerText = "LOGIN WITH PHONE";
        sendOtpBtn.onclick = handlePhonePasswordLogin;
    }
}

// ----------------------------------------------------
// UNIFIED ACCOUNT RESOLVER (DATA SYNC ACROSS ALL METHODS)
// ----------------------------------------------------
async function findExistingUserNode({ email, phone, username, anyIdentifier }) {
    const snap = await database.ref('users').once('value');
    if (!snap.exists()) return null;

    let matchedUser = null;
    let matchedKey = null;

    const normEmail = email ? email.trim().toLowerCase() : null;
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '').slice(-10) : null;
    const normUsername = username ? username.trim().toLowerCase() : null;

    let searchVal = anyIdentifier ? anyIdentifier.trim().toLowerCase() : null;
    let searchPhone = anyIdentifier ? anyIdentifier.replace(/[^0-9]/g, '').slice(-10) : null;

    snap.forEach(child => {
        const u = child.val();
        const k = child.key.toLowerCase();

        const uEmail = u.email ? u.email.trim().toLowerCase() : null;
        const uPhone = u.phone ? String(u.phone).replace(/[^0-9]/g, '').slice(-10) : null;

        if (normUsername && k === normUsername) {
            matchedUser = u;
            matchedKey = child.key;
            return true;
        }
        if (normEmail && uEmail && normEmail === uEmail) {
            matchedUser = u;
            matchedKey = child.key;
            return true;
        }
        if (cleanPhone && uPhone && cleanPhone === uPhone) {
            matchedUser = u;
            matchedKey = child.key;
            return true;
        }
        if (searchVal) {
            if (k === searchVal || (uEmail && uEmail === searchVal)) {
                matchedUser = u;
                matchedKey = child.key;
                return true;
            }
            if (searchPhone && searchPhone.length === 10 && uPhone === searchPhone) {
                matchedUser = u;
                matchedKey = child.key;
                return true;
            }
        }
    });

    if (matchedUser && matchedKey) {
        return { ...matchedUser, username: matchedKey };
    }
    return null;
}

// ----------------------------------------------------
// MODAL CONTROLLERS & PAYMENT
// ----------------------------------------------------
function showPaymentModal() {
    document.getElementById('payment-modal')?.classList.remove('hidden');
    document.getElementById('payment-form-step')?.classList.remove('hidden');
    document.getElementById('payment-success-step')?.classList.add('hidden');
    const err = document.getElementById('payment-err');
    if (err) err.innerText = "";
}

function hidePaymentModal() {
    document.getElementById('payment-modal')?.classList.add('hidden');
}

function showFreeRequestModal() {
    document.getElementById('free-request-modal')?.classList.remove('hidden');
    document.getElementById('free-form-step')?.classList.remove('hidden');
    document.getElementById('free-success-step')?.classList.add('hidden');
    const err = document.getElementById('free-err');
    if (err) err.innerText = "";
}

function hideFreeRequestModal() {
    document.getElementById('free-request-modal')?.classList.add('hidden');
}

function submitFreePlanRequest() {
    const name = document.getElementById('free-name')?.value.trim();
    const email = document.getElementById('free-email')?.value.trim();
    const phone = document.getElementById('free-phone')?.value.trim();
    const username = document.getElementById('free-username')?.value.trim().toLowerCase();
    const dob = document.getElementById('free-dob')?.value;
    const err = document.getElementById('free-err');

    if (!name || !email || !phone || !username) {
        if (err) err.innerText = "❌ Please complete all mandatory fields!";
        return;
    }

    const payload = {
        name,
        email,
        phone,
        username,
        dob: dob || "N/A",
        planType: "free",
        status: "PENDING_APPROVAL",
        timestamp: new Date().toISOString()
    };

    database.ref('freePlanRequests').push(payload).then(() => {
        document.getElementById('free-form-step')?.classList.add('hidden');
        document.getElementById('free-success-step')?.classList.remove('hidden');
    }).catch(e => {
        if (err) err.innerText = "Error: " + e.message;
    });
}

function initiateRazorpayPayment() {
    const name = document.getElementById('pay-name')?.value.trim();
    const email = document.getElementById('pay-email')?.value.trim();
    const phone = document.getElementById('pay-phone')?.value.trim();
    const username = document.getElementById('pay-username')?.value.trim().toLowerCase();
    const err = document.getElementById('payment-err');

    if (!name || !email || !phone || !username) {
        if (err) err.innerText = "❌ Please fill all details before proceeding to pay!";
        return;
    }
    if (err) err.innerText = "";

    const options = {
        "key": RAZORPAY_KEY_ID,
        "amount": "1000",
        "currency": "INR",
        "name": "CYBHACX MONEY",
        "description": "PRO VIP Node Access Pass",
        "image": "https://img.icons8.com/neon/96/00f0ff/cyberpunk.png",
        "handler": function (response) {
            handleSuccessfulPayment({
                paymentId: response.razorpay_payment_id,
                name: name,
                email: email,
                phone: phone,
                username: username,
                amount: 10,
                planType: "vip",
                timestamp: new Date().toISOString()
            });
        },
        "prefill": {
            "name": name,
            "email": email,
            "contact": phone
        },
        "theme": {
            "color": "#ff007f"
        }
    };

    try {
        const rzp1 = new Razorpay(options);
        rzp1.on('payment.failed', function (response){
            alert("Payment Failed: " + response.error.description);
        });
        rzp1.open();
    } catch (e) {
        alert("Razorpay SDK Error: " + e.message);
    }
}

function handleSuccessfulPayment(paymentRecord) {
    database.ref('paymentRequests').push(paymentRecord).then(() => {
        const confId = document.getElementById('conf-pay-id');
        if (confId) confId.innerText = paymentRecord.paymentId;
        document.getElementById('payment-form-step')?.classList.add('hidden');
        document.getElementById('payment-success-step')?.classList.remove('hidden');
    }).catch(err => {
        alert("Database error: " + err.message);
    });
}

// ----------------------------------------------------
// LIGHTWEIGHT FUTURISTIC PARTICLES
// ----------------------------------------------------
function setupFuturisticEffects() {
    if (!document.getElementById('cyber-particles-canvas')) {
        const pCanvas = document.createElement('canvas');
        pCanvas.id = 'cyber-particles-canvas';
        document.body.prepend(pCanvas);
    }

    const authScreen = document.getElementById('auth-screen');
    if (authScreen && !authScreen.querySelector('.smoke-cyan')) {
        const colors = ['cyan', 'pink', 'green', 'purple'];
        colors.forEach(col => {
            const smoke = document.createElement('div');
            smoke.className = `smoke-cloud smoke-${col}`;
            authScreen.prepend(smoke);
        });
    }

    initCyberParticles();
}

function initCyberParticles() {
    const pCanvas = document.getElementById('cyber-particles-canvas');
    if (!pCanvas) return;
    const pCtx = pCanvas.getContext('2d');

    const isMobile = window.innerWidth < 650;
    let width = (pCanvas.width = window.innerWidth);
    let height = (pCanvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
        width = pCanvas.width = window.innerWidth;
        height = pCanvas.height = window.innerHeight;
    });

    const colors = ['#00f0ff', '#ff007f', '#00ff66'];
    const particles = [];
    const particleCount = isMobile ? 18 : 35;

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 1.8 + 0.8;
            this.speedX = (Math.random() - 0.5) * 0.45;
            this.speedY = (Math.random() - 0.5) * 0.45;
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
        }

        draw() {
            pCtx.fillStyle = this.color;
            pCtx.beginPath();
            pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            pCtx.fill();
        }
    }

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function animate() {
        pCtx.clearRect(0, 0, width, height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        requestAnimationFrame(animate);
    }
    animate();
}

// MONKEY EYE TOGGLE
function togglePassVisibility(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btnElement.innerText = '🐵';
    } else {
        input.type = 'password';
        btnElement.innerText = '🙈';
    }
}

// ----------------------------------------------------
// DATE & TIME FORMATTERS
// ----------------------------------------------------
function formatIndianTime(dateObj) {
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return 'N/A';
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

function formatIndianDate(dateObj) {
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return 'N/A';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
}

function parseRecordDate(timestampStr) {
    if (!timestampStr) return null;
    if (timestampStr instanceof Date) return isNaN(timestampStr.getTime()) ? null : timestampStr;
    if (typeof timestampStr === 'number') return new Date(timestampStr);

    const cleanStr = String(timestampStr).trim();
    if (cleanStr.includes('/') || (cleanStr.includes('-') && cleanStr.indexOf('-') <= 2)) {
        let datePart = cleanStr;
        let timePartRaw = '';

        if (cleanStr.includes(',')) {
            const parts = cleanStr.split(',');
            datePart = parts[0].trim();
            timePartRaw = (parts[1] || '').trim();
        } else if (cleanStr.includes(' ')) {
            const parts = cleanStr.split(' ');
            datePart = parts[0].trim();
            timePartRaw = cleanStr.substring(datePart.length).trim();
        }

        const delimiter = datePart.includes('/') ? '/' : '-';
        const tokens = datePart.split(delimiter);

        if (tokens.length === 3 && tokens[2].length === 4) {
            const day = parseInt(tokens[0], 10);
            const month = parseInt(tokens[1], 10) - 1;
            const year = parseInt(tokens[2], 10);

            let hours = 0, minutes = 0, seconds = 0;
            if (timePartRaw) {
                const timeTokens = timePartRaw.split(/\s+/);
                const clock = (timeTokens[0] || '').split(':').map(Number);
                hours = clock[0] || 0;
                minutes = clock[1] || 0;
                seconds = clock[2] || 0;

                const meridian = (timeTokens[1] || '').toUpperCase();
                if (meridian === 'PM' && hours < 12) hours += 12;
                if (meridian === 'AM' && hours === 12) hours = 0;
            }

            const parsed = new Date(year, month, day, hours, minutes, seconds);
            if (!isNaN(parsed.getTime())) return parsed;
        }
    }

    const fallback = new Date(cleanStr);
    return isNaN(fallback.getTime()) ? null : fallback;
}

// ----------------------------------------------------
// USER PROFILE & DYNAMIC ROLES SETUP
// ----------------------------------------------------
function renderUserProfileData() {
    if (!currentUser) return;

    const userDispName = document.getElementById('user-display-name');
    const profCardName = document.getElementById('profile-card-name');
    const profCardId = document.getElementById('profile-card-id');
    const profCardEmail = document.getElementById('profile-card-email');
    const profCardPhone = document.getElementById('profile-card-phone');
    const profCardDob = document.getElementById('profile-card-dob');
    const profCardRole = document.getElementById('profile-card-role');

    if (userDispName) userDispName.innerText = currentUser.name || currentUser.username || 'Agent';
    if (profCardName) profCardName.innerText = currentUser.name || 'Agent';
    if (profCardId) profCardId.innerText = currentUser.username || 'NODE';
    if (profCardEmail) profCardEmail.innerText = currentUser.email || 'Not Set';
    if (profCardPhone) profCardPhone.innerText = currentUser.phone || 'Not Set';
    if (profCardDob) profCardDob.innerText = currentUser.dob || 'Not Set';
    if (profCardRole) profCardRole.innerText = (currentUser.role || 'user').toUpperCase();

    const avatarImg = document.getElementById('user-profile-img');
    if (avatarImg) avatarImg.src = currentUser.profileImg || DEFAULT_AVATAR;

    const planBadge = document.getElementById('user-plan-badge');
    const isVIP = currentUser.unlockedFeatures === 'vip';
    if (planBadge) {
        planBadge.innerText = isVIP ? '🚀 PRO VIP' : 'FREE PASS';
        planBadge.style.background = isVIP ? 'var(--neon-pink)' : 'var(--neon-blue)';
    }

    const permissions = getResolvedPermissions(currentUser);

    const vipAnalyticsPanel = document.getElementById('user-vip-analytics-panel');
    const loggedEntriesCard = document.getElementById('user-logged-entries-card');
    const btnUploadSign = document.getElementById('btn-mode-upload');
    const btnEditTarget = document.getElementById('btn-edit-target');

    if (permissions.canViewCharts) {
        vipAnalyticsPanel?.classList.remove('hidden');
    } else {
        vipAnalyticsPanel?.classList.add('hidden');
    }

    if (permissions.canViewTable) {
        loggedEntriesCard?.classList.remove('hidden');
    } else {
        loggedEntriesCard?.classList.add('hidden');
    }

    if (permissions.canUploadSign) {
        btnUploadSign?.classList.remove('hidden');
    } else {
        btnUploadSign?.classList.add('hidden');
        switchSignatureMode('draw');
    }

    if (permissions.canSetCustomTarget) {
        btnEditTarget?.classList.remove('hidden');
    } else {
        btnEditTarget?.classList.add('hidden');
    }

    updateUserTargetProgressUI();
}

function getResolvedPermissions(user) {
    const isVIP = user.unlockedFeatures === 'vip';
    const custom = user.customFeatureOverrides || {};

    return {
        canDrawSign: custom.drawpad !== undefined ? custom.drawpad : true,
        canUploadSign: custom.imgupload !== undefined ? custom.imgupload : isVIP,
        canViewCharts: custom.charts !== undefined ? custom.charts : isVIP,
        canViewTable: custom.table !== undefined ? custom.table : isVIP,
        canSetCustomTarget: custom.customtarget !== undefined ? custom.customtarget : isVIP
    };
}

function updateUserTargetProgressUI() {
    if (!currentUser) return;
    const target = currentUser.personalTargetGoal || currentAppTargetGoal;
    const targetDisplay = document.getElementById('user-target-display');
    const progressFill = document.getElementById('user-target-progress-fill');
    const percentTxt = document.getElementById('user-target-percent-txt');

    if (targetDisplay) targetDisplay.innerText = `₹${target.toLocaleString('en-IN')}`;

    let personalSavings = 0;
    currentUserRecordsCache.forEach(r => {
        personalSavings += (parseFloat(r.amount) || 0);
    });

    const percent = Math.min(100, Math.round((personalSavings / target) * 100));
    if (progressFill) progressFill.style.width = percent + "%";
    if (percentTxt) percentTxt.innerText = percent + "%";
}

function promptEditUserTarget() {
    const newGoal = prompt("Set personal savings target goal (₹):", currentUser.personalTargetGoal || 100000);
    if (newGoal && !isNaN(newGoal) && Number(newGoal) > 0) {
        const goalNum = parseInt(newGoal, 10);
        database.ref('users/' + currentUser.username).update({ personalTargetGoal: goalNum }).then(() => {
            currentUser.personalTargetGoal = goalNum;
            sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
            updateUserTargetProgressUI();
            alert("Goal updated successfully!");
        });
    }
}

function toggleEditProfileDeck() {
    const deck = document.getElementById('edit-profile-deck');
    if (!deck) return;
    const isHidden = deck.classList.contains('hidden');
    if (isHidden) {
        document.getElementById('edit-profile-username').value = currentUser.username || '';
        document.getElementById('edit-profile-name').value = currentUser.name || '';
        document.getElementById('edit-profile-email').value = currentUser.email || '';
        document.getElementById('edit-profile-phone').value = currentUser.phone || '';
        document.getElementById('edit-profile-dob').value = currentUser.dob || '';
        document.getElementById('edit-profile-password').value = '';
        uploadedProfileBase64 = null;
        document.getElementById('profile-save-msg').innerText = '';

        const note = document.getElementById('system-id-cooldown-note');
        if (note && currentUser.lastUsernameChange) {
            const lastChange = new Date(currentUser.lastUsernameChange);
            const daysPassed = (Date.now() - lastChange.getTime()) / (1000 * 3600 * 24);
            if (daysPassed < 7) {
                const daysLeft = Math.ceil(7 - daysPassed);
                note.innerText = `⚠️ System ID is on cooldown. You can change it in ${daysLeft} day(s).`;
                document.getElementById('edit-profile-username').disabled = true;
            } else {
                note.innerText = "✅ System ID can be updated now.";
                document.getElementById('edit-profile-username').disabled = false;
            }
        }
        deck.classList.remove('hidden');
    } else {
        deck.classList.add('hidden');
    }
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) { uploadedProfileBase64 = event.target.result; };
    reader.readAsDataURL(file);
}

function handleAdminImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        adminUploadedProfileBase64 = event.target.result;
        const previewImg = document.getElementById('admin-preview-img');
        const placeholder = document.getElementById('admin-preview-placeholder');
        if (previewImg && placeholder) {
            previewImg.src = adminUploadedProfileBase64;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);
}

function saveUserProfileChanges() {
    if (!currentUser || !currentUser.username) return;

    const newUsername = document.getElementById('edit-profile-username').value.trim().toLowerCase();
    const name = document.getElementById('edit-profile-name').value.trim();
    const email = document.getElementById('edit-profile-email').value.trim();
    const phone = document.getElementById('edit-profile-phone').value.trim();
    const dob = document.getElementById('edit-profile-dob').value;
    const newPassword = document.getElementById('edit-profile-password').value;
    const msg = document.getElementById('profile-save-msg');

    if (!name) {
        alert("Full name cannot be empty!");
        return;
    }

    const updates = { name, email, phone, dob };
    if (newPassword) updates.password = newPassword;
    if (uploadedProfileBase64) updates.profileImg = uploadedProfileBase64;

    const oldUsername = currentUser.username;

    if (newUsername && newUsername !== oldUsername) {
        if (currentUser.lastUsernameChange) {
            const lastChange = new Date(currentUser.lastUsernameChange);
            const daysPassed = (Date.now() - lastChange.getTime()) / (1000 * 3600 * 24);
            if (daysPassed < 7) {
                alert(`System ID can only be modified once every 7 days! Wait ${Math.ceil(7 - daysPassed)} more day(s).`);
                return;
            }
        }

        database.ref('users/' + newUsername).once('value').then(snap => {
            if (snap.exists()) {
                alert(`System ID [${newUsername}] is already taken! Choose another.`);
                return;
            }

            updates.username = newUsername;
            updates.lastUsernameChange = new Date().toISOString();

            const migratedData = { ...currentUser, ...updates };
            database.ref('users/' + newUsername).set(migratedData).then(() => {
                database.ref('users/' + oldUsername).remove();
                currentUser = migratedData;
                sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
                renderUserProfileData();
                if (msg) msg.innerText = "🟢 PROFILE & SYSTEM ID UPDATED!";
                setTimeout(() => { toggleEditProfileDeck(); if (msg) msg.innerText = ""; }, 1200);
            });
        });
        return;
    }

    database.ref('users/' + oldUsername).update(updates).then(() => {
        currentUser = { ...currentUser, ...updates };
        sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
        renderUserProfileData();
        if (msg) msg.innerText = "🟢 PROFILE UPDATED SUCCESSFULLY!";
        setTimeout(() => {
            toggleEditProfileDeck();
            if (msg) msg.innerText = "";
        }, 1000);
    }).catch(err => {
        alert("Update Error: " + err.message);
    });
}

// ----------------------------------------------------
// SIGNATURE ENGINE
// ----------------------------------------------------
function switchSignatureMode(mode) {
    const permissions = getResolvedPermissions(currentUser || {});
    if (mode === 'upload' && !permissions.canUploadSign) {
        alert("Upload Signature is reserved for PRO VIP Nodes! Upgrade to unlock.");
        return;
    }

    currentSigMode = mode;
    const drawBtn = document.getElementById('btn-mode-draw');
    const uploadBtn = document.getElementById('btn-mode-upload');
    const drawContainer = document.getElementById('sig-draw-container');
    const uploadContainer = document.getElementById('sig-upload-container');

    if (mode === 'draw') {
        drawBtn?.classList.add('active');
        uploadBtn?.classList.remove('active');
        drawContainer?.classList.remove('hidden');
        uploadContainer?.classList.add('hidden');
    } else {
        uploadBtn?.classList.add('active');
        drawBtn?.classList.remove('active');
        uploadContainer?.classList.remove('hidden');
        drawContainer?.classList.add('hidden');
    }
}

function handleSignatureFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);

            const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

                if (brightness > 140) {
                    data[i + 3] = 0;
                } else {
                    data[i] = 0;
                    data[i + 1] = 255;
                    data[i + 2] = 102;
                    data[i + 3] = 255;
                }
            }

            tempCtx.putImageData(imgData, 0, 0);
            uploadedSignatureBase64 = tempCanvas.toDataURL('image/png');

            const previewImg = document.getElementById('sig-preview-img');
            const previewWrapper = document.getElementById('sig-preview-wrapper');
            if (previewImg) previewImg.src = uploadedSignatureBase64;
            previewWrapper?.classList.remove('hidden');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function initSignatureEngine() {
    if (!canvas) return;
    ctx.strokeStyle = '#00ff66';
    canvas.addEventListener('mousedown', () => drawing = true);
    canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', (e) => { drawing = true; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', () => { drawing = false; ctx.beginPath(); });
    canvas.addEventListener('touchmove', (e) => {
        if (!drawing) return;
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
        ctx.stroke(); ctx.beginPath();
        ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
}

function draw(e) {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke(); ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function clearSignature() {
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function matchMonthIndex(monthValue, dateMonthIndex) {
    if (!monthValue || monthValue === 'ALL' || monthValue === 'All Months') return true;
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const valLower = String(monthValue).trim().toLowerCase();

    if (monthNames.includes(valLower)) {
        return monthNames.indexOf(valLower) === dateMonthIndex;
    }
    const num = parseInt(valLower, 10);
    if (!isNaN(num)) {
        return num === dateMonthIndex;
    }
    return false;
}

// ----------------------------------------------------
// REALTIME LISTENERS & DYNAMIC POPULATION
// ----------------------------------------------------
function listenToLiveDatabase() {
    database.ref('savingRecords').on('value', (snapshot) => {
        allRecordsCache = [];
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            data._key = childSnapshot.key;
            if (data.timestamp) {
                allRecordsCache.push(data);
            }
        });

        allRecordsCache.sort((a, b) => {
            const da = parseRecordDate(a.timestamp);
            const db = parseRecordDate(b.timestamp);
            return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
        });

        populateFilterDropdowns(allRecordsCache);
        applyMatrixFilters();
    });

    database.ref('appConfig/targetGoal').on('value', (snap) => {
        if (snap.exists()) {
            currentAppTargetGoal = snap.val();
            const targetDisp = document.getElementById('admin-target-display');
            if (targetDisp) targetDisp.innerText = `₹${currentAppTargetGoal.toLocaleString('en-IN')}`;
            applyMatrixFilters();
        }
    });
}

function listenToUserProfiles() {
    database.ref('users').on('value', (snapshot) => {
        const tbody = document.getElementById('user-profiles-body');
        if (!tbody) return;
        tbody.innerHTML = "";

        snapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            const uId = childSnapshot.key;
            const userAvatar = user.profileImg || DEFAULT_AVATAR;
            const isLocked = user.isLocked === true || user.isLocked === "true";
            const featStatus = user.unlockedFeatures === 'vip' ? '🚀 VIP' : 'Standard';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${userAvatar}" class="admin-tbl-avatar" alt="Avatar"/></td>
                <td><b>${uId}</b></td>
                <td>${user.name || 'N/A'}</td>
                <td style="font-size:11px; line-height:1.4;">
                    📧 ${user.email || 'N/A'}<br>
                    📱 ${user.phone || 'N/A'}<br>
                    🎂 ${user.dob || 'N/A'}
                </td>
                <td>
                    <span style="color:${isLocked ? '#ff3366' : '#00ff66'}; font-weight:bold;">
                        ${isLocked ? '🔒 LOCKED' : '🟢 ACTIVE'}
                    </span>
                </td>
                <td><span class="${user.unlockedFeatures === 'vip' ? 'txt-pink' : 'txt-muted'}" style="font-size:12px; font-weight:bold;">${featStatus}</span></td>
                <td style="font-size:10px; line-height:1.4;">
                    ${renderUserFeatureBadges(user)}
                </td>
                <td>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn-table-edit" onclick="editUserProfile('${uId}')">EDIT</button>
                        <button class="${isLocked ? 'btn-table-req' : 'btn-table-del'}" onclick="toggleUserLock('${uId}', ${!isLocked})">
                            ${isLocked ? '🔓 UNLOCK' : '🔒 LOCK'}
                        </button>
                        <button class="btn-table-edit" style="border-color:var(--neon-pink); color:var(--neon-pink);" onclick="toggleUserFeature('${uId}', '${user.unlockedFeatures === 'vip' ? 'standard' : 'vip'}')">
                            ${user.unlockedFeatures === 'vip' ? 'REVOKE VIP' : 'GRANT VIP'}
                        </button>
                        <button class="btn-table-del" onclick="deleteUserByAdmin('${uId}')">DELETE</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    database.ref('freePlanRequests').on('value', (snapshot) => {
        const tbody = document.getElementById('admin-free-requests-body');
        if (!tbody) return;
        tbody.innerHTML = "";

        snapshot.forEach((childSnapshot) => {
            const req = childSnapshot.val();
            const rKey = childSnapshot.key;
            const dateObj = parseRecordDate(req.timestamp);
            const timeOnly = formatIndianTime(dateObj);
            const dateOnly = formatIndianDate(dateObj);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${timeOnly}</td>
                <td>${dateOnly}</td>
                <td><span class="txt-blue" style="font-weight:bold;">${req.username || 'N/A'}</span></td>
                <td style="font-size:11px; line-height:1.4;">
                    👤 ${req.name}<br>
                    📧 ${req.email}<br>
                    📱 ${req.phone}
                </td>
                <td>${req.dob || 'N/A'}</td>
                <td>
                    <button class="btn-table-edit" onclick="prefillFreeUser('${req.username}', '${req.name}', '${req.email}', '${req.phone}', '${req.dob}', '${rKey}')">APPROVE & SETUP</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    database.ref('paymentRequests').on('value', (snapshot) => {
        const tbody = document.getElementById('admin-payments-body');
        if (!tbody) return;
        tbody.innerHTML = "";

        snapshot.forEach((childSnapshot) => {
            const req = childSnapshot.val();
            const rKey = childSnapshot.key;
            const dateObj = parseRecordDate(req.timestamp);
            const timeOnly = formatIndianTime(dateObj);
            const dateOnly = formatIndianDate(dateObj);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${timeOnly}</td>
                <td>${dateOnly}</td>
                <td><span class="txt-pink" style="font-weight:bold;">${req.username || 'N/A'}</span></td>
                <td style="font-size:11px; line-height:1.4;">
                    👤 ${req.name}<br>
                    📧 ${req.email}<br>
                    📱 ${req.phone}
                </td>
                <td><code style="color:var(--neon-blue); font-size:11px;">${req.paymentId || 'PAID'}</code></td>
                <td><span class="txt-green" style="font-weight:bold;">₹10 PAID</span></td>
                <td>
                    <button class="btn-table-edit" onclick="prefillUserProvisioning('${req.username}', '${req.name}', '${req.email}', '${req.phone}')">⚡ CREATE USER</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

function renderUserFeatureBadges(user) {
    const p = getResolvedPermissions(user);
    return `
        <span>Draw: ${p.canDrawSign ? '🟢' : '🔴'}</span><br>
        <span>Upload: ${p.canUploadSign ? '🟢' : '🔴'}</span><br>
        <span>Charts: ${p.canViewCharts ? '🟢' : '🔴'}</span><br>
        <span>Table: ${p.canViewTable ? '🟢' : '🔴'}</span>
    `;
}

function prefillFreeUser(username, name, email, phone, dob, reqKey) {
    prefillUserProvisioning(username, name, email, phone);
    const dobInp = document.getElementById('signup-dob');
    const featSel = document.getElementById('signup-features-unlocked');
    if (dobInp && dob !== 'N/A') dobInp.value = dob;
    if (featSel) featSel.value = 'standard';
    database.ref('freePlanRequests/' + reqKey).remove();
}

function deleteUserByAdmin(username) {
    if (confirm(`⚠️ DANGER: Permanently delete User [${username}]?`)) {
        database.ref('users/' + username).remove().then(() => {
            alert(`User [${username}] deleted successfully.`);
        }).catch(err => {
            alert("Delete Error: " + err.message);
        });
    }
}

function toggleUserLock(username, newStatus) {
    const actionName = newStatus ? "LOCK" : "UNLOCK";
    if (confirm(`Confirm ${actionName} User [${username}]?`)) {
        database.ref('users/' + username).update({ isLocked: newStatus }).then(() => {
            alert(`User [${username}] ${actionName}ED!`);
        });
    }
}

function toggleUserFeature(username, newFeatureState) {
    database.ref('users/' + username).update({ unlockedFeatures: newFeatureState }).then(() => {
        alert(`User [${username}] feature level: ${newFeatureState.toUpperCase()}`);
    });
}

function prefillUserProvisioning(username, name, email, phone) {
    const uInp = document.getElementById('signup-username');
    const nInp = document.getElementById('signup-name');
    const eInp = document.getElementById('signup-email');
    const pInp = document.getElementById('signup-phone');
    if (uInp) uInp.value = username;
    if (nInp) nInp.value = name;
    if (eInp) eInp.value = email;
    if (pInp) pInp.value = phone;

    const deck = document.getElementById('admin-user-provision-deck');
    if (deck) {
        deck.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function promptAdminSavingsTarget() {
    const val = prompt("Update Central Master Grid Target (₹):", currentAppTargetGoal);
    if (val && !isNaN(val) && Number(val) > 0) {
        const newGoal = parseInt(val, 10);
        database.ref('appConfig/targetGoal').set(newGoal).then(() => {
            alert("Master Target Updated!");
        });
    }
}

// ----------------------------------------------------
// MASTER LEDGER & GLOWING ANALYTICS
// ----------------------------------------------------
function populateFilterDropdowns(records) {
    const userSelect = document.getElementById('filter-user');
    const yearSelect = document.getElementById('filter-year');
    if (!userSelect || !yearSelect) return;

    const currentUserVal = userSelect.value;
    const currentYearVal = yearSelect.value;
    const usersSet = new Set();
    const yearsSet = new Set();

    records.forEach(r => {
        if (r.userId) usersSet.add(r.userId);
        else if (r.username) usersSet.add(r.username);
        const parsed = parseRecordDate(r.timestamp);
        if (parsed) {
            yearsSet.add(parsed.getFullYear());
        }
    });

    userSelect.innerHTML = '<option value="ALL">All Operators</option>';
    Array.from(usersSet).sort().forEach(user => {
        const opt = document.createElement('option');
        opt.value = user; opt.innerText = user;
        userSelect.appendChild(opt);
    });

    yearSelect.innerHTML = '<option value="ALL">All Years</option>';
    Array.from(yearsSet).sort((a, b) => b - a).forEach(year => {
        const opt = document.createElement('option');
        opt.value = year; opt.innerText = year;
        yearSelect.appendChild(opt);
    });

    if (Array.from(usersSet).includes(currentUserVal)) userSelect.value = currentUserVal;
    if (Array.from(yearsSet).map(String).includes(currentYearVal)) yearSelect.value = currentYearVal;
}

function applyMatrixFilters() {
    const selectedUser = document.getElementById('filter-user')?.value || 'ALL';
    const selectedYear = document.getElementById('filter-year')?.value || 'ALL';
    const selectedMonth = document.getElementById('filter-month')?.value || 'ALL';
    const selectedDate = document.getElementById('filter-date')?.value || '';
    const searchQuery = document.getElementById('admin-search-input')?.value.toLowerCase().trim() || "";

    currentFilteredRecords = allRecordsCache.filter(record => {
        const recordUser = record.userId || record.username;
        if (selectedUser !== 'ALL' && recordUser !== selectedUser) return false;

        const dateObj = parseRecordDate(record.timestamp);
        if ((selectedYear !== 'ALL' || (selectedMonth !== 'ALL' && selectedMonth !== 'All Months') || selectedDate) && !dateObj) {
            return false;
        }

        if (dateObj) {
            if (selectedYear !== 'ALL' && dateObj.getFullYear() !== parseInt(selectedYear, 10)) return false;
            if (!matchMonthIndex(selectedMonth, dateObj.getMonth())) return false;
            if (selectedDate) {
                const parts = selectedDate.split('-');
                if (parts.length === 3) {
                    const selY = parseInt(parts[0], 10);
                    const selM = parseInt(parts[1], 10) - 1;
                    const selD = parseInt(parts[2], 10);
                    if (
                        dateObj.getFullYear() !== selY ||
                        dateObj.getMonth() !== selM ||
                        dateObj.getDate() !== selD
                    ) return false;
                }
            }
        }

        if (searchQuery) {
            const timeStr = formatIndianTime(dateObj).toLowerCase();
            const dateStr = formatIndianDate(dateObj).toLowerCase();
            const matchesUser = recordUser?.toLowerCase().includes(searchQuery);
            const matchesAmt = String(record.amount).includes(searchQuery);
            const matchesTime = timeStr.includes(searchQuery) || dateStr.includes(searchQuery);
            const matchesStatus = record.status?.toLowerCase().includes(searchQuery);
            if (!matchesUser && !matchesAmt && !matchesTime && !matchesStatus) return false;
        }

        return true;
    });

    renderAdminDashboard(currentFilteredRecords);
    renderAdminMasterAnalytics(currentFilteredRecords);
}

function renderAdminMasterAnalytics(records) {
    const chartCanvas = document.getElementById('admin-master-chart');
    if (!chartCanvas) return;

    const sorted = [...records].sort((a, b) => {
        const da = parseRecordDate(a.timestamp);
        const db = parseRecordDate(b.timestamp);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });

    const labels = sorted.map(r => {
        const d = parseRecordDate(r.timestamp);
        const name = r.username || r.userId || 'Agent';
        return d ? `${formatIndianDate(d)} (${name})` : 'N/A';
    });
    const dataPoints = sorted.map(r => parseFloat(r.amount) || 0);

    if (adminMasterChart) {
        adminMasterChart.data.labels = labels.length ? labels : ['No Activity'];
        adminMasterChart.data.datasets[0].data = dataPoints.length ? dataPoints : [0];
        adminMasterChart.update('none');
        return;
    }

    const isDay = document.body.classList.contains('day-mode');
    const primaryColor = isDay ? '#0284c7' : '#00ff66';
    const gridColor = isDay ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';

    adminMasterChart = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['No Activity'],
            datasets: [{
                label: 'Filtered Vault Inflow (₹)',
                data: dataPoints.length ? dataPoints : [0],
                borderColor: primaryColor,
                backgroundColor: isDay ? 'rgba(2, 132, 199, 0.12)' : 'rgba(0, 255, 102, 0.15)',
                borderWidth: 2,
                pointBackgroundColor: primaryColor,
                pointBorderColor: '#ffffff',
                pointRadius: 4,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: isDay ? '#374151' : '#a1a1aa', font: { size: 10 } } },
                y: { grid: { color: gridColor }, ticks: { color: isDay ? '#374151' : '#a1a1aa', font: { size: 10 } } }
            },
            plugins: {
                legend: { labels: { color: isDay ? '#111827' : '#ffffff', font: { size: 11 } } }
            }
        }
    });
}

function resetFilters() {
    if (document.getElementById('filter-user')) document.getElementById('filter-user').value = 'ALL';
    if (document.getElementById('filter-year')) document.getElementById('filter-year').value = 'ALL';
    if (document.getElementById('filter-month')) document.getElementById('filter-month').value = 'ALL';
    if (document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
    const adminSearch = document.getElementById('admin-search-input');
    if (adminSearch) adminSearch.value = '';
    applyMatrixFilters();
}

// ----------------------------------------------------
// AUTHENTICATION: DIRECT SYNCED METHODS
// ----------------------------------------------------
function showForgetPassword() {
    document.getElementById('login-form-group')?.classList.add('hidden');
    document.getElementById('forget-form-group')?.classList.remove('hidden');
    setAuthMessage("");
}

function hideForgetPassword() {
    document.getElementById('forget-form-group')?.classList.add('hidden');
    document.getElementById('login-form-group')?.classList.remove('hidden');
    setAuthMessage("");
}

// 1. SYSTEM ID LOGIN
function handleLogin() {
    const rawUserInp = document.getElementById('login-username')?.value.trim();
    const passInp = document.getElementById('login-password')?.value;
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');

    if (usernameInput) usernameInput.style.borderColor = "";
    if (passwordInput) passwordInput.style.borderColor = "";
    setAuthMessage("");

    if (!rawUserInp || !passInp) {
        setAuthMessage("🚨 ACCESS DENIED: Please enter System ID and Passcode!");
        if (usernameInput && !rawUserInp) usernameInput.style.borderColor = "#ff3366";
        if (passwordInput && !passInp) passwordInput.style.borderColor = "#ff3366";
        return;
    }

    const lowerUserInp = rawUserInp.toLowerCase();

    if (lowerUserInp === 'cybhacx') {
        if (passInp === 'cybhacx@#Ravi') {
            currentUser = {
                password: "cybhacx@#Ravi",
                role: "admin",
                name: "CYBHACX ADMIN",
                username: "cybhacx"
            };
            sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
            launchAppForUser();
            return;
        } else {
            setAuthMessage("🚨 ACCESS DENIED: Invalid Admin Passcode!");
            if (passwordInput) passwordInput.style.borderColor = "#ff3366";
            return;
        }
    }

    setAuthMessage("Connecting to System Node...");

    findExistingUserNode({ username: lowerUserInp }).then((matchedUser) => {
        if (matchedUser) {
            if (matchedUser.isLocked === true || matchedUser.isLocked === "true") {
                setAuthMessage("🔒 ACCESS LOCKED: Your Node has been restricted by Admin!");
                return;
            }

            if (String(matchedUser.password).trim() === String(passInp).trim()) {
                currentUser = matchedUser;
                setAuthMessage("");
                sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
                launchAppForUser();
            } else {
                setAuthMessage("🚨 ACCESS DENIED: Incorrect Passcode entered!");
                if (passwordInput) passwordInput.style.borderColor = "#ff3366";
            }
        } else {
            setAuthMessage("🚨 ACCESS DENIED: System ID [" + rawUserInp + "] not registered!");
            if (usernameInput) usernameInput.style.borderColor = "#ff3366";
        }
    }).catch(e => {
        setAuthMessage("🚨 FAULT: Database connection error (" + e.message + ")");
    });
}

// 2. EMAIL & PASSWORD LOGIN (LINKED TO USER PROFILE)
async function handleEmailPasswordLogin() {
    const email = document.getElementById('login-email')?.value.trim();
    const pass = document.getElementById('login-email-password')?.value;

    if (!email || !pass) {
        setAuthMessage("🚨 ACCESS DENIED: Email and Passcode required!");
        return;
    }

    setAuthMessage("Locating Linked Node...");

    try {
        const matched = await findExistingUserNode({ email });
        if (matched) {
            if (matched.isLocked === true || matched.isLocked === "true") {
                setAuthMessage("🔒 ACCESS LOCKED: Your Node has been restricted by Admin!");
                return;
            }
            if (String(matched.password).trim() === String(pass).trim()) {
                currentUser = matched;
                sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
                setAuthMessage("");
                launchAppForUser();
                return;
            } else {
                setAuthMessage("🚨 ACCESS DENIED: Invalid Passcode for this account!");
                return;
            }
        }

        // Account does not exist
        setAuthMessage("🚨 ACCESS DENIED: No account linked to this Email. Get Pass first!");
    } catch (e) {
        setAuthMessage("🚨 AUTH ERROR: " + e.message);
    }
}

// 3. PHONE NUMBER & PASSWORD LOGIN (ZERO COST - NO OTP REQUIRED)
async function handlePhonePasswordLogin() {
    let phoneNum = document.getElementById('login-phone')?.value.trim();
    let passInp = document.getElementById('login-phone-password')?.value || document.getElementById('login-password')?.value;

    if (!phoneNum) {
        setAuthMessage("🚨 Please enter your registered mobile number!");
        return;
    }

    const digitsOnly = phoneNum.replace(/[^0-9]/g, '').slice(-10);
    if (digitsOnly.length !== 10) {
        setAuthMessage("🚨 Invalid Phone: Enter 10-digit Indian number!");
        return;
    }

    if (!passInp) {
        passInp = prompt("Enter your Account Passcode/Password:");
        if (!passInp) {
            setAuthMessage("🚨 Passcode is required to login via phone!");
            return;
        }
    }

    setAuthMessage("Authenticating Mobile Node...");

    try {
        const matched = await findExistingUserNode({ phone: digitsOnly });
        if (matched) {
            if (matched.isLocked === true || matched.isLocked === "true") {
                setAuthMessage("🔒 ACCESS LOCKED: Your Node has been restricted by Admin!");
                return;
            }

            if (String(matched.password).trim() === String(passInp).trim()) {
                currentUser = matched;
                sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
                setAuthMessage("");
                launchAppForUser();
                return;
            } else {
                setAuthMessage("🚨 ACCESS DENIED: Incorrect Passcode for this mobile number!");
                return;
            }
        } else {
            setAuthMessage("🚨 Mobile Number not registered with any profile!");
        }
    } catch (e) {
        setAuthMessage("🚨 ERROR: " + e.message);
    }
}

// 4. GOOGLE SIGN-IN (UNIFIED SYNC)
async function handleGoogleSignIn() {
    setAuthMessage("Connecting Google Node...");

    if (window.location.protocol === 'file:') {
        alert("Google Sign-In requires http:// or https:// protocol (Live Server).");
        setAuthMessage("⚠️ Error: Run via Web Server!");
        return;
    }

    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        if (!user) return;

        const matched = await findExistingUserNode({ email: user.email });

        if (matched) {
            if (matched.isLocked === true || matched.isLocked === "true") {
                setAuthMessage("🔒 ACCESS LOCKED: Your Node has been restricted by Admin!");
                auth.signOut();
                return;
            }

            currentUser = {
                ...matched,
                email: user.email,
                profileImg: matched.profileImg || user.photoURL || DEFAULT_AVATAR
            };

            await database.ref('users/' + matched.username).update({
                email: currentUser.email,
                profileImg: currentUser.profileImg
            });

            sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
            setAuthMessage("");
            launchAppForUser();
            return;
        }

        setAuthMessage("🚨 No existing account found for this Google ID. Please acquire a Pass first!");
        auth.signOut();
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            setAuthMessage("⚠️ Google sign-in cancelled.");
        } else {
            setAuthMessage("🚨 GOOGLE AUTH ERROR: " + error.message);
        }
    }
}

// ----------------------------------------------------
// UNIVERSAL FORGET PASSWORD (USERNAME, EMAIL, PHONE)
// ----------------------------------------------------
async function handleForgetPassword() {
    const rawIdentifier = document.getElementById('forget-username')?.value.trim();
    const security = document.getElementById('forget-security')?.value.trim().toLowerCase();
    const newPass = document.getElementById('forget-new-password')?.value;
    const succ = document.getElementById('auth-success');

    if (!rawIdentifier || !security || !newPass) {
        setAuthMessage("🚨 FAULT: Please enter Identifier (System ID/Email/Phone), Security Key & New Passcode.");
        return;
    }

    setAuthMessage("Locating Account Record...");

    try {
        const matched = await findExistingUserNode({ anyIdentifier: rawIdentifier });

        if (matched) {
            if (matched.securityAnswer?.toLowerCase() === security) {
                await database.ref('users/' + matched.username + '/password').set(newPass);
                setAuthMessage("🟢 PASSCODE RESET SUCCESSFUL! Please Login.", true);
                if (succ) succ.innerText = "🟢 PASSCODE UPDATED!";
                setTimeout(() => {
                    hideForgetPassword();
                    setAuthMessage("");
                    if (succ) succ.innerText = "";
                }, 1500);
                return;
            } else {
                setAuthMessage("🚨 ACCESS DENIED: Security Key Signature Invalid!");
                return;
            }
        }

        setAuthMessage("🚨 Account not found matching entered System ID, Email, or Phone!");
    } catch (e) {
        setAuthMessage("🚨 ERROR: " + e.message);
    }
}

function launchAppForUser() {
    document.getElementById('auth-screen')?.classList.add('hidden');
    if (currentUser.role === 'admin') {
        document.getElementById('admin-screen')?.classList.remove('hidden');
        listenToLiveDatabase();
        listenToUserProfiles();
        listenToSupportTicketsAdmin();
    } else {
        document.getElementById('user-screen')?.classList.remove('hidden');
        renderUserProfileData();
        initSignatureEngine();
        bindUserFilterEvents();
        listenToUserRecords();
    }
}

// ----------------------------------------------------
// USER LEDGER: DATA ISOLATION
// ----------------------------------------------------
function bindUserFilterEvents() {
    const ySel = document.getElementById('user-filter-year');
    const mSel = document.getElementById('user-filter-month');
    const dInp = document.getElementById('user-filter-date');
    const sInp = document.getElementById('user-search-input');

    if (ySel) ySel.onchange = renderUserLedger;
    if (mSel) mSel.onchange = renderUserLedger;
    if (dInp) dInp.onchange = renderUserLedger;
    if (sInp) sInp.oninput = renderUserLedger;
}

function listenToUserRecords() {
    database.ref('savingRecords').on('value', () => {
        renderUserLedger();
    });
}

function populateUserVIPYearDropdown(records) {
    const yearSelect = document.getElementById('user-filter-year');
    if (!yearSelect) return;
    const currentVal = yearSelect.value;
    const yearsSet = new Set();

    records.forEach(r => {
        const parsed = parseRecordDate(r.timestamp);
        if (parsed) yearsSet.add(parsed.getFullYear());
    });

    yearSelect.innerHTML = '<option value="ALL">All Years</option>';
    Array.from(yearsSet).sort((a, b) => b - a).forEach(year => {
        const opt = document.createElement('option');
        opt.value = year; opt.innerText = year;
        yearSelect.appendChild(opt);
    });

    if (Array.from(yearsSet).map(String).includes(currentVal)) yearSelect.value = currentVal;
}

function resetUserVIPFilters() {
    if (document.getElementById('user-filter-year')) document.getElementById('user-filter-year').value = 'ALL';
    if (document.getElementById('user-filter-month')) document.getElementById('user-filter-month').value = 'ALL';
    if (document.getElementById('user-filter-date')) document.getElementById('user-filter-date').value = '';
    const sInp = document.getElementById('user-search-input');
    if (sInp) sInp.value = '';
    renderUserLedger();
}

function renderUserLedger() {
    const searchQuery = document.getElementById('user-search-input')?.value.toLowerCase().trim() || "";
    const selectedYear = document.getElementById('user-filter-year')?.value || 'ALL';
    const selectedMonth = document.getElementById('user-filter-month')?.value || 'ALL';
    const selectedDate = document.getElementById('user-filter-date')?.value || '';

    const tbody = document.getElementById('user-records-body');
    const userTotalSavingsText = document.getElementById('user-total-savings');
    const userTotalEntriesText = document.getElementById('user-total-entries');
    
    if (!tbody || !currentUser) return;

    database.ref('savingRecords').once('value').then(snapshot => {
        let personalTotalAmount = 0;
        let personalTotalCount = 0;
        currentUserRecordsCache = [];
        let rawUserRecords = [];

        const myUName = (currentUser.username || '').toLowerCase();
        const myName = (currentUser.name || '').toLowerCase();

        snapshot.forEach(childSnapshot => {
            const item = childSnapshot.val();
            item._key = childSnapshot.key;
            
            const rUid = (item.userId || '').toLowerCase();
            const rUname = (item.username || '').toLowerCase();

            if (rUid === myUName || rUname === myUName || (myName && rUname === myName)) {
                rawUserRecords.push(item);
            }
        });

        rawUserRecords.sort((a, b) => {
            const da = parseRecordDate(a.timestamp);
            const db = parseRecordDate(b.timestamp);
            return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
        });

        const permissions = getResolvedPermissions(currentUser);
        if (permissions.canViewTable) {
            populateUserVIPYearDropdown(rawUserRecords);
        }

        tbody.innerHTML = "";

        rawUserRecords.forEach(item => {
            const key = item._key;
            const dateObj = parseRecordDate(item.timestamp);
            const timeOnly = formatIndianTime(dateObj);
            const dateOnly = formatIndianDate(dateObj);

            if ((selectedYear !== 'ALL' || (selectedMonth !== 'ALL' && selectedMonth !== 'All Months') || selectedDate) && !dateObj) {
                return;
            }

            if (dateObj) {
                if (selectedYear !== 'ALL' && dateObj.getFullYear() !== parseInt(selectedYear, 10)) return;
                if (!matchMonthIndex(selectedMonth, dateObj.getMonth())) return;
                if (selectedDate) {
                    const parts = selectedDate.split('-');
                    if (parts.length === 3) {
                        const selY = parseInt(parts[0], 10);
                        const selM = parseInt(parts[1], 10) - 1;
                        const selD = parseInt(parts[2], 10);
                        if (
                            dateObj.getFullYear() !== selY ||
                            dateObj.getMonth() !== selM ||
                            dateObj.getDate() !== selD
                        ) return;
                    }
                }
            }

            if (searchQuery) {
                const matchTime = timeOnly.toLowerCase().includes(searchQuery) || dateOnly.toLowerCase().includes(searchQuery);
                const matchAmt = String(item.amount).includes(searchQuery);
                if (!matchTime && !matchAmt) return;
            }

            personalTotalAmount += (parseFloat(item.amount) || 0);
            personalTotalCount++;
            currentUserRecordsCache.push(item);

            const tr = document.createElement('tr');
            const isRequested = item.deleteRequested === true;

            tr.innerHTML = `
                <td>${timeOnly}</td>
                <td>${dateOnly}</td>
                <td class="txt-green" style="font-weight:bold;">₹${(item.amount || 0).toLocaleString('en-IN')}</td>
                <td><span style="color:${isRequested ? '#ffaa00' : '#00ff66'};">${isRequested ? '// REQ DELETION' : '// SECURED'}</span></td>
                <td>
                    ${isRequested 
                        ? '<span style="color:#ffaa00; font-size:11px;">Request Pending</span>' 
                        : `<button type="button" class="btn-table-req" onclick="requestDeleteEntry('${key}')">Request Delete</button>`}
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (userTotalSavingsText) userTotalSavingsText.innerText = personalTotalAmount.toLocaleString('en-IN');
        if (userTotalEntriesText) userTotalEntriesText.innerText = personalTotalCount;

        updateUserTargetProgressUI();

        if (permissions.canViewCharts) {
            renderUserVIPAnalytics(currentUserRecordsCache);
        }
    });
}

function renderUserVIPAnalytics(records) {
    const chartCanvas = document.getElementById('user-vip-chart');
    if (!chartCanvas) return;

    const sorted = [...records].sort((a, b) => {
        const da = parseRecordDate(a.timestamp);
        const db = parseRecordDate(b.timestamp);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });

    const labels = sorted.map(r => {
        const d = parseRecordDate(r.timestamp);
        return d ? formatIndianDate(d) : 'N/A';
    });
    const dataPoints = sorted.map(r => parseFloat(r.amount) || 0);

    if (userAnalyticsChart) {
        userAnalyticsChart.data.labels = labels.length ? labels : ['No Data'];
        userAnalyticsChart.data.datasets[0].data = dataPoints.length ? dataPoints : [0];
        userAnalyticsChart.update('none');
        return;
    }

    const isDay = document.body.classList.contains('day-mode');
    const primaryColor = isDay ? '#d90466' : '#00f0ff';
    const gridColor = isDay ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';

    userAnalyticsChart = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Savings Deposit Trend (₹)',
                data: dataPoints.length ? dataPoints : [0],
                borderColor: primaryColor,
                backgroundColor: isDay ? 'rgba(217, 4, 102, 0.1)' : 'rgba(0, 240, 255, 0.15)',
                borderWidth: 2,
                pointBackgroundColor: primaryColor,
                pointBorderColor: '#ffffff',
                pointRadius: 4,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: isDay ? '#374151' : '#a1a1aa' } },
                y: { grid: { color: gridColor }, ticks: { color: isDay ? '#374151' : '#a1a1aa' } }
            },
            plugins: {
                legend: { labels: { color: isDay ? '#111827' : '#ffffff' } }
            }
        }
    });
}

function requestDeleteEntry(key) {
    if (confirm("Admin ko is entry ko delete karne ki request bhejein?")) {
        const updates = {};
        updates[`savingRecords/${key}/deleteRequested`] = true;
        updates[`users/${currentUser.username}/savingRecords/${key}/deleteRequested`] = true;

        database.ref().update(updates).then(() => {
            alert("Delete request admin panel par send ho gayi hai!");
            renderUserLedger();
        });
    }
}

function downloadUserFilteredData() {
    if (!currentUserRecordsCache || currentUserRecordsCache.length === 0) {
        alert("Aapka koi personal record download ke liye uplabdh nahi hai!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Time,Date,Amount,Status\r\n";

    currentUserRecordsCache.forEach(r => {
        const dateObj = parseRecordDate(r.timestamp);
        const row = [
            `"${formatIndianTime(dateObj)}"`,
            `"${formatIndianDate(dateObj)}"`,
            r.amount || 0,
            `"${r.status || 'SECURED'}"`
        ];
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VIP_Savings_${currentUser.username}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ----------------------------------------------------
// ADMIN ACTIONS & GRANULAR FEATURE PROVISIONING
// ----------------------------------------------------
function deleteRecordByAdmin(key) {
    if (confirm("⚠️ Permanently delete this entry?")) {
        database.ref('savingRecords/' + key).once('value').then(snapshot => {
            const record = snapshot.val();
            const updates = {};
            updates['savingRecords/' + key] = null;
            if (record && (record.userId || record.username)) {
                const uNode = record.userId || record.username;
                updates[`users/${uNode}/savingRecords/${key}`] = null;
            }

            database.ref().update(updates).then(() => {
                alert("Entry successfully deleted across database!");
            }).catch(err => {
                alert("Delete error: " + err.message);
            });
        });
    }
}

function handleAdminCreateUser() {
    const username = document.getElementById('signup-username')?.value.trim().toLowerCase();
    const name = document.getElementById('signup-name')?.value.trim();
    const email = document.getElementById('signup-email')?.value.trim();
    const phone = document.getElementById('signup-phone')?.value.trim();
    const dob = document.getElementById('signup-dob')?.value;
    const security = document.getElementById('signup-security')?.value.trim().toLowerCase();
    const password = document.getElementById('signup-password')?.value;
    const role = document.getElementById('signup-role')?.value || "user";
    const isLocked = document.getElementById('signup-is-locked')?.value === "true";
    const features = document.getElementById('signup-features-unlocked')?.value || "standard";
    
    const err = document.getElementById('admin-create-err');
    const succ = document.getElementById('admin-create-msg');
    if (err) err.innerText = "";
    if (succ) succ.innerText = "";

    if (!username || !name || !security) {
        if (err) err.innerText = "❌ ERROR: Username, Name and Security answer required!";
        return;
    }

    const customFeatureOverrides = {
        drawpad: document.getElementById('feat-toggle-drawpad').checked,
        imgupload: document.getElementById('feat-toggle-imgupload').checked,
        charts: document.getElementById('feat-toggle-charts').checked,
        table: document.getElementById('feat-toggle-table').checked,
        customtarget: document.getElementById('feat-toggle-customtarget').checked
    };

    const payload = {
        name,
        email,
        phone,
        dob,
        role,
        isLocked,
        unlockedFeatures: features,
        securityAnswer: security,
        customFeatureOverrides
    };
    if (password) payload.password = password;
    if (adminUploadedProfileBase64) payload.profileImg = adminUploadedProfileBase64;

    database.ref('users/' + username).update(payload).then(() => {
        if (succ) succ.innerText = `✅ ACCOUNT SAVED: [${name}] updated successfully!`;
        clearProfileForm();
    });
}

function editUserProfile(username) {
    database.ref('users/' + username).once('value').then(snapshot => {
        if (!snapshot.exists()) return;
        const user = snapshot.val();

        document.getElementById('signup-username').value = username;
        document.getElementById('signup-name').value = user.name || "";
        document.getElementById('signup-email').value = user.email || "";
        document.getElementById('signup-phone').value = user.phone || "";
        document.getElementById('signup-dob').value = user.dob || "";
        document.getElementById('signup-security').value = user.securityAnswer || "";
        document.getElementById('signup-password').value = user.password || "";
        document.getElementById('signup-role').value = user.role || "user";
        
        const lockSel = document.getElementById('signup-is-locked');
        if (lockSel) lockSel.value = String(user.isLocked || false);
        
        const featSel = document.getElementById('signup-features-unlocked');
        if (featSel) featSel.value = user.unlockedFeatures || "standard";

        const perms = getResolvedPermissions(user);
        document.getElementById('feat-toggle-drawpad').checked = perms.canDrawSign;
        document.getElementById('feat-toggle-imgupload').checked = perms.canUploadSign;
        document.getElementById('feat-toggle-charts').checked = perms.canViewCharts;
        document.getElementById('feat-toggle-table').checked = perms.canViewTable;
        document.getElementById('feat-toggle-customtarget').checked = perms.canSetCustomTarget;

        const previewImg = document.getElementById('admin-preview-img');
        const placeholder = document.getElementById('admin-preview-placeholder');

        if (user.profileImg) {
            adminUploadedProfileBase64 = user.profileImg;
            if (previewImg) previewImg.src = user.profileImg;
            previewImg?.classList.remove('hidden');
            placeholder?.classList.add('hidden');
        } else {
            adminUploadedProfileBase64 = null;
            if (previewImg) previewImg.src = "";
            previewImg?.classList.add('hidden');
            placeholder?.classList.remove('hidden');
        }

        const deck = document.getElementById('admin-user-provision-deck');
        if (deck) {
            deck.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

function clearProfileForm() {
    document.getElementById('signup-username').value = "";
    document.getElementById('signup-name').value = "";
    document.getElementById('signup-email').value = "";
    document.getElementById('signup-phone').value = "";
    document.getElementById('signup-dob').value = "";
    document.getElementById('signup-security').value = "";
    document.getElementById('signup-password').value = "";
    
    const lockSel = document.getElementById('signup-is-locked');
    if (lockSel) lockSel.value = "false";
    
    const featSel = document.getElementById('signup-features-unlocked');
    if (featSel) featSel.value = "standard";

    document.getElementById('feat-toggle-drawpad').checked = true;
    document.getElementById('feat-toggle-imgupload').checked = false;
    document.getElementById('feat-toggle-charts').checked = false;
    document.getElementById('feat-toggle-table').checked = false;
    document.getElementById('feat-toggle-customtarget').checked = false;
    
    adminUploadedProfileBase64 = null;
    const fileInp = document.getElementById('signup-profile-file');
    if (fileInp) fileInp.value = "";
    const previewImg = document.getElementById('admin-preview-img');
    const placeholder = document.getElementById('admin-preview-placeholder');
    if (previewImg) previewImg.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
}

function downloadFilteredData() {
    if (currentFilteredRecords.length === 0) {
        alert("Download karne ke liye koi records nahi mile!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Operator_ID,Operator_Name,Time,Date,Amount,Status,Delete_Requested\r\n";

    currentFilteredRecords.forEach(r => {
        const dateObj = parseRecordDate(r.timestamp);
        const row = [
            `"${r.userId || ''}"`,
            `"${r.username || ''}"`,
            `"${formatIndianTime(dateObj)}"`,
            `"${formatIndianDate(dateObj)}"`,
            r.amount || 0,
            `"${r.status || 'SECURED'}"`,
            r.deleteRequested ? "YES" : "NO"
        ];
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Vault_Records_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ----------------------------------------------------
// DAILY ENTRY SUBMISSION
// ----------------------------------------------------
function submitDailyEntry() {
    const amount = document.getElementById('saving-amount')?.value;
    const msg = document.getElementById('user-msg');

    if (!amount || amount <= 0) {
        alert("CRITICAL FAULT: Invalid monetary allocation credit!");
        return;
    }

    let finalSignature = null;
    if (currentSigMode === 'draw') {
        finalSignature = canvas.toDataURL();
    } else {
        if (!uploadedSignatureBase64) {
            alert("Please upload your signature image first!");
            return;
        }
        finalSignature = uploadedSignatureBase64;
    }
    
    const entry = {
        userId: currentUser.username,
        username: currentUser.name || currentUser.username,
        timestamp: new Date().toISOString(),
        amount: parseFloat(amount),
        status: "SECURED",
        signature: finalSignature,
        deleteRequested: false
    };

    const recordKey = database.ref('savingRecords').push().key;

    const atomicUpdates = {};
    atomicUpdates['savingRecords/' + recordKey] = entry;
    atomicUpdates[`users/${currentUser.username}/savingRecords/${recordKey}`] = entry;

    database.ref().update(atomicUpdates).then(() => {
        if (msg) msg.innerText = `🟢 SUCCESS: ₹${amount} saved & synced across cloud grid.`;
        const savInp = document.getElementById('saving-amount');
        if (savInp) savInp.value = "";
        clearSignature();
        uploadedSignatureBase64 = null;
        document.getElementById('sig-preview-wrapper')?.classList.add('hidden');
        const fileInp = document.getElementById('sig-file-input');
        if (fileInp) fileInp.value = "";
        setTimeout(() => { if (msg) msg.innerText = ""; }, 3000);
    }).catch(err => {
        alert("Sync Error: " + err.message);
    });
}

// ----------------------------------------------------
// ADMIN DASHBOARD RENDERING
// ----------------------------------------------------
function renderAdminDashboard(records) {
    const tbody = document.getElementById('records-body');
    const totalMoneyText = document.getElementById('total-pool-money');
    const totalEntriesText = document.getElementById('total-entries-count');
    const progressFill = document.getElementById('target-progress-fill');
    const progressTxt = document.getElementById('progress-percent-txt');
    
    if (!tbody) return;
    tbody.innerHTML = "";
    let totalMoney = 0;

    records.forEach(record => {
        totalMoney += (parseFloat(record.amount) || 0);
        const row = document.createElement('tr');
        const isDeleteReq = record.deleteRequested === true;
        const dateObj = parseRecordDate(record.timestamp);

        row.innerHTML = `
            <td><b>${record.username || record.userId || 'N/A'}</b></td>
            <td>${formatIndianTime(dateObj)}</td>
            <td>${formatIndianDate(dateObj)}</td>
            <td class="txt-blue" style="font-weight:bold;">₹${(record.amount || 0).toLocaleString('en-IN')}</td>
            <td><span style="color:${isDeleteReq ? '#ffaa00' : '#00ff66'};">// ${isDeleteReq ? 'REQ DELETION' : (record.status || 'SECURED')}</span></td>
            <td>${record.signature ? `<img src="${record.signature}" class="sig-img" alt="signature"/>` : '<span style="color:#6b7280;">NO SIGN</span>'}</td>
            <td>
                <button type="button" class="btn-table-del" onclick="deleteRecordByAdmin('${record._key}')">DELETE</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (totalMoneyText) totalMoneyText.innerText = totalMoney.toLocaleString('en-IN');
    if (totalEntriesText) totalEntriesText.innerText = records.length;

    const percent = Math.min(100, Math.round((totalMoney / currentAppTargetGoal) * 100));
    if (progressFill) progressFill.style.width = percent + "%";
    if (progressTxt) progressTxt.innerText = percent + "%";
}

// ----------------------------------------------------
// HELP & SUPPORT LIVE CHAT & TICKETING (VIEWPORT CENTERED)
// ----------------------------------------------------
function toggleSupportModal() {
    const modal = document.getElementById('support-modal');
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
        modal.classList.remove('hidden');
        // Ensure standard centered overlay in viewport without awkward jumps
        modal.style.position = "fixed";
        modal.style.top = "50%";
        modal.style.left = "50%";
        modal.style.transform = "translate(-50%, -50%)";
        modal.style.zIndex = "99999";
        listenToLiveSupportMessages();
    } else {
        modal.classList.add('hidden');
    }
}

function listenToLiveSupportMessages() {
    const chatStream = document.getElementById('support-chat-stream');
    if (!chatStream) return;

    database.ref('supportTickets').limitToLast(40).on('value', (snapshot) => {
        chatStream.innerHTML = "";
        snapshot.forEach((child) => {
            const msg = child.val();
            const isSelf = currentUser && (msg.username === currentUser.username || (currentUser.role === 'admin' && msg.senderRole === 'admin'));

            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${isSelf ? 'msg-self' : 'msg-peer'}`;
            
            const dateObj = parseRecordDate(msg.timestamp);
            const timeFormatted = `${formatIndianTime(dateObj)} | ${formatIndianDate(dateObj)}`;

            bubble.innerHTML = `
                <span class="chat-meta">${msg.username || 'Agent'} [${msg.senderRole || 'user'}] - ${timeFormatted}</span>
                <span>${msg.text}</span>
            `;
            chatStream.appendChild(bubble);
        });
        chatStream.scrollTop = chatStream.scrollHeight;
    });
}

function sendSupportMessage() {
    const input = document.getElementById('support-chat-input');
    const text = input?.value.trim();
    if (!text || !currentUser) return;

    const payload = {
        username: currentUser.username,
        name: currentUser.name || currentUser.username,
        senderRole: currentUser.role || 'user',
        text: text,
        timestamp: new Date().toISOString(),
        status: 'OPEN'
    };

    database.ref('supportTickets').push(payload).then(() => {
        if (input) input.value = "";
    });
}

function listenToSupportTicketsAdmin() {
    const tbody = document.getElementById('admin-support-tickets-body');
    if (!tbody) return;

    database.ref('supportTickets').on('value', (snapshot) => {
        tbody.innerHTML = "";
        snapshot.forEach((child) => {
            const ticket = child.val();
            const tKey = child.key;
            const dateObj = parseRecordDate(ticket.timestamp);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatIndianTime(dateObj)}</td>
                <td>${formatIndianDate(dateObj)}</td>
                <td><b class="txt-pink">${ticket.username}</b></td>
                <td>${ticket.text}</td>
                <td><span style="color:${ticket.status === 'RESOLVED' ? '#00ff66' : '#ffaa00'}; font-weight:bold;">${ticket.status || 'OPEN'}</span></td>
                <td>
                    <button class="btn-table-edit" onclick="replySupportTicket('${ticket.username}')">CHAT</button>
                    <button class="btn-table-del" onclick="database.ref('supportTickets/${tKey}').remove()">DISMISS</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

function replySupportTicket(username) {
    toggleSupportModal();
    const input = document.getElementById('support-chat-input');
    if (input) {
        input.value = `@${username}: `;
        input.focus();
    }
}

// ----------------------------------------------------
// LOGOUT
// ----------------------------------------------------
function logout() {
    currentUser = null;
    sessionStorage.removeItem('cybhacx_auth_user');
    auth.signOut().catch(() => {});
    
    const uInp = document.getElementById('login-username');
    const pInp = document.getElementById('login-password');
    const eInp = document.getElementById('login-email');
    const epInp = document.getElementById('login-email-password');
    const phInp = document.getElementById('login-phone');
    const phPassInp = document.getElementById('login-phone-password');

    if (uInp) { uInp.value = ""; uInp.style.borderColor = ""; }
    if (pInp) { pInp.value = ""; pInp.style.borderColor = ""; }
    if (eInp) eInp.value = "";
    if (epInp) epInp.value = "";
    if (phInp) phInp.value = "";
    if (phPassInp) phPassInp.value = "";

    document.getElementById('user-screen')?.classList.add('hidden');
    document.getElementById('admin-screen')?.classList.add('hidden');
    document.getElementById('auth-screen')?.classList.remove('hidden');

    const aErr = document.getElementById('admin-create-err');
    const aMsg = document.getElementById('admin-create-msg');
    if (aErr) aErr.innerText = "";
    if (aMsg) aMsg.innerText = "";
    setAuthMessage("");
}

// ----------------------------------------------------
// INITIAL LOAD & EVENTS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initThemeEngine();
    setupFuturisticEffects();

    const savedUserSession = sessionStorage.getItem('cybhacx_auth_user');
    if (savedUserSession) {
        try {
            currentUser = JSON.parse(savedUserSession);
            launchAppForUser();

            if (currentUser && currentUser.role !== 'admin') {
                database.ref('users/' + currentUser.username).on('value', snapshot => {
                    if (snapshot.exists()) {
                        const latestData = snapshot.val();
                        if (latestData.isLocked === true || latestData.isLocked === "true") {
                            logout();
                            alert("Your Node has been locked by administrator.");
                            return;
                        }
                        currentUser = { ...latestData, username: currentUser.username };
                        sessionStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
                        renderUserProfileData();
                    }
                });
            }
        } catch (e) {
            sessionStorage.removeItem('cybhacx_auth_user');
        }
    }

    const loginUser = document.getElementById('login-username');
    const loginPass = document.getElementById('login-password');

    if (loginUser) {
        loginUser.addEventListener('input', () => setAuthMessage(""));
        loginUser.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginPass?.focus();
            }
        });
    }

    if (loginPass) {
        loginPass.addEventListener('input', () => setAuthMessage(""));
        loginPass.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }

    const supportInput = document.getElementById('support-chat-input');
    if (supportInput) {
        supportInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendSupportMessage();
            }
        });
    }
});