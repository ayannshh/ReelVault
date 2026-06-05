const https = require("https");

function stripTags(value = "") {
    return value.replace(/<[^>]*>/g, "").trim();
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            let body = "";

            response.on("data", (chunk) => {
                body += chunk;
            });

            response.on("end", () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`TVMaze returned ${response.statusCode}`));
                    return;
                }

                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(err);
                }
            });
        });

        request.setTimeout(7000, () => {
            request.destroy(new Error("TVMaze request timed out"));
        });

        request.on("error", reject);
    });
}

async function fetchSeriesInfo(title) {
    if (!title || title.trim().length < 2) {
        return null;
    }

    const endpoint =
        "https://api.tvmaze.com/singlesearch/shows?q=" +
        encodeURIComponent(title.trim()) +
        "&embed=episodes";

    const show = await getJson(endpoint);
    const episodes = show?._embedded?.episodes || [];
    const premiered = show?.premiered ? Number(show.premiered.slice(0, 4)) : undefined;

    return {
        tvmazeId: show.id,
        title: show.name,
        totalEpisodes: episodes.length || undefined,
        posterUrl: show.image?.original || show.image?.medium || "",
        genres: show.genres || [],
        releaseYear: Number.isNaN(premiered) ? undefined : premiered,
        summary: stripTags(show.summary || ""),
        officialSite: show.officialSite || "",
    };
}

async function fetchSeriesInfoById(id) {
    const endpoint =
        "https://api.tvmaze.com/shows/" +
        encodeURIComponent(id) +
        "?embed=episodes";

    const show = await getJson(endpoint);
    const episodes = show?._embedded?.episodes || [];
    const premiered = show?.premiered ? Number(show.premiered.slice(0, 4)) : undefined;

    return {
        id: String(show.id),
        tvmazeId: show.id,
        title: show.name,
        type: "series",
        totalEpisodes: episodes.length || undefined,
        posterUrl: show.image?.original || show.image?.medium || "",
        genres: show.genres || [],
        releaseYear: Number.isNaN(premiered) ? undefined : premiered,
        summary: stripTags(show.summary || ""),
        officialSite: show.officialSite || show.url || "",
        network: show.network?.name || show.webChannel?.name || "",
        language: show.language || "",
    };
}

async function searchSeries(query) {
    if (!query || query.trim().length < 2) {
        return [];
    }

    const endpoint =
        "https://api.tvmaze.com/search/shows?q=" +
        encodeURIComponent(query.trim());
    const matches = await getJson(endpoint);

    const topMatches = matches
        .slice(0, 8)
        .map((match) => match.show)
        .filter(Boolean);

    return Promise.all(
        topMatches.map((show) => fetchSeriesInfoById(show.id))
    );
}

module.exports = { fetchSeriesInfo, fetchSeriesInfoById, searchSeries };
