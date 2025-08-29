const API_URL = ''; // Keep it empty for same-origin requests

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const path = window.location.pathname;

    if (token) {
        if (path.includes('admin.html') && role === 'admin') {
            loadAdminDashboard();
        } else if (path.includes('employee.html') && role === 'employee') {
            loadEmployeeDashboard();
        } else if (path === '/' || path.includes('index.html')) {
            // If on login page with a token, redirect
            window.location.href = role === 'admin' ? 'admin.html' : 'employee.html';
        }
    } else if (path.includes('admin.html') || path.includes('employee.html')) {
        // If on a protected page without a token, redirect to login
        window.location.href = 'index.html';
    }
});

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        const { token, role } = await response.json();
        localStorage.setItem('token', token);
        localStorage.setItem('role', role);

        window.location.href = role === 'admin' ? 'admin.html' : 'employee.html';
    } catch (error) {
        errorMessage.textContent = error.message;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = 'index.html';
}

async function loadAdminDashboard() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/api/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const tableBody = document.getElementById('attendance-body');
        tableBody.innerHTML = ''; // Clear existing data
        data.forEach(emp => {
            const row = `<tr>
                <td>${emp.username}</td>
                <td>${emp.presentDays}</td>
                <td>${emp.attendancePercentage}%</td>
                <td>${emp.records.map(r => r.date).join(', ')}</td>
            </tr>`;
            tableBody.innerHTML += row;
        });
    } catch (error) {
        console.error('Failed to load admin dashboard:', error);
    }
}

async function createUser() {
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        alert(result.message);
        loadAdminDashboard(); // Refresh dashboard
    } catch (error) {
        console.error('Failed to create user:', error);
        alert('Error creating user.');
    }
}

async function changePassword() {
    const username = document.getElementById('change-username').value;
    const newPassword = document.getElementById('change-password').value;
    const token = localStorage.getItem('token');

    if (!username || !newPassword) {
        alert('Please provide both username and new password.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/users/${username}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ newPassword })
        });
        const result = await response.json();
        alert(result.message);
    } catch (error) {
        console.error('Failed to change password:', error);
        alert('Error changing password.');
    }
}


async function loadEmployeeDashboard() {
    const token = localStorage.getItem('token');
    document.getElementById('welcome-message').textContent = `Welcome!`;
    
    try {
        const response = await fetch(`${API_URL}/api/attendance/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const records = await response.json();
        const historyList = document.getElementById('attendance-history');
        historyList.innerHTML = '';
        records.forEach(record => {
            const listItem = document.createElement('li');
            listItem.textContent = `Present on: ${record.date}`;
            historyList.appendChild(listItem);
        });

        const today = new Date().toISOString().split('T')[0];
        const alreadyMarked = records.some(r => r.date === today);
        if (alreadyMarked) {
            document.getElementById('mark-attendance-btn').disabled = true;
            document.getElementById('mark-attendance-btn').textContent = 'Attendance Marked for Today';
        }
    } catch (error) {
        console.error('Failed to load employee data:', error);
    }
}

async function markAttendance() {
    const token = localStorage.getItem('token');
    const statusEl = document.getElementById('attendance-status');
    try {
        const response = await fetch(`${API_URL}/api/attendance`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        statusEl.textContent = result.message;
        if (response.ok) {
            statusEl.className = 'status';
            document.getElementById('mark-attendance-btn').disabled = true;
            document.getElementById('mark-attendance-btn').textContent = 'Attendance Marked for Today';
            loadEmployeeDashboard(); // Refresh history
        } else {
            statusEl.className = 'error';
        }
    } catch (error) {
        statusEl.textContent = 'An error occurred.';
        statusEl.className = 'error';
    }
}
