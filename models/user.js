const mongoose = require("mongoose");
const passportLocalMongoose =
    require("passport-local-mongoose").default;

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    resetPasswordOtpHash: String,
    resetPasswordOtpExpires: Date,
    resetPasswordOtpAttempts: {
        type: Number,
        default: 0,
    },
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
