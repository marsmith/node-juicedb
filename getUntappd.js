var localjuice = require('./index');

var untappdVenues = ['troy-discount-beverage/385265', 'olivers-beverage-brew-crew/334214', 'westmere-beverage/58838', 'the-ruck/1797', 'pint-sized/5973790', 'delaware-supply/6894255', 'hill-street-cafe/70543','mohawk-taproom-and-grill/1749228','hunters-on-jay/2265376','hoosick-beverage-center/340342','elixir-16/6362949','the-black-bear-inn/305546','pontoosuc-package-store/4055110','sinclair-saratoga/6356586','sharon-package-store/4220556','beer-bones-taproom/7454563','kellys-package-store/295792','minogues-beverage-center/418856','minogues-beverage-center/448787','henry-street-taproom/432437','delmar-beverage/397052'];

var untappdUsers = ['AlbanyAleandOyster','FranklinAlleySocialClub'];

//first cleaup and DB check
localjuice.cleanupUntappd().then(function(result){
    console.log('RESULT: ' + result.result)
    //then start loop
    untappdVenues.forEach(function (item) {
        localjuice.getUntappdMenu(item).then(function(result){
            console.log('Finished untapped venue: ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });

    untappdUsers.forEach(function (item) {
        localjuice.getUntappdUser(item).then(function(result){
            console.log('Finished untapped user: ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });
});


//for testing
//localjuice.getUntappdMenu('hill-street-cafe/70543');

//for testing
//localjuice.getUntappdUser('FranklinAlleySocialClub')