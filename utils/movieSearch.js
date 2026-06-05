const https = require("https");

function getJson(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            let body = "";

            response.on("data", (chunk) => {
                body += chunk;
            });

            response.on("end", () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`Movie search returned ${response.statusCode}`));
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
            request.destroy(new Error("Movie search request timed out"));
        });

        request.on("error", reject);
    });
}

function getSuggestionPath(query) {
    const cleaned = query
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    const first = cleaned[0];

    return `https://v2.sg.media-imdb.com/suggestion/${first}/${cleaned}.json`;
}

function isMovie(item) {
    return ["movie", "tvMovie", "video"].includes(item.qid);
}

function mapMovie(item) {
    return {
        id: item.id,
        iTunesId: undefined,
        title: item.l,
        type: "movie",
        totalEpisodes: 1,
        currentEpisode: 0,
        posterUrl: item.i?.imageUrl || "",
        genres: [],
        releaseYear: item.y,
        summary: item.s ? `Cast: ${item.s}` : "Movie result from IMDb suggestions.",
        officialSite: item.id ? `https://www.imdb.com/title/${item.id}/` : "",
        contentRating: item.q || "",
        country: "",
    };
}

async function searchMovies(query) {
    if (!query || query.trim().length < 2) {
        return [];
    }

    const data = await getJson(getSuggestionPath(query));

    return (data.d || [])
        .filter((item) => item.l && isMovie(item))
        .slice(0, 8)
        .map(mapMovie);
}

module.exports = { searchMovies };
