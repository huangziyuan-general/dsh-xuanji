# 行为评测（discipline evals）

引擎测试证明「算得对」，这一层证明「该不该这么答」。纪律原本只是一段 systemPrompt，
改坏了没人报警、模型违约了也没人知道——所以把它拆成可回归断言。

## 两类用例

| kind | 断言什么 | 举例 |
|---|---|---|
| `engine` | 引擎真跑一遍，纪律有没有做进代码 | 缺时辰不许补子时、没给出生地不许偷偷做真太阳时、非法日期要给中文错误 |
| `contract` | 纪律文本里这条约束还在不在 | Fail-Two、隐私、健康转诊、不承诺投资收益 |

模型侧的行为（比如「真会不会转诊」）没法在单测里跑模型，所以这类只保证**规则没被删掉**；
能被代码保证的部分一律走 `engine`，真跑真断言。

## 加一条用例

在 `cases/` 新建一个 JSON（文件名 = id）：

```json
{
  "schemaVersion": "1.0.0",
  "id": "021-xxx",
  "rule": "纪律 N（一句话说明这条约束）",
  "kind": "engine",
  "engine": "bazi",
  "args": { "year": 1990, "month": 8, "day": 16, "gender": "male" },
  "assertions": [
    { "path": "meta.timeKnown", "operator": "equals", "value": false },
    { "path": "meta.solar", "operator": "not-matches", "value": "12:00", "why": "时辰未知时不许打印占位时刻" }
  ]
}
```

可用算子：`equals` `not-equals` `missing` `exists` `matches` `not-matches`
`matches-any` `not-matches-any`（后两个对数组逐项匹配）。
特殊 path：`throws`（断言抛错及其消息正则）、`repeatable`（同输入两次结果必须一致）。
引擎入口在 `test/discipline.test.mjs` 的 `ENGINES` 表里登记。

跑：`node --test test/discipline.test.mjs`（`npm test` 也带上了）。
