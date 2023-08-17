const superagent = require('superagent')

require('superagent-proxy')(superagent)

var proxy = process.env.http_proxy || 'http://127.0.0.1:10810';

let cookie = '';

/**
 *
 * @param url 请求地址
 * @param method 请求方法
 * @param params 请求参数
 * @param data 请求body
 * @param cookies cookies
 * @param spider 是否需要爬取数据
 * @param platform 请求哪个平台 tx 天行数据  tl 图灵机器人
 * @returns {Promise}
 */
function req({url, method, params, data, cookies, spider = false, platform = 'tx'}) {
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

                        //获取cookie
                        cookie = response.headers["set-cookie"];
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
