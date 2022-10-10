import {ShopInfo} from "../superagent/amazon_shop_info";

const restify = require('restify');
const amazon_shop_info = require('../superagent/amazon_shop_info');
const server = restify.createServer();
const env = require('../utils/env');

// 去除请求网址中的多个 /
server.pre(restify.plugins.pre.dedupeSlashes());

server.pre((req: any, res: any, next: any): any => {
    let pwd: string | undefined = req.headers.authorization;
    if (pwd === env.getValue("PWD")) {
        return next();
    }
    res.send(500, "密码错误");
});


server.post('/amazon/getPriceByAsin', async (req: any, res: any, next: any): Promise<any> => {
    let asinList: Array<string> | undefined = req.body.asin;
    let sendEmail: boolean | undefined = req.body.sendEmail;
    if (!asinList) {
        res.send(500, "asin不能为空，请输入asin");
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
    }
    return next();
})

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
        res.header('Access-Control-Allow-Origin', req.headers.origin);

        return res.send(204);
    } else
        return res.send(new restify.MethodNotAllowedError());
}

server.on('MethodNotAllowed', unknownMethodHandler);

server.listen(3001, '127.0.0.1', function (): void {
    console.log('%s listening at %s', server.name, server.url)
});
