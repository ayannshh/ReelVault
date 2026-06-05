document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("[data-media-form]");

    if (!form) {
        return;
    }

    const defaultPoster =
        "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";

    const titleInput = form.querySelector("#title");
    const typeInputs = form.querySelectorAll("input[name='type']");
    const seriesFields = form.querySelector("[data-series-fields]");
    const fetchButton = form.querySelector("[data-fetch-media]");
    const fetchStatus = form.querySelector("[data-fetch-status]");
    const resultsBox = form.querySelector("[data-search-results]");
    const totalEpisodesInput = form.querySelector("#totalEpisodes");
    const currentEpisodeInput = form.querySelector("#currentEpisode");
    const posterInput = form.querySelector("#posterUrl");
    const posterPreview = form.querySelector("[data-poster-preview]");
    const genresInput = form.querySelector("#genres");
    const releaseYearInput = form.querySelector("#releaseYear");
    const platformInput = form.querySelector("#platform");
    const sourceNameInput = form.querySelector("[data-source-name]");
    const officialSiteInput = form.querySelector("[data-official-site]");
    const tvmazeIdInput = form.querySelector("[data-tvmaze-id]");
    const iTunesIdInput = form.querySelector("[data-itunes-id]");
    let lastSearchKey = "";

    function selectedType() {
        const checked = form.querySelector("input[name='type']:checked");
        return checked ? checked.value : "movie";
    }

    function setStatus(message, kind = "") {
        fetchStatus.textContent = message;
        fetchStatus.dataset.kind = kind;
    }

    function clampEpisodes() {
        const total = Math.max(Number(totalEpisodesInput.value) || 1, 1);
        let current = Math.max(Number(currentEpisodeInput.value) || 0, 0);

        if (current > total) {
            current = total;
        }

        totalEpisodesInput.value = String(total);
        currentEpisodeInput.value = String(current);
        currentEpisodeInput.max = String(total);
    }

    function toggleSeriesFields() {
        const isSeries = selectedType() === "series";
        seriesFields.hidden = !isSeries;

        if (!isSeries) {
            totalEpisodesInput.value = "1";
            currentEpisodeInput.value = "0";
        }

        clampEpisodes();
    }

    function updatePosterPreview() {
        posterPreview.src = posterInput.value.trim() || defaultPoster;
    }

    function clearExternalIds() {
        sourceNameInput.value = "";
        officialSiteInput.value = "";
        tvmazeIdInput.value = "";
        iTunesIdInput.value = "";
    }

    function clearResults() {
        resultsBox.hidden = true;
        resultsBox.innerHTML = "";
    }

    function compactText(value = "", maxLength = 150) {
        if (value.length <= maxLength) {
            return value;
        }

        return `${value.slice(0, maxLength).trim()}...`;
    }

    function renderResults(results) {
        resultsBox.innerHTML = "";

        if (!results.length) {
            resultsBox.hidden = false;
            resultsBox.innerHTML = `<p class="result-empty">No matches found. Try a more exact title.</p>`;
            return;
        }

        for (const result of results) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "search-result";
            button.dataset.resultId = result.id;

            const poster = document.createElement("img");
            poster.src = result.posterUrl || defaultPoster;
            poster.alt = "";

            const body = document.createElement("span");
            body.className = "search-result-body";

            const title = document.createElement("strong");
            title.textContent = result.title;

            const meta = document.createElement("span");
            meta.className = "search-result-meta";
            meta.textContent = [
                result.type === "series" ? "Web Series" : "Movie",
                result.releaseYear,
                result.totalEpisodes ? `${result.totalEpisodes} episodes` : "",
                result.network || result.country || result.contentRating || "",
            ]
                .filter(Boolean)
                .join(" - ");

            const summary = document.createElement("span");
            summary.className = "search-result-summary";
            summary.textContent = compactText(result.summary || "No summary available.");

            body.append(title, meta, summary);
            button.append(poster, body);
            button.addEventListener("click", () => applyResult(result));
            resultsBox.append(button);
        }

        resultsBox.hidden = false;
    }

    function applyResult(info) {
        titleInput.value = info.title || titleInput.value;
        posterInput.value = info.posterUrl || "";
        updatePosterPreview();

        if (info.genres && info.genres.length) {
            genresInput.value = info.genres.join(", ");
        }

        releaseYearInput.value = info.releaseYear || "";
        totalEpisodesInput.value =
            selectedType() === "series" ? String(info.totalEpisodes || 1) : "1";
        currentEpisodeInput.value =
            selectedType() === "series"
                ? String(Math.min(Number(currentEpisodeInput.value) || 0, Number(totalEpisodesInput.value) || 1))
                : "0";

        if (info.network && !platformInput.value.trim()) {
            platformInput.value = info.network;
        }

        sourceNameInput.value = info.title || "";
        officialSiteInput.value = info.officialSite || "";
        tvmazeIdInput.value = info.tvmazeId || "";
        iTunesIdInput.value = info.iTunesId || "";

        clampEpisodes();
        clearResults();
        setStatus(
            selectedType() === "series"
                ? `Selected ${info.title} with ${info.totalEpisodes || "unknown"} episodes.`
                : `Selected ${info.title}.`,
            "success"
        );
    }

    async function searchMedia() {
        const title = titleInput.value.trim();
        const type = selectedType();

        if (title.length < 2) {
            setStatus("Type at least 2 characters before fetching.", "error");
            clearResults();
            return;
        }

        const searchKey = `${type}:${title.toLowerCase()}`;

        if (lastSearchKey === searchKey && !resultsBox.hidden) {
            return;
        }

        lastSearchKey = searchKey;
        setStatus(
            type === "series"
                ? "Searching web series matches..."
                : "Searching movie matches...",
            "loading"
        );
        fetchButton.disabled = true;
        clearResults();

        try {
            const response = await fetch(
                `/media/search?type=${encodeURIComponent(type)}&q=${encodeURIComponent(title)}`
            );
            const result = await response.json();

            if (!response.ok || !result.ok) {
                setStatus(result.message || "Could not fetch matches.", "error");
                return;
            }

            renderResults(result.results || []);
            setStatus("Choose the correct result from the list.", "success");
        } catch (err) {
            setStatus("Could not fetch matches right now.", "error");
        } finally {
            fetchButton.disabled = false;
        }
    }

    for (const input of typeInputs) {
        input.addEventListener("change", () => {
            lastSearchKey = "";
            clearExternalIds();
            clearResults();
            setStatus("");
            toggleSeriesFields();
        });
    }

    fetchButton.addEventListener("click", searchMedia);

    titleInput.addEventListener("input", () => {
        lastSearchKey = "";
        clearExternalIds();
    });
    posterInput.addEventListener("input", updatePosterPreview);
    totalEpisodesInput.addEventListener("input", clampEpisodes);
    currentEpisodeInput.addEventListener("input", clampEpisodes);

    form.addEventListener("submit", () => {
        clampEpisodes();
    });

    toggleSeriesFields();
    updatePosterPreview();
});
