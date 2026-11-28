#!/usr/bin/env python3
"""在 Bot 直聘（https://bot.jiachengbo.com）的收录库里找 Prompt、Skill 和 Grok Bot。

只用 Python 3.8+ 标准库。

  python3 find.py 周报                      搜全部类型
  python3 find.py 代码 审查 --kind skill     只搜 Skill，多个词用空格分开
  python3 find.py --get prompt/<slug>        看一条的详情（正文、安装命令、导入链接）
  python3 find.py --get prompt/<slug> --original   英文 Prompt 打印英文原文

环境变量 BOT_ZHIPIN_URL 可换站点根地址（本地验收用）。
"""
import argparse
import hashlib
import http.client
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request

DEFAULT_BASE = 'https://bot.jiachengbo.com'
BASE = (os.environ.get('BOT_ZHIPIN_URL') or DEFAULT_BASE).strip().rstrip('/')
CACHE_DIR = os.path.join(os.path.expanduser('~'), '.cache', 'bot-zhipin')
TTL = 24 * 3600
RETRY_AFTER = 600  # 联网失败后 10 分钟内直接用旧缓存，不再每次干等
TIMEOUT = 10
KIND_LABEL = {'prompt': 'Prompt', 'skill': 'Skill', 'bot': 'Grok Bot'}
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]*$')
# 字段分组和权重：名字 > 用途 > 场景/标签/分类/开场白 > 作者、slug。
GROUPS = (
    (5.0, ('title', 'name', 'nameZh', 'titleOriginal')),
    (3.0, ('purpose',)),
    (2.0, ('scenarios', 'tags', 'category', 'starters', 'models')),
    (1.0, ('author', 'slug')),
)
# 适用工具（Claude Code、Codex……）是筛选属性，几乎每个 Skill 都有：只认整个名字或名字的第一个词
# （claude code、claude、codex），给很低的分，免得单独一个 code 让所有 Skill 都算命中。
AGENT_WEIGHT = 0.5
CJK_RUN = r'[\u3400-\u9fff\uf900-\ufaff]+'
SPLIT = re.compile(r'[\s,;:!?/|、。，；：！？]+')

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8')
    except (AttributeError, ValueError):
        pass


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(2)


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'bot-zhipin-skill/1.0', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        if error.code == 404:
            raise LookupError('没有这条（404）：' + url)
        raise ConnectionError('Bot 直聘返回了错误 {}：{}'.format(error.code, url))
    except (urllib.error.URLError, OSError, http.client.HTTPException) as error:
        reason = getattr(error, 'reason', error)
        raise ConnectionError('连不上 Bot 直聘（{}）。检查网络后再试，或直接打开 {}/prompts/、{}/skills/ 自己翻。'.format(reason, BASE, BASE))
    except ValueError:
        raise ConnectionError('Bot 直聘返回的不是有效的 JSON：' + url)


def cache_path():
    if BASE == DEFAULT_BASE:
        return os.path.join(CACHE_DIR, 'index.json')
    return os.path.join(CACHE_DIR, 'index-{}.json'.format(hashlib.sha1(BASE.encode('utf-8')).hexdigest()[:10]))


def read_cache(path):
    try:
        with open(path, encoding='utf-8') as handle:
            data = json.load(handle)
        return data if isinstance(data.get('items'), list) else None
    except (OSError, ValueError, AttributeError):
        return None


def fail_mark(path):
    return path + '.fail'


def recently_failed(path):
    try:
        return time.time() - os.path.getmtime(fail_mark(path)) < RETRY_AFTER
    except OSError:
        return False


def touch(path, remove=False):
    try:
        if remove:
            os.remove(path)
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8'):
                pass
    except OSError:
        pass


def load_index(refresh=False):
    """返回 (索引, 来源)：'online' 刚从网上拉的，'cache' 还新鲜的本机缓存，'stale' 连不上、退回的旧缓存。"""
    path = cache_path()
    cached = read_cache(path)
    if cached is not None and not refresh:
        try:
            fresh = time.time() - os.path.getmtime(path) < TTL
        except OSError:
            fresh = False
        if fresh:
            return cached, 'cache'
        if recently_failed(path):
            print('（刚才连不上 Bot 直聘，先用本机缓存的旧索引；加 --refresh 强制重新拉）', file=sys.stderr)
            return cached, 'stale'
    try:
        data = fetch(BASE + '/data/index.json')
        if not isinstance(data, dict) or not isinstance(data.get('items'), list):
            raise ConnectionError('索引格式不对：' + BASE + '/data/index.json')
    except (ConnectionError, LookupError) as error:
        if cached is not None:
            touch(fail_mark(path))
            print('{}\n（这次先用本机缓存的旧索引，可能不是最新的）'.format(error), file=sys.stderr)
            return cached, 'stale'
        fail(str(error))
    touch(fail_mark(path), remove=True)
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        temp = path + '.tmp'
        with open(temp, 'w', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False)
        os.replace(temp, path)
    except OSError:
        pass  # 缓存写不进去不影响这次搜索
    return data, 'online'


def fold(value):
    if isinstance(value, list):
        return '\n'.join(fold(item) for item in value)
    if not isinstance(value, str):
        return ''
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', value).lower()).strip()


_PATTERNS = {}


def contains(piece, text):
    """英文、数字按词边界找（pr 不会命中 prompt；四位以上的词允许后面接字母，review 能命中 reviews）；汉字按子串找。"""
    if not piece.isascii():
        return piece in text
    pattern = _PATTERNS.get(piece)
    if pattern is None:
        tail = '' if len(piece) >= 4 else '(?![a-z0-9])'
        pattern = _PATTERNS[piece] = re.compile('(?<![a-z0-9])' + re.escape(piece) + tail)
    return pattern.search(text) is not None


def variants(term):
    """一个词的几种拆法。英文、数字整段算一块；汉字相邻两两一组（代码审查 → 代码/码审/审查），
    四个字以上再按不重叠的两字一块拆一次（简历优化 → 简历/优化），免得「历优」这种跨词片段拉低分数。"""
    overlap, chunks = [], []
    for run in re.findall(r'[a-z0-9][a-z0-9.+#-]*|' + CJK_RUN, term):
        if run.isascii() or len(run) < 2:
            overlap.append(run)
            chunks.append(run)
        else:
            pairs = [run[i:i + 2] for i in range(len(run) - 1)]
            overlap.extend(pairs)
            if len(run) >= 4:
                chunks.extend(run[i:i + 2] for i in range(0, len(run) - 1, 2))
                if len(run) % 2:
                    chunks.append(run[-2:])
            else:
                chunks.extend(pairs)
    return [parts for parts in (overlap, chunks) if parts]


def term_score(term, texts, agents):
    """整词命中：每个命中的字段组都加分。再按片段算整条的覆盖率：每个片段取它命中的最高权重，打六折，
    命中的片段不到四成不算（只中一两个零碎片段多半是巧合）。两部分相加，原词完整出现的条目总排在只凑上半截的前面。"""
    full = sum(weight for weight, text in texts if contains(term, text))
    if term in agents:
        full += AGENT_WEIGHT
    best = 0.0
    for parts in variants(term):
        weights = [max([weight for weight, text in texts if contains(part, text)] or [0.0]) for part in parts]
        if sum(1 for weight in weights if weight) / len(parts) >= 0.4:
            best = max(best, sum(weights) / len(parts) * 0.6)
    return full + best


def agent_names(item):
    names = set()
    for agent in item.get('agents') or []:
        name = fold(agent)
        if name:
            names.add(name)
            names.add(name.split(' ')[0])
    return names


def score(item, terms, phrase):
    texts = [(weight, '\n'.join(fold(item.get(key)) for key in keys)) for weight, keys in GROUPS]
    agents = agent_names(item)
    total, missed = 0.0, 0
    for term in terms:
        points = term_score(term, texts, agents)
        if not points:
            missed += 1
        total += points
    if not total:
        return 0.0
    if len(terms) > 1 and (phrase in texts[0][1] or phrase in fold(item.get('slug')).replace('-', ' ')):
        total += 3.0
    return total * (0.5 ** missed)


def search(args):
    index, origin = load_index(args.refresh)
    terms = [term for term in SPLIT.split(fold(' '.join(args.words))) if term]
    if not terms:
        fail('给几个关键词，比如：python3 find.py 周报')
    phrase = ' '.join(terms)
    items = [item for item in index['items'] if not args.kind or item.get('kind') == args.kind]
    ranked = sorted(((score(item, terms, phrase), order, item) for order, item in enumerate(items)), key=lambda row: (-row[0], row[1]))
    hits = [row for row in ranked if row[0] > 0]
    if hits:
        floor = hits[0][0] * 0.2
        hits = [row for row in hits if row[0] >= floor]
    if not hits:
        print('「{}」没找到{}。{}换个说法再搜，或者打开 {}/prompts/、{}/skills/、{}/ 自己翻。'.format(
            ' '.join(args.words), ' ' + KIND_LABEL[args.kind] if args.kind else '',
            {'cache': '用的是本机缓存的索引，先加 --refresh 用最新的再搜一次；还是没有就',
             'stale': '连不上 Bot 直聘，只查了本机的旧索引，没搜到不代表站上没有。可以'}.get(origin, ''),
            BASE, BASE, BASE))
        return
    shown = hits[:args.limit]
    print('「{}」找到 {} 条{}：'.format(' '.join(args.words), len(hits), '，列出前 {} 条'.format(len(shown)) if len(hits) > len(shown) else ''))
    for number, (_, _, item) in enumerate(shown, 1):
        kind = item.get('kind')
        title = item.get('title') or item.get('slug')
        if kind == 'bot' and item.get('name') and item.get('name') != title:
            title = '{}（{}）'.format(title, item['name'])
        elif kind == 'skill' and item.get('name') and item.get('name') != title:
            title = '{}（{}）'.format(title, item['name'])
        extra = [item.get('category'), item.get('author')]
        if kind == 'skill' and item.get('agents'):
            extra.append('/'.join(item['agents']))
        if kind == 'prompt' and item.get('hasBody') is False:
            extra.append('仅摘要')
        if kind == 'prompt' and item.get('lang') == 'en':
            extra.append('英文原文')
        label = 'OpenBot' if kind == 'bot' and item.get('platform') == 'OpenBot' else KIND_LABEL.get(kind, kind)
        print('{}. [{}] {}/{}  {} · {}'.format(number, label, kind, item.get('slug'), title, ' · '.join(x for x in extra if x)))
        print('   {}  {}'.format(item.get('purpose', ''), item.get('detailUrl', '')))


def parse_target(value):
    value = value.strip().rstrip('/')
    match = re.search(r'(prompt|skill|bot)s?/([^/?#]+?)(?:\.json)?$', value)
    if not match or not SLUG.match(match.group(2)):
        fail('--get 要写成 <类型>/<slug>，比如 prompt/weekly-report；类型是 prompt、skill、bot 之一')
    return match.group(1), match.group(2)


def section(title, body):
    if body:
        print('\n## ' + title)
        print(body.rstrip())


def show_prompt(data, original):
    head = data.get('title', '')
    if data.get('titleOriginal'):
        head += '（{}）'.format(data['titleOriginal'])
    print('# ' + head)
    print('类型：Prompt · {} · 正文语言 {}'.format(data.get('category', ''), data.get('lang', '')))
    print('用途：' + data.get('purpose', ''))
    print('详情页：' + data.get('detailUrl', ''))
    text = data.get('body') if original else data.get('text')
    if text:
        note = ''
        if data.get('models'):
            print('适用模型：' + '、'.join(data['models']))
        if data.get('bodyZh') and not original:
            note = '（原文是英文，下面是本站译的中文版；要英文原文加 --original）'
        print('\n## 正文{}'.format(note))
        print('----- 正文开始 -----')
        print(text.rstrip('\n'))
        print('----- 正文结束 -----')
    else:
        source = (data.get('source') or {}).get('url') or data.get('detailUrl', '')
        print('\n这条只收了摘要，没有正文，原文在：' + source)
        section('摘要', data.get('summary'))
    images = data.get('images') or []
    if images:
        section('效果图', '\n'.join('- {}：{}{}'.format(image.get('alt') or '图', image.get('url', ''),
                                                       '（{}）'.format(image['credit']) if image.get('credit') else '') for image in images))
    section('怎么用', data.get('usage'))
    section('署名', (data.get('creditOriginal') or data.get('credit')) if original else data.get('credit'))


def show_skill(data):
    head = data.get('title', '')
    if data.get('name') and data['name'] != head:
        head += '（{}）'.format(data['name'])
    print('# ' + head)
    print('类型：Skill · {} · 适用：{}'.format(data.get('category', ''), '、'.join(data.get('agents') or []) or '未注明'))
    print('用途：' + data.get('purpose', ''))
    print('详情页：' + data.get('detailUrl', ''))
    section('介绍', data.get('summary'))
    installs = data.get('install') or []
    if installs:
        print('\n## 安装（按你用的工具挑一条）')
        for entry in installs:
            print('- [{}] {}'.format(entry.get('agent') or '通用', entry.get('command', '')))
            if entry.get('note'):
                print('  说明：' + entry['note'])
    if data.get('requires'):
        section('依赖', '\n'.join('- ' + item for item in data['requires']))
    examples = data.get('examples') or []
    if examples:
        print('\n## 作者给的示例（{} 个）'.format(len(examples)))
        for number, example in enumerate(examples, 1):
            print('\n### {}. {}'.format(number, example.get('caption', '')))
            ask = example.get('askZh') or example.get('ask')
            reply = example.get('replyZh') or example.get('reply')
            if ask:
                print('用户说：' + ask.strip())
            if reply:
                print('它回：' + reply.strip())
            for image in example.get('images') or []:
                print('截图：{} {}'.format(image.get('alt') or '', image.get('url', '')).strip())
            for key, label in (('video', '视频'), ('file', '文件')):
                if example.get(key):
                    print('{}：{}'.format(label, example[key]))
            source = example.get('source') or {}
            if source.get('url') or example.get('rights'):
                print('出处：{}{}'.format(source.get('url') or '', '（{}）'.format(example['rights']) if example.get('rights') else ''))
    section('署名', data.get('credit'))


def show_bot(data):
    head = data.get('title') or data.get('name', '')
    if data.get('name') and data['name'] != head:
        head += '（{}）'.format(data['name'])
    print('# ' + head)
    openbot = data.get('platform') == 'OpenBot'
    print('类型：{} · {}'.format('OpenBot 的 Bot' if openbot else 'Grok Bot 模板', data.get('category', '')))
    print('一句话：' + data.get('tagline', ''))
    if openbot:
        print('导入：没有模板链接，把最后那段「安装提示词」发给 OpenBot 里任意一个 Agent')
    else:
        print('导入：在 Grok Bot App 里打开这个模板页导入 → ' + (data.get('templateUrl') or ''))
    if data.get('projectUrl'):
        print('源项目：' + data['projectUrl'])
    print('详情页：' + data.get('detailUrl', ''))
    facts = []
    if data.get('permissions'):
        facts.append('会用到：' + '、'.join(data['permissions']))
    if data.get('quotaCost'):
        facts.append('额度消耗：' + data['quotaCost'])
    cn = data.get('cn') or {}
    if cn.get('fit') or cn.get('note'):
        facts.append('国内好不好用：{}{}'.format(cn.get('fit') or '', '，' + cn['note'] if cn.get('note') else ''))
    if facts:
        print('\n'.join(facts))
    if data.get('starters'):
        section('导入后可以直接发给它', '\n'.join('- ' + line for line in data['starters']))
    section('编辑点评', data.get('editorNote'))
    section('署名', data.get('credit'))
    if openbot:
        section('安装提示词', data.get('installPrompt'))


def get(args):
    kind, slug = parse_target(args.get)
    try:
        data = fetch('{}/data/{}s/{}.json'.format(BASE, kind, slug))
    except LookupError as error:
        fail('{}\n先用 python3 find.py <关键词> 搜一下，确认类型和 slug。'.format(error))
    except ConnectionError as error:
        fail(str(error))
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    elif kind == 'prompt':
        show_prompt(data, args.original)
    elif kind == 'skill':
        show_skill(data)
    else:
        show_bot(data)


def main():
    parser = argparse.ArgumentParser(description='在 Bot 直聘的收录库里找 Prompt、Skill 和 Grok Bot')
    parser.add_argument('words', nargs='*', help='关键词，多个用空格分开')
    parser.add_argument('--kind', choices=sorted(KIND_LABEL), help='只搜一种')
    parser.add_argument('--limit', type=int, default=8, help='最多列几条（默认 8）')
    parser.add_argument('--refresh', action='store_true', help='不用缓存，重新拉索引')
    parser.add_argument('--get', metavar='类型/slug', help='看一条的详情，如 prompt/<slug>')
    parser.add_argument('--original', action='store_true', help='配合 --get：英文 Prompt 打印英文原文')
    parser.add_argument('--json', action='store_true', help='配合 --get：原样打印详情 JSON')
    args = parser.parse_intermixed_args()
    args.limit = max(1, args.limit)
    if not re.match(r'^https?://[^/\s]+', BASE):
        fail('BOT_ZHIPIN_URL 要写成 http(s)://开头的站点根地址，比如 https://bot.jiachengbo.com')
    if args.get:
        get(args)
    else:
        search(args)


if __name__ == '__main__':
    main()
