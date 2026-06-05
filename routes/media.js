const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Media = require("../models/media");
const { isLoggedIn } = require("../middleware");
const { fetchSeriesInfo, searchSeries } = require("../utils/tvmaze");
const { searchMovies } = require("../utils/movieSearch");

const statusOptions = [
    { value: "watching", label: "Watching" },
    { value: "planning", label: "Planning to Watch" },
    { value: "completed", label: "Completed" },
    { value: "dropped", label: "Dropped" },
];

const typeOptions = [
    { value: "movie", label: "Movie" },
    { value: "series", label: "Web Series" },
];

const sortOptions = [
    { value: "updated", label: "Recently Updated" },
    { value: "title", label: "Title A-Z" },
    { value: "rating", label: "Highest Rated" },
    { value: "progress", label: "Most Progress" },
];

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseNumber(value, fallback = null) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const number = Number(value);
    return Number.isNaN(number) ? fallback : number;
}

function parseGenres(value) {
    if (!value) {
        return [];
    }

    return value
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean);
}

function getStatus(value) {
    return statusOptions.some((status) => status.value === value)
        ? value
        : "planning";
}

function getType(value) {
    return value === "series" ? "series" : "movie";
}

function buildPayload(body) {
    const type = getType(body.type);
    const totalEpisodes =
        type === "series"
            ? Math.max(parseNumber(body.totalEpisodes, 1), 1)
            : 1;
    const currentEpisode =
        type === "series"
            ? Math.max(parseNumber(body.currentEpisode, 0), 0)
            : 0;

    return {
        title: body.title,
        type,
        status: getStatus(body.status),
        rating: parseNumber(body.rating, null),
        platform: body.platform,
        genres: parseGenres(body.genres),
        releaseYear: parseNumber(body.releaseYear, null),
        posterUrl: body.posterUrl,
        currentEpisode,
        totalEpisodes,
        notes: body.notes,
        external: {
            sourceName: body.externalSourceName,
            officialSite: body.externalOfficialSite,
            tvmazeId: parseNumber(body.tvmazeId, undefined),
            iTunesId: parseNumber(body.iTunesId, undefined),
        },
    };
}

async function enrichSeriesPayload(payload) {
    if (payload.type !== "series") {
        return;
    }

    try {
        const info = await fetchSeriesInfo(payload.title);

        if (!info) {
            return;
        }

        if ((!payload.totalEpisodes || payload.totalEpisodes <= 1) && info.totalEpisodes) {
            payload.totalEpisodes = info.totalEpisodes;
        }

        if (!payload.posterUrl && info.posterUrl) {
            payload.posterUrl = info.posterUrl;
        }

        if (!payload.genres.length && info.genres.length) {
            payload.genres = info.genres;
        }

        if (!payload.releaseYear && info.releaseYear) {
            payload.releaseYear = info.releaseYear;
        }

        payload.external = {
            tvmazeId: info.tvmazeId,
            sourceName: info.title,
            officialSite: info.officialSite,
        };
    } catch (err) {
        payload.external = undefined;
    }
}

function summarize(items) {
    const stats = {
        total: items.length,
        watching: 0,
        planning: 0,
        completed: 0,
        dropped: 0,
        movies: 0,
        series: 0,
        averageRating: null,
    };

    let ratingTotal = 0;
    let ratingCount = 0;

    for (const item of items) {
        stats[item.status] += 1;
        stats[item.type === "series" ? "series" : "movies"] += 1;

        if (item.rating !== null && item.rating !== undefined) {
            ratingTotal += item.rating;
            ratingCount += 1;
        }
    }

    if (ratingCount > 0) {
        stats.averageRating = (ratingTotal / ratingCount).toFixed(1);
    }

    return stats;
}

async function findOwnedMedia(req) {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }

    return Media.findOne({
        _id: id,
        owner: req.user._id,
    });
}

router.get("/", isLoggedIn, async (req, res) => {
    const q = (req.query.q || "").trim();
    const status = req.query.status || "all";
    const type = req.query.type || "all";
    const sort = req.query.sort || "updated";

    const filter = { owner: req.user._id };

    if (statusOptions.some((option) => option.value === status)) {
        filter.status = status;
    }

    if (typeOptions.some((option) => option.value === type)) {
        filter.type = type;
    }

    if (q) {
        const pattern = new RegExp(escapeRegex(q), "i");
        filter.$or = [
            { title: pattern },
            { platform: pattern },
            { genres: pattern },
        ];
    }

    const sortMap = {
        updated: { updatedAt: -1 },
        title: { title: 1 },
        rating: { rating: -1, updatedAt: -1 },
        progress: { currentEpisode: -1, updatedAt: -1 },
    };

    const [mediaItems, allItems] = await Promise.all([
        Media.find(filter).sort(sortMap[sort] || sortMap.updated),
        Media.find({ owner: req.user._id }),
    ]);

    res.render("media/index", {
        mediaItems,
        stats: summarize(allItems),
        filters: { q, status, type, sort },
        statusOptions,
        typeOptions,
        sortOptions,
    });
});

router.get("/new", isLoggedIn, (req, res) => {
    res.render("media/new", {
        media: {
            type: "movie",
            status: "planning",
            rating: null,
            genres: [],
            currentEpisode: 0,
            totalEpisodes: 1,
        },
        statusOptions,
        typeOptions,
    });
});

router.get("/series-info", isLoggedIn, async (req, res) => {
    try {
        const info = await fetchSeriesInfo(req.query.title);

        if (!info) {
            return res.status(404).json({
                ok: false,
                message: "No matching web series found.",
            });
        }

        res.json({ ok: true, info });
    } catch (err) {
        res.status(404).json({
            ok: false,
            message: "Could not fetch that web series right now.",
        });
    }
});

router.get("/search", isLoggedIn, async (req, res) => {
    const type = getType(req.query.type);
    const q = (req.query.q || "").trim();

    if (q.length < 2) {
        return res.status(400).json({
            ok: false,
            message: "Type at least 2 characters to search.",
        });
    }

    try {
        const results =
            type === "series"
                ? await searchSeries(q)
                : await searchMovies(q);

        res.json({ ok: true, results });
    } catch (err) {
        res.status(500).json({
            ok: false,
            message:
                type === "series"
                    ? "Could not fetch web series matches right now."
                    : "Could not fetch movie matches right now.",
        });
    }
});

router.post("/", isLoggedIn, async (req, res) => {
    try {
        const payload = buildPayload(req.body);
        payload.owner = req.user._id;

        await enrichSeriesPayload(payload);

        const media = new Media(payload);
        await media.save();

        req.flash("success", "Added to your tracker.");
        res.redirect(`/media/${media._id}`);
    } catch (err) {
        req.flash("error", err.message || "Could not add this title.");
        res.redirect("/media/new");
    }
});

router.get("/:id", isLoggedIn, async (req, res) => {
    const media = await findOwnedMedia(req);

    if (!media) {
        req.flash("error", "That title is not in your account.");
        return res.redirect("/media");
    }

    res.render("media/show", { media, statusOptions });
});

router.get("/:id/edit", isLoggedIn, async (req, res) => {
    const media = await findOwnedMedia(req);

    if (!media) {
        req.flash("error", "That title is not in your account.");
        return res.redirect("/media");
    }

    res.render("media/edit", { media, statusOptions, typeOptions });
});

router.put("/:id", isLoggedIn, async (req, res) => {
    const media = await findOwnedMedia(req);

    if (!media) {
        req.flash("error", "That title is not in your account.");
        return res.redirect("/media");
    }

    try {
        const payload = buildPayload(req.body);
        await enrichSeriesPayload(payload);

        Object.assign(media, payload);
        await media.save();

        req.flash("success", "Tracker item updated.");
        res.redirect(`/media/${media._id}`);
    } catch (err) {
        req.flash("error", err.message || "Could not update this title.");
        res.redirect(`/media/${media._id}/edit`);
    }
});

router.post("/:id/progress", isLoggedIn, async (req, res) => {
    const media = await findOwnedMedia(req);

    if (!media) {
        req.flash("error", "That title is not in your account.");
        return res.redirect("/media");
    }

    const action = req.body.action;

    if (action === "start") {
        media.status = "watching";
    }

    if (action === "increment") {
        if (media.type === "series") {
            if (media.currentEpisode >= media.totalEpisodes) {
                media.currentEpisode = media.totalEpisodes;
                media.status = "completed";
            } else {
                media.currentEpisode = Math.min(
                    media.currentEpisode + 1,
                    media.totalEpisodes
                );
                media.status =
                    media.currentEpisode >= media.totalEpisodes
                        ? "completed"
                        : "watching";
            }
        } else {
            media.status = "completed";
        }
    }

    if (action === "decrement" && media.type === "series") {
        media.currentEpisode = Math.max(media.currentEpisode - 1, 0);
        media.status = media.currentEpisode === 0 ? "planning" : "watching";
    }

    if (action === "complete") {
        media.status = "completed";
        media.currentEpisode = media.totalEpisodes;
    }

    if (action === "drop") {
        media.status = "dropped";
    }

    if (action === "planning") {
        media.status = "planning";
        media.currentEpisode = 0;
    }

    await media.save();

    req.flash("success", "Progress updated.");
    res.redirect(req.get("Referrer") || `/media/${media._id}`);
});

router.delete("/:id", isLoggedIn, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        req.flash("error", "That title is not in your account.");
        return res.redirect("/media");
    }

    const media = await Media.findOneAndDelete({
        _id: req.params.id,
        owner: req.user._id,
    });

    if (!media) {
        req.flash("error", "That title is not in your account.");
        return res.redirect("/media");
    }

    req.flash("success", "Removed from your tracker.");
    res.redirect("/media");
});

module.exports = router;
