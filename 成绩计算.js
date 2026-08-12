function handler(input) {
  if (
    !input?.form ||
    !input?.query ||
    !input?.query?.userid ||
    !input?.query?.month
  ) {
    return {
      result: "error:关键参数丢失，请重试。",
    };
  }
  const query = input.query;
  const form = input.form;
  const path =
    "https://open.feishu.cn/anycross/trigger/callback/MDRkMjEzODNjOTQ0ZjJlMWUzNTIzZDQwY2I3NDQ0M2Ey";
  const res = {
    result: "success",
  };
  if (query.record && query.record !== "" && query.record !== "null") {
    // 修改
    res["record"] = query.record;
  } else {
    return {
      result: "error:未读取自评信息。",
    };
  }
  res["feild"] = {
    上级评分: query.score,
    总监评分: query.ceo || null,
    完成日期: Date.now(),
    考核评语: query.comment,
  };
  const safeParse = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v !== "" && v !== "null") {
      try {
        return JSON.parse(v);
      } catch (e) {
        return null;
      }
    }
    return null;
  };
  const { categories, figure, score, ceo, selfScore } = {
    categories: safeParse(query.categories),
    figure: safeParse(query.figure),
    score: safeParse(query.score),
    ceo: safeParse(query.ceo),
    selfScore: safeParse(query.selfScore),
  };
  // 验证三个关键数组是否都存在且为数组类型，只有数据完整时才进行评分计算
  if (
    Array.isArray(figure) &&
    Array.isArray(score) &&
    Array.isArray(categories)
  ) {
    // 存储每项指标的加权评分结果
    const pow = [];
    // 累计所有指标的加权总分
    let total = 0;
    // 保留两位小数的辅助函数，避免浮点数精度问题
    const round2 = (n) => Math.round(n * 100) / 100;
    // 遍历每个评分项，计算加权评分
    score.forEach((num, index, arr) => {
      // 计算单个指标的加权分：自评分×自评权重 + 上级评分×上级权重 + 总监评分×总监权重
      // figure[0]是自评权重，figure[1]是上级权重，figure[2]是总监权重，需要除以100转换为小数
      const pp = round2(
        (selfScore?.[index] || 0) * (figure?.[0] / 100 || 0) +
          (score?.[index] || 0) * (figure?.[1] / 100 || 0) +
          (ceo?.[index] || 0) * (figure?.[2] / 100 || 0),
      );
      // 将计算好的加权评分存入数组
      pow.push(pp);
      // 累加到总分
      total += pp;
    });
    // 用于追踪当前在pow数组中的位置索引
    let idx = 0;
    // 按类别汇总评分：categories数组存储每个类别包含的指标数量
    categories.push(1)
    categories.push(1);
    const lei = categories.map((n) => {
      // 从pow数组中截取当前类别对应的评分片段，并求和
      const sum = pow.slice(idx, idx + n).reduce((s, val) => s + val, 0);
      // 更新索引位置，跳过已处理的指标数量
      idx += n;
      // 返回该类别的总分（保留两位小数）
      return round2(sum);
    });
    // 将加权评分数组转为JSON字符串存入结果字段
    res["feild"]["加权评分"] = JSON.stringify(pow);
    // 将类别评分数组转为JSON字符串存入结果字段
    res["feild"]["类别评分"] = JSON.stringify(lei);
    // 将最终考核总分存入结果字段（保留两位小数）
    res["feild"]["考核分值"] = round2(total);
  }

  return res;
}
