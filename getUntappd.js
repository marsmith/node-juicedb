var localjuice = require('./index');

var untappdVenues = ['troy-discount-beverage/385265', 'olivers-beverage-brew-crew/334214', 'westmere-beverage/58838', 'the-ruck/1797', 'pint-sized/5973790', 'delaware-supply/6894255', 'hill-street-cafe/70543','mohawk-taproom-and-grill/1749228','hunters-on-jay/2265376','hoosick-beverage-center/340342'];

var untappdUsers = ['AlbanyAleandOyster'];

untappdVenues.forEach(function (item) {
    localjuice.getUntappdMenu(item).then(function(result){
        console.log('Finished ' + item);
    })
    .catch(function(err){
        console.log('there was an error');
    });
});

//for testing
// localjuice.getUntappdMenu('hunters-on-jay/2265376')

untappdUsers.forEach(function (item) {
    localjuice.getUntappdUser(item).then(function(result){
        console.log('Finished ' + item);
    })
    .catch(function(err){
        console.log('there was an error');
    });
});

//for testing
//localjuice.getUntappdUser('AlbanyAleandOyster')