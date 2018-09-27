var argv = require('minimist')(process.argv.slice(2))

const { Chromeless } = require("chromeless")
const fs = require("fs")

var scrollsBeforeSave = null

var url = ""

if (!fs.existsSync("./scraped-urls")) {
    fs.mkdirSync("./scraped-urls/")
}

// MARK -- Argument parsing
if (argv.tag) {
    url = `https://www.instagram.com/explore/tags/${argv.tag}`
    if (!fs.existsSync("./scraped-urls/tags")) {
        fs.mkdirSync("./scraped-urls/tags")
    }
    scrollsBeforeSave = 20
} else if (argv.user) {
    url = `https://www.instagram.com/${argv.user}`
    if (!fs.existsSync("./scraped-urls/users")) {
        fs.mkdirSync("./scraped-urls/users")
    }
    scrollsBeforeSave = 5
} else if (argv.url) {
    url = argv.url
}

if (url.length === 0) {
    console.error("Please specify a --tag, --user or --url parameter.");
    process.exit()
}

var set = new Set(url.split("/"))
var arr = ["https:", "www.instagram.com", "explore", ""]
arr.map(s => {set.delete(s)})
var fileUrl = Array.from(set).join("/") + ".txt"
if (!set.has("tags")) {
    fileUrl = "users/" + fileUrl
}

// MARK -- Persistence (reading)
var linksSet = new Set()
fs.readFile(`./scraped-urls/${fileUrl}`, 'utf8', (err,data) => {
    if (err) {
        return console.log(err);
    }
    linksSet = new Set(data.split("\n"))
    linksSet.delete("\n")
    linksSet.delete(" ")
})

var start = new Date()

async function run() {
    const chromeless = new Chromeless()

    // MARK -- Load More

    // Locate 'Load More' buttona and assign element ID
    await chromeless
        .goto(url)
        .evaluate(() => {
            document.querySelectorAll("a").forEach(a => {
                if (a.innerHTML === "Load more") {a.id = "loadMore"}
            })
        })

    // Check if 'Load More' button was located
    var canLoadMore = await chromeless
        .evaluate(() => document.getElementById("loadMore") != null)

    // Click 'Load More' if found
    if (canLoadMore) {
        await chromeless
            .scrollTo(0, Number.MAX_SAFE_INTEGER)
            .click("#loadMore")
    } else {
        console.log("Could not locate #loadMore")
    }

    // MARK -- Continuous scrolling
    var currentScrollLocation = await chromeless
        .evaluate(() => window.pageYOffset)
    var lastScrollLocation = -1
    var sameLocationCount = 0

    // Scroll indefinitely
    while (sameLocationCount <= 5) {

        lastScrollLocation = currentScrollLocation

        // Scroll `scrollsBeforeSave` times before saving
        for (var i = 0; i < scrollsBeforeSave; i++) {
            await chromeless
                .scrollTo(0, Number.MAX_SAFE_INTEGER)
                .wait(100)
        }

        // MARK -- Extract links
        var links = await chromeless
            .evaluate(() => Array.prototype.slice.call(document.querySelectorAll("img")).reverse().slice(0, Math.min(15 * 5, document.querySelectorAll("img").length-1)).map(a => {
	            var src = a.src
                a.src = ""
                return src
            }).join())

        links = links.split(",")
        var newLinks = []
        links.map(l => {
            if (!linksSet.has(l)) {
                newLinks.push(l)
            }
            linksSet.add(l)
        })

        // MARK -- Persistence (writing)
        if (newLinks.length > 0) {
            fs.appendFileSync(`./scraped-urls/${fileUrl}`, newLinks.join("\n") + "\n")
        }

        // Scrolling exit condition
        currentScrollLocation = await chromeless
            .evaluate(() => window.pageYOffset)

        var timeElapsed = (new Date() - start) / 1000

        if (currentScrollLocation === lastScrollLocation) {
            sameLocationCount += 1
            console.log(sameLocationCount);
        } else {
            sameLocationCount = 0
            console.log(`${linksSet.size}\t\t${Math.round(timeElapsed*100)/100}s\t\t${Math.round(linksSet.size/timeElapsed*100)/100} links/s`);
        }

        // Max limit exceeded exit condition
        if (linksSet.size >= argv.max) {
            break
        }

    }

    // End chromeless session
    await chromeless.end()

}

run().catch(console.error.bind(console))