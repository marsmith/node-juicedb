var juice = require('./index');
var config = require('./config');

//Instagram
juice.cleanupInstagram().then(function(result){
    config.instagramUsers.forEach(function (item) {
        juice.instagramByUser(item).then(function(result){
            console.log('Finished ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });
});

//Untappd
juice.cleanupUntappd().then(function(result){
    console.log('RESULT: ' + result.result)
    //then start loop
    config.untappdVenues.forEach(function (item) {
        juice.getUntappdMenu(item).then(function(result){
            console.log('Finished untapped venue: ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });

    config.untappdUsers.forEach(function (item) {
        juice.getUntappdUser(item).then(function(result){
            console.log('Finished untapped user: ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });
});

//Twitter
juice.cleanupTwitter().then(function(result){
    //loop over instagram users
    config.twitterUsers.forEach(function (item) {
        juice.getTwitterByUser(item).then(function(result){
            console.log('Finished ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });
});