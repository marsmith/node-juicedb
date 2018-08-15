var localjuice = require('./index');

var instagramUsers = ['troy_beverage','woodstockbrewing','burlingtonbeer','alchemistbeer','peekskillbrewery','rareformbrewco','fiddleheadbrewing','chathambrewing','druthersbrewing','commonrootsbrewing','paradoxbrewery','adirondackbrewery','suarezfamilybrewery','rootandbranchbrewing','foambrewers','hudsonvalleybrewery','mainebeerco','kcbcbeer','barrierbrewingco','singlecutbeer','otherhalfnyc','prairieales','nightshiftbeer','bissellbrothers','industrialartsbrewing','lawsonsfinest','treehousebrewco','grimmales','licbeerproject','trilliumbrewing','finbackbrewery','eqbrewery','fobeerco','hillfarmstead','sloopbrewingco','albanyaleandoyster','oliversbeverage','westmerebeverage','beerbonestaproom','mohawktaproom','thecitybeerhall42','district96_beerco','4counties_beerco','delmarbeveragecenter','wearepintsized','sandcitybrewery','frost.beer.works','liquidlyricsbrewing'];

//first cleaup and DB check
localjuice.cleanupInstagram().then(function(result){
    //loop over instagram users
    instagramUsers.forEach(function (item) {
        localjuice.instagramByUser(item).then(function(result){
            console.log('Finished ' + item);
        })
        .catch(function(err){
            console.log('there was an error');
        });
    });
});

// localjuice.cleanupInstagram().then(function(result){
//     localjuice.instagramByUser('rootandbranchbrewing');
// });
