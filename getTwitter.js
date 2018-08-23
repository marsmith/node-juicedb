var localjuice = require('./index');

var twitterUsers = ['TreeHouseBrewCo','burlingtonbeer','riverroostvt','eqbrewery'];

//first cleaup and DB check
// localjuice.cleanupTwitter().then(function(result){
//     //loop over instagram users
//     twitterUsers.forEach(function (item) {
//         localjuice.getTwitterByUser(item).then(function(result){
//             console.log('Finished ' + item);
//         })
//         .catch(function(err){
//             console.log('there was an error');
//         });
//     });
// });

localjuice.getTwitterByUser('TreeHouseBrewCo');
