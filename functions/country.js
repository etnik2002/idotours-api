const normalizeCountry = (name) => {
    if (!name) return null;
    const cleaned = name.trim().toLowerCase();

    const aliases = {
        "north macedonia": "North Macedonia",
        "macedonia": "North Macedonia",
        "czech republic": "czech republic",
        "kosovo": "Kosovo",
        "albania": "Albania",
        "Albania": "Albania",
        "germany": "Germany",
        "austria": "Austria",
        "croatia": "Croatia",
        "slovenia": "Slovenia",
        "switzerland": "Switzerland",
        "italy": "Italy",
        "slovakia": "Slovakia",
        "serbia": "Serbia",
        "bulgaria": "Bulgaria",
        "greece": "Greece"
    };

    return (
        aliases[cleaned] ||
        cleaned
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
    );
};


module.exports = { normalizeCountry }