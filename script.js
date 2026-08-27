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

let currentUser = null;
let allRecordsCache = [];
let currentFilteredRecords = [];
const TARGET_GOAL = 100000; // Target goal amount in ₹

// Signature Setup
const canvas = document.getElementById('sig-canvas');
const ctx = canvas?.getContext('2d');
let drawing = false;

// 2. REALTIME LISTENERS
function listenToLiveDatabase() {
    database.ref('savingRecords').on('value', (snapshot) => {
        allRecordsCache = [];
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            data._key = childSnapshot.key; // Store key for deleting
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
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${uId}</b></td>
                <td>${user.name || 'N/A'}</td>
                <td><span class="${user.role === 'admin' ? 'txt-pink' : 'txt-green'}">${user.role?.toUpperCase()}</span></td>
                <td>${user.securityAnswer || 'N/A'}</td>
                <td>
                    <button class="btn-table-edit" onclick="editUserProfile('${uId}', '${user.name || ''}', '${user.securityAnswer || ''}', '${user.role || 'user'}')">EDIT</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// 3. MATRIX FILTERS & SEARCH
function populateFilterDropdowns(records) {
    const userSelect = document.getElementById('filter-user');
    const yearSelect = document.getElementById('filter-year');

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

function parseRecordDate(timestampStr) {
    if (!timestampStr) return null;
    const directDate = new Date(timestampStr);
    if (!isNaN(directDate.getTime())) return directDate;

    const parts = timestampStr.split(/[\s,/:-]+/);
    if (parts.length >= 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const parsed = new Date(y, m, d);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
}

function applyMatrixFilters() {
    const selectedUser = document.getElementById('filter-user').value;
    const selectedYear = document.getElementById('filter-year').value;
    const selectedMonth = document.getElementById('filter-month').value;
    const selectedDate = document.getElementById('filter-date').value;
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
            const matchesUser = record.username?.toLowerCase().includes(searchQuery);
            const matchesAmt = String(record.amount).includes(searchQuery);
            const matchesTime = record.timestamp?.toLowerCase().includes(searchQuery);
            const matchesStatus = record.status?.toLowerCase().includes(searchQuery);
            if (!matchesUser && !matchesAmt && !matchesTime && !matchesStatus) return false;
        }

        return true;
    });

    renderAdminDashboard(currentFilteredRecords);
}

function resetFilters() {
    document.getElementById('filter-user').value = 'ALL';
    document.getElementById('filter-year').value = 'ALL';
    document.getElementById('filter-month').value = 'ALL';
    document.getElementById('filter-date').value = '';
    const adminSearch = document.getElementById('admin-search-input');
    if (adminSearch) adminSearch.value = '';
    applyMatrixFilters();
}

// 4. AUTHENTICATION & SESSIONS
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

    if(!userInp || !passInp) {
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
                launchAppForUser();
            } else {
                err.innerText = "🚨 ACCESS DENIED: PASSCODE INVALID!";
            }
        } else {
            if(userInp === 'cybhacx' && passInp === 'cybhacx@#Ravi') {
                currentUser = { password: "cybhacx@#Ravi", role: "admin", name: "ADMIN CYBHACX", username: "cybhacx" };
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
        document.getElementById('user-display-name').innerText = currentUser.name;
        initSignatureEngine();
        listenToUserRecords();
    }
}

// 5. USER SPECIFIC ACTIONS & DELETE REQUEST
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
                if (searchQuery) {
                    const matchTime = item.timestamp?.toLowerCase().includes(searchQuery);
                    const matchAmt = String(item.amount).includes(searchQuery);
                    if (!matchTime && !matchAmt) return;
                }

                const tr = document.createElement('tr');
                const isRequested = item.deleteRequested === true;

                tr.innerHTML = `
                    <td>${item.timestamp || 'N/A'}</td>
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

// 6. ADMIN ENTRY DELETE & PROFILE CONTROLLER
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
    const security = document.getElementById('signup-security').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    
    const err = document.getElementById('admin-create-err');
    const succ = document.getElementById('admin-create-msg');
    err.innerText = ""; succ.innerText = "";

    if(!username || !name || !security) {
        err.innerText = "❌ ERROR: Username, Name and Security answer required!";
        return;
    }

    const payload = {
        name: name,
        role: role,
        securityAnswer: security
    };
    if (password) payload.password = password;

    database.ref('users/' + username).update(payload).then(() => {
        succ.innerText = `✅ ACCOUNT SAVED: [${name}] updated successfully!`;
        clearProfileForm();
    });
}

function editUserProfile(username, name, security, role) {
    document.getElementById('signup-username').value = username;
    document.getElementById('signup-name').value = name;
    document.getElementById('signup-security').value = security;
    document.getElementById('signup-role').value = role;
    window.scrollTo({ top: 300, behavior: 'smooth' });
}

function clearProfileForm() {
    document.getElementById('signup-username').value = "";
    document.getElementById('signup-name').value = "";
    document.getElementById('signup-security').value = "";
    document.getElementById('signup-password').value = "";
}

// 7. DOWNLOAD FILTERED DATA AS CSV
function downloadFilteredData() {
    if (currentFilteredRecords.length === 0) {
        alert("Download karne ke liye koi records nahi mile!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Operator,Timestamp,Amount,Status,Delete_Requested\r\n";

    currentFilteredRecords.forEach(r => {
        const row = [
            `"${r.username || ''}"`,
            `"${r.timestamp || ''}"`,
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

// 8. FORGET PASSWORD RECOVERY
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

// 9. SIGNATURE CANVAS ENGINE
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

function clearSignature() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

// 10. DAILY ENTRY SUBMISSION
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
        signature: signatureImage,
        deleteRequested: false
    };

    database.ref('savingRecords').push(entry).then(() => {
        msg.innerText = `🟢 SUCCESS: ₹${amount} saved & synced across cloud grid.`;
        document.getElementById('saving-amount').value = "";
        clearSignature();
        setTimeout(() => { msg.innerText = ""; }, 3000);
    });
}

// 11. ADMIN DASHBOARD RE-RENDER & PROGRESS BAR
function renderAdminDashboard(records) {
    const tbody = document.getElementById('records-body');
    const totalMoneyText = document.getElementById('total-pool-money');
    const totalEntriesText = document.getElementById('total-entries-count');
    const progressFill = document.getElementById('target-progress-fill');
    const progressTxt = document.getElementById('progress-percent-txt');
    
    tbody.innerHTML = "";
    let totalMoney = 0;

    records.forEach(record => {
        totalMoney += (parseFloat(record.amount) || 0);
        const row = document.createElement('tr');
        const isDeleteReq = record.deleteRequested === true;

        row.innerHTML = `
            <td><b>${record.username || 'N/A'}</b></td>
            <td>${record.timestamp || 'N/A'}</td>
            <td class="txt-blue" style="font-weight:bold;">₹${(record.amount || 0).toLocaleString('en-IN')}</td>
            <td><span style="color:${isDeleteReq ? '#ffaa00' : '#00ff66'};">// ${isDeleteReq ? 'REQ DELETION' : (record.status || 'SECURED')}</span></td>
            <td>${record.signature ? `<img src="${record.signature}" class="sig-img" alt="signature"/>` : '<span style="color:#6b7280;">NO SIGN</span>'}</td>
            <td>
                <button class="btn-table-del" onclick="deleteRecordByAdmin('${record._key}')">DELETE</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    totalMoneyText.innerText = totalMoney.toLocaleString('en-IN');
    totalEntriesText.innerText = records.length;

    // Update Target Goal Progress Bar
    const percent = Math.min(100, Math.round((totalMoney / TARGET_GOAL) * 100));
    if (progressFill) progressFill.style.width = percent + "%";
    if (progressTxt) progressTxt.innerText = percent + "%";
}

// 12. LOGOUT
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