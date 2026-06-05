const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DEFAULT_POSTER =
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";

const mediaSchema = new Schema(
    {
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["movie", "series"],
            required: true,
            default: "movie",
        },
        status: {
            type: String,
            enum: ["watching", "planning", "completed", "dropped"],
            default: "planning",
        },
        rating: {
            type: Number,
            min: 0,
            max: 10,
            default: null,
        },
        platform: {
            type: String,
            trim: true,
        },
        genres: [
            {
                type: String,
                trim: true,
            },
        ],
        releaseYear: {
            type: Number,
            min: 1888,
            max: 2100,
        },
        posterUrl: {
            type: String,
            trim: true,
            default: DEFAULT_POSTER,
            set: (value) => {
                if (!value || value.trim() === "") {
                    return DEFAULT_POSTER;
                }

                return value.trim();
            },
        },
        currentEpisode: {
            type: Number,
            min: 0,
            default: 0,
        },
        totalEpisodes: {
            type: Number,
            min: 1,
            default: 1,
        },
        notes: {
            type: String,
            trim: true,
        },
        external: {
            tvmazeId: Number,
            iTunesId: Number,
            sourceName: String,
            officialSite: String,
        },
    },
    { timestamps: true }
);

mediaSchema.pre("validate", function normalizeProgress() {
    if (this.type === "movie") {
        this.totalEpisodes = 1;
        this.currentEpisode = this.status === "completed" ? 1 : 0;
    }

    if (this.type === "series") {
        if (!this.totalEpisodes || this.totalEpisodes < 1) {
            this.totalEpisodes = 1;
        }

        if (!this.currentEpisode || this.currentEpisode < 0) {
            this.currentEpisode = 0;
        }

        if (this.currentEpisode > this.totalEpisodes) {
            this.currentEpisode = this.totalEpisodes;
        }

        if (this.status === "completed") {
            this.currentEpisode = this.totalEpisodes;
        }

        if (
            this.currentEpisode >= this.totalEpisodes &&
            this.status !== "dropped" &&
            this.status !== "planning"
        ) {
            this.currentEpisode = this.totalEpisodes;
            this.status = "completed";
        }
    }
});

mediaSchema.virtual("progressPercent").get(function getProgressPercent() {
    if (!this.totalEpisodes) {
        return 0;
    }

    return Math.min(
        Math.round((this.currentEpisode / this.totalEpisodes) * 100),
        100
    );
});

mediaSchema.index({ owner: 1, status: 1, updatedAt: -1 });
mediaSchema.index({ owner: 1, title: 1 });

module.exports = mongoose.model("Media", mediaSchema);
module.exports.DEFAULT_POSTER = DEFAULT_POSTER;
