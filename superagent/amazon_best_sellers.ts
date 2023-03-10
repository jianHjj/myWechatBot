import {ShopInfo} from "./amazon_shop_info";
import {Page} from "puppeteer";

const puppeteer = require('puppeteer');


const amazon_shop_info = require('./amazon_shop_info');

export async function getShopInfo(url: string, se: boolean): Promise<ShopInfo[] | undefined[]> {
    let result: ShopInfo[] | undefined[] = [];
    await start(url, se, true);
    return result;
}

async function extractAsinObj(page: Page, url: string): Promise<string[]> {
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
            asinList.push({
                "asin": asinEle.id,
                "url": asinEle.getElementsByClassName('a-link-normal')[0].href
            });
        })
        return {"asins": asinList}
    });
    return evalResult.asins;
}

//设置网址
async function start(url: string, se: boolean, hl: boolean) {
    //启动浏览器,传入headless为false可以打开窗口
    const browers = await puppeteer.launch({
        headless: hl,
        env: {'--disable-site-isolation-trials': true},
        args: [
            '--no-sandbox',
        ]
    })
    //启动新页面
    const page = await browers.newPage()
    //设置页面打开时的页面宽度高度
    await page.setViewport({
        width: 1920,
        height: 1080,
    })

    //不设置超时时间
    await page.setDefaultNavigationTimeout(0);

    //链接网址
    let asins_page1: any[] = await extractAsinObj(page, url);

    //翻第二页
    url = url.replace('pg=1', 'pg=2').replace('zg_bs_pg_1', 'zg_bs_pg_2');
    let asins_page2: any[] = await extractAsinObj(page, url);

    //关闭浏览器
    await browers.close();
    let asins = [...asins_page1, ...asins_page2];
    await amazon_shop_info.getShopInfo(asins.slice(0, 5), se);
}
