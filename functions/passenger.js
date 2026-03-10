function calculateTotalAmount(passengers) {
    if (passengers.length < 1) return 0;

    let total = 0;
    let amount_in_eur = 0;
    passengers.forEach((p) => {
        total += p.price;
    });

    const amount_in_cents = Math.round(total * 100);

    // returning in cents and also in eur
    return { amount_in_eur, amount_in_cents };
}


module.exports = { calculateTotalAmount };