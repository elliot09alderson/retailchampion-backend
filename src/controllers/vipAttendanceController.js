import VIPAttendance from '../models/VIPAttendance.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

// @desc    Submit VIP Attendance
// @route   POST /api/vip/attendance
// @access  Public
export const submitAttendance = async (req, res) => {
  try {
    const { name, phoneNumber, meetingCode, leaderCode } = req.body;

    if (!req.file || !name || !phoneNumber || !meetingCode) {
      return res.status(400).json({ success: false, message: 'All required fields are missing' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'retailchampions/attendance');

    const attendance = await VIPAttendance.create({
      name,
      phoneNumber,
      meetingCode,
      leaderCode,
      photo: result.secure_url,
      photoPublicId: result.public_id,
    });

    res.status(201).json({ success: true, data: attendance });
  } catch (error) {
    console.error('Attendance submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit attendance' });
  }
};

// @desc    Get all attendance records
// @route   GET /api/vip/attendance
// @access  Private (Admin)
export const getAttendance = async (req, res) => {
  try {
    const records = await VIPAttendance.find().sort({ attendedAt: -1 });
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch attendance records' });
  }
};
