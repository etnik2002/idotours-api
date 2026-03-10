const router = require("express").Router();
const apicache = require("apicache");
const cache = apicache.middleware;

const { getCountryCities, getCityRelations, getAllCountries, validateRoute } = require("../controllers/seo-controller");

router.get("/country/:countrySlug", getCountryCities);

router.get("/city/relations/:citySlug", getCityRelations);

router.get("/countries/get-all", getAllCountries);

router.get("/validate-route", validateRoute);


module.exports = router;
