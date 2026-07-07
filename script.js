// मास्टर डेटाबेस सिंक (प्रारंभिक डिफ़ॉल्ट क्रेडेंशियल्स)
let CRITICAL_DATABASE = JSON.parse(localStorage.getItem('cyberVaultUsers')) || {
    "admin": { password: "admin123", role: "admin", name: "System Overlord", securityAnswer: "admin" },
    "ravi": { password: "ravi123", role: "user", name: "Ravi Kumar", securityAnswer: "bullet" }
};

let savingRecords = JSON.parse(localStorage.getItem('savingRecords')) || [];
let currentUser = null;

// Signature Variable Nodes
const canvas = document.getElementById('sig-canvas');
const ctx = canvas?.getContext('2d');
let drawing = false;

// 1. FORGET SYSTEM MANAGEMENT
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

// 2. USER/ADMIN LOGIN LOGIC
function handleLogin() {
    const userInp = document.getElementById('login-username').value.trim().toLowerCase();
    const passInp = document.getElementById('login-password').value;
    const err = document.getElementById('auth-error');

    if (CRITICAL_DATABASE[userInp] && CRITICAL_DATABASE[userInp].password === passInp) {
        currentUser = CRITICAL_DATABASE[userInp];
        currentUser.username = userInp;
        err.innerText = "";
        
        document.getElementById('auth-screen').classList.add('hidden');
        if (currentUser.role === 'admin') {
            document.getElementById('admin-screen').classList.remove('hidden');
            renderAdminDashboard();
        } else {
            document.getElementById('user-screen').classList.remove('hidden');
            document.getElementById('user-display-name').innerText = currentUser.name;
            initSignatureEngine();
        }
    } else {
        err.innerText = "🚨 ACCESS DENIED: SECURE PROTOCOL BREACH!";
    }
}

// 3. ADMIN-EXCLUSIVE ACCOUNT CREATION LOGIC
function handleAdminCreateUser() {
    const username = document.getElementById('signup-username').value.trim().toLowerCase();
    const name = document.getElementById('signup-name').value.trim();
    const security = document.getElementById('signup-security').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    
    const err = document.getElementById('admin-create-err');
    const succ = document.getElementById('admin-create-msg');

    err.innerText = "";
    succ.innerText = "";

    if(!username || !name || !security || !password) {
        err.innerText = "❌ ERROR: All configuration modules must be filled!";
        return;
    }
    if(CRITICAL_DATABASE[username]) {
        err.innerText = "❌ ERROR: Identity signature already exists in core database!";
        return;
    }

    // Inject account settings directly inside current database pool
    CRITICAL_DATABASE[username] = { password, role, name, securityAnswer: security };
    localStorage.setItem('cyberVaultUsers', JSON.stringify(CRITICAL_DATABASE));

    succ.innerText = `✅ SUCCESS: Account for [${name}] initialized as ${role.toUpperCase()}!`;
    
    // Reset Form Fields
    document.getElementById('signup-username').value = "";
    document.getElementById('signup-name').value = "";
    document.getElementById('signup-security').value = "";
    document.getElementById('signup-password').value = "";
}

// 4. PASSWORD RECOVERY SYSTEM
function handleForgetPassword() {
    const username = document.getElementById('forget-username').value.trim().toLowerCase();
    const security = document.getElementById('forget-security').value.trim().toLowerCase();
    const newPass = document.getElementById('forget-new-password').value;
    const err = document.getElementById('auth-error');
    const succ = document.getElementById('auth-success');

    if(!username || !security || !newPass) {
        err.innerText = "🚨 FAULT: Recovery arrays incomplete.";
        return;
    }

    if(CRITICAL_DATABASE[username] && CRITICAL_DATABASE[username].securityAnswer === security) {
        CRITICAL_DATABASE[username].password = newPass;
        localStorage.setItem('cyberVaultUsers', JSON.stringify(CRITICAL_DATABASE));
        err.innerText = "";
        succ.innerText = "🟢 PASSCODE MODIFIED! RETURNING TO AUTH UNIT.";
        setTimeout(() => { hideForgetPassword(); succ.innerText = ""; }, 1500);
    } else {
        err.innerText = "🚨 CRITICAL BREACH: ANSWER MATRIX REJECTED!";
    }
}

// 5. SIGNATURE ENGINE (Canvas Canvas Drawing Handler)
function initSignatureEngine() {
    if (!canvas) return;
    ctx.strokeStyle = '#00ff66'; // Neon Green Canvas Pen Glow
    
    canvas.addEventListener('mousedown', () => drawing = true);
    canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
    canvas.addEventListener('mousemove', draw);

    // Mobile Systems
    canvas.addEventListener('touchstart', (e) => { drawing = true; e.preventDefault(); });
    canvas.addEventListener('touchend', () => { drawing = false; ctx.beginPath(); });
    canvas.addEventListener('touchmove', (e) => {
        if (!drawing) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    });
}

function draw(e) {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 6. TRANSACTION LOGGING SUBMISSION
function submitDailyEntry() {
    const amount = document.getElementById('saving-amount').value;
    const msg = document.getElementById('user-msg');

    if (!amount || amount <= 0) {
        alert("CRITICAL LOG FLUID: Enter valid monetary credits!");
        return;
    }

    const signatureImage = canvas.toDataURL();

    const entry = {
        username: currentUser.name,
        timestamp: new Date().toLocaleString(),
        amount: parseFloat(amount),
        status: "SECURED",
        signature: signatureImage
    };

    savingRecords.push(entry);
    localStorage.setItem('savingRecords', JSON.stringify(savingRecords));

    msg.innerText = `🟢 INJECTED: ₹${amount} logged under encrypted logs.`;
    document.getElementById('saving-amount').value = "";
    clearSignature();
    setTimeout(() => { msg.innerText = ""; }, 3000);
}

// 7. ADMIN RE-RENDERING LOOPS
function renderAdminDashboard() {
    const tbody = document.getElementById('records-body');
    const totalMoneyText = document.getElementById('total-pool-money');
    const totalEntriesText = document.getElementById('total-entries-count');
    
    tbody.innerHTML = "";
    let totalMoney = 0;

    savingRecords.forEach(record => {
        totalMoney += record.amount;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><b>${record.username}</b></td>
            <td>${record.timestamp}</td>
            <td class="txt-blue" style="font-weight:bold;">₹${record.amount}</td>
            <td><span style="color:#00ff66;">// ${record.status}</span></td>
            <td><img src="${record.signature}" class="sig-img" alt="signature"/></td>
        `;
        tbody.appendChild(row);
    });

    totalMoneyText.innerText = totalMoney.toLocaleString('en-IN');
    totalEntriesText.innerText = savingRecords.length;
}

// 8. LOGOUT SYSTEM
function logout() {
    currentUser = null;
    document.getElementById('login-username').value = "";
    document.getElementById('login-password').value = "";
    document.getElementById('user-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('admin-create-err').innerText = "";
    document.getElementById('admin-create-msg').innerText = "";
}