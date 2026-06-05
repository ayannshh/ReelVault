require("dotenv").config();

const express = require("express");
const app = express();

const path = require("path");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

const session = require("express-session");
const flash = require("connect-flash");

const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const User = require("./models/user");

const mediaRouter = require("./routes/media");
const userRouter = require("./routes/user");

const port = process.env.PORT || 8000;

const dbUrl =
    process.env.MONGO_URL ||
    "mongodb://127.0.0.1:27017/ReelVault";

console.log("Using DB:", dbUrl.replace(/:\/\/.*@/, "://***@"));

// Database Connection
async function main() {
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB");
}

main().catch((err) => {
    console.error("MongoDB Connection Error:");
    console.error(err);
});

// Settings
app.engine("ejs", ejsMate);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Session Configuration
const sessionOptions = {
    secret:
        process.env.SESSION_SECRET ||
        "development-secret-change-me",
    resave: false,
    saveUninitialized: false,
};

app.use(session(sessionOptions));

app.use(flash());

// Passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(
    new LocalStrategy(User.authenticate())
);

passport.serializeUser(
    User.serializeUser()
);

passport.deserializeUser(
    User.deserializeUser()
);

// Global Variables
app.use((req, res, next) => {
    res.locals.currUser = req.user;
    res.locals.appName = "ReelVault";
    res.locals.currentPath = req.path;

    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");

    next();
});

// Routes
app.get("/", (req, res) => {
    res.redirect(
        req.isAuthenticated()
            ? "/media"
            : "/login"
    );
});

app.use("/", userRouter);
app.use("/media", mediaRouter);

app.use("/listings", (req, res) => {
    res.redirect("/media");
});

// 404
app.use((req, res) => {
    res.status(404).render("errors/not-found");
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).render("errors/error", {
        message:
            "Something went wrong. Please try again.",
    });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});