import {ShopInfo} from "../superagent/amazon_shop_info";


const restify = require('restify');
const amazon_shop_info = require('../superagent/amazon_shop_info');
const amazon_best_sellers = require('../superagent/amazon_best_sellers');
const server = restify.createServer();
const env = require('../utils/env');
const constants = require('./constants.js');

// 去除请求网址中的多个 /
server.pre(restify.plugins.pre.dedupeSlashes());
server.pre((req: any, res: any, next: any) => {
    let allowedHeaders: string[] = constants.ALLOW_HEADERS;
    // 6.2.7
    res.setHeader(constants.AC_ALLOW_ORIGIN, '*')
    res.setHeader(constants.AC_ALLOW_CREDS, true)

    // 6.2.8
    res.setHeader(constants.AC_MAX_AGE, 5)

    // 6.2.9
    res.setHeader(constants.AC_ALLOW_METHODS, 'GET,POST,PUT,OPTIONS')

    // 6.2.10
    res.setHeader(constants.AC_ALLOW_HEADERS, allowedHeaders.join(','))

    if (req.method !== 'OPTIONS') {
        return next();
    }

    res.send(constants.HTTP_NO_CONTENT)
});

server.pre((req: any, res: any, next: any): any => {
    let pwd: string | undefined = req.headers.authorization;
    if (pwd === env.getValue("PWD")) {
        return next();
    }
    res.send(200, "密码错误");
});

server.use((req: any, res: any, next: any) => {
    var originHeader = req.headers.origin

    // Since we use the origin header to control what we return, that
    // means we vary on origin
    res.setHeader(constants.STR_VARY, constants.STR_VARY_DETAILS)

    // if match was found, let's set some headers.
    res.setHeader(constants.AC_ALLOW_ORIGIN, originHeader)
    res.setHeader(constants.AC_ALLOW_CREDS, 'true')
    res.setHeader(constants.AC_EXPOSE_HEADERS, [].join(','))

    return next()
});
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.fullResponse())

// This is a simplified example just to give you an idea
// You will probably need more allowed headers
function unknownMethodHandler(req: any, res: any): any {
    if (req.method.toLowerCase() === 'options') {
        var allowHeaders = ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version'];

        if (res.methods.indexOf('OPTIONS') === -1) res.methods.push('OPTIONS');

        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Headers', allowHeaders.join(', '));
        res.header('Access-Control-Allow-Methods', res.methods.join(', '));
        res.header('Access-Control-Allow-Origin', '*');

        return res.send(204);
    } else
        return res.send(500, "该方法不被允许");
}

server.on('MethodNotAllowed', unknownMethodHandler);

server.post('/amazon/getPriceByAsin', async (req: any, res: any, next: any): Promise<any> => {
    let asinList: Array<string> | undefined = req.body.asin;
    let sendEmail: boolean | undefined = req.body.sendEmail;
    if (!asinList) {
        res.send(200, "asin不能为空，请输入asin");
        return next();
    }
    if (asinList.length > 1) {
        amazon_shop_info.getShopInfo(asinList, true).then((r: any) => console.log("获取商品完毕，返回信息 ：" + r));
        res.send("请稍等片刻，信息将会以邮件的形式发给您~");
        return next();
    }
    let shopInfoList: ShopInfo[] | undefined[] = await amazon_shop_info.getShopInfo(asinList, sendEmail);
    var shopInfo: ShopInfo | undefined = shopInfoList[0];
    if (shopInfo) {
        res.send("=" + shopInfo.first);
    } else {
        res.send(200, "获取商品信息出错，请检查asin是否正确");
    }
    return next();
})

server.post('/amazon/getPriceByUrl', async (req: any, res: any, next: any): Promise<any> => {
    let url: string | undefined = req.body.url;
    amazon_best_sellers.getShopInfo(url, false);
    res.send(200);
    return next();
})

server.listen(3001, function (): void {
    console.log('%s listening at %s', server.name, server.url)
});
