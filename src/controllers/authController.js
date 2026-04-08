const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const { sendEmail } = require("../config/nodemailer");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Login admin
// @route   POST /api/auth/login
// @access  Public
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!admin.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "Account is disabled" });
    }

    admin.lastLogin = new Date();
    await admin.save();

    res.json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        token: generateToken(admin._id),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register new admin/manager (Only super_admin can do this)
// @route   POST /api/auth/register
// @access  Private (Super Admin only)
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin already exists with this email",
      });
    }

    // Validate role
    const requestedRole = role || "admin";
    const validRoles = ["super_admin", "admin", "manager"];

    if (!validRoles.includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be super_admin, admin, or manager",
      });
    }

    // Check permission: Only super_admin can create new admins/managers
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can create new admins or managers",
      });
    }

    // Create new admin/manager
    const newAdmin = await Admin.create({
      name,
      email,
      password,
      role: requestedRole,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: `${requestedRole} created successfully`,
      data: {
        _id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        isActive: newAdmin.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all admins and managers (Super admin only)
// @route   GET /api/auth/admins
// @access  Private (Super Admin only)
const getAllAdmins = async (req, res) => {
  try {
    // Check if user is super_admin
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can view all admins and managers",
      });
    }

    const admins = await Admin.find({
      role: { $in: ["super_admin", "admin", "manager"] },
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: admins.length,
      data: admins,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update admin/manager (Super admin only)
// @route   PUT /api/auth/admins/:id
// @access  Private (Super Admin only)
const updateAdmin = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can update admin/manager accounts",
      });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Prevent changing another super_admin account
    if (
      admin.role === "super_admin" &&
      req.user._id.toString() !== admin._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify other super admin accounts",
      });
    }

    // Update fields
    admin.name = req.body.name || admin.name;
    admin.email = req.body.email || admin.email;
    admin.role = req.body.role || admin.role;
    admin.isActive =
      req.body.isActive !== undefined ? req.body.isActive : admin.isActive;

    if (req.body.password) {
      admin.password = req.body.password;
    }

    await admin.save();

    res.json({
      success: true,
      message: "Admin updated successfully",
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete admin/manager (Super admin only)
// @route   DELETE /api/auth/admins/:id
// @access  Private (Super Admin only)
const deleteAdmin = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can delete admin/manager accounts",
      });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Prevent deleting yourself
    if (req.user._id.toString() === admin._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Prevent deleting super_admin
    if (admin.role === "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete super admin account",
      });
    }

    await admin.deleteOne();

    res.json({
      success: true,
      message: `${admin.role} deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current admin profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select("-password");
    res.json({ success: true, data: admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update admin profile
// @route   PUT /api/auth/update
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    admin.name = req.body.name || admin.name;

    if (req.body.password) {
      admin.password = req.body.password;
    }

    await admin.save();
    res.json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: req.body.email });
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    const resetToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const html = `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 1 hour.</p>
    `;

    await sendEmail(admin.email, "Password Reset", html);
    res.json({ success: true, message: "Password reset email sent" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  loginAdmin,
  getMe,
  updateProfile,
  forgotPassword,
  registerAdmin,
  getAllAdmins,
  updateAdmin,
  deleteAdmin,
};
