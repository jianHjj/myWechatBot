import {ShopInfo} from "./amazon_shop_info";
import {Browser, Page} from "puppeteer";

const puppeteer = require('puppeteer');
const amazon_shop_info = require('./amazon_shop_info');

// 延时函数，防止检测出类似机器人行为操作
const delay = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));

let browser: Browser;

export async function getShopAsins(url: string): Promise<String[] | undefined[]> {
    return await startBrowser(url, true);
}

export async function getShopInfo(url: string, se: boolean): Promise<ShopInfo[] | undefined[]> {
    let asins: String[] | undefined[] = await getShopAsins(url);
    return await amazon_shop_info.getShopInfo(asins, se);
}

async function extractAsinObj(page: Page, url: string): Promise<string[]> {
    await delay(10000);
    await page.goto(url)
    await page.evaluate(() => {
        var top = 0
        //每300毫秒滚动100px
        let timer: number | any = setInterval((): void => {
            console.log(window.scrollY);
            window.scrollTo(0, top += 170)
        }, 200);
        //15秒后清除定时器并开始获取内容
        setTimeout((): void => {
            clearInterval(timer)
        }, 15000);
    });

    await page.waitForTimeout(15000);

    let evalResult = await page.evaluate(() => {
        let asinList: any[] = [];
        let asinElements = document.querySelectorAll('div.p13n-sc-uncoverable-faceout')
        asinElements.forEach((asinEle: any) => {
            asinList.push(asinEle.id);
        })
        return {"asins": asinList}
    });
    return evalResult.asins;
}

//设置网址
async function startBrowser(url: string, hl: boolean): Promise<String[] | undefined[]> {
    const setup = async () => {
        browser = await puppeteer.launch({
            headless: hl,
            env: {'--disable-site-isolation-trials': true},
            args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
        });

        browser.on('disconnected', setup);

        console.log("Started Puppeteer with pid ${browser.process().pid}");
    };

    //启动浏览器,传入headless为false可以打开窗口
    if (!browser) {
        browser = await puppeteer.launch({
            headless: hl,
            env: {'--disable-site-isolation-trials': true},
            args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
        });
        browser.on('disconnected', setup);
    }
    let pages: Page[] = await browser.pages();
    let page: Page = pages && pages.length > 0 ? pages[0] : await browser.newPage();
    page.on('error', async err => {
        console.log('Chrome浏览器页面崩溃：', err);
        pages = await browser.pages();
        page = pages && pages.length > 0 ? pages[0] : await browser.newPage();
    });
    //设置页面打开时的页面宽度高度
    await page.setViewport({
        width: 1920,
        height: 1080,
    });

    //不设置超时时间
    await page.setDefaultNavigationTimeout(0);

    //链接网址
    let asins_page1: any[] = await extractAsinObj(page, url);

    //翻第二页
    url = url.replace('pg=1', 'pg=2').replace('zg_bs_pg_1', 'zg_bs_pg_2');
    let asins_page2: any[] = await extractAsinObj(page, url);

    let asins = [...asins_page1, ...asins_page2];

    return asins.slice(0, 5);
}
