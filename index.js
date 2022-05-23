const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const domain = process.argv[2] || "https://www.fxstreet.com/";
const selector = process.argv[3] || "[src*='_Medium.']";
const attributeName = process.argv[4] || "src";

const csvWriter = createCsvWriter({
    path: `dataMedium.csv`,
    header: [
        { id: 'page', title: 'PAGE' },
        { id: 'attributeValue', title: 'ATTRIBUTE VALUE' },
    ]
});


const unvisitedUrls = [];
const visitedUrls = [];
if (!domain) {
    throw "Please provide URL as a first argument";
}
if (!selector) {
    throw "Please provide a selector to search as second argument";
}

async function run(url, selector) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setCookie(
        {
            name: "PopupAd_roadblocks",
            value: "true",
            url: "https://www.fxstreet.com",
            httpOnly: false
        },
        {
            name: "policyAccepted",
            value: "",
            url: "https://www.fxstreet.com",
            httpOnly: false
        }
    );

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

        const selectorExists = await page.evaluate((selector) => {
            return Promise.resolve(Array.from(document.querySelectorAll(selector)).length > 0);
        }, selector);

        const attributes = await page.evaluate((selector,attributeName) => {
            return Promise.resolve(
                Array.from(
                    document.querySelectorAll(selector)).map(
                        element => element.getAttribute(attributeName)
                    )
            );
        },selector,attributeName);

        if (selectorExists) {
            attributes.map(async (attributeValue) => {
                await csvWriter.writeRecords([{
                    page: url,
                    attributeValue: attributeValue
                }]);
            })
        };

        const domainUrls = await page.evaluate((domain) => {
            return Promise.resolve(Array.from(document.querySelectorAll(`[href^='${domain}']`)).map(item => item.href));
        }, domain);
        domainUrls.map(item => {
            if (!visitedUrls.includes(item) && !unvisitedUrls.includes(item)) {
                unvisitedUrls.push(item);
            }
        });
    } catch (error) {
        console.log(error.message);
    }
    browser.close();
    if (unvisitedUrls.length > 0) {
        const nextUrl = unvisitedUrls.pop();
        visitedUrls.push(nextUrl);
        await run(nextUrl, selector)
    } else {
        console.log('Exiting process');
        process.exit();
    }
}
run(domain, selector);
