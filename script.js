// 1. FIREBASE MAIN ENCRYPTION CONFIGURATION MATRIX
const firebaseConfig = {
  apiKey: "AIzaSyD6A6Jn61-_fUD8FRjC2bbccYNpMIYw3Sk",
  authDomain: "saving-wallet-pro.firebaseapp.com",
  databaseURL: "https://saving-wallet-pro-default-rtdb.firebaseio.com",
  projectId: "saving-wallet-pro",
  storageBucket: "saving-wallet-pro.firebasestorage.app",
  messagingSenderId: "190574060583",
  appId: "1:190574060583:web:eee472df4a0c6be3aa5a02"
};

// Initialize Cloud Core Gateway
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentUser = null;

// Signature Variable Nodes
const canvas = document.getElementById('sig-canvas');
const ctx = canvas?.getContext('2d');
let drawing = false;

// Realtime Database Database Listener for Admin Table
function listenToLiveDatabase() {
    database.ref('savingRecords').on('value', (snapshot) => {
        const records = [];
        snapshot.forEach((childSnapshot) => {
            records.push(childSnapshot.val());
        });
        renderAdminDashboard(records);
    });
}

// 2. FORGET SYSTEM TOGGLES
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

// 3. USER/ADMIN CLOUD LOGIN SYSTEM
function handleLogin() {
    const userInp = document.getElementById('login-username').value.trim().toLowerCase();
    const passInp = document.getElementById('login-password').value;
    const err = document.getElementById('auth-error');

    if(!userInp || !passInp) {
        err.innerText = "🚨 ACCESS DENIED: Empty Matrix Loops!";
        return;
    }

    // Ping Firebase to fetch the secure identity profile
    database.ref('users/' + userInp).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.password === passInp) {
                currentUser = userData;
                currentUser.username = userInp;
                err.innerText = "";
                
                document.getElementById('auth-screen').classList.add('hidden');
                if (currentUser.role === 'admin') {
                    document.getElementById('admin-screen').classList.remove('hidden');
                    listenToLiveDatabase(); // Trigger Realtime Synchronization
                } else {
                    document.getElementById('user-screen').classList.remove('hidden');
                    document.getElementById('user-display-name').innerText = currentUser.name;
                    initSignatureEngine();
                }
            } else {
                err.innerText = "🚨 ACCESS DENIED: PASSCODE INVALID!";
            }
        } else {
            // First boot trigger (If cloud is empty, use master bypass to let you in)
            if(userInp === 'cybhacx' && passInp === 'cybhacx@#Ravi') {
                currentUser = { password: "cybhacx@#Ravi", role: "admin", name: "ADMIN CYBHACX" };
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('admin-screen').classList.remove('hidden');
                listenToLiveDatabase();
            } else {
                err.innerText = "🚨 ACCESS DENIED: NODE IDENTITY NOT DEPLOYED!";
            }
        }
    }).catch(e => {
        err.innerText = "🚨 FAULT: Connect Firebase Rules Framework!";
        console.error(e);
    });
}

// 4. ADMIN ONLY: CLOUD USER PROVISIONING
function handleAdminCreateUser() {
    const username = document.getElementById('signup-username').value.trim().toLowerCase();
    const name = document.getElementById('signup-name').value.trim();
    const security = document.getElementById('signup-security').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    
    const err = document.getElementById('admin-create-err');
    const succ = document.getElementById('admin-create-msg');

    err.innerText = ""; succ.innerText = "";

    if(!username || !name || !security || !password) {
        err.innerText = "❌ ERROR: Configuration modules incomplete!";
        return;
    }

    database.ref('users/' + username).once('value').then((snapshot) => {
        if(snapshot.exists()) {
            err.innerText = "❌ ERROR: Signature identifier already claimed!";
        } else {
            // Write payload data directly into cloud nodes
            database.ref('users/' + username).set({
                password: password,
                role: role,
                name: name,
                securityAnswer: security
            }).then(() => {
                succ.innerText = `✅ ACCOUNT DEPLOYED: [${name}] initialized successfully!`;
                document.getElementById('signup-username').value = "";
                document.getElementById('signup-name').value = "";
                document.getElementById('signup-security').value = "";
                document.getElementById('signup-password').value = "";
            });
        }
    });
}

// 5. SECURE CLOUD PASSWORD RECOVERY
function handleForgetPassword() {
    const username = document.getElementById('forget-username').value.trim().toLowerCase();
    const security = document.getElementById('forget-security').value.trim().toLowerCase();
    const newPass = document.getElementById('forget-new-password').value;
    const err = document.getElementById('auth-error');
    const succ = document.getElementById('auth-success');

    if(!username || !security || !newPass) {
        err.innerText = "🚨 FAULT: Missing verification matrix fields.";
        return;
    }

    database.ref('users/' + username).once('value').then((snapshot) => {
        if(snapshot.exists() && snapshot.val().securityAnswer === security) {
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

// 6. HARDWARE DIGITAL BIOMETRIC SIGN-PAD
function initSignatureEngine() {
    if (!canvas) return;
    ctx.strokeStyle = '#00ff66'; // Glowing Green Pen
    
    canvas.addEventListener('mousedown', () => drawing = true);
    canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
    canvas.addEventListener('mousemove', draw);

    // Mobile Ecosystem Compatibility
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

function clearSignature() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

// 7. TRANSACTION PROCESSING GATEWAY
function submitDailyEntry() {
    const amount = document.getElementById('saving-amount').value;
    const msg = document.getElementById('user-msg');

    if (!amount || amount <= 0) {
        alert("CRITICAL FAULT: Invalid monetary allocation credit!");
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

    // Push secure JSON mapping node to Cloud Mainframe
    database.ref('savingRecords').push(entry).then(() => {
        msg.innerText = `🟢 SUCCESS: ₹${amount} saved & synced across cloud grid.`;
        document.getElementById('saving-amount').value = "";
        clearSignature();
        setTimeout(() => { msg.innerText = ""; }, 3000);
    });
}

// 8. REALTIME LIVE RE-RENDERING LOOPS
function renderAdminDashboard(records) {
    const tbody = document.getElementById('records-body');
    const totalMoneyText = document.getElementById('total-pool-money');
    const totalEntriesText = document.getElementById('total-entries-count');
    
    tbody.innerHTML = "";
    let totalMoney = 0;

    records.forEach(record => {
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
    totalEntriesText.innerText = records.length;
}

// 9. SYSTEM HANDSHAKE TERMINATION
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