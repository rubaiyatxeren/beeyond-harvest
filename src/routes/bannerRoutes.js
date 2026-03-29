const express = require("express");
const {
  createBanner,
  getBanners,
  updateBanner,
  deleteBanner,
} = require("../controllers/bannerController");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getBanners)
  .post(
    protect,
    authorize("admin", "super_admin"),
    upload.single("image"),
    createBanner,
  );

router
  .route("/:id")
  .put(
    protect,
    authorize("admin", "super_admin"),
    upload.single("image"),
    updateBanner,
  )
  .delete(protect, authorize("admin", "super_admin"), deleteBanner);

module.exports = router;
