---
name: video-clip-sop-setup
description: 第一次在这台 Mac 上下载、配置、检查并试跑开源项目 video-clip-sop（百搭剪辑）。我说「装一下百搭剪辑」「帮我把视频剪辑 SOP 跑起来」，或项目根目录还没有 配置.json 时用。
---

# 第一次装好并试跑百搭剪辑

按顺序做，每做完一步用大白话告诉我结果。全程守 ROLE.md 里的「你不做什么」。

## 1. 下载

- 克隆到 `~/video-clip-sop`：`git clone https://github.com/CrazyGoudanli/video-clip-sop ~/video-clip-sop`。没有 git 就先装（`xcode-select --install`，或者用 Homebrew 装）。
- 文件夹已经在了：先看 `git -C ~/video-clip-sop remote -v` 是不是这个仓库。是就 `git -C ~/video-clip-sop pull`，里面已有的 `配置.json`、`data/`、录像一样都不动；不是就停下问我放哪。

## 2. 读规则

完整读项目里的 `AGENTS.md` 和 `README.md`。之后都按 `AGENTS.md` 的「第一次启动」来做，它写的比这里细的，照它的。

## 3. 配置

- 根目录已经有 `配置.json` 就跳过这一步，告诉我在用哪份配置。
- 没有：按 `启动问卷.md` 问我，一次只问一两个，用提问工具给选项，把默认值放第一个。我答不上来或说「默认」的，用 `配置模板.json` 里的值。
- 「驱动AI」写成你自己底层用的那个：Claude Code、Codex、Cursor CLI 或 Pi。「驱动命令」照 README 里对应的那条填。你底层不是这四个之一，就问我用哪个（推荐 Claude Code），它要另外装好、登录。
- 「代理」：先查这台电脑上网走不走代理（`scutil --proxy`、终端里的 `HTTPS_PROXY`），把查到的地址当一个选项给我。后台定时任务不会自己带上终端里的代理。
- 问完生成 `配置.json`，在里面写明哪些是我确认的、哪些用了默认值。

## 4. 检查环境

- 运行 `python3 3-工具/check_env.py --fix`。
- 标 `[AI]` 的缺失项你直接装（git、Python 依赖、本机转写工具、ChatCut 接入等），装完再查一次。
- ChatCut 接入你自己：Claude Code、Codex 用 `3-工具/工具说明/剪辑_ChatCut.md` 里的命令；Cursor CLI 用 `python3 3-工具/脚本/connect_chatcut.py cursor`；Pi 用 `python3 3-工具/脚本/connect_chatcut.py pi`。
- 标 `[用户]` 的（安装或登录 ChatCut、在发布浏览器里登录各平台、扫码、登录 AI 账号、存密钥）：一句大白话告诉我做什么，等我说好了再查。
- 反复运行，直到只剩要我处理的项；⚠️ 告诉我就行，不挡着往下走。

## 5. 自检

运行 `python3 3-工具/verify_flow.py`，告诉我一共几项、几项失败、为什么失败、怎么修。

## 6. 打开工作台

- 运行 `zsh 3-工具/脚本/autorun.sh install-workbench`，告诉我浏览器打开哪个地址（默认 `http://127.0.0.1:8765/`，以配置里的端口为准）。
- 用确认卡问我要不要开自动监测。我同意了，再运行 `zsh 3-工具/脚本/autorun.sh install`。`自动执行` 保持 `false`（只提醒、不自动拉起 AI），等流程跑顺了我说开再改。

## 7. 试跑

- 告诉我把一段录像放进项目里的 `待加工/` 文件夹；喜欢的封面和视频可以放进 `参考/封面/`、`参考/视频风格/`。
- 我放好以后，照 `db.py next` 一个环节一个环节往下跑：整理、转写和挑片段、剪辑、写文案、做封面。
- 每到要我拍板的地方（挑片段、看成片、选封面、授权发布）就停下，告诉我去工作台的哪一页点什么。

## 8. 总结

最后给我一份简短总结：装了什么、哪些已经能用、哪些还要我处理、试跑走到了哪一步、遇到了什么问题和下一步。
