const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const passport = require("passport");
const User = require("../models/user");
const { sendPasswordOtp } = require("../utils/mailer");

function normalizeEmail(email = "") {
    return email.trim().toLowerCase();
}

function normalizeUsername(username = "") {
    return username.trim();
}

function hashOtp(otp) {
    return crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex");
}

function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}

// Signup Form
router.get("/signup", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/media");
    }

    res.render("users/signup");
});

// Register User
router.post("/signup", async (req, res, next) => {
    try {
        const username = normalizeUsername(req.body.username);
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;

        const existingUsername = await User.findOne({ username });

        if (existingUsername) {
            req.flash("error", "This username already exists.");
            return res.redirect("/signup");
        }

        const existingEmail = await User.findOne({ email });

        if (existingEmail) {
            req.flash(
                "error",
                "An account connected to this email already exists."
            );
            return res.redirect("/signup");
        }

        const newUser = new User({
            username,
            email,
        });

        const registeredUser = await User.register(newUser, password);

        return req.login(registeredUser, (loginErr) => {
            if (loginErr) {
                return next(loginErr);
            }

            req.flash(
                "success",
                "Account created. Your tracker is ready."
            );

            res.redirect("/media");
        });

    } catch (err) {

        if (err.name === "UserExistsError") {

            req.flash(
                "error",
                "This username already exists."
            );

            return res.redirect("/signup");
        }

        if (err.code === 11000 && err.keyPattern?.email) {
            req.flash(
                "error",
                "An account connected to this email already exists."
            );

            return res.redirect("/signup");
        }

        req.flash(
            "error",
            "Something went wrong"
        );

        res.redirect("/signup");
    }
});

router.get("/forgot-password", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/media");
    }

    res.render("users/forgot");
});

router.post("/forgot-password", async (req, res) => {
    const email = normalizeEmail(req.body.email);

    if (!email) {
        req.flash("error", "Enter the email connected to your account.");
        return res.redirect("/forgot-password");
    }

    const user = await User.findOne({ email });

    if (!user) {
        req.flash("error", "No account is connected to this email.");
        return res.redirect("/forgot-password");
    }

    const otp = generateOtp();

    user.resetPasswordOtpHash = hashOtp(otp);
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    try {
        const result = await sendPasswordOtp(email, otp, user.username);

        if (result.sent) {
            req.flash("success", "OTP sent to your email.");
        } else {
            req.flash(
                "success",
                `SMTP is not configured, so development OTP is ${otp}.`
            );
        }
    } catch (err) {
        req.flash("error", "Could not send OTP right now.");
        return res.redirect("/forgot-password");
    }

    res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
});

router.get("/reset-password", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/media");
    }

    res.render("users/reset", {
        email: normalizeEmail(req.query.email),
    });
});

router.post("/reset-password", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const otp = (req.body.otp || "").trim();
    const password = req.body.password || "";
    const confirmPassword = req.body.confirmPassword || "";

    if (!email || !otp || !password) {
        req.flash("error", "Email, OTP, and new password are required.");
        return res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    }

    if (password !== confirmPassword) {
        req.flash("error", "New password and confirm password do not match.");
        return res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    }

    const user = await User.findOne({ email });

    if (
        !user ||
        !user.resetPasswordOtpHash ||
        !user.resetPasswordOtpExpires ||
        user.resetPasswordOtpExpires < new Date()
    ) {
        req.flash("error", "OTP is invalid or expired.");
        return res.redirect("/forgot-password");
    }

    if (user.resetPasswordOtpAttempts >= 5) {
        req.flash("error", "Too many incorrect OTP attempts. Request a new OTP.");
        return res.redirect("/forgot-password");
    }

    if (hashOtp(otp) !== user.resetPasswordOtpHash) {
        user.resetPasswordOtpAttempts += 1;
        await user.save();

        req.flash("error", "Incorrect OTP.");
        return res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    }

    await user.setPassword(password);
    user.resetPasswordOtpHash = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    req.flash("success", "Password reset successfully. Please login.");
    res.redirect("/login");
});

// Login Form
router.get("/login", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/media");
    }

    res.render("users/login");
});

// Login User
router.post("/login", (req, res, next) => {

    passport.authenticate(
        "local",
        (err, user, info) => {

            if (err) {
                return next(err);
            }

            if (!user) {

                req.flash(
                    "error",
                    "Invalid username or password"
                );

                return res.redirect("/login");
            }

            req.logIn(user, (err) => {

                if (err) {
                    return next(err);
                }

                req.flash(
                    "success",
                    `Welcome back, ${user.username}!`
                );

                return res.redirect("/media");
            });
        }
    )(req, res, next);
});

// Logout User
router.get("/logout", (req, res, next) => {

    req.logout((err) => {

        if (err) {
            return next(err);
        }

        req.flash(
            "success",
            "Logged out successfully"
        );

        res.redirect("/login");
    });
});

module.exports = router;
