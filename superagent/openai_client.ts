const {Configuration, OpenAIApi} = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const ai: string = "AI: ";
const human: string = "Human: ";
const conversation_base: string = "AI: I am an AI created by OpenAI. How can I help you today?Human: 用中文AI: 您好，我是由OpenAI创建的AI助理。有什么可以帮您的吗？";
let conversation_context: string = conversation_base;

/**
 * 发送提问
 * @param content 提问内容
 * @return 返回回答
 */
export async function say(content: string): Promise<string> {
    //上下文保存
    try {
        conversation_context = conversation_context + human + content;
        let res = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: conversation_context,
            temperature: 0.9,
            max_tokens: 1000,
            stream: false,
            top_p: 1,
            best_of: 1,
            echo: true,
            frequency_penalty: 0,
            logprobs: 0,
            presence_penalty: 0.6,
            stop: [" Human:", " AI:"]
        });
        let reply: string = res.data.choices[0].text;
        let indexOf: number = reply.lastIndexOf(ai);
        reply = reply.slice(indexOf);
        conversation_context = conversation_context + reply;
        return reply.replace(ai, '').trim();
    } catch (e) {
        conversation_context = conversation_base;
        return "openai服务器出现异常，上下文重置，请重新提问~";
    }
}
