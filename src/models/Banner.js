const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    titleBn: {
      type: String,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    subtitleBn: {
      type: String,
      trim: true,
    },
    image: {
      url: {
        type: String,
        required: [true, "Image URL is required"],
      },
      publicId: {
        type: String,
        required: [true, "Image public ID is required"],
      },
    },
    mobileImage: {
      url: String,
      publicId: String,
    },
    link: {
      type: String,
      trim: true,
    },
    buttonText: {
      type: String,
      trim: true,
    },
    buttonTextBn: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      enum: ["home_top", "home_middle", "home_bottom", "category_top"],
      default: "home_top",
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Banner", bannerSchema);
