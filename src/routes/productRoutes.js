const express = require("express");
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  updateStock,
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getProducts)
  .post(
    protect,
    authorize("admin", "super_admin"),
    upload.array("images", 5),
    createProduct,
  );

router
  .route("/:id")
  .get(getProduct)
  .put(
    protect,
    authorize("admin", "super_admin"),
    upload.array("images", 5),
    updateProduct,
  )
  .delete(protect, authorize("admin", "super_admin"), deleteProduct);

router.patch(
  "/:id/stock",
  protect,
  authorize("admin", "super_admin"),
  updateStock,
);

module.exports = router;
