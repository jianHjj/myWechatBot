import {ShopInfo} from "./amazon_shop_info";

const puppeteer = require('puppeteer');


const amazon_shop_info = require('./amazon_shop_info');

export async function getShopInfo(url: string, se: boolean): Promise<ShopInfo[] | undefined[]> {
    let result: ShopInfo[] | undefined[] = [];
    await start(url, false);
    return result;
}

//设置网址
async function start(url: string, bool: boolean) {
    //启动浏览器,传入headless为false可以打开窗口
    const browers = await puppeteer.launch({
        headless: bool
    })
    //启动新页面
    const page = await browers.newPage()
    //设置页面打开时的页面宽度高度
    await page.setViewport({
        width: 1920,
        height: 1080,
    })

    //链接网址
    await page.goto(url)
    await page.evaluate((resolve, reject) => {
        var top = 0
        //每300毫秒滚动100px
        var timer = setInterval((): void => {
            console.log(window.scrollY);
            window.scrollTo(0, top += 100)
        }, 200);
        //15秒后清除定时器并开始获取内容
        setTimeout((): void => {
            clearInterval(timer)
            let asinList: string[] = [];
            let asinElements = document.querySelectorAll('div.p13n-sc-uncoverable-faceout')
            asinElements.forEach(asinEle=>{
                asinList.push(asinEle.id);
            })
            amazon_shop_info.getShopInfo(asinList, true);
        }, 10000);
        // let asins = document.querySelectorAll('#gridItemRoot.a-column.a-span12.a-text-center._cDEzb_grid-column_2hIsc.asin-Boxtext')
    });
}
