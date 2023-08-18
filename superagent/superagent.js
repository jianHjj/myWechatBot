const superagent = require('superagent')

require('superagent-proxy')(superagent)

var proxy = process.env.http_proxy || 'http://127.0.0.1:10810';

let cookieMap = new Map();

let defaultCookieMap = new Map();
defaultCookieMap.set('usa', 'session-id=132-9578608-3161013; session-id-time=2082787201l; i18n-prefs=USD; ubid-main=134-7272345-3685851; lc-main=en_US; session-token="DxIPMU7gynIZOmY3KCZmHavmijHrE51p1LgLx3W8qzjmIiaIC8sdAfvGRCJnz03dUIsfMADb9IPtTuMx2f8/WCAER/Oz/AbqNMoZar5AjjA1jgnKABJxuVwesu/gYV2CqFHNu5QDNJhFqdQZ7bC70nHzGDr8w91DToXheGKDX4Aka4R9pktb0jYrO9R9JnGLUiEU4bLwNJf4qUN0N00Al0VdFBeeB46UU6tszURQTOk="; csm-hit=tb:s-ZSBMZ4CMSYHMETT7FQBK|1692342327655&t:1692342330443&adb:adblk_unk');
defaultCookieMap.set('canada','session-id=137-9601198-8117855; session-id-time=2082787201l; i18n-prefs=CAD; notice28=0; ubid-acbca=134-4568679-1927410; lc-acbca=en_CA; session-token=ey6RQlfXOT3vDpELw01XDI/plfYESdGKlxWjl1RQWSI7sYkbDgS6I79H65uNwChoBzvZN57u9C75hq/DuNA4AguRyV9J8AMMIB76nOxw4KsJiAkvHwj8D37CPF5xSAH0zCd5LurNv9XGJTYepqZEQGT/0+aARAv1kTtUT6I6VL3jBuLwqch2VM3mUED46aqK7jiElr0wwQv4MdJpF17utPjmgq0O1vdC2xCkJdI/RzY=; csm-hit=tb:F9MKKQ231NESAEBND1DQ+s-F9MKKQ231NESAEBND1DQ|1692342529447&t:1692342529447&adb:adblk_unk');

/**
 *
 * @param url 请求地址
 * @param method 请求方法
 * @param params 请求参数
 * @param data 请求body
 * @param domain 域名 or 其它关键字
 * @param cookies cookies
 * @param spider 是否需要爬取数据
 * @param platform 请求哪个平台 tx 天行数据  tl 图灵机器人
 * @returns {Promise}
 */
function req({url, method, params, data, domain, cookies, spider = false, platform = 'tx'}) {
    let cookieTemp = cookieMap.get(domain);
    let cookie = cookieTemp && cookieTemp !== '' ? cookieTemp : '';
    return new Promise(function (resolve, reject) {
        superagent(method, url)
            .timeout({
              response: 6000,  // Wait 6 seconds for the server to start sending,
              deadline: 60000, // but allow 1 minute for the file to finish loading.
            })
            .query(params)
            .proxy(proxy)
            .send(data)
            .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36')
            .set('Referer', url)
            .set('Cookie',cookie)
            .end(function (err, response) {
                if (err) {
                    reject(err)
                }
                if (spider) { // 如果是爬取内容，直接返回页面html
                    if (response && response.text) {
                        resolve(response.text);

                        if (response.text.length < 10000) {
                            //爬取失败
                            console.log(new Date().toLocaleString() + " error 弹出人机验证页 [url = " + url + "]");
                            let cookieCache = cookieMap.get(domain);
                            let defaultCookie = defaultCookieMap.get(domain);
                            if (cookieCache && cookieCache !== defaultCookie) {
                                //当前cookie失效 and 当前cookie不等于默认cookie
                                if (defaultCookie && defaultCookie !== '') {
                                    //设置成默认cookie
                                    console.log(new Date().toLocaleString() + " warn 设置成默认cookie [url = " + url + "]");
                                    cookieMap.set(domain, defaultCookie);
                                }
                            }

                            if (cookieCache === defaultCookie) {
                                //如果是默认cookie爬取失败将cookie设置为空
                                console.log(new Date().toLocaleString() + " warn 将cookie设置为空 [url = " + url + "]");
                                cookieMap.set(domain, '');
                            }
                        }

                        //获取cookie
                        let cookieTemp = response.headers["set-cookie"];
                        let cookieCache = cookieMap.get(domain);
                        if (!cookieCache || cookieCache === '') {
                            let c = cookieTemp && cookieTemp !== '' ? cookieTemp : '';
                            cookieMap.set(domain, c);
                        }
                    }
                } else { // 如果是非爬虫，返回格式化后的内容
                    const res = JSON.parse(response.text);
                    if (res.code !== 200 && platform === 'tx' || res.code !== 100000 && platform === 'tl') {
                        console.error('接口请求失败', res.msg || res.text)
                    }
                    resolve(res)
                }
            })
    })
}

module.exports = {
    req
}
