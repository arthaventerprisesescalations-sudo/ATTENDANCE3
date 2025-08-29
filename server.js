const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Set default database structure
db.defaults({ users: [], attendance: [] }).write();

// Create a default admin user if one doesn't exist
if (!db.get('users').find({ username: 'admin' }).value()) {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('admin123', salt);
  db.get('users').push({ id: 1, username: 'admin', password: hash, role: 'admin' }).write();
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const SECRET_KEY = 'your-secret-key'; // Change this to a secure key

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(403).send({ message: 'No token provided.' });
  }

  jwt.verify(token.split(' ')[1], SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(500).send({ message: 'Failed to authenticate token.' });
    }
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
};

// API Routes
// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.get('users').find({ username }).value();

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
  res.send({ token, role: user.role });
});

// Admin: Create User
app.post('/api/users', verifyToken, (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).send({ message: 'Requires admin role' });
  }
  const { username, password } = req.body;
  if (db.get('users').find({ username }).value()) {
    return res.status(400).send({ message: 'Username already exists' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const newUser = { id: Date.now(), username, password: hash, role: 'employee' };

  db.get('users').push(newUser).write();
  res.status(201).send({ message: 'User created successfully' });
});

// Admin: Change Password
app.put('/api/users/:username/password', verifyToken, (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send({ message: 'Requires admin role' });
    }
    const { username } = req.params;
    const { newPassword } = req.body;

    const user = db.get('users').find({ username });
    if (!user.value()) {
        return res.status(404).send({ message: 'User not found' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);
    
    user.assign({ password: hash }).write();
    res.send({ message: 'Password updated successfully' });
});


// Mark Attendance
app.post('/api/attendance', verifyToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const existingRecord = db.get('attendance').find({ userId: req.userId, date: today }).value();

  if (existingRecord) {
    return res.status(400).send({ message: 'Attendance already marked for today' });
  }

  db.get('attendance').push({ userId: req.userId, date: today, status: 'present' }).write();
  res.status(201).send({ message: 'Attendance marked successfully' });
});

// Get Employee Attendance (for employee dashboard)
app.get('/api/attendance/me', verifyToken, (req, res) => {
    const records = db.get('attendance').filter({ userId: req.userId }).value();
    res.send(records);
});


// Get All Attendance Data (for admin dashboard)
app.get('/api/admin/dashboard', verifyToken, (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).send({ message: 'Requires admin role' });
  }
  const users = db.get('users').filter({ role: 'employee' }).value();
  const attendance = db.get('attendance').value();

  const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const dashboardData = users.map(user => {
    const userAttendance = attendance.filter(a => a.userId === user.id);
    const presentDays = userAttendance.length;
    const attendancePercentage = (presentDays / totalDaysInMonth) * 100;
    
    return {
      username: user.username,
      presentDays,
      attendancePercentage: attendancePercentage.toFixed(2),
      records: userAttendance
    };
  });

  res.send(dashboardData);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
