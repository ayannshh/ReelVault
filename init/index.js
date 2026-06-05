const mongoose = require("mongoose");
const initData = require("./data.js");
const Media = require("../models/media");
const User = require("../models/user");

const dbUrl =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/ReelVault";

async function main() {
    await mongoose.connect(dbUrl);
}

async function getDemoUser() {
    const existingUser = await User.findOne({ username: "demo" });

    if (existingUser) {
        return existingUser;
    }

    const demoUser = new User({
        username: "demo",
        email: "demo@reelvault.local",
    });

    return User.register(demoUser, "demo123");
}

async function initDB() {
    const demoUser = await getDemoUser();
    const media = initData.data.map((item) => ({
        ...item,
        owner: demoUser._id,
    }));

    await Media.deleteMany({ owner: demoUser._id });
    await Media.insertMany(media);

    console.log("Demo tracker was initialized");
    console.log("Login: demo / demo123");
}

main()
    .then(initDB)
    .then(() => mongoose.connection.close())
    .catch((err) => {
        console.log(err);
        mongoose.connection.close();
    });
