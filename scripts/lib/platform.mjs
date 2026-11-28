// Bot 在哪个平台上用（bot.yaml 的 platform，取值只在 schema 里定义，单测核对这里的常量还在枚举里）。
// 不写就是 Grok Bot。OpenBot 的 Bot 没有 x.ai 模板链接，装法是复制安装提示词，内容就是仓库里 bots/<slug>/ 的文件。
// 纯函数，不读盘：校验内核（浏览器、Function 也用）、摘要和页面共用。
export const GROK_BOT = 'Grok Bot'
export const OPENBOT = 'OpenBot'

/** 归一成两个取值之一：只有明确写了 OpenBot 才算 OpenBot。 */
export const platformOf = (data) => data?.platform === OPENBOT ? OPENBOT : GROK_BOT

// 两种「文件」权限各归各的平台：Grok Bot 读写云电脑，OpenBot 读写你自己的电脑。
export const CLOUD_FILES = '云电脑文件'
export const LOCAL_FILES = '本机文件'
