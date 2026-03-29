const Banner = require("../models/Banner");
const cloudinary = require("../config/cloudinary");

// @desc    Create banner
// @route   POST /api/banners
// @access  Private
const createBanner = async (req, res) => {
  try {
    const bannerData = { ...req.body };

    if (req.file) {
      bannerData.image = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    const banner = await Banner.create(bannerData);
    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all banners
// @route   GET /api/banners
// @access  Public
const getBanners = async (req, res) => {
  try {
    const query = req.query.position ? { position: req.query.position } : {};
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === "true";
    }

    const banners = await Banner.find(query).sort("order").lean();

    // Filter by date
    const now = new Date();
    const activeBanners = banners.filter((banner) => {
      if (!banner.isActive) return false;
      if (banner.startDate && banner.startDate > now) return false;
      if (banner.endDate && banner.endDate < now) return false;
      return true;
    });

    res.json({ success: true, data: activeBanners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update banner
// @route   PUT /api/banners/:id
// @access  Private
const updateBanner = async (req, res) => {
  try {
    let banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }

    if (req.file) {
      // Delete old image
      if (banner.image.publicId) {
        await cloudinary.uploader.destroy(banner.image.publicId);
      }

      req.body.image = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete banner
// @route   DELETE /api/banners/:id
// @access  Private
const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }

    if (banner.image.publicId) {
      await cloudinary.uploader.destroy(banner.image.publicId);
    }

    if (banner.mobileImage?.publicId) {
      await cloudinary.uploader.destroy(banner.mobileImage.publicId);
    }

    await banner.deleteOne();
    res.json({ success: true, message: "Banner deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createBanner,
  getBanners,
  updateBanner,
  deleteBanner,
};
