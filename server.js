const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

// Initialize express app
const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
const mongoDBUri = 'mongodb+srv://pj123:skibidi@cluster0.1uxmx.mongodb.net/yourDatabaseName'; // Replace 'yourDatabaseName'
mongoose.connect(mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define a User schema with location and approval fields
const offsiteRequestSchema = new mongoose.Schema({
  fromTime: { type: Date, required: true },
  leavingTime: { type: Date, required: true },
  location: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  isApproved: { type: Boolean, default: null }, // null = pending, true = approved, false = disapproved
  currentLocation: {
      lat: Number,
      lon: Number
  } // New field to store the current location
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  attendance: { type: Number, default: 0 },
  punchInTime: String,
  punchOutTime: String,
  firstCheckInTime: String,
  lastCheckOutTime: String,
  totalWorkingHours: { type: Number, default: 0 },
  lastCheckInDate: String,
  isApproved: { type: Boolean, default: false }, // New field to track admin approval status
  location: String,
  offsiteRequests: [offsiteRequestSchema] // New field for offsite work requests
});
const User = mongoose.model('User', userSchema);

// Admin credentials
const adminCredentials = {
  username: 'admin', // Replace with your desired admin username
  password: 'admin123' // Replace with your desired admin password
};

// Utility functions
const convertTimeStringToSeconds = (timeString) => {
  const [hours, minutes, seconds] = timeString.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

const formatTimeOnly = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

// Admin Login endpoint
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === adminCredentials.username && password === adminCredentials.password) {
    res.json({ success: true, message: 'Admin login successful' });
  } else {
    res.json({ success: false, message: 'Invalid admin credentials' });
  }
});

// Admin Dashboard Data endpoint
app.get('/admin/dashboard', async (req, res) => {
  const { username } = req.query;

  if (username !== adminCredentials.username) {
    return res.json({ success: false, message: 'Unauthorized' });
  }

  try {
    const users = await User.find({});
    res.json({
      success: true,
      users: users.map(user => ({
        username: user.username,
        firstCheckInTime: user.firstCheckInTime,
        lastCheckOutTime: user.lastCheckOutTime,
        totalAttendance: user.attendance,
        totalWorkingHours: formatTime(user.totalWorkingHours),
        location: user.location ? `${user.location.lat}, ${user.location.lon}` : 'N/A' // Include location
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all users for admin
app.get('/admin/offsite-requests', async (req, res) => {
  try {
      const users = await User.find({ 'offsiteRequests.0': { $exists: true } });

      const requests = users.map(user => {
          return user.offsiteRequests.map(request => ({
              username: user.username,
              fromTime: request.fromTime,
              leavingTime: request.leavingTime,
              location: request.location,
              isApproved: request.isApproved,
              requestId: request._id
          }));
      }).flat();

      res.json({ success: true, requests });
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Approve or disapprove a user
app.post('/admin/approve-request', async (req, res) => {
  try {
      const { username, requestId, isApproved } = req.body;

      const user = await User.findOne({ username });

      if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      const request = user.offsiteRequests.id(requestId);

      if (!request) {
          return res.status(404).json({ success: false, message: 'Request not found' });
      }

      request.isApproved = isApproved;
      await user.save();

      res.json({ success: true, message: 'Request status updated successfully' });
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Sign In endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });
    if (user) {
      res.json({ success: true, message: 'Login successful', username: user.username });
    } else {
      res.json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Attendance update endpoint
app.post('/update-attendance', async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user) {
      user.attendance += 1;
      await user.save();
      res.json({ success: true, message: 'Attendance updated', attendance: user.attendance });
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Punch In endpoint
app.post('/punch-in', async (req, res) => {
  const { username, isInGeofence } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Ensure the user is within the geofence if necessary


    // Get the current time in UTC and convert to IST
const now = new Date();
const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
const istTime = new Date(now.getTime() + istOffset);

// Format the IST time
const formattedDateTime = istTime.toDateString() + ' ' + istTime.toTimeString().split(' ')[0];

// Get today's date in ISO format adjusted for IST
const todayDate = istTime.toISOString().split('T')[0];

if (user.lastCheckInDate !== todayDate) {
  user.firstCheckInTime = formattedDateTime;
  user.lastCheckOutTime = null;
  user.lastCheckInDate = todayDate;
}

user.punchInTime = formattedDateTime;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Punched In successfully', 
      punchInTime: user.punchInTime,
      firstCheckInTime: user.firstCheckInTime
    });

  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



app.post('/punch-out', async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (!user.punchInTime) {
      return res.status(400).json({ success: false, message: 'Punch In first before Punching Out' });
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
    const istTime = new Date(now.getTime() + istOffset);
    
    // Format the IST time
    const formattedDateTime = istTime.toDateString() + ' ' + istTime.toTimeString().split(' ')[0];
    
    // Set punchOutTime and lastCheckOutTime
    user.punchOutTime = formattedDateTime;
    user.lastCheckOutTime = formattedDateTime;
    
    // Calculate worked time in seconds
    const punchInDate = new Date(user.punchInTime);
    const punchInIST = new Date(punchInDate.getTime() + istOffset); // Adjust punchInTime to IST
    const workedTimeInSeconds = (istTime.getTime() - punchInIST.getTime()) / 1000;
    
    // Update totalWorkingHours
    user.totalWorkingHours += workedTimeInSeconds;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Punched Out successfully', 
      punchOutTime: user.punchOutTime,
      lastCheckOutTime: user.lastCheckOutTime,
      totalWorkingHours: formatTime(user.totalWorkingHours)
    });

  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ success: false, message: 'Server error' });
  }
});





// Get Attendance endpoint
app.get('/get-attendance', async (req, res) => {
  const { username } = req.query;

  try {
    const user = await User.findOne({ username });
    if (user) {
      res.json({
        success: true,
        attendance: [{
          firstCheckInTime: user.firstCheckInTime,
          lastCheckOutTime: user.lastCheckOutTime,
          totalAttendance: user.attendance,
          totalWorkingHours: formatTime(user.totalWorkingHours)
        }],
      });
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/offsite-request', async (req, res) => {
  try {
      const { username, fromTime, leavingTime, location } = req.body;

      // Find the user by username
      const user = await User.findOne({ username });

      if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Add the offsite request to the user's offsiteRequests array
      user.offsiteRequests.push({
          fromTime: new Date(fromTime),
          leavingTime: new Date(leavingTime),
          location
      });

      // Save the updated user document
      await user.save();

      res.json({ success: true, message: 'Offsite work request submitted successfully' });
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/check-approval-status', (req, res) => {
  const { username } = req.query;

  if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
  }

  OffsiteRequest.findOne({ username }, (err, request) => {
      if (err) {
          console.error('Database error:', err); // Log the error for debugging
          return res.status(500).json({ success: false, message: 'Server error' });
      }
      if (!request) {
          return res.status(404).json({ success: false, message: 'Request not found' });
      }

      return res.json({ success: true, isApproved: request.isApproved });
  });
});


// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
