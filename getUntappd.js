var localjuice = require('./index');

var untappdVenues = ['troy-discount-beverage/385265', 'olivers-beverage-brew-crew/334214', 'westmere-beverage/58838', 'the-ruck/1797', 'pint-sized/5973790', 'delaware-supply/6894255', 'hill-street-cafe/70543','mohawk-taproom-and-grill/1749228','hunters-on-jay/2265376'];

var untappdUsers = ['AlbanyAleandOyster'];

untappdVenues.forEach(function (item) {
    localjuice.getUntappdMenu(item);
});
//localjuice.getUntappdMenu('hunters-on-jay/2265376')

localjuice.getUntappdUser('AlbanyAleandOyster');
