import http from "k6/http";
import { check, sleep } from "k6";

// const Amadeus = require('amadeus');

// to run the script use k6 run performance.js

export let options = {
  vus: 500,
  duration: '5s',
};

export default function () {
  var res = http.get("https://api-v2.gobusly.com/station");

  check(res, {
    "status is 200": function (r) {
      return r.status === 200;
    },
  });

  sleep(1);
}

// const api_key = "C0Qq5CSvPRuen5Y97CpWteuYLvouAKGd";
// const api_secret = "wTuR4HNWRZ4tYrLA";

// const amadeus = new Amadeus({
//   clientId: api_key,
//   clientSecret: api_secret
// });

// amadeus.shopping.flightOffersSearch.get({
//   originLocationCode: 'SKP',
//   destinationLocationCode: 'SKG',
//   departureDate: '2024-11-11',
//   adults: '1'
// }).then(function(response){
// }).catch(function(responseError){
// });

// amadeus.referenceData.locations.hotels.byCity.get({
//   cityCode: 'SKP'
// }).then(function(response){
// }).catch(function(responseError){
// });





// https://www.npmjs.com/package/amadeus
// https://developers.amadeus.com/self-service/apis-docs