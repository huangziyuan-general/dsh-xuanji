// lib/server-api.js — 服务端 REST API（对齐 dsh-novel-forge 的 /api/* 模式）。
//
// 浏览器面板（src/client 构建出的 lib/client.js）通过 fetch() 调这些端点：
//   GET /health        探活 + 版本
//   GET /trend         人生K线逐年 OHLC（xuanji_trend 同引擎）
//   GET /tarot         每日一牌 / 三牌阵（xuanji_tarot 同引擎）
// 全部只读、纯本地确定性计算，零 token。
//
// 安全：Host/Origin 本机白名单 + fence header。**这套防线只对浏览器威胁模型成立**：
// 它挡的是跨站页面调用（fence 用的自定义头会触发 CORS 预检，服务端不发
// Access-Control-Allow-* 就过不去），挡不住本机进程——FENCE_HEADER 是常量值，
// 任何本地程序带上 `Host: 127.0.0.1` + `x-dsh-xuanji: 1` 就能读全部端点（含生辰、
// 城市、所问何事）。若要把威胁模型扩到「防同机其它进程」，需要每次启动随机会话令牌，
// 目前未做，故此处如实限定措辞，不在 README 里笼统称作「三道防线」。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PREFIX, FENCE_HEADER, trusted, fail, parsePath } from './server-http.js';
import { handle as handleXuanji, setVersion, setConfig } from './server-routes/xuanji.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

// 版本号单一来源 = package.json（构建闸与面板徽标同源）。
try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    setVersion(pkg.version);
} catch { /* 版本读不到只影响 /health 徽标，不挡路由 */ }

/**
 * 注册 REST API 路由。
 * @param {object} ctx - cordis 上下文（需宿主提供 webServer 服务）
 * @param {object} [config] - 宿主配置（dayunCount / ziShi），透传给排盘引擎，
 *   保证面板（REST 面）与 xuanji_bazi 工具面用同一套晚子时口径。
 */
export function registerServerApi(ctx, config) {
    if (config) setConfig(config);
    ctx.inject(['webServer'], (wctx) => {
        wctx.effect(() => wctx.webServer.register({
            kind: 'prefix',
            path: PREFIX,
            handler: async (req, res) => {
                // ① DNS rebinding 防线：Host 由浏览器按真实目标填写、页面无法伪造。
                const hostname = String(req.headers.host ?? '').toLowerCase().replace(/:\d+$/, '');
                if (!LOCAL_HOSTS.includes(hostname)) {
                    fail(res, 403, 'FORBIDDEN_HOST', `只允许本机访问（Host「${hostname}」不在本机白名单）`);
                    return;
                }
                // ② Origin 存在时（跨域 fetch/POST 总是带）也必须本机；畸形 Origin 直接拒。
                const origin = req.headers.origin;
                if (origin !== undefined) {
                    try {
                        const oh = new URL(String(origin)).hostname;
                        if (!LOCAL_HOSTS.includes(oh)) {
                            fail(res, 403, 'FORBIDDEN_ORIGIN', 'Origin 非本机，已拒绝');
                            return;
                        }
                    } catch {
                        fail(res, 403, 'FORBIDDEN_ORIGIN', 'Origin 畸形，已拒绝');
                        return;
                    }
                }
                // ③ fence header：普通跨域页面 fetch 带不上它。
                if (!trusted(req)) {
                    fail(res, 403, 'FORBIDDEN', `missing fence header（${FENCE_HEADER}: 1）`);
                    return;
                }
                const segments = parsePath(req.url);
                // 参数守卫（strParam 超长、boundedIntParam 越界）现在会抛，
                // 且抛出点分布在各个 handler 里、不在 runEngine 的 try 内——
                // 这里兜一层，避免一个畸形 query 直接把整个 REST 面打挂。
                try {
                    if (handleXuanji(req, res, segments)) return;
                } catch (error) {
                    if (error?.name === 'RangeError') {
                        fail(res, 400, 'BAD_PARAM', String(error?.message ?? error));
                    } else {
                        fail(res, 500, 'INTERNAL', '面板计算出错，请查看宿主日志——这是插件缺陷，不是你的输入问题。');
                    }
                    return;
                }
                fail(res, 404, 'NOT_FOUND', 'unknown resource');
            },
        }), 'dsh-xuanji: server-api');
    });
}
