var localjuice = require('./index');

var untappdVenues = ['troy-discount-beverage/385265', 'olivers-beverage-brew-crew/334214', 'westmere-beverage/58838', 'the-ruck/1797', 'pint-sized/5973790', 'delaware-supply/6894255', 'hill-street-cafe/70543'];

untappdVenues.forEach(function (item) {
    var menu = localjuice.getUntappdMenu(item);
});
// //localjuice.getUntappdMenu('troy-discount-beverage/385265')

localjuice.instagramByUser('troy_beverage');
