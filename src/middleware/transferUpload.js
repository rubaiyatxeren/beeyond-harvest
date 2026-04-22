// middleware/transferUpload.js
// ─────────────────────────────────────────────────────────────────────────────
// Multer config for BeeTransfer — supports both:
//   (A) Cloudinary storage  (if CLOUDINARY_CLOUD_NAME is set)
//   (B) Local disk storage  (fallback, stores in /uploads/transfers/)
// ─────────────────────────────────────────────────────────────────────────────

const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_FILES = 10;

// Allowed mime types — extend as needed
const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  // Audio / Video
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "video/quicktime",
  // Code / Data
  "application/json",
  "application/xml",
  "text/html",
  "text/css",
  "application/javascript",
  "text/javascript",
  // Generic binary (fallback)
  "application/octet-stream",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `File type "${file.mimetype}" is not allowed`,
      ),
      false,
    );
  }
};

// ── Storage engine selection ───────────────────────────────────────────────────
function _diskStorage() {
  // Use /tmp directory on Render (writable)
  const uploadDir =
    process.env.NODE_ENV === "production"
      ? "/tmp/uploads/transfers" // Render's writable temp directory
      : path.join(__dirname, "../uploads/transfers");

  console.log("💾 [UPLOAD] Using disk storage at:", uploadDir);

  // Ensure directory exists
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("✅ [UPLOAD] Created upload directory:", uploadDir);
    } catch (err) {
      console.error("❌ [UPLOAD] Failed to create directory:", err);
      throw new Error(`Cannot create upload directory: ${err.message}`);
    }
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
      cb(null, uniqueName);
    },
  });
}

let storage;

if (process.env.CLOUDINARY_CLOUD_NAME) {
  // Cloudinary storage via multer-storage-cloudinary
  try {
    const { CloudinaryStorage } = require("multer-storage-cloudinary");
    const cloudinary = require("../config/cloudinary");

    storage = new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${crypto.randomBytes(12).toString("hex")}${ext}`;
        return {
          folder: "beeharvest/transfers",
          public_id: uniqueName,
          resource_type: "auto", // Changed from "raw" to "auto" for better compatibility
          access_mode: "public",
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        };
      },
    });
    console.log("🌤️ [TRANSFER UPLOAD] Using Cloudinary storage");
  } catch (err) {
    console.warn(
      "⚠️ [TRANSFER UPLOAD] Cloudinary storage error, falling back to disk storage:",
      err.message,
    );
    storage = _diskStorage(); // FIXED: Now calling the function
  }
} else {
  console.log("💾 [TRANSFER UPLOAD] No Cloudinary config, using disk storage");
  storage = _diskStorage(); // FIXED: Now calling the function
}

const transferUpload = multer({
  storage: storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES,
  },
});

module.exports = transferUpload;
