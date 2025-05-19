require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const LoginAudit = require('./models/LoginAudit');
const nodemailer = require('nodemailer');
const Course = require('./models/Course');
const Attendance = require('./models/Attendance');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/projectx')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Create login audit entry
    const loginLog = new LoginAudit({
      userId: user._id,
      username: user.username,
      role: user.role
    });
    await loginLog.save();

    // Return user data without password
    const userData = user.toObject();
    delete userData.password;
    
    // Include the loginAuditId in the response
    res.json({
      ...userData,
      loginAuditId: loginLog._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Password reset endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mock login log endpoint
app.post('/api/logs/mock', async (req, res) => {
  try {
    const { userId, username, role } = req.body;

    // Get the current Philippine time (UTC+8)
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

    // Create mock login audit entry with Philippine time
    const loginLog = new LoginAudit({
      userId: new mongoose.Types.ObjectId(userId),
      username,
      role,
      loginTime: phTime
    });
    
    await loginLog.save();
    console.log('Created mock login audit entry:', loginLog._id);

    res.json({ 
      success: true,
      loginAuditId: loginLog._id
    });
  } catch (error) {
    console.error('Error creating mock login log:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = user.toObject();
    delete userData.password;
    res.json(userData);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { idNumber, firstName, lastName, email, username, password, role, roles } = req.body;

    // Validate required fields
    if (!idNumber || !firstName || !lastName || !email || !username || !password || (!role && !roles?.length)) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username ? 
          'Username already exists' : 'Email already exists' 
      });
    }

    // Create new user
    const userData = {
      idNumber,
      firstName,
      lastName,
      email,
      username,
      password,
    };
    
    // Handle both single role and multiple roles
    if (roles && roles.length > 0) {
      userData.role = roles[0]; // Set primary role for backward compatibility
      userData.roles = roles;   // Store all roles
    } else if (role) {
      userData.role = role;
      userData.roles = [role];
    }

    const user = new User(userData);

    await user.save();

    // Return user data without password
    const responseData = user.toObject();
    delete responseData.password;
    res.status(201).json(responseData);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { idNumber, firstName, lastName, email, username, password, role, roles } = req.body;
    
    // Validate required fields
    if (!idNumber || !firstName || !lastName || !email || !username || (!role && !roles?.length)) {
      return res.status(400).json({ message: 'All fields except password are required' });
    }

    // Check if username or email already exists for other users
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: req.params.id } },
        { $or: [{ username }, { email }] }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username ? 
          'Username already exists' : 'Email already exists' 
      });
    }

    // Prepare update data
    const updateData = {
      idNumber,
      firstName,
      lastName,
      email,
      username,
    };
    
    // Handle both single role and multiple roles
    if (roles && roles.length > 0) {
      updateData.role = roles[0]; // Set primary role for backward compatibility
      updateData.roles = roles;   // Store all roles
    } else if (role) {
      updateData.role = role;
      updateData.roles = [role];
    }

    // Only update password if provided
    if (password) {
      updateData.password = password;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = user.toObject();
    delete userData.password;
    res.json(userData);
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is trying to delete themselves
    if (user._id.toString() === req.user?._id?.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get login audit logs (admin only)
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await LoginAudit.find()
      .sort({ loginTime: -1 })
      .populate('userId', 'firstName lastName email');
    res.json(logs);
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  try {
    console.log('Logout endpoint called with:', req.body);
    const { userId, loginAuditId } = req.body;
    
    if (!userId && !loginAuditId) {
      console.log('Missing required parameters: userId or loginAuditId');
      return res.status(400).json({ message: 'Either userId or loginAuditId is required' });
    }

    // Get the current Philippine time (UTC+8)
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    console.log('Current Philippine time:', phTime);
    
    let loginRecord;
    let query = {};
    
    if (loginAuditId) {
      console.log('Searching for LoginAudit by ID:', loginAuditId);
      // If loginAuditId is provided, find and update that specific record
      loginRecord = await LoginAudit.findById(loginAuditId);
    } else {
      console.log('Searching for LoginAudit by userId:', userId);
      // Otherwise fall back to finding the most recent login for the user
      loginRecord = await LoginAudit.findOne({
        userId,
        logoutTime: null
      }).sort({ loginTime: -1 });
    }

    console.log('Found login record:', loginRecord ? loginRecord._id : 'none');

    if (loginRecord) {
      // Update the login record with logout time
      console.log('Updating login record with logout time:', phTime);
      loginRecord.logoutTime = phTime;
      await loginRecord.save();
      console.log('Successfully saved logout time');
      
      res.json({ 
        message: 'Logout successful', 
        logoutTime: phTime,
        loginAuditId: loginRecord._id 
      });
    } else {
      console.log('No active session found for logout');
      res.status(404).json({ message: 'No active session found' });
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send credentials email endpoint
app.post('/api/auth/send-credentials', async (req, res) => {
  try {
    const { email, username, password, role, firstName } = req.body;

    // Validate required fields
    if (!email || !username || !password || !role || !firstName) {
      console.error('Missing required fields for email:', { email, username, role, firstName });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email credentials not configured');
      return res.status(500).json({ message: 'Email service not configured' });
    }

    console.log('Attempting to send email to:', email);
    console.log('Using email account:', process.env.EMAIL_USER);

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log('Email transporter verified successfully');
    } catch (verifyError) {
      console.error('Email transporter verification failed:', verifyError);
      return res.status(500).json({ message: 'Email service configuration error' });
    }

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to ProjectX - Your Account Credentials',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 20px;
              border-radius: 0 0 5px 5px;
            }
            .credentials {
              background-color: white;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .credential-item {
              margin: 10px 0;
              padding: 10px;
              background-color: #f5f5f5;
              border-radius: 3px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #666;
            }
            .button {
              display: inline-block;
              padding: 10px 20px;
              background-color: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin-top: 20px;
            }
            .logo {
              max-width: 150px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to ProjectX!</h1>
          </div>
          <div class="content">
            <p>Hello ${firstName},</p>
            <p>Your account has been successfully created. Here are your login credentials:</p>
            
            <div class="credentials">
              <div class="credential-item">
                <strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
              <div class="credential-item">
                <strong>Username:</strong> ${username}
              </div>
              <div class="credential-item">
                <strong>Password:</strong> ${password}
              </div>
            </div>

            <p>For security reasons, please:</p>
            <ul>
              <li>Log in to your account immediately</li>
              <li>Change your password after your first login</li>
              <li>Keep your credentials secure and do not share them with anyone</li>
            </ul>

            <p>If you have any questions or need assistance, please contact the system administrator.</p>
            
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} ProjectX. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    res.json({ message: 'Credentials email sent successfully' });
  } catch (error) {
    console.error('Error sending credentials email:', error);
    res.status(500).json({ 
      message: 'Failed to send credentials email',
      error: error.message 
    });
  }
});

// Create new course
app.post('/api/courses', async (req, res) => {
  try {
    const { courseCode, courseName, description, lecturerId, schedules } = req.body;

    // Validate required fields
    if (!courseCode || !courseName || !description || !lecturerId || !schedules || schedules.length === 0) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if course code already exists
    const existingCourse = await Course.findOne({ courseCode });
    if (existingCourse) {
      return res.status(400).json({ message: 'Course code already exists' });
    }

    // Check if lecturer exists
    const lecturer = await User.findById(lecturerId);
    if (!lecturer || lecturer.role !== 'lecturer') {
      return res.status(400).json({ message: 'Invalid lecturer' });
    }

    // Create new course
    const course = new Course({
      courseCode,
      courseName,
      description,
      lecturerId,
      schedules
    });

    await course.save();

    // Populate lecturer details
    await course.populate('lecturerId', 'firstName lastName');

    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find().populate('lecturerId', 'firstName lastName');
    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update course
app.put('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate required fields
    if (!updateData.courseCode || !updateData.courseName || !updateData.description || !updateData.lecturerId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if the course exists
    const existingCourse = await Course.findById(id);
    if (!existingCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // If students array is provided, validate that all student IDs exist
    if (updateData.students && updateData.students.length > 0) {
      const studentIds = updateData.students;
      const validStudents = await User.find({
        _id: { $in: studentIds },
        role: 'student'
      });

      if (validStudents.length !== studentIds.length) {
        return res.status(400).json({ message: 'One or more invalid student IDs provided' });
      }
    }

    // Update the course with the new data
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      { 
        $set: {
          courseCode: updateData.courseCode,
          courseName: updateData.courseName,
          description: updateData.description,
          lecturerId: updateData.lecturerId,
          schedules: updateData.schedules || [],
          students: updateData.students || [],
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    );

    res.json(updatedCourse);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ message: 'Failed to update course', error: error.message });
  }
});

// Delete course
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate QR code for attendance
app.post('/api/attendance/generate-qr', async (req, res) => {
  try {
    const { courseId, lecturerId } = req.body;

    // Validate course and lecturer
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.lecturerId.toString() !== lecturerId) {
      return res.status(403).json({ message: 'Unauthorized to generate QR for this course' });
    }

    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Convert to PH time (UTC+8)
    const expiryTime = new Date(phTime.getTime() + (60 * 60 * 1000)); // 1 hour from now

    const qrData = JSON.stringify({
      courseId: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      generatedAt: phTime.toISOString(),
      expiresAt: expiryTime.toISOString()
    });

    // Create attendance record
    const attendance = new Attendance({
      courseId: course._id,
      lecturerId: lecturerId,
      qrCodeData: qrData,
      generatedAt: phTime,
      expiresAt: expiryTime
    });

    await attendance.save();

    res.json({
      qrData,
      generatedAt: phTime,
      expiresAt: expiryTime
    });
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Record attendance from QR scan
app.post('/api/attendance/scan', async (req, res) => {
  try {
    const { qrData, studentId, intendedCourseId, courseCode } = req.body;
    
    console.log('Scan request received:', { 
      studentId, 
      intendedCourseId,
      courseCode 
    });
    
    let qrInfo;
    try {
      qrInfo = JSON.parse(qrData);
      console.log('Parsed QR data:', qrInfo);
    } catch (error) {
      console.error('Invalid QR data format:', error);
      return res.status(400).json({ message: 'Invalid QR code format' });
    }

    // Validate that QR course matches intended course (if provided)
    if (intendedCourseId && qrInfo.courseId !== intendedCourseId) {
      console.error('Course mismatch:', { 
        qrCourseId: qrInfo.courseId, 
        intendedCourseId 
      });
      return res.status(400).json({ 
        message: `This QR code is for ${qrInfo.courseCode || 'another course'}. You are trying to mark attendance for ${courseCode || 'a different course'}.` 
      });
    }

    // Validate QR code expiration
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Current PH time
    if (new Date(qrInfo.expiresAt) <= phTime) {
      console.error('QR code expired');
      return res.status(400).json({ message: 'QR code has expired' });
    }

    // Find the attendance record
    const attendance = await Attendance.findOne({
      courseId: qrInfo.courseId,
      generatedAt: new Date(qrInfo.generatedAt)
    });

    if (!attendance) {
      console.error('Attendance record not found');
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Check if student has already scanned
    const hasScanned = attendance.scannedBy.some(
      scan => scan.studentId.toString() === studentId
    );

    if (hasScanned) {
      console.error('Student already scanned this QR code');
      return res.status(400).json({ message: 'You have already scanned this QR code' });
    }

    // Validate student is enrolled in the course
    const course = await Course.findById(qrInfo.courseId);
    if (!course) {
      console.error('Course not found');
      return res.status(404).json({ message: 'Course not found' });
    }

    const isEnrolled = course.students && course.students.some(
      id => id.toString() === studentId
    );

    if (!isEnrolled) {
      console.error('Student not enrolled in course', {
        studentId,
        courseId: qrInfo.courseId,
        courseName: qrInfo.courseName
      });
      return res.status(403).json({ 
        message: `You are not enrolled in ${qrInfo.courseCode || 'this course'}. Attendance cannot be marked.` 
      });
    }

    // Add student to scannedBy array
    attendance.scannedBy.push({
      studentId: studentId,
      scannedAt: phTime
    });

    await attendance.save();

    res.json({ message: 'Attendance recorded successfully' });
  } catch (error) {
    console.error('Scan QR error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get attendance records for a course
app.get('/api/attendance/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const attendanceRecords = await Attendance.find({ courseId })
      .populate('scannedBy.studentId', 'firstName lastName idNumber')
      .sort({ generatedAt: -1 });

    res.json(attendanceRecords);
  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get students enrolled in a course
app.get('/api/courses/:courseId/students', async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).populate('students');
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json(course.students);
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get attendance records for a course
app.get('/api/courses/:courseId/attendance', async (req, res) => {
  try {
    const attendance = await Attendance.find({ courseId: req.params.courseId });
    res.json(attendance);
  } catch (error) {
    console.error('Get course attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 