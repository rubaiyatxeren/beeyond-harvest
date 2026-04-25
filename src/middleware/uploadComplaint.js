const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Separate storage for complaints
const complaintStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "complaints", // Separate folder for complaints
    allowed_formats: ["jpg", "jpeg", "png", "gif", "pdf"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

// File filter for complaints
const complaintFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("শুধুমাত্র ছবি (JPG, PNG, GIF) বা PDF ফাইল সমর্থিত"), false);
  }
};

const uploadComplaint = multer({
  storage: complaintStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: complaintFileFilter,
});

module.exports = uploadComplaint;
