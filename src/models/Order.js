const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    customer: {
      name: {
        type: String,
        required: [true, "Customer name is required"],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Customer email is required"],
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        required: [true, "Customer phone is required"],
        trim: true,
      },
      address: {
        street: String,
        city: String,
        area: String,
        postalCode: String,
        district: String,
        division: String,
      },
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        sku: String,
        quantity: {
          type: Number,
          required: true,
          min: [1, "Quantity must be at least 1"],
        },
        price: {
          type: Number,
          required: true,
          min: [0, "Price cannot be negative"],
        },
        total: {
          type: Number,
          required: true,
        },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    coupon: {
      code: String,
      discount: Number,
    },
    deliveryCharge: {
      type: Number,
      default: 60,
      min: [0, "Delivery charge cannot be negative"],
    },
    total: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash_on_delivery", "bkash", "nagad", "rocket", "card"],
      required: [true, "Payment method is required"],
      default: "cash_on_delivery",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "pending",
    },
    deliveryDate: Date,
    notes: String,
    adminNotes: String,
    trackingNumber: String,
    deliveryPartner: String,
  },
  {
    timestamps: true,
  },
);

orderSchema.pre("save", async function () {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    try {
      // Get the count using the model after it's defined
      const OrderModel = mongoose.models.Order || mongoose.model("Order");
      const count = await OrderModel.countDocuments();
      this.orderNumber = `ORD-${year}${month}-${String(count + 1).padStart(5, "0")}`;
    } catch (error) {
      // Fallback: use timestamp if count fails
      const timestamp = Date.now().toString().slice(-5);
      this.orderNumber = `ORD-${year}${month}-${timestamp}`;
    }
  }
});

module.exports = mongoose.model("Order", orderSchema);
