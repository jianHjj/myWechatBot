// 配置文件
module.exports = {
// 每日说配置项（必填项）
  NAME: '公主殿下', //女朋友备注姓名
  NICKNAME: '公主殿下', //女朋友昵称
  MEMORIAL_DAY: '2021/10/23', //你和女朋友的纪念日
  CITY: '广州', //女朋友所在城市（城市名称，不要带“市”）
  CRON_EXP: {tz: 'Asia/Shanghai', rule: '13 20 5 * * *'}, //定时发送时间 每天13点14分0秒发送，规则见 /schedule/index.js
  TXAPIKEY: 'bc3cd84973cd8218a526d756a79fe891', //此处须填写个人申请的天行apikey,请替换成自己的 申请地址https://www.tianapi.com/signup.html?source=474284281

// 高级功能配置项（非必填项）
  AUTOREPLY: false, //自动聊天功能 默认开启, 关闭设置为: false
  DEFAULTBOT: '1', //设置默认聊天机器人 0 天行机器人 1 图灵机器人 2 天行对接的图灵机器人，需要到天行机器人官网充值（50元/年，每天1000次）
  AUTOREPLYPERSON: ['公主殿下'], //指定多个好友开启机器人聊天功能   指定好友的备注，最好不要带有特殊字符
  TULINGKEY: '357d7bd975264980a418ce6dde16e740',//图灵机器人apikey,需要自己到图灵机器人官网申请，并且需要认证

// (自定义) 如果你有 DIY 和基本的编程基础, 可以在这自己定义变量, 用于 js 文件访问, 包括设置简单的定时任务, 例如可以定义 task 数组
  tasks: [{
    alias: '公主殿下',
    taskMsg: '宝宝，国庆节到了\n除了要开心，七天小长假我们也要安排起来，说走就走咱有的是时间~\n噗噗童鞋天天爱你哦 Salute!',
    date: new Date(2022, 9, 1, 5, 20, 0)
  }],

  // 测试node-schedule 时区问题
  // month 从 0-11 代表 1-12 月 , day alias date
  // example : 2022-9-13 14:21:00 => new Date(2022, 8, 13, 14, 21, 0) / {year: 2022, month: 8, date: 13, hour: 14, minute: 21, second: 0, tz: 'Asia/Shanghai'}
  testTask: [{
    testMsg: '测试定时任务时区',
    testDate: new Date(2022, 8, 13, 14, 49, 0)
  }],
}
