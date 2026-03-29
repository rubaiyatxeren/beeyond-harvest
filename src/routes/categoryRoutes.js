const express = require("express");
const {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getCategories)
  .post(
    protect,
    authorize("admin", "super_admin"),
    upload.single("image"),
    createCategory,
  );

router
  .route("/:id")
  .get(getCategory)
  .put(
    protect,
    authorize("admin", "super_admin"),
    upload.single("image"),
    updateCategory,
  )
  .delete(protect, authorize("admin", "super_admin"), deleteCategory);

module.exports = router;
