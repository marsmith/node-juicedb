var juice = require('./app');
var config = require('./config');

//Instagram
juice.cleanupInstagram().then(function(result){
    console.log(result.result);
    config.instagramUsers.forEach(function (item) {
        juice.instagramByUser(item).then(function(result){
            console.log('Finished instagram user: ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });
});

//Untappd
juice.cleanupUntappd().then(function(result){
    console.log(result.result);
    //then start loop
    // config.untappdVenues.forEach(function (item) {
    //     juice.getUntappdMenu(item).then(function(result){
    //         console.log('Finished untapped venue: ' + item);
    //     })
    //     .catch(function(err){
    //         console.log('there was an error');
    //     });
    // });

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
    console.log(result.result);
    //loop over instagram users
    config.twitterUsers.forEach(function (item) {
        juice.getTwitterByUser(item).then(function(result){
            console.log('Finished twitter user: ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });
});