// const mongoose = require("mongoose");

// const billSchema = new mongoose.Schema(
//     {
//         billNumber: {
//             type: String,
//             required: true,
//             unique: true,
//         },
//         customerName: {
//             type: String,
//             required: true,
//             trim: true,
//         },
//         customerEmail: {
//             type: String,
//             trim: true,
//         },
//         customerPhone: {
//             type: String,
//             trim: true,
//         },
//         items: [
//             {
//                 productId: {
//                     type: mongoose.Schema.Types.ObjectId,
//                     ref: "Product",
//                     required: true,
//                 },
//                 productName: String,
//                 quantity: {
//                     type: Number,
//                     required: true,
//                     min: 1,
//                 },
//                 price: {
//                     type: Number,
//                     required: true,
//                 },
//                 total: {
//                     type: Number,
//                     required: true,
//                 },
//             },
//         ],
//         subtotal: {
//             type: Number,
//             required: true,
//             default: 0,
//         },
//         tax: {
//             type: Number,
//             default: 0,
//         },
//         discount: {
//             type: Number,
//             default: 0,
//         },
//         total: {
//             type: Number,
//             required: true,
//             default: 0,
//         },
//         paymentMethod: {
//             type: String,
//             enum: ["cash", "card", "check", "online"],
//             default: "cash",
//         },
//         paymentStatus: {
//             type: String,
//             enum: ["paid", "pending", "cancelled"],
//             default: "pending",
//         },
//         notes: {
//             type: String,
//             default: "",
//         },
//         status: {
//             type: String,
//             enum: ["draft", "finalized", "cancelled"],
//             default: "draft",
//         },
//         createdBy: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "User",
//             required: true,
//         },
//     },
//     { timestamps: true }
// );

// // Generate bill number before saving
// billSchema.pre("save", async function (next) {
//     if (this.isNew) {
//         const count = await mongoose.model("Bill").countDocuments();
//         const date = new Date();
//         const year = date.getFullYear();
//         const month = String(date.getMonth() + 1).padStart(2, "0");
//         const day = String(date.getDate()).padStart(2, "0");
//         this.billNumber = `BILL-${year}${month}${day}-${String(count + 1).padStart(5, "0")}`;
//     }
//     next();
// });

// module.exports = mongoose.model("Bill", billSchema);


const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    // ❌ removed required:true (IMPORTANT FIX)
    billNumber: {
      type: String,
      unique: true,
    },

    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    customerEmail: {
      type: String,
      trim: true,
    },

    customerPhone: {
      type: String,
      trim: true,
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productName: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
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
      default: 0,
    },

    tax: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
      default: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "card", "check", "online"],
      default: "cash",
    },

    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "cancelled"],
      default: "pending",
    },

    notes: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["draft", "finalized", "cancelled"],
      default: "draft",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// ✅ AUTO GENERATE BILL NUMBER (SAFE)
billSchema.pre("save", async function () {
  if (this.isNew) {
    const unique = Math.floor(1000 + Math.random() * 9000);

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    this.billNumber = `BILL-${year}${month}${day}-${Date.now()}-${unique}`;
  }
});

module.exports = mongoose.model("Bill", billSchema);