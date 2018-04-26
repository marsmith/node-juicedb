var localjuice = require('./index');

var untappdVenues = [
    {
        name:'Troy Beverage Center',
        venueURL:'troy-discount-beverage/385265'
    },
    {
        name:'Olivers Beverage Center',
        venueURL:'olivers-beverage-brew-crew/334214'
    },
    {
        name:'Westmere Beverage',
        venueURL:'westmere-beverage/58838'
    },
    {
        name:'The Ruck',
        venueURL:'the-ruck/1797'
    }, 
    {
        name:'Pint Sized - Albany',
        venueURL:'pint-sized/5973790'
    }, 
    {
        name:'Delaware Supply',
        venueURL:'delaware-supply/6894255'
    },
    {
        name:'Hill Street Cafe',
        venueURL:'hill-street-cafe/70543'
    }, 
];

untappdVenues.forEach(function (item) {
    var menu = localjuice.getUntappdMenu(item.venueURL);
});
//localjuice.getUntappdMenu('delaware-supply/6894255')
