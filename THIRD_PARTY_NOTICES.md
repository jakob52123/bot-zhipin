# 第三方代码声明

## Prompt 与 Skills 收录内容

Prompt 一律收录原文，英文 Prompt 另配本站中文译文。每个条目页面标明原作者、具体出处、原版权行和许可；原页没写许可的，标「版权归原作者，原页未声明许可」。转载内容不因收录而改用本站代码的许可证。原作者要求下架时，维护者会删除对应条目，见 [维护指南](docs/dev/MAINTAINING.md#收录或下架-prompt--skill仅维护者)。Skill 不转载 SKILL.md 全文。

## bloub

- 用途：按 slug 生成默认头像（`site/.vitepress/theme/vendor/bloub/`）
- 来源：https://github.com/jeremy-prt/bloub （提交 `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`，目录 `src/bot/`）
- 许可证：MIT，Copyright (c) 2026 Jérémy Perret，全文见 `site/.vitepress/theme/vendor/bloub/LICENSE`
- 本站 `LiveBot.vue` 的渲染方式、`live/gaze.ts` 的视线参数参考了 jeremy-prt/bloub 的 `src/components/BloubBot.vue` 和 `src/ui/gaze.ts`（MIT，提交 `b4bb3c1`）。

## VitePress

- 用途：站点生成器（npm 依赖，不随仓库分发）
- 许可证：MIT

## library/ 收录的第三方内容

`library/` 是混合许可的原料目录，每条的许可以文件头或 `links.jsonl` 里的 `license` 为准，总说明见 `library/LICENSES.md`。下面列出需要保留声明的来源。

### MIT

以下仓库的内容按 MIT 许可收录，版权声明分别为：

- cobusgreyling/grok-bot-templates（提交 `4f3f28b4e6578cd227ff7f4b78ec91d15fd091b5`）：Copyright (c) 2026 Cobus Greyling
- elie222/botdirectory.ai（提交 `447d18f1b6b70a7fa3ade8676bf28d1f8540c124`）：Copyright (c) 2026 Inbox Zero Inc.
- sit-in/awesome-grokbot-playbooks（提交 `a0984780ce733b750366fa23999e0a32d90dc44b`）：Copyright (c) 2026 awesome-grokbot-playbooks contributors
- majiayu000/awesome-grok-bot 中标为 MIT 的 11 行目录数据（提交 `34ae6ed87f6d1af227c29fa41795014fd9db35d7`）：Copyright (c) 2026 majiayu000

四份 MIT 许可正文相同，原文如下：

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### CC BY 4.0

- ZeroPointRepo/GrokBotDev 的 `content/`（提交 `48fec858f3968e12cb149ad205fe4ff059d8f2d1`）：© GrokBot.dev contributors，CC BY 4.0（https://creativecommons.org/licenses/by/4.0/）。每条都在文件头的 `attribution` 里署名，并在 `changes` 里写明本站改了什么。
- kydlikebtc/awesome-grokbot 中标为 CC-BY-4.0 的目录行，文字继承自上面的 GrokBotDev，署名随行保留。

### CC0 1.0

RongleCat/awesome-grok-bot（提交 `e50ac2f8dd2f5fe83827bf2a2b9f70e50d893be1`）、majiayu000/awesome-grok-bot（提交 `34ae6ed`，目录数据和配方）、kydlikebtc/awesome-grokbot（提交 `f64dc25af7f823bcc697ad7d5fa675b397934d82`，CC0 行）已放弃权利，不需要署名；本站仍逐条注明来源。

## Noto Sans SC

- 用途：分享图的 Medium 和 Bold 字体（随仓库分发静态 OTF 子集）
- 来源：https://github.com/notofonts/noto-cjk/releases/tag/Sans2.004 （简体中文 Noto Sans CJK SC）
- 许可证：OFL-1.1，全文见 `scripts/og/fonts/OFL.txt`

## satori

- 用途：将分享图文字转为 SVG 路径（npm 依赖，不随仓库分发）
- 许可证：MPL-2.0

## @resvg/resvg-js

- 用途：将分享图 SVG 光栅化为 PNG（npm 依赖，不随仓库分发）
- 许可证：MPL-2.0
