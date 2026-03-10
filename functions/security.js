function removePassword(model) {
    model.password = undefined;
}

function getRandomInt() {
    return Math.floor(Math.random() * 9000) + 1000;
}


module.exports = { removePassword, getRandomInt };