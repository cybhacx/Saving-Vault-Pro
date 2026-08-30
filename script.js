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

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// RAZORPAY CONFIGURATION (Apni Razorpay Key ID yahan paste karein)
const RAZORPAY_KEY_ID = "rzp_live_TW3Dh4C7B3KHW5"; // Replace with your Live or Test Key ID

let currentUser = null;
let allRecordsCache = [];
let currentFilteredRecords = [];
let uploadedProfileBase64 = null;
let adminUploadedProfileBase64 = null;
let currentSigMode = 'draw'; // 'draw' or 'upload'
let uploadedSignatureBase64 = null;
const TARGET_GOAL = 100000; // Target goal amount in ₹

// Default Avatar SVG
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%2300f0ff' viewBox='0 0 16 16'><path d='M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z'/></svg>";

// Signature Canvas Setup
const canvas = document.getElementById('sig-canvas');
const ctx = canvas?.getContext('2d');
let drawing = false;

// ----------------------------------------------------
// PAYMENT MODAL CONTROLLER & RAZORPAY CHECKOUT
// ----------------------------------------------------
function showPaymentModal() {
    document.getElementById('payment-modal').classList.remove('hidden');
    document.getElementById('payment-form-step').classList.remove('hidden');
    document.getElementById('payment-success-step').classList.add('hidden');
    document.getElementById('payment-err').innerText = "";
}

function hidePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
}

function initiateRazorpayPayment() {
    const name = document.getElementById('pay-name').value.trim();
    const email = document.getElementById('pay-email').value.trim();
    const phone = document.getElementById('pay-phone').value.trim();
    const username = document.getElementById('pay-username').value.trim().toLowerCase();
    const err = document.getElementById('payment-err');

    if (!name || !email || !phone || !username) {
        err.innerText = "❌ Please fill all details before proceeding to pay!";
        return;
    }
    err.innerText = "";

    // Razorpay Standard Checkout Options (Amount is in Paise: 10 INR = 1000 Paise)
    const options = {
        "key": RAZORPAY_KEY_ID,
        "amount": "1000",
        "currency": "INR",
        "name": "CYBHACX MONEY",
        "description": "Node Activation Pass (Lifetime)",
        "image": "https://img.icons8.com/neon/96/00f0ff/cyberpunk.png",
        "handler": function (response) {
            // Callback after payment completion
            handleSuccessfulPayment({
                paymentId: response.razorpay_payment_id,
                name: name,
                email: email,
                phone: phone,
                username: username,
                amount: 10,
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
        alert("Razorpay SDK not ready or Key missing: " + e.message);
    }
}

function handleSuccessfulPayment(paymentRecord) {
    // 1. Log Payment Entry to Firebase Database
    database.ref('paymentRequests').push(paymentRecord).then(() => {
        document.getElementById('conf-pay-id').innerText = paymentRecord.paymentId;
        document.getElementById('payment-form-step').classList.add('hidden');
        document.getElementById('payment-success-step').classList.remove('hidden');
    }).catch(err => {
        alert("Database error: " + err.message);
    });
}

// ----------------------------------------------------
// AUTO-INJECT NEON SMOKE & FLOATING PARTICLES ENGINE
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

    let width = (pCanvas.width = window.innerWidth);
    let height = (pCanvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
        width = pCanvas.width = window.innerWidth;
        height = pCanvas.height = window.innerHeight;
    });

    const colors = ['#00f0ff', '#ff007f', '#00ff66', '#b026ff'];
    const particles = [];
    const particleCount = Math.min(85, Math.floor((width * height) / 12000));

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2.2 + 0.8;
            this.speedX = (Math.random() - 0.5) * 0.75;
            this.speedY = (Math.random() - 0.5) * 0.75;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.alpha = Math.random() * 0.6 + 0.3;
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
            pCtx.save();
            pCtx.globalAlpha = this.alpha;
            pCtx.shadowBlur = 10;
            pCtx.shadowColor = this.color;
            pCtx.fillStyle = this.color;
            pCtx.beginPath();
            pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            pCtx.fill();
            pCtx.restore();
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

            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 110) {
                    pCtx.save();
                    pCtx.globalAlpha = (1 - dist / 110) * 0.18;
                    pCtx.strokeStyle = particles[i].color;
                    pCtx.lineWidth = 0.6;
                    pCtx.beginPath();
                    pCtx.moveTo(particles[i].x, particles[i].y);
                    pCtx.lineTo(particles[j].x, particles[j].y);
                    pCtx.stroke();
                    pCtx.restore();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}

// ----------------------------------------------------
// PASSWORD VISIBILITY TOGGLER
// ----------------------------------------------------
function togglePassVisibility(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btnElement.innerText = '🙈';
    } else {
        input.type = 'password';
        btnElement.innerText = '👁️';
    }
}

// ----------------------------------------------------
// DATE & TIME HELPERS (INDIAN FORMATTER)
// ----------------------------------------------------
function formatIndianDateTime(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return 'N/A';
    
    return dateObj.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

function parseRecordDate(timestampStr) {
    if (!timestampStr) return null;

    const cleanStr = String(timestampStr).trim();
    if (cleanStr.includes('T')) {
        const directDate = new Date(cleanStr);
        if (!isNaN(directDate.getTime())) return directDate;
    }

    const parts = cleanStr.split(/[\s,/:-]+/);
    if (parts.length >= 3) {
        let p1 = parseInt(parts[0], 10);
        let p2 = parseInt(parts[1], 10);
        let p3 = parseInt(parts[2], 10);

        let year, month, day;

        if (p1 > 1000) {
            year = p1;
            month = p2 - 1;
            day = p3;
        } else {
            year = p3 < 100 ? p3 + 2000 : p3;

            if (p1 > 12) {
                day = p1;
                month = p2 - 1;
            } else if (p2 > 12) {
                month = p1 - 1;
                day = p2;
            } else {
                if (p1 === 8 || p1 === 7) {
                    month = p1 - 1;
                    day = p2;
                } else {
                    day = p1;
                    month = p2 - 1;
                }
            }
        }

        let hours = 0;
        let minutes = 0;
        let seconds = 0;

        if (parts.length >= 5) {
            hours = parseInt(parts[3], 10) || 0;
            minutes = parseInt(parts[4], 10) || 0;
            seconds = parseInt(parts[5], 10) || 0;

            const isPM = /pm/i.test(cleanStr);
            const isAM = /am/i.test(cleanStr);

            if (isPM && hours < 12) hours += 12;
            if (isAM && hours === 12) hours = 0;
        }

        const parsed = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    const fallbackDate = new Date(cleanStr);
    return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

// ----------------------------------------------------
// USER PROFILE ENGINE
// ----------------------------------------------------
function renderUserProfileData() {
    if (!currentUser) return;

    document.getElementById('user-display-name').innerText = currentUser.name || 'Agent';
    document.getElementById('profile-card-name').innerText = currentUser.name || 'Agent';
    document.getElementById('profile-card-id').innerText = currentUser.username || 'NODE';
    document.getElementById('profile-card-email').innerText = currentUser.email || 'Not Set';
    document.getElementById('profile-card-phone').innerText = currentUser.phone || 'Not Set';
    document.getElementById('profile-card-dob').innerText = currentUser.dob || 'Not Set';
    document.getElementById('profile-card-role').innerText = currentUser.role?.toUpperCase() || 'STANDARD AGENT';

    const avatarImg = document.getElementById('user-profile-img');
    if (avatarImg) {
        avatarImg.src = currentUser.profileImg || DEFAULT_AVATAR;
    }
}

function toggleEditProfileDeck() {
    const deck = document.getElementById('edit-profile-deck');
    if (!deck) return;

    const isHidden = deck.classList.contains('hidden');
    if (isHidden) {
        document.getElementById('edit-profile-name').value = currentUser.name || '';
        document.getElementById('edit-profile-email').value = currentUser.email || '';
        document.getElementById('edit-profile-phone').value = currentUser.phone || '';
        document.getElementById('edit-profile-dob').value = currentUser.dob || '';
        uploadedProfileBase64 = null;
        document.getElementById('profile-save-msg').innerText = '';
        deck.classList.remove('hidden');
    } else {
        deck.classList.add('hidden');
    }
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        uploadedProfileBase64 = event.target.result;
    };
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

    const name = document.getElementById('edit-profile-name').value.trim();
    const email = document.getElementById('edit-profile-email').value.trim();
    const phone = document.getElementById('edit-profile-phone').value.trim();
    const dob = document.getElementById('edit-profile-dob').value;
    const msg = document.getElementById('profile-save-msg');

    if (!name) {
        alert("Full name cannot be empty!");
        return;
    }

    const updates = {
        name: name,
        email: email,
        phone: phone,
        dob: dob
    };

    if (uploadedProfileBase64) {
        updates.profileImg = uploadedProfileBase64;
    }

    database.ref('users/' + currentUser.username).update(updates).then(() => {
        currentUser = { ...currentUser, ...updates };
        localStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
        renderUserProfileData();
        msg.innerText = "🟢 PROFILE MATRIX UPDATED SUCCESSFULLY!";
        setTimeout(() => {
            toggleEditProfileDeck();
            msg.innerText = "";
        }, 1200);
    }).catch(err => {
        alert("Update Error: " + err.message);
    });
}

// ----------------------------------------------------
// SIGNATURE ENGINE
// ----------------------------------------------------
function switchSignatureMode(mode) {
    currentSigMode = mode;
    const drawBtn = document.getElementById('btn-mode-draw');
    const uploadBtn = document.getElementById('btn-mode-upload');
    const drawContainer = document.getElementById('sig-draw-container');
    const uploadContainer = document.getElementById('sig-upload-container');

    if (mode === 'draw') {
        drawBtn.classList.add('active');
        uploadBtn.classList.remove('active');
        drawContainer.classList.remove('hidden');
        uploadContainer.classList.add('hidden');
    } else {
        uploadBtn.classList.add('active');
        drawBtn.classList.remove('active');
        uploadContainer.classList.remove('hidden');
        drawContainer.classList.add('hidden');
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
                const brightness = (r + g + b) / 3;

                if (brightness > 180) {
                    data[i + 3] = 0;
                } else {
                    data[i] = 0;
                    data[i + 1] = 240;
                    data[i + 2] = 255;
                    data[i + 3] = 255;
                }
            }

            tempCtx.putImageData(imgData, 0, 0);
            uploadedSignatureBase64 = tempCanvas.toDataURL();

            const previewImg = document.getElementById('sig-preview-img');
            const previewWrapper = document.getElementById('sig-preview-wrapper');
            previewImg.src = uploadedSignatureBase64;
            previewWrapper.classList.remove('hidden');
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

    canvas.addEventListener('touchstart', (e) => { drawing = true; e.preventDefault(); });
    canvas.addEventListener('touchend', () => { drawing = false; ctx.beginPath(); });
    canvas.addEventListener('touchmove', (e) => {
        if (!drawing) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
        ctx.stroke(); ctx.beginPath();
        ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    });
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
    if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ----------------------------------------------------
// REALTIME LISTENERS & QUEUE
// ----------------------------------------------------
function listenToLiveDatabase() {
    database.ref('savingRecords').on('value', (snapshot) => {
        allRecordsCache = [];
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            data._key = childSnapshot.key;
            allRecordsCache.push(data);
        });
        populateFilterDropdowns(allRecordsCache);
        applyMatrixFilters();
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
                <td><span class="${user.role === 'admin' ? 'txt-pink' : 'txt-green'}">${user.role?.toUpperCase()}</span></td>
                <td>${user.securityAnswer || 'N/A'}</td>
                <td>
                    <button class="btn-table-edit" onclick="editUserProfile('${uId}')">EDIT</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    // Listen to Payment Requests Queue in Admin Panel
    database.ref('paymentRequests').on('value', (snapshot) => {
        const tbody = document.getElementById('admin-payments-body');
        if (!tbody) return;
        tbody.innerHTML = "";

        snapshot.forEach((childSnapshot) => {
            const req = childSnapshot.val();
            const reqKey = childSnapshot.key;
            const dateObj = parseRecordDate(req.timestamp);
            const displayTime = formatIndianDateTime(dateObj);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${displayTime}</td>
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

function prefillUserProvisioning(username, name, email, phone) {
    document.getElementById('signup-username').value = username;
    document.getElementById('signup-name').value = name;
    document.getElementById('signup-email').value = email;
    document.getElementById('signup-phone').value = phone;
    window.scrollTo({ top: 450, behavior: 'smooth' });
}

// ----------------------------------------------------
// MATRIX FILTERS
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
        if (r.username) usersSet.add(r.username);
        const parsed = parseRecordDate(r.timestamp);
        if (parsed) yearsSet.add(parsed.getFullYear());
    });

    userSelect.innerHTML = '<option value="ALL">All Operators</option>';
    Array.from(usersSet).sort().forEach(user => {
        const opt = document.createElement('option');
        opt.value = user;
        opt.innerText = user;
        userSelect.appendChild(opt);
    });

    yearSelect.innerHTML = '<option value="ALL">All Years</option>';
    Array.from(yearsSet).sort((a, b) => b - a).forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.innerText = year;
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
        if (selectedUser !== 'ALL' && record.username !== selectedUser) return false;

        const dateObj = parseRecordDate(record.timestamp);
        if (dateObj) {
            if (selectedYear !== 'ALL' && dateObj.getFullYear() !== parseInt(selectedYear, 10)) return false;
            if (selectedMonth !== 'ALL' && dateObj.getMonth() !== parseInt(selectedMonth, 10)) return false;
            if (selectedDate) {
                const pickerDate = new Date(selectedDate);
                if (
                    dateObj.getFullYear() !== pickerDate.getFullYear() ||
                    dateObj.getMonth() !== pickerDate.getMonth() ||
                    dateObj.getDate() !== pickerDate.getDate()
                ) return false;
            }
        }

        if (searchQuery) {
            const formattedTime = formatIndianDateTime(dateObj).toLowerCase();
            const matchesUser = record.username?.toLowerCase().includes(searchQuery);
            const matchesAmt = String(record.amount).includes(searchQuery);
            const matchesTime = record.timestamp?.toLowerCase().includes(searchQuery) || formattedTime.includes(searchQuery);
            const matchesStatus = record.status?.toLowerCase().includes(searchQuery);
            if (!matchesUser && !matchesAmt && !matchesTime && !matchesStatus) return false;
        }

        return true;
    });

    renderAdminDashboard(currentFilteredRecords);
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
// AUTHENTICATION & SESSIONS
// ----------------------------------------------------
function showForgetPassword() {
    document.getElementById('login-form-group').classList.add('hidden');
    document.getElementById('forget-form-group').classList.remove('hidden');
    document.getElementById('auth-error').innerText = "";
}

function hideForgetPassword() {
    document.getElementById('forget-form-group').classList.add('hidden');
    document.getElementById('login-form-group').classList.remove('hidden');
    document.getElementById('auth-error').innerText = "";
}

function handleLogin() {
    const userInp = document.getElementById('login-username').value.trim().toLowerCase();
    const passInp = document.getElementById('login-password').value;
    const err = document.getElementById('auth-error');

    if (!userInp || !passInp) {
        err.innerText = "🚨 ACCESS DENIED: Empty Matrix Loops!";
        return;
    }

    database.ref('users/' + userInp).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.password === passInp) {
                currentUser = userData;
                currentUser.username = userInp;
                err.innerText = "";
                localStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
                launchAppForUser();
            } else {
                err.innerText = "🚨 ACCESS DENIED: PASSCODE INVALID!";
            }
        } else {
            if (userInp === 'cybhacx' && passInp === 'cybhacx@#Ravi') {
                currentUser = { password: "cybhacx@#Ravi", role: "admin", name: "ADMIN CYBHACX", username: "cybhacx" };
                localStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
                launchAppForUser();
            } else {
                err.innerText = "🚨 ACCESS DENIED: NODE IDENTITY NOT DEPLOYED!";
            }
        }
    }).catch(e => {
        err.innerText = "🚨 FAULT: Database connection error!";
        console.error(e);
    });
}

function launchAppForUser() {
    document.getElementById('auth-screen').classList.add('hidden');
    if (currentUser.role === 'admin') {
        document.getElementById('admin-screen').classList.remove('hidden');
        listenToLiveDatabase();
        listenToUserProfiles();
    } else {
        document.getElementById('user-screen').classList.remove('hidden');
        renderUserProfileData();
        initSignatureEngine();
        listenToUserRecords();
    }
}

// ----------------------------------------------------
// USER SPECIFIC ACTIONS
// ----------------------------------------------------
function listenToUserRecords() {
    database.ref('savingRecords').on('value', () => {
        renderUserLedger();
    });
}

function renderUserLedger() {
    const searchQuery = document.getElementById('user-search-input')?.value.toLowerCase().trim() || "";
    const tbody = document.getElementById('user-records-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    database.ref('savingRecords').once('value').then(snapshot => {
        snapshot.forEach(childSnapshot => {
            const item = childSnapshot.val();
            const key = childSnapshot.key;

            if (item.username === currentUser.name) {
                const dateObj = parseRecordDate(item.timestamp);
                const displayTime = formatIndianDateTime(dateObj);

                if (searchQuery) {
                    const matchTime = item.timestamp?.toLowerCase().includes(searchQuery) || displayTime.toLowerCase().includes(searchQuery);
                    const matchAmt = String(item.amount).includes(searchQuery);
                    if (!matchTime && !matchAmt) return;
                }

                const tr = document.createElement('tr');
                const isRequested = item.deleteRequested === true;

                tr.innerHTML = `
                    <td>${displayTime}</td>
                    <td class="txt-green" style="font-weight:bold;">₹${(item.amount || 0).toLocaleString('en-IN')}</td>
                    <td><span style="color:${isRequested ? '#ffaa00' : '#00ff66'};">${isRequested ? '// REQ DELETION' : '// SECURED'}</span></td>
                    <td>
                        ${isRequested 
                            ? '<span style="color:#ffaa00; font-size:11px;">Request Pending</span>' 
                            : `<button class="btn-table-req" onclick="requestDeleteEntry('${key}')">Request Delete</button>`}
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
    });
}

function requestDeleteEntry(key) {
    if (confirm("Admin ko is entry ko delete karne ki request bhejein?")) {
        database.ref('savingRecords/' + key).update({
            deleteRequested: true
        }).then(() => {
            alert("Delete request admin panel par send ho gayi hai!");
            renderUserLedger();
        });
    }
}

// ----------------------------------------------------
// ADMIN CONTROLS
// ----------------------------------------------------
function deleteRecordByAdmin(key) {
    if (confirm("⚠️ Kya aap sach me is entry ko database se permanently DELETE karna chahte hain?")) {
        database.ref('savingRecords/' + key).remove().then(() => {
            alert("Entry successfully delete ho gayi!");
        }).catch(err => {
            alert("Delete error: " + err.message);
        });
    }
}

function handleAdminCreateUser() {
    const username = document.getElementById('signup-username').value.trim().toLowerCase();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const dob = document.getElementById('signup-dob').value;
    const security = document.getElementById('signup-security').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    
    const err = document.getElementById('admin-create-err');
    const succ = document.getElementById('admin-create-msg');
    err.innerText = ""; succ.innerText = "";

    if (!username || !name || !security) {
        err.innerText = "❌ ERROR: Username, Name and Security answer required!";
        return;
    }

    const payload = {
        name: name,
        email: email,
        phone: phone,
        dob: dob,
        role: role,
        securityAnswer: security
    };
    if (password) payload.password = password;
    if (adminUploadedProfileBase64) payload.profileImg = adminUploadedProfileBase64;

    database.ref('users/' + username).update(payload).then(() => {
        succ.innerText = `✅ ACCOUNT SAVED: [${name}] updated successfully!`;
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

        const previewImg = document.getElementById('admin-preview-img');
        const placeholder = document.getElementById('admin-preview-placeholder');

        if (user.profileImg) {
            adminUploadedProfileBase64 = user.profileImg;
            previewImg.src = user.profileImg;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            adminUploadedProfileBase64 = null;
            previewImg.src = "";
            previewImg.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }

        window.scrollTo({ top: 300, behavior: 'smooth' });
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
    csvContent += "Operator,Timestamp,Amount,Status,Delete_Requested\r\n";

    currentFilteredRecords.forEach(r => {
        const dateObj = parseRecordDate(r.timestamp);
        const displayTime = formatIndianDateTime(dateObj);
        const row = [
            `"${r.username || ''}"`,
            `"${displayTime}"`,
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
// FORGET PASSWORD
// ----------------------------------------------------
function handleForgetPassword() {
    const username = document.getElementById('forget-username').value.trim().toLowerCase();
    const security = document.getElementById('forget-security').value.trim().toLowerCase();
    const newPass = document.getElementById('forget-new-password').value;
    const err = document.getElementById('auth-error');
    const succ = document.getElementById('auth-success');

    if (!username || !security || !newPass) {
        err.innerText = "🚨 FAULT: Missing verification matrix fields.";
        return;
    }

    database.ref('users/' + username).once('value').then((snapshot) => {
        if (snapshot.exists() && snapshot.val().securityAnswer === security) {
            database.ref('users/' + username + '/password').set(newPass).then(() => {
                err.innerText = "";
                succ.innerText = "🟢 SYSTEM INJECT: PASSCODE MODIFIED!";
                setTimeout(() => { hideForgetPassword(); succ.innerText = ""; }, 1500);
            });
        } else {
            err.innerText = "🚨 CRITICAL BREACH: ANSWER SIGNATURE INVALID!";
        }
    });
}

// ----------------------------------------------------
// DAILY ENTRY SUBMISSION
// ----------------------------------------------------
function submitDailyEntry() {
    const amount = document.getElementById('saving-amount').value;
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
        username: currentUser.name,
        timestamp: new Date().toISOString(),
        amount: parseFloat(amount),
        status: "SECURED",
        signature: finalSignature,
        deleteRequested: false
    };

    database.ref('savingRecords').push(entry).then(() => {
        msg.innerText = `🟢 SUCCESS: ₹${amount} saved & synced across cloud grid.`;
        document.getElementById('saving-amount').value = "";
        clearSignature();
        uploadedSignatureBase64 = null;
        document.getElementById('sig-preview-wrapper')?.classList.add('hidden');
        const fileInp = document.getElementById('sig-file-input');
        if (fileInp) fileInp.value = "";
        setTimeout(() => { msg.innerText = ""; }, 3000);
    });
}

// ----------------------------------------------------
// ADMIN DASHBOARD
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
        const displayTime = formatIndianDateTime(dateObj);

        row.innerHTML = `
            <td><b>${record.username || 'N/A'}</b></td>
            <td>${displayTime}</td>
            <td class="txt-blue" style="font-weight:bold;">₹${(record.amount || 0).toLocaleString('en-IN')}</td>
            <td><span style="color:${isDeleteReq ? '#ffaa00' : '#00ff66'};">// ${isDeleteReq ? 'REQ DELETION' : (record.status || 'SECURED')}</span></td>
            <td>${record.signature ? `<img src="${record.signature}" class="sig-img" alt="signature"/>` : '<span style="color:#6b7280;">NO SIGN</span>'}</td>
            <td>
                <button class="btn-table-del" onclick="deleteRecordByAdmin('${record._key}')">DELETE</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (totalMoneyText) totalMoneyText.innerText = totalMoney.toLocaleString('en-IN');
    if (totalEntriesText) totalEntriesText.innerText = records.length;

    const percent = Math.min(100, Math.round((totalMoney / TARGET_GOAL) * 100));
    if (progressFill) progressFill.style.width = percent + "%";
    if (progressTxt) progressTxt.innerText = percent + "%";
}

// ----------------------------------------------------
// LOGOUT
// ----------------------------------------------------
function logout() {
    currentUser = null;
    localStorage.removeItem('cybhacx_auth_user');
    document.getElementById('login-username').value = "";
    document.getElementById('login-password').value = "";
    document.getElementById('user-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('admin-create-err').innerText = "";
    document.getElementById('admin-create-msg').innerText = "";
}

// ----------------------------------------------------
// INITIAL LOAD
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupFuturisticEffects();

    const savedUserSession = localStorage.getItem('cybhacx_auth_user');
    if (savedUserSession) {
        try {
            currentUser = JSON.parse(savedUserSession);
            database.ref('users/' + currentUser.username).once('value').then(snapshot => {
                if (snapshot.exists()) {
                    currentUser = { ...snapshot.val(), username: currentUser.username };
                    localStorage.setItem('cybhacx_auth_user', JSON.stringify(currentUser));
                }
                launchAppForUser();
            }).catch(() => {
                launchAppForUser();
            });
        } catch (e) {
            localStorage.removeItem('cybhacx_auth_user');
        }
    }

    const loginUser = document.getElementById('login-username');
    const loginPass = document.getElementById('login-password');

    if (loginUser) {
        loginUser.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginPass?.focus();
            }
        });
    }

    if (loginPass) {
        loginPass.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }
});