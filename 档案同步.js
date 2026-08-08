function handler(input) {
  // 需要调整，细化拆分多模块，预留阶段检查口。要识别某些词条可以选择上传至平台，部分词条从平台同步到多维表。具体在深度比较时，选择的结果。还需要有定期更新的值的考量
  const DA = input.DA ? TabToObj(input.DA, "name") : [];
  const DAB = input.DAB ? TabToObj(input.DAB, "name") : [];
  const VILLAGE_MAP = input.village;
  const worker = input.worker;
  const ids = [];
  let newfam = [];

  // 预编译正则表达式
  const ADDRESS_VALIDATION_REGEX =
    /^(?!.*广州市)(?=.*[\u4e00-\u9fa5]+市)(?=.*[\u4e00-\u9fa5]+区)(?!.*番禺区)(?:[\u4e00-\u9fa5]+市)(?:[\u4e00-\u9fa5]+区)(?:[镇乡村街路]|$)/;

  // 地址验证函数
  const isValidAddress = (address) => ADDRESS_VALIDATION_REGEX.test(address);

  // 缓存电话号码匹配结果
  const phoneMatchCache = new Map();
  const matchPhoneCached = (phone) => {
    if (phoneMatchCache.has(phone)) {
      return phoneMatchCache.get(phone);
    }
    const result = matchPhone(phone);
    phoneMatchCache.set(phone, result);
    return result;
  };

  // 配置项：定义字段同步规则
  // 说明：
  // - TO_PLATFORM: 需要从多维表同步到平台的字段（多维表值覆盖平台值）
  // - TO_BASE: 需要从平台同步到多维表的字段（平台值覆盖多维表值）
  // - ROUTINE_UPDATES: 需要定期更新的字段（双向同步，优先多维表值）
  const SYNC_CONFIG = {
    // 从多维表同步到平台的字段（多维表值覆盖平台值）
    TO_PLATFORM: [
      "name", // 姓名
      "cardNo", // 身份证号
      "sex", // 性别
      "age", // 年龄
      "job", // 职业
      "company", // 工作单位
      "jobStatus", // 就业状态
      "unJobReason", // 未就业原因
      "educationLevel", // 教育程度
      "degree", // 学位
      "school", // 毕业院校
      "educationOtherRemark", // 教育情况其他说明
      "telphone", // 手机号码
      "fixedTelephone", // 固定电话
      "emegencyPhone", // 紧急联系人电话
      "livingAddress", // 现居住地址
      "censusAddrss", // 户籍地址
      "membersNum", // 共同生活成员数
      "nation", // 民族
      "assessGrading", // 评估等级
      "socialWorkSpotName", // 社工站名称
      "socialWorkSpotId", // 社工站ID
      "community", // 社区
      "residenceAreaId", // 居住区域ID
      "district", // 区
      "street", // 街道
      "personType", // 人员类型
      "personType2", // 人员类型2
      "healthCondition", // 健康状况
      "healthConditionTxt", // 健康状况说明
      "mentalDisability", // 精神残疾情况
      "mentalCondition", // 精神状态
      "mentalDisabilityLevel", // 精神残疾等级
      "healthOther", // 健康状况其他说明
      "marryStatus", // 婚姻状态
      "marryStatusTxt", // 婚姻状态说明
      "childSon", // 儿子数
      "childDaughter", // 女儿数
      "childOther", // 其他子女数
      "emegencyContact", // 紧急联系人
      "careAbility", // 自理能力
      "minder", // 照料人
      "careResource", // 照料资源
      "livingType", // 居住类型
      "livingTypeTxt", // 居住类型说明
      "separationStatus", // 分居情况
      "cjrLevel", // 困境儿童等级
      "remarks", // 备注
      "socialWorkerName", // 负责社工姓名
      "socialWorkerId", // 负责社工ID
    ],
    // 从平台同步到多维表的字段（平台值覆盖多维表值）
    TO_BASE: [
      "智慧平台ID", // 平台ID
      "家庭档案ID", // 家庭档案ID
    ],
    // 需要定期更新的字段（双向同步，优先多维表值）
    ROUTINE_UPDATES: ["age", "assessGrading"], // 年龄、评估等级
  };

  // 预定义所有映射表
  const FOLLOW_LEVEL_MAP = {
    一级: "1",
    二级: "2",
    三级: "3",
    四级: "4",
    五级: "5",
    六级: "6",
  };

  // 正则表达式定义
  const COMPANY_REGEX = /\(([\u4e00-\u9fa5]+)\)/;
  const PHONE_REGEX = /(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)/;
  const CHILD_SON_REGEX = /\d+(?=[子儿])/;
  const CHILD_DAUGHTER_REGEX = /\d+(?=女)/;
  const DISABILITY_LEVEL_REGEX = /[一二三四]级/;

  // 自理能力映射
  const CARE_ABILITY_MAP = {
    全自理: "2",
    自理: "2",
    半自理: "4",
    失能: "3",
    全失能: "1",
  };

  // 居住类型映射
  const LIVING_TYPE_MAP = [
    { pattern: ["自置", "购", "商品", "住宅", "小区"], code: "0" },
    { pattern: ["公租", "廉租", "保障"], code: "1" },
    { pattern: ["出租", "租房"], code: "2" },
    { pattern: ["自建", "宅基", "私建", "自有"], code: "3" },
    { pattern: ["回迁"], code: "4" },
    { pattern: ["宿舍", "寄宿"], code: "5" },
    { pattern: ["院"], code: "6" },
    { pattern: ["安置"], code: "7" },
  ];

  // 残疾等级排序
  const DISABILITY_ORDER = [" ", "四级", "三级", "二级", "一级"];

  // 获取社工ID
  const getSocialWorkerId = (workerName, workerMap) => {
    return workerMap.get(workerName) || "";
  };

  // 处理职业信息
  const processJobInfo = (val, res) => {
    if (!val || val.length === 0) return;

    const jobText = val.toString();
    if (JOB_REGEX.test(jobText)) {
      res["job"] = jobText;
      res["jobStatus"] = "1"; // 就业
    } else {
      const companyMatch = jobText.match(COMPANY_REGEX);
      if (companyMatch) {
        res["company"] = companyMatch[1];
        res["jobStatus"] = "1"; // 就业
      } else {
        res["unJobReason"] = jobText;
        res["jobStatus"] = "2"; // 未就业
      }
    }
  };

  // 处理健康状况
  const processHealthCondition = (val, res) => {
    if (!val || val.length === 0) return;

    const healthText = val.toString();
    let found = false;

    // 检查精神状况
    Object.entries(Mental_Disability).forEach(([key, code]) => {
      if (healthText.includes(key)) {
        res["mentalCondition"] = "2"; // 有精神疾病
        res["mentalDisability"] = code;
        found = true;
      }
    });

    if (found) return;

    // 检查身体状况
    Object.entries(Health_Condition).forEach(([key, code]) => {
      if (healthText.includes(key)) {
        res["healthCondition"] = code;
        found = true;
      }
    });

    if (!found) {
      res["healthCondition"] = "0"; // 其它
      res["healthConditionTxt"] = healthText;
    }
  };

  // 处理残疾信息
  const processDisability = (val, res) => {
    if (!val || val.length === 0) return;

    const disabilityText = val.toString();
    const disabilityLevelMatch = disabilityText.match(DISABILITY_LEVEL_REGEX);

    if (disabilityLevelMatch) {
      res["mentalCondition"] = "2"; // 有残疾
      res["mentalDisabilityLevel"] = disabilityLevelMatch[0];

      // 确定残疾等级代码
      const levelIndex = DISABILITY_ORDER.indexOf(disabilityLevelMatch[0]);
      if (levelIndex > 0) {
        res["mentalDisability"] = levelIndex.toString();
      }
    } else {
      res["healthOther"] = disabilityText;
    }
  };

  // 处理紧急联系人
  const processEmergencyContact = (val, res, currentName) => {
    if (!val || val.length === 0) return;

    const contactText = val.toString();
    if (!res["emegencyContact"]) {
      res["emegencyContact"] = contactText;
    } else if (
      res["emegencyContact"] &&
      !val.includes(res["emegencyContact"]) &&
      !res["emegencyContact"].includes(val)
    ) {
      res["emegencyContact"] += "," + val;
    }
  };

  // 处理居住类型
  const processLivingType = (val, res) => {
    if (!val || val.length === 0) return;

    const livingText = val.toString();
    let found = false;

    LIVING_TYPE_MAP.forEach((item) => {
      if (item.pattern.some((pattern) => livingText.includes(pattern))) {
        res["livingType"] = item.code;
        found = true;
      }
    });

    if (!found) {
      res["livingType"] = "9"; // 其它
      res["livingTypeTxt"] = livingText;
    }
  };

  const MARGINAL_PERSON_TYPE_MAP = [
    { condition: (Da) => Da["年龄"] < 13, code: "1", desc: "儿童家庭" },
    { condition: (Da) => Da["年龄"] < 18, code: "2", desc: "青少年" },
    { condition: (Da) => Da["年龄"] >= 60, code: "3", desc: "老年人" },
    { condition: (Da) => Da["性别"] === "女", code: "4", desc: "妇女" },
    { condition: () => true, code: "6", desc: "其他人员" },
  ];

  const PERSON_TYPE_MAP = {
    低保: {
      code: "1",
      desc: "低保对象",
      condition: (val, obj) => val.includes("低保") && !val.includes("边缘"),
    },
    低保边缘家庭: {
      code: "2",
      desc: "低边对象",
      condition: (val) => val.includes("低保边缘") || val.includes("低边"),
    },
    特困: {
      code: "3",
      desc: "特困人员",
      condition: (val) => val.includes("特困") && !val.includes("单身"),
    },
    困境儿童: {
      code: "4",
      desc: "其他困境儿童",
      condition: (val) =>
        val.includes("困境") &&
        val.includes("儿童") &&
        !val.includes("孤儿") &&
        !val.includes("事实无人"),
    },
    留守老人: {
      code: "5",
      desc: "留守老人",
      condition: (val, obj) => val.includes("留守") && obj["年龄"] >= 60,
    },
    孤寡: {
      code: "6",
      desc: "孤寡老人",
      condition: (val, obj) => val.includes("孤寡") && obj["年龄"] >= 60,
    },
    特殊困难重度残疾人: {
      code: "7",
      desc: "特殊困难重度残疾人",
      condition: (val) =>
        val.includes("重残") && (val.includes("低保") || val.includes("特困")),
    },
    独居: {
      code: "8",
      desc: "独自一人居住老人(独居)",
      condition: (val, obj) => val.includes("独居") && obj["年龄"] >= 60,
    },
    支出型困难家庭: {
      code: "9",
      desc: "刚性支出特困人员困难家庭(支出型困难家庭)",
      condition: (val) => val.includes("支出型") || val.includes("刚性支出"),
    },
    残疾人: {
      code: "10",
      desc: "残疾人(不含特殊困难重度残疾人)",
      condition: (val) =>
        val.includes("残疾") &&
        !val.includes("重残") &&
        !val.includes("低保") &&
        !val.includes("特困"),
    },
    流浪乞讨人员: {
      code: "11",
      desc: "流浪乞讨",
      condition: (val) => val.includes("流浪") || val.includes("乞讨"),
    },
    留守儿童: {
      code: "12",
      desc: "农村留守儿童",
      condition: (val, obj) => val.includes("留守") && obj["年龄"] < 18,
    },
    单身特困母亲: {
      code: "13",
      desc: "单身特困母亲",
      condition: (val, obj) =>
        (val.includes("单亲") || val.includes("单身")) && obj["性别"] === "女",
    },
    留守妇女: {
      code: "14",
      desc: "农村留守妇女",
      condition: (val, obj) => val.includes("留守") && obj["性别"] === "女",
    },
    空巢: {
      code: "15",
      desc: "空巢老年人",
      condition: (val, obj) => val.includes("空巢") && obj["年龄"] >= 60,
    },
    失能: {
      code: "16",
      desc: "失能老年人",
      condition: (val, obj) => val.includes("失能") && obj["年龄"] >= 60,
    },
    重残: {
      code: "17",
      desc: "重残老年人",
      condition: (val, obj) => val.includes("重残") && obj["年龄"] >= 60,
    },
    计生特殊家庭: {
      code: "18",
      desc: "计划生育特殊家庭等特殊困难老年人",
      condition: (val, obj) =>
        (val.includes("计划生育") || val.includes("计生")) && obj["年龄"] >= 60,
    },
    孤儿: {
      code: "19",
      desc: "孤儿",
      condition: (val) => val.includes("孤儿"),
    },
    事实无人: {
      code: "20",
      desc: "事实无人抚养儿童",
      condition: (val) =>
        val.includes("事实无人") || val.includes("事实无人抚养"),
    },
  };

  const Health_Condition = {
    健康: "1",
    良好: "1",
    糖尿病: "2",
    高血压: "3",
    腰椎间盘突出: "4",
    中风: "5",
    冠心疾病: "6",
    冠心病: "6",
    类风湿: "7",
    甲状腺疾病: "8",
    甲亢: "8",
    甲减: "8",
    癌症: "9",
    肿瘤: "9",
    心脏病: "10",
    肾病: "11",
    肝病: "12",
    肺病: "13",
    哮喘: "14",
    关节炎: "15",
    骨质疏松: "16",
    白内障: "17",
    青光眼: "18",
    皮肤病: "19",
    传染病: "20",
    其它: "0",
  };

  const Mental_Disability = {
    抑郁: "1",
    抑郁症: "1",
    精神分裂: "2",
    精神分裂症: "2",
    躁狂: "3",
    躁狂症: "3",
    癫痫: "4",
    癫痫病: "4",
    双相障碍: "5",
    双相情感障碍: "5",
    焦虑: "6",
    焦虑症: "6",
    强迫症: "7",
    恐怖症: "8",
    创伤后应激障碍: "9",
    精神发育迟滞: "10",
    智力障碍: "10",
    痴呆: "11",
    阿尔茨海默病: "11",
  };

  // 预编译正则表达式
  const JOB_REGEX = /^[\u4e00-\u9fa5]+$/;

  // 预创建DAB的快速查找映射
  const dabMap = new Map();
  DAB.forEach((itemB) => {
    if (itemB && typeof itemB === "object") {
      if (itemB["档案号"]) dabMap.set(itemB["档案号"], itemB["record_id"]);
      if (itemB["身份证"]) dabMap.set(itemB["身份证"], itemB["record_id"]);
      if (itemB["服务对象"]) dabMap.set(itemB["服务对象"], itemB["record_id"]);
    }
  });

  // 预创建ZH的快速查找映射
  const zhMap = new Map();
  (input.ZH || []).forEach((data) => {
    if (data && typeof data === "object") {
      if (data.id) zhMap.set(`id:${data.id}`, data);
      if (data.cardNo) zhMap.set(`cardNo:${data.cardNo}`, data);
      if (data.dossiersNumber)
        zhMap.set(`dossiersNumber:${data.dossiersNumber}`, data);
    }
  });

  // 预创建worker的快速查找映射
  const workerMap = new Map();
  worker.forEach((item) => {
    if (item.name) workerMap.set(item.name, item.id);
  });

  const newData = DA.map((item) => {
    // 更新档案年龄
    const age = item["身份证"] ? calculateAge(item["身份证"]) * 1 : undefined;
    const ageo = item["年龄"] * 1 || undefined;
    if (age) item["年龄"] = age;

    // 更新兜底类型
    if (item["困境类型"]) item["兜底类型"] = DoDi(item["困境类型"]);
    // 更新电话信息 - 使用缓存
    if (item["其他联系电话"])
      item["紧急联系电话"] = matchPhoneCached(item["其他联系电话"]);
    if (item["常用电话"]) item["联系电话"] = matchPhoneCached(item["常用电话"]);

    const newItem = transform(item, VILLAGE_MAP, workerMap);

    // 优化人户分离状态判断
    if (
      newItem["separationStatus"] !== "0" &&
      item["livingAddress"] &&
      isValidAddress(item["livingAddress"]) &&
      item["assessGrading"] === "6"
    ) {
      newItem["separationStatus"] = "1"; // 0=户籍在、人在,1=户籍在、人不在,2=户籍不在、人在
    }

    // 使用快速映射查找DAB记录
    let recB;
    if (item["档案号"] && dabMap.has(item["档案号"])) {
      recB = dabMap.get(item["档案号"]);
    } else if (item["身份证"] && dabMap.has(item["身份证"])) {
      recB = dabMap.get(item["身份证"]);
    } else if (item["服务对象"] && dabMap.has(item["服务对象"])) {
      recB = dabMap.get(item["服务对象"]);
    }

    const rec = item["record_id"] || undefined;

    // 使用快速映射查找ZH记录
    let oldItem;
    if (item["智慧平台ID"] && zhMap.has(`id:${item["智慧平台ID"]}`)) {
      oldItem = { ...zhMap.get(`id:${item["智慧平台ID"]}`) };
    } else if (item["身份证"] && zhMap.has(`cardNo:${item["身份证"]}`)) {
      oldItem = { ...zhMap.get(`cardNo:${item["身份证"]}`) };
    } else if (
      item["档案号"] &&
      zhMap.has(`dossiersNumber:${item["档案号"]}`)
    ) {
      oldItem = { ...zhMap.get(`dossiersNumber:${item["档案号"]}`) };
    }

    let res = { recB, rec };
    if (age && ageo && age !== ageo) res["age"] = age;

    if (oldItem) {
      if (!item["家庭档案ID"])
        res["familyId"] = oldItem.hasOwnProperty("familyId")
          ? oldItem["familyId"]
          : "";
      if (!item["智慧平台ID"])
        res["id"] = oldItem.hasOwnProperty("id") ? oldItem["id"] : "";
      if (oldItem.hasOwnProperty("id")) ids.push(oldItem["id"]);
      if (!item["红棉热线ID"] && item["负责社工"]) {
        // 未登记ID进入流程
        res["worker"] = {
          cardID: newItem.cardNo || null,
          worker: item["负责社工"] || undefined,
          customerName: newItem.name || null,
          token: input.token,
        };
      }
      if (res["familyId"] === "" && oldItem["id"]) {
        // 需要在平台新建家庭档案的
        newfam.push({
          id: oldItem["id"],
          fields: item,
          cookies: input.cookie,
        });
      }

      // 删除无法回传的值 - 使用更高效的方式
      const { familyId, createDate, updateDate, ...cleanOldItem } = oldItem;

      const diff = compareObjects(newItem, cleanOldItem, "platform"); //比较两个对象，返回差异值
      if (diff.diff.hasOwnProperty("remarks")) {
        res["worker"] = {
          cardID: newItem.cardNo || cleanOldItem.cardNo || null,
          worker: item["负责社工"] || "",
          customerName: newItem.name || cleanOldItem.name || null,
          token: input.token,
        };
      }
      res["data"] = diff.data;
      res["diff"] = diff.diff;
    } else {
      // 平台上没有匹配的档案，需新建，只要翻译格式且不带id即可
      // 准备上传用fromDataArr的数据
      newItem["socialworkStation.id"] = input.swS.stationId;
      newItem["socialworkStation.name"] = input.swS.stationName;

      res["data"] = newItem;
      if (!newItem.hasOwnProperty("id")) {
        res["worker"] = {
          cardID: newItem.cardNo || null,
          worker: item["负责社工"] || "",
          customerName: newItem.name || null,
          token: input.token,
        };
      }
    }
    return res;
  });
  // 根据数据整理结果，进行筛选分类输出
  // 更新平台数据 - 仅包含配置中允许同步到平台的字段
  const upd = newData
    .filter(
      (val) =>
        val.hasOwnProperty("data") &&
        Object.keys(val["data"]).length > 2 &&
        !val["data"].hasOwnProperty("socialworkStation.name") &&
        !val["data"].hasOwnProperty("socialworkStation.id"),
    )
    .map((item) => {
      // 过滤出仅同步到平台和双向同步的字段
      const filteredData = {};
      Object.keys(item["data"]).forEach((key) => {
        if (
          SYNC_CONFIG.PLATFORM_ONLY.includes(key) ||
          SYNC_CONFIG.BIDIRECTIONAL.includes(key)
        ) {
          filteredData[key] = item["data"][key];
        }
      });
      return filteredData;
    });

  // 创建平台数据 - 包含所有必要字段
  const crea = newData
    .filter(
      (val) =>
        val.hasOwnProperty("data") &&
        Object.keys(val["data"]).length > 1 &&
        !val["data"].hasOwnProperty("id") &&
        (val["data"].hasOwnProperty("socialworkStation.name") ||
          val["data"].hasOwnProperty("socialworkStation.id")),
    )
    .map((item) => item["data"]);

  // 补充：添加多维表中有但平台中没有的数据到创建列表
  const zhIds = ids;
  const marginalInBaseOnly = (input.DA || [])
    .filter((item) => {
      const platformId = item["智慧平台ID"];
      return platformId && !zhIds.includes(platformId);
    })
    .map((item) => {
      const newItem = transform(item, VILLAGE_MAP, workerMap);
      newItem["socialworkStation.id"] = input.swS.stationId;
      newItem["socialworkStation.name"] = input.swS.stationName;
      return newItem;
    });
  crea.push(...marginalInBaseOnly);

  // 需要更新多维表档案 - 仅包含配置中允许同步到多维表的字段
  const rec = newData
    .filter(
      (val) =>
        (val.hasOwnProperty("diff") && Object.keys(val.diff).length > 0) ||
        (val.hasOwnProperty("id") && val["id"].length > 1) ||
        (val.hasOwnProperty("familyId") && val["familyId"].length > 1) ||
        val.hasOwnProperty("age"),
    )
    .map((item) => {
      const fields = {};

      // 处理智慧平台ID
      if (item.hasOwnProperty("id")) {
        fields["智慧平台ID"] = item.id;
      }

      // 处理家庭档案ID
      if (item.hasOwnProperty("familyId")) {
        fields["家庭档案ID"] = item.familyId;
      }

      // 处理年龄
      if (item.hasOwnProperty("age")) {
        fields["年龄"] = item.age;
      }

      // 处理更新内容 - 仅包含配置中允许同步到多维表的字段
      if (item.hasOwnProperty("diff")) {
        const filteredDiff = {};
        Object.keys(item.diff).forEach((key) => {
          // 转换平台字段名为多维表字段名
          const baseKey =
            key === "id"
              ? "智慧平台ID"
              : key === "familyId"
                ? "家庭档案ID"
                : key === "age"
                  ? "年龄"
                  : key;

          if (
            SYNC_CONFIG.BASE_ONLY.includes(baseKey) ||
            SYNC_CONFIG.BIDIRECTIONAL.includes(baseKey)
          ) {
            filteredDiff[baseKey] = item.diff[key];
          }
        });

        if (Object.keys(filteredDiff).length > 0) {
          fields["更新内容"] = JSON.stringify(filteredDiff);
        }
      }

      return {
        record_id: item.rec,
        record: item.recB,
        fields: fields,
      };
    });
  const recA = rec.map((item) => {
    const { record, ...rest } = item; // 解构并排除record字段  rest 的作用是收集对象中剩余未被解构的属性
    return rest;
  });
  const recB = rec
    .filter((val) => val.record)
    .map((item) => {
      const res = JSON.parse(JSON.stringify(item));
      res["record_id"] = res.record;
      delete res.record;
      return res;
    });
  // 红棉热线调整坐席
  const hmrx = newData
    .filter((val) => val.hasOwnProperty("worker"))
    .map((item) => ({
      recA: item.rec,
      recB: item.recB,
      hmrx: item.worker,
    }));
  // 未在档 - 平台中有但多维表中没有的数据
  const nodata =
    (input.ZH || []).filter((item) => !ids.includes(item.id)) || [];

  // 新增：多维表中有但平台中没有的数据（已包含在crea中）
  const baseOnlyInCrea =
    marginalInBaseOnly.length > 0
      ? marginalInBaseOnly.map((item) => item.id)
      : [];

  return {
    upd,
    crea,
    recA,
    recB,
    newfam,
    newData,
    nodata,
    hmrx,
    baseOnlyInCrea, // 返回多维表中有但平台中没有的数据ID列表
  };
}

// 比较两个对象，返回差异值和需要同步的数据
// 同步规则：
// 1. 先处理定期更新字段（双向同步，优先多维表值）
// 2. 处理TO_PLATFORM字段（多维表值覆盖平台值）
// 3. 处理TO_BASE字段（平台值覆盖多维表值）
function compareObjects(obj1, obj2) {
  const diff = {};
  const platformData = {}; // 需要同步到平台的数据
  const baseData = {}; // 需要同步到多维表的数据
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  // 平台字段到多维表字段的映射
  const FIELD_MAPPING = {
    // 基础信息
    id: "智慧平台ID",
    familyId: "家庭档案ID",
    age: "年龄",
    name: "姓名",
    cardNo: "身份证",
    sex: "性别",
    telphone: "联系电话",
    fixedTelephone: "固定电话",
    emegencyPhone: "紧急联系电话",
    emegencyContact: "紧急联系人",

    // 地址信息
    livingAddress: "居住地址",
    censusAddrss: "户籍地址",

    // 人员类型
    personType: "人员类型",
    personType2: "人员类型2",

    // 健康状况
    healthCondition: "健康状况",
    healthConditionTxt: "健康状况说明",
    mentalDisability: "精神残疾情况",
    mentalCondition: "精神状态",
    mentalDisabilityLevel: "精神残疾等级",
    healthOther: "健康状况其他说明",

    // 婚姻家庭
    marryStatus: "婚姻状态",
    marryStatusTxt: "婚姻状态说明",
    childSon: "儿子数",
    childDaughter: "女儿数",
    childOther: "其他子女数",
    membersNum: "同住人数",

    // 职业教育
    job: "职业",
    company: "工作单位",
    jobStatus: "就业状态",
    unJobReason: "未就业原因",
    educationLevel: "教育程度",
    degree: "学位",
    school: "毕业院校",
    educationOtherRemark: "教育情况其他说明",

    // 社工信息
    socialWorkerName: "负责社工",
    socialWorkerId: "社工ID",
    remarks: "备注",

    // 居住情况
    livingType: "居住类型",
    livingTypeTxt: "居住类型说明",
    careAbility: "自理能力",
    minder: "照料人",
    careResource: "照料资源",
    separationStatus: "分居情况",

    // 评估信息
    assessGrading: "跟进级别",
    cjrLevel: "困境儿童等级",

    // 社工站信息
    socialWorkSpotName: "社工站名称",
    socialWorkSpotId: "社工站ID",
    community: "社区",
    residenceAreaId: "居住区域ID",
    district: "区",
    street: "街道",

    // 系统信息
    dossiersNumber: "档案号",
    nation: "民族",
  };

  // 获取多维表字段名
  const getBaseKey = (key) => {
    return FIELD_MAPPING[key] || key;
  };

  // 1. 处理定期更新字段（双向同步，优先多维表值）
  SYNC_CONFIG.ROUTINE_UPDATES.forEach((key) => {
    if (obj1[key] !== obj2[key]) {
      // 双向同步，优先多维表值
      diff[key] = obj2[key] + "=>" + obj1[key];
      platformData[key] = obj1[key]; // 同步到平台
      baseData[key] = obj1[key]; // 同步到多维表
    }
  });

  // 2. 处理TO_PLATFORM字段（多维表值覆盖平台值）
  SYNC_CONFIG.TO_PLATFORM.forEach((key) => {
    // 跳过已经处理的定期更新字段
    if (SYNC_CONFIG.ROUTINE_UPDATES.includes(key)) return;

    if (obj1[key] !== obj2[key]) {
      diff[key] = obj2[key] + "=>" + obj1[key];
      platformData[key] = obj1[key]; // 多维表值覆盖平台值
    }
  });

  // 3. 处理TO_BASE字段（平台值覆盖多维表值）
  SYNC_CONFIG.TO_BASE.forEach((key) => {
    // 转换平台字段名为多维表字段名
    const baseKey = getBaseKey(key);

    // 跳过已经处理的定期更新字段
    if (SYNC_CONFIG.ROUTINE_UPDATES.includes(baseKey)) return;

    if (obj1[key] !== obj2[key]) {
      diff[key] = obj1[key] + "=>" + obj2[key];
      baseData[baseKey] = obj2[key]; // 平台值覆盖多维表值
    }
  });

  // 4. 处理所有其他字段的同步（扩展支持）
  allKeys.forEach((key) => {
    // 跳过已经处理过的字段
    if (
      SYNC_CONFIG.ROUTINE_UPDATES.includes(key) ||
      SYNC_CONFIG.TO_PLATFORM.includes(key) ||
      SYNC_CONFIG.TO_BASE.includes(key)
    ) {
      return;
    }

    // 只处理有差异的字段
    if (obj1[key] !== obj2[key]) {
      const baseKey = getBaseKey(key);
      diff[key] = obj1[key] + "=>" + obj2[key];

      // 根据字段类型决定同步方向
      if (
        key.startsWith("mental") ||
        key.startsWith("health") ||
        key === "careAbility"
      ) {
        // 健康相关字段优先使用平台值
        baseData[baseKey] = obj2[key];
      } else if (key === "name" || key === "cardNo" || key === "sex") {
        // 核心身份信息优先使用多维表值
        platformData[key] = obj1[key];
      }
    }
  });

  // 特殊规则处理
  allKeys.forEach((key) => {
    if (
      (key === "emegencyContact" ||
        key === "familyId" ||
        key === "assessGrading") &&
      (!(key in obj1) || obj1[key] == null)
    ) {
      // 忽略删除的紧急联系人
    } else if (
      (key === "livingAddress" || key === "censusAddrss") &&
      obj2[key] &&
      obj2[key].includes(obj1[key])
    ) {
      // 特殊规则：地址包含关系，忽略
    } else if (key === "personType2" && platformData[key]) {
      // 人员类型2变更需要特殊标记
      platformData["changeSjyType"] = 1; //1=变更，0=默认
    }
  });

  // 准备平台同步数据
  platformData["id"] = obj2["id"] || obj1["id"] || null;
  if (Object.keys(diff).length > 0) platformData["fromType"] = "sjy";

  // 准备多维表同步数据
  const baseFields = { ...baseData };
  if (Object.keys(diff).length > 0) {
    // 格式化更新内容为更易读的格式：字段名: 旧值=>新值
    const updateContent = Object.entries(diff)
      .map(([field, change]) => `${field}: ${change}`)
      .join("; ");
    baseFields["更新内容"] = updateContent;
  }

  return {
    diff,
    platformData,
    baseData: baseFields,
  };
}

// 封装的翻译函数，将档案数据翻译为平台格式
function transform(obj, VILLAGE_MAP, workerMap) {
  if (!obj || typeof obj !== "object") return {};
  // 村居映射
  const VILLAGE_Arr = Object.keys(VILLAGE_MAP).map((i) =>
    i.replace("居委", ""),
  );

  // 预编译正则表达式
  const JOB_REGEX = /^[\u4e00-\u9fa5]+$/;
  const COMPANY_REGEX = /\(([\u4e00-\u9fa5]+)\)/;
  const PHONE_REGEX = /(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)/;
  const CHILD_SON_REGEX = /\d+(?=[子儿])/;
  const CHILD_DAUGHTER_REGEX = /\d+(?=女)/;
  const DISABILITY_LEVEL_REGEX = /[一二三四]级/;
  const ADDRESS_VALIDATION_REGEX =
    /^(?!.*广州市)(?=.*[\u4e00-\u9fa5]+市)(?=.*[\u4e00-\u9fa5]+区)(?!.*番禺区)(?:[\u4e00-\u9fa5]+市)(?:[\u4e00-\u9fa5]+区)(?:[镇乡村街路]|$)/;

  // 地址验证函数
  const isValidAddress = (address) => ADDRESS_VALIDATION_REGEX.test(address);

  // 自理能力映射
  const CARE_ABILITY_MAP = {
    全自理: "2",
    自理: "2",
    半自理: "4",
    失能: "3",
    全失能: "1",
  };

  // 居住类型映射
  const LIVING_TYPE_MAP = [
    { pattern: ["自置", "购", "商品", "住宅", "小区"], code: "0" },
    { pattern: ["公租", "廉租", "保障"], code: "1" },
    { pattern: ["出租", "租房"], code: "2" },
    { pattern: ["自建", "宅基", "私建", "自有"], code: "3" },
    { pattern: ["回迁"], code: "4" },
    { pattern: ["宿舍", "寄宿"], code: "5" },
    { pattern: ["院"], code: "6" },
    { pattern: ["安置"], code: "7" },
  ];

  // 残疾等级排序
  const DISABILITY_ORDER = [" ", "四级", "三级", "二级", "一级"];

  // 身体状况映射
  const Health_Condition = {
    健康: "1",
    良好: "1",
    糖尿病: "2",
    高血压: "3",
    腰椎间盘突出: "4",
    中风: "5",
    冠心疾病: "6",
    冠心病: "6",
    类风湿: "7",
    甲状腺疾病: "8",
    甲亢: "8",
    甲减: "8",
    癌症: "9",
    肿瘤: "9",
    心脏病: "10",
    肾病: "11",
    肝病: "12",
    肺病: "13",
    哮喘: "14",
    关节炎: "15",
    骨质疏松: "16",
    白内障: "17",
    青光眼: "18",
    皮肤病: "19",
    传染病: "20",
    其它: "0",
  };

  // 精神状况映射
  const Mental_Disability = {
    抑郁: "1",
    抑郁症: "1",
    精神分裂: "2",
    精神分裂症: "2",
    躁狂: "3",
    躁狂症: "3",
    癫痫: "4",
    癫痫病: "4",
    双相障碍: "5",
    双相情感障碍: "5",
    焦虑: "6",
    焦虑症: "6",
    强迫症: "7",
    恐怖症: "8",
    创伤后应激障碍: "9",
    精神发育迟滞: "10",
    智力障碍: "10",
    痴呆: "11",
    阿尔茨海默病: "11",
  };

  // 获取社工ID
  const getSocialWorkerId = (workerName, workerMap) => {
    return workerMap.get(workerName) || "";
  };

  // 处理职业信息
  const processJobInfo = (val, res) => {
    if (!val || val.length === 0) return;

    const jobText = val.toString();
    if (JOB_REGEX.test(jobText)) {
      res["job"] = jobText;
      res["jobStatus"] = "1"; // 就业
    } else {
      const companyMatch = jobText.match(COMPANY_REGEX);
      if (companyMatch) {
        res["company"] = companyMatch[1];
        res["jobStatus"] = "1"; // 就业
      } else {
        res["unJobReason"] = jobText;
        res["jobStatus"] = "2"; // 未就业
      }
    }
  };

  // 处理健康状况
  const processHealthCondition = (val, res) => {
    if (!val || val.length === 0) return;

    const healthText = val.toString();
    let found = false;

    // 检查精神状况
    Object.entries(Mental_Disability).forEach(([key, code]) => {
      if (healthText.includes(key)) {
        res["mentalCondition"] = "2"; // 有精神疾病
        res["mentalDisability"] = code;
        found = true;
      }
    });

    if (found) return;

    // 检查身体状况
    Object.entries(Health_Condition).forEach(([key, code]) => {
      if (healthText.includes(key)) {
        res["healthCondition"] = code;
        found = true;
      }
    });

    if (!found) {
      res["healthCondition"] = "0"; // 其它
      res["healthConditionTxt"] = healthText;
    }
  };

  // 处理残疾信息
  const processDisability = (val, res) => {
    if (!val || val.length === 0) return;

    const disabilityText = val.toString();
    const disabilityLevelMatch = disabilityText.match(DISABILITY_LEVEL_REGEX);

    if (disabilityLevelMatch) {
      res["mentalCondition"] = "2"; // 有残疾
      res["mentalDisabilityLevel"] = disabilityLevelMatch[0];

      // 确定残疾等级代码
      const levelIndex = DISABILITY_ORDER.indexOf(disabilityLevelMatch[0]);
      if (levelIndex > 0) {
        res["mentalDisability"] = levelIndex.toString();
      }
    } else {
      res["healthOther"] = disabilityText;
    }
  };

  // 处理紧急联系人
  const processEmergencyContact = (val, res, currentName) => {
    if (!val || val.length === 0) return;

    const contactText = val.toString();
    if (!res["emegencyContact"]) {
      res["emegencyContact"] = contactText;
    } else if (
      res["emegencyContact"] &&
      !val.includes(res["emegencyContact"]) &&
      !res["emegencyContact"].includes(val)
    ) {
      res["emegencyContact"] += "," + val;
    }
  };

  // 处理居住类型
  const processLivingType = (val, res) => {
    if (!val || val.length === 0) return;

    const livingText = val.toString();
    let found = false;

    LIVING_TYPE_MAP.forEach((item) => {
      if (item.pattern.some((pattern) => livingText.includes(pattern))) {
        res["livingType"] = item.code;
        found = true;
      }
    });

    if (!found) {
      res["livingType"] = "9"; // 其它
      res["livingTypeTxt"] = livingText;
    }
  };

  // 边缘人群类型映射
  const MARGINAL_PERSON_TYPE_MAP = [
    {
      condition: (Da) => Da["年龄"] < 13,
      code: "1",
      desc: "儿童家庭",
    },
    {
      condition: (Da) => Da["年龄"] < 18,
      code: "2",
      desc: "青少年",
    },
    {
      condition: (Da) => Da["年龄"] >= 60,
      code: "3",
      desc: "老年人",
    },
    {
      condition: (Da) => Da["性别"] === "女",
      code: "4",
      desc: "妇女",
    },
    {
      condition: () => true, // 默认值，至少会返回这个
      code: "6",
      desc: "其他人员",
    },
  ];

  // 人员类型映射
  const PERSON_TYPE_MAP = {
    低保: {
      code: "1",
      desc: "低保对象",
      condition: (val, obj) => val.includes("低保") && !val.includes("边缘"),
    },
    低保边缘家庭: {
      code: "2",
      desc: "低边对象",
      condition: (val) => val.includes("低保边缘") || val.includes("低边"),
    },
    特困: {
      code: "3",
      desc: "特困人员",
      condition: (val) => val.includes("特困") && !val.includes("单身"),
    },
    困境儿童: {
      code: "4",
      desc: "其他困境儿童",
      condition: (val) =>
        val.includes("困境") &&
        val.includes("儿童") &&
        !val.includes("孤儿") &&
        !val.includes("事实无人"),
    },
    留守老人: {
      code: "5",
      desc: "留守老人",
      condition: (val, obj) => val.includes("留守") && obj["年龄"] >= 60,
    },
    孤寡: {
      code: "6",
      desc: "孤寡老人",
      condition: (val, obj) => val.includes("孤寡") && obj["年龄"] >= 60,
    },
    特殊困难重度残疾人: {
      code: "7",
      desc: "特殊困难重度残疾人",
      condition: (val) =>
        val.includes("重残") && (val.includes("低保") || val.includes("特困")),
    },
    独居: {
      code: "8",
      desc: "独自一人居住老人(独居)",
      condition: (val, obj) => val.includes("独居") && obj["年龄"] >= 60,
    },
    支出型困难家庭: {
      code: "9",
      desc: "刚性支出特困人员困难家庭(支出型困难家庭)",
      condition: (val) => val.includes("支出型") || val.includes("刚性支出"),
    },
    残疾人: {
      code: "10",
      desc: "残疾人(不含特殊困难重度残疾人)",
      condition: (val) =>
        val.includes("残疾") &&
        !val.includes("重残") &&
        !val.includes("低保") &&
        !val.includes("特困"),
    },
    流浪乞讨人员: {
      code: "11",
      desc: "流浪乞讨",
      condition: (val) => val.includes("流浪") || val.includes("乞讨"),
    },
    留守儿童: {
      code: "12",
      desc: "农村留守儿童",
      condition: (val, obj) => val.includes("留守") && obj["年龄"] < 18,
    },
    单身特困母亲: {
      code: "13",
      desc: "单身特困母亲",
      condition: (val, obj) =>
        (val.includes("单亲") || val.includes("单身")) && obj["性别"] === "女",
    },
    留守妇女: {
      code: "14",
      desc: "农村留守妇女",
      condition: (val, obj) => val.includes("留守") && obj["性别"] === "女",
    },
    空巢: {
      code: "15",
      desc: "空巢老年人",
      condition: (val, obj) => val.includes("空巢") && obj["年龄"] >= 60,
    },
    失能: {
      code: "16",
      desc: "失能老年人",
      condition: (val, obj) => val.includes("失能") && obj["年龄"] >= 60,
    },
    重残: {
      code: "17",
      desc: "重残老年人",
      condition: (val, obj) => val.includes("重残") && obj["年龄"] >= 60,
    },
    计生特殊家庭: {
      code: "18",
      desc: "计划生育特殊家庭等特殊困难老年人",
      condition: (val, obj) =>
        (val.includes("计划生育") || val.includes("计生")) && obj["年龄"] >= 60,
    },
    孤儿: {
      code: "19",
      desc: "孤儿",
      condition: (val) => val.includes("孤儿"),
    },
    事实无人: {
      code: "20",
      desc: "事实无人抚养儿童",
      condition: (val) =>
        val.includes("事实无人") || val.includes("事实无人抚养"),
    },
  };

  // 身体状况映射
  const Health_Condition = {
    健康: "1",
    良好: "1",
    糖尿病: "2",
    高血压: "3",
    腰椎间盘突出: "4",
    中风: "5",
    冠心疾病: "6",
    冠心病: "6",
    类风湿: "7",
    甲状腺疾病: "8",
    甲亢: "8",
    甲减: "8",
    癌症: "9",
    肿瘤: "9",
    心脏病: "10",
    肾病: "11",
    肝病: "12",
    肺病: "13",
    哮喘: "14",
    关节炎: "15",
    骨质疏松: "16",
    白内障: "17",
    青光眼: "18",
    皮肤病: "19",
    传染病: "20",
    其它: "0",
  };
  // 精神状况映射
  const Mental_Disability = {
    抑郁: "1",
    抑郁症: "1",
    精神分裂: "2",
    精神分裂症: "2",
    躁狂: "3",
    躁狂症: "3",
    癫痫: "4",
    癫痫病: "4",
    双相障碍: "5",
    双相情感障碍: "5",
    焦虑: "6",
    焦虑症: "6",
    强迫症: "7",
    恐怖症: "8",
    创伤后应激障碍: "9",
    精神发育迟滞: "10",
    智力障碍: "10",
    痴呆: "11",
    阿尔茨海默病: "11",
  };

  const res = Object.keys(obj).reduce((res, key) => {
    const val = obj[key];
    switch (key) {
      case "姓名":
        res["name"] = val;
        res["careResource"] = res["careResource"]
          ? res["careResource"] + ",2"
          : "2";
        break;
      case "身份证":
        res["cardNo"] = val.length > 10 ? val : "";
        break;
      case "智慧平台ID":
        res["id"] = val.length > 5 ? val : "";
        break;
      case "负责社工":
        res["remarks"] = "跟进社工：" + val;
        res["socialWorkerName"] = val;
        res["socialWorkerId"] = getSocialWorkerId(val, workerMap);
        break;
      case "性别":
        res["sex"] = val === "男" ? "0" : val === "女" ? "1" : "";
        break;
      case "年龄":
        res["age"] = val > 0 ? val + "" : "";
        break;
      case "职业":
        processJobInfo(val, res);
        break;
      case "学历":
        const sch =
          val.match(/\([\u4e00-\u9fa5]+\)/)?.[0].replace(/[()]/g, "") ?? " ";
        const deg =
          val.match(/^[\u4e00-\u9fa5][\u4e00-\u9fa5]*[\u4e00-\u9fa5]$/)?.[0] ??
          " ";
        if (sch != "" && obj["年龄"] < 29) {
          res["educationLevel"] = "1"; //在读
          res["school"];
        } else if (deg != "") {
          res["educationLevel"] = "2"; //毕业
          res["degree"] = deg;
        } else {
          res["educationLevel"] = "3"; //其他
          res["educationOtherRemark"] = val;
        }
        break;
      case "档案号":
        res["dossiersNumber"] = val;
        break;
      case "联系电话":
        res["telphone"] = val;
        res["fixedTelephone"] = /(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)/.test(val)
          ? val
          : "";
        break;
      case "紧急联系电话":
        res["emegencyPhone"] = val;
        res["fixedTelephone"] = /(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)/.test(val)
          ? val
          : "";
        break;
      case "居住地址":
        res["livingAddress"] = val;
        if (val.includes("石楼") || VILLAGE_Arr.some((t) => val.includes(t))) {
          // 未完善，无法筛出非辖区的对象
          res["separationStatus"] = "0"; //人户分离情况，“0”在，1户在 2人在
        }
        break;
      case "户籍地址":
        res["censusAddrss"] = val;
        break;
      case "同住人数":
        res["membersNum"] = val + 1 + "";
        break;
      case "民族":
        res["nation"] =
          val === "汉族"
            ? "1"
            : val === "瑶族"
              ? "52"
              : val === "藏族"
                ? "8"
                : "1"; //有出现其他民族再补一下映射 1-56
        break;
      case "跟进级别": // 还要考虑人户分离情况
        res["assessGrading"] = FOLLOW_LEVEL_MAP[val]; // 平台已经不能直接添加，但词条还有效。
        break;
      case "村居":
        res["socialWorkSpotName"] = VILLAGE_MAP[val]["spotName"];
        res["socialWorkSpotId"] = VILLAGE_MAP[val]["spotID"];
        res["community"] = VILLAGE_MAP[val]["communit"];
        res["residenceAreaId"] = VILLAGE_MAP[val]["communit"];
        //res['residenceArea.name'] = val+"村民委员会" // 需要一个对照表;
        res["district"] = "440113000000"; //区
        res["street"] = "440113105000"; //街道
        break;
      case "兜底类型":
        if (val === "边缘人群") {
          res["personType"] = "2"; // 适度普惠
          // 处理边缘人群类型
          const types = MARGINAL_PERSON_TYPE_MAP.filter((item) =>
            item.condition(obj),
          );
          res["personType2"] = types.map((item) => item.code).join(","); // 支持多类型
        } else {
          // 处理非边缘人群类型
          res["personType"] = "1";
          const codes = [];
          Object.entries(PERSON_TYPE_MAP).forEach(([key, value]) => {
            const conditionMet = value.condition //是否有条件
              ? value.condition(val, obj) // 满足一定条件
              : val.includes(key); // 文本中包含键名
            if (conditionMet) {
              codes.push(value.code); // 返回数字
            }
          }); //全都没包含，返回codes=[]
          res["personType2"] = codes.length > 0 ? codes.join(",") : "";
        }
        break;
      case "身体状况":
        processHealthCondition(val, res);
        break;
      case "残疾类型等级":
        processDisability(val, res);
        const disability = val.filter(
          (item) => item.includes("精神") && item.includes("级"),
        );
        const disability2 = val.filter(
          (item) => !item.includes("精神") && item.includes("级"),
        );
        if (disability.length > 0) {
          // 包含精神残疾
          res["mentalCondition"] = "2";
          res["mentalDisabilityLevel"] =
            disability[0].match(/[一二三四]级/)?.[0] ?? " ";
          res["mentalDisability"] = disability
            .map((item) => item.replace("级", ""))
            .join(",");
          res["unJobReason"] = val.toString();
        } else if (disability2.length > 0) {
          // 其他残疾
          res["mentalCondition"] = "1";
          res["mentalDisabilityLevel"] = " ";
          res["mentalDisability"] = " ";
          res["healthOther"] = disability2.join(",");
          res["unJobReason"] = val.toString();
        } else {
          // 无残疾
          res["mentalCondition"] = "1";
          res["mentalDisabilityLevel"] = " ";
          res["mentalDisability"] = " ";
          res["unJobReason"] = " ";
        }
        break;
      case "婚姻状况":
        const marryStatus = ["其他", "未婚", "已婚", "", "离异", "丧偶"];
        const marrytype = marryStatus.indexOf(val);
        res["marryStatus"] =
          marrytype !== -1 ? marrytype + "" : val.length > 1 ? "0" : " ";
        res["marryStatusTxt"] = res["marryStatus"] === "0" ? val : " ";
        break;
      case "子女状况":
        const child = val.toString() || "";
        res["childSon"] = child.match(/\d+(?=[子儿])/)?.[0] || " ";
        res["childDaughter"] = child.match(/\d+(?=女)/)?.[0] || " ";
        if (child == "无子女") {
          res["childSon"] = "0";
          res["childDaughter"] = "0";
          res["childOther"] = " ";
        } else if (
          (res["childSon"] === " " &&
            res["childDaughter"] === " " &&
            val.length > 0) ||
          child.includes("去世")
        ) {
          res["childOther"] = child;
        }
        break;
      case "户主姓名":
        if (!res["emegencyContact"] && res["name"] && val !== res["name"]) {
          res["emegencyContact"] = val;
        } else if (
          res["emegencyContact"] &&
          !res["emegencyContact"].includes(val) &&
          res["name"] &&
          val !== res["name"]
        ) {
          res["emegencyContact"] += "," + val;
        }
        break;
      case "监护人/主要照顾者":
        if (!res["emegencyContact"]) {
          res["emegencyContact"] = val;
        } else if (
          res["emegencyContact"] &&
          !val.includes(res["emegencyContact"]) &&
          !res["emegencyContact"].includes(val)
        ) {
          res["emegencyContact"] += "," + val;
        }
        /*const emegency =
          val.match(/\([\u4e00-\u9fa5]+\)/)?.[0].replace(/[()]/g, '') ?? undefined;
        res['emegencyContact'] =
          val && val.length > 0 && emegency
            ? emegency
            : val && val.length > 0
            ? val
            : ' ';*/
        break; // 自理能力中的主要照顾者暂未找到对应键
      case "自理能力":
        res["careAbility"] =
          val === "全自理" || val === "自理"
            ? "2"
            : val === "半自理"
              ? "4"
              : val === "失能"
                ? "3"
                : val === "全失能"
                  ? "1"
                  : "";
        break; // 1无法自理影响生存 2自理 3无法自理半自理且照顾支持不足 4无法自理半自理但照顾支持充足
      case "同住情况":
        res["minder"] = val; // 照顾支持文本  应该引用一个照顾情况，但没有
        if (val.includes("长住") && !val.includes("石楼"))
          res["separationStatus"] = "1"; //人户分离 人不在
        if (val.includes("同住"))
          res["careResource"] = res["careResource"]
            ? res["careResource"] + ",1"
            : "1"; //  亲属供养、照顾
        break;
      case "房屋环境":
      case "房屋情况":
        if (
          ["自置", "购", "商品", "住宅", "小区"].some((v) => val.includes(v))
        ) {
          res["livingType"] = "0";
        } else if (
          val.includes("公租") ||
          val.includes("廉租") ||
          val.includes("保障")
        ) {
          res["livingType"] = "1";
        } else if (val.includes("出租") || val.includes("租房")) {
          res["livingType"] = "2";
        } else if (
          ["自建", "宅基", "私建", "自有"].some((v) => val.includes(v))
        ) {
          res["livingType"] = "3";
        } else if (val.includes("回迁")) {
          res["livingType"] = "4";
          res["livingTypeTxt"] = val;
        } else if (val.includes("宿舍") || val.includes("寄宿")) {
          res["livingType"] = "5";
        } else if (val.includes("院")) {
          res["livingType"] = "6";
        } else if (val.includes("安置")) {
          res["livingType"] = "7";
        } else {
          if (!res["livingType"]) {
            res["livingType"] = "9";
            res["livingTypeTxt"] = val; // 好像没有这个了
          }
        }
        break;
      case "收入状况":
        if (val.join(",").includes("退休")) res["unJobReason"] = "退休";
        // res['serviceUseSituation']='' //政策救助金额 1000元/月
        /*const social = val.toString() || '';
        if (
          ['政策', '救助', '补贴', '低保', '特困', '孤儿', '事实无人', '残疾'].some(word => social.includes(word))
        )
          socialSecurity.push("1");
        if (
          ['家属', '子女', '父母', '家人'].some(word => social.includes(word))
        )
          careResource.push("1");*/
        break;
      case "为老服务":
        const weilao = val.filter((v) => v != "无" && v != "申请中");
        if (weilao.length > 0)
          res["careResource"] = res["careResource"]
            ? res["careResource"] + ",3"
            : "3"; //社区、居家养老服务
        break;
      case "社保医保情况":
        if (val.length > 0) socialSecurity.push("6"); // 暂时将享受商业保险或保险相关政策才算
        break;
      case "政策救助情况":
        const security = val.toString() || "";
        res["socialSecurity"] = "";
        if (
          security.includes("老/儿/残/困等政策性救助补贴") ||
          security.includes("政策性救助")
        )
          res["socialSecurity"] += "1"; //老/儿/残/困等政策性救助补贴
        if (security.includes("医疗")) res["socialSecurity"] += ",2";
        if (security.includes("长护险") || security.includes("长期护理"))
          res["socialSecurity"] += ",3"; // 长护险
        if (security.includes("住房")) res["socialSecurity"] += ",4";
        if (security.includes("教育") || security.includes("助学"))
          res["socialSecurity"] += ",5";
        if (security.includes("社会保险") || security.includes("保险"))
          res["socialSecurity"] += ",6";
        if (security.includes("社会优抚")) res["socialSecurity"] += ",7";
        if (security.includes("司法")) res["socialSecurity"] += ",8";
        if (
          val.length > 0 &&
          !security.includes("无") &&
          !/[1-8]/.test(res["socialSecurity"])
        )
          res["socialSecurity"] += ",0"; //其他
        break;
      case "服务需求":
        res["serviceRequirement"] = val.toString();
        break;
      case "服务目标":
        res["serviceTarget"] = val;
        break;
      default:
      // res[key] = obj[key];  // 可选择是否保留其他属性
    }
    return res;
  }, {}); //初始值为空对象

  // 优化人户分离状态判断
  if (
    res["separationStatus"] !== "0" &&
    obj["livingAddress"] &&
    isValidAddress(obj["livingAddress"]) &&
    obj["assessGrading"] === "6"
  ) {
    res["separationStatus"] = "1"; // 0=户籍在、人在,1=户籍在、人不在,2=户籍不在、人在
  }
  return res;
}

// 通过身份证计算年龄idCard as text
function calculateAge(idCard) {
  if (idCard.length !== 18)
    throw new Error("身份证号码必须是18位,异常身份证号：" + idCard);
  const birthStr = idCard.substring(6, 14);
  const birthDate = new Date(
    birthStr.substring(0, 4),
    birthStr.substring(4, 6) - 1,
    birthStr.substring(6, 8),
  );
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today <
    new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

//处理兜底类型   /// 平台转换有特殊规则，最后面保留
function DoDi(value) {
  let result = "";
  if (!value) return result;
  if (value.includes("低保") && !value.includes("边")) {
    result += "低保";
  } else if (value.includes("特困") && !value.includes("单身")) {
    result += "特困";
  } else if (value.includes("低边") || value.includes("低保边缘")) {
    result += "低保边缘家庭";
  }
  if (value.includes("困境") && value.includes("残疾")) {
    result += "残疾困境儿童";
  } else if (
    ["事实无人", "事无", "孤儿", "困境"].some((word) => value.includes(word))
  ) {
    result += "困境儿童";
  }
  if (value.includes("独居")) {
    result += "独居";
  }
  if (value.includes("孤寡")) {
    result += "孤寡";
  }
  if (value.includes("重残")) {
    result += "重残";
  } else if (
    (value.includes("独居") ||
      value.includes("孤寡") ||
      value.includes("空巢") ||
      value.includes("计生") ||
      value.includes("失能")) &&
    value.includes("残疾")
  ) {
    result += "残疾";
  }
  if (value.includes("失能")) {
    result += "失能";
  }
  if (value.includes("空巢")) {
    result += "空巢";
  }
  if (value.includes("计生") || value.includes("计划生育")) {
    result += "计生特殊家庭";
  }
  if (value.includes("支出")) {
    result += "支出型困难家庭";
  }
  if (
    ["独居", "孤寡", "空巢", "重残", "计生", "失能"].some((word) =>
      result.includes(word),
    )
  ) {
    result += "老人";
  }
  if (value.includes("残疾") && !result.includes("残疾")) {
    result += "残疾人";
  }
  if (value.includes("单身")) {
    result += "单身特困母亲";
  }
  if (value.includes("边缘") && !value.includes("低")) {
    result += "边缘人群";
  }
  //注意保留
  if (value.includes("孤儿")) result += "孤儿";
  if (value.includes("事无") || value.includes("事实无人"))
    result += "事实无人";
  return result;
}

// 封装匹配手机号，若无匹配固话，若无返回空
function matchPhone(text) {
  if (!text) return null;
  // 优先匹配手机号
  const mobilePattern = /(?<!\d)1[3-9]\d{9}(?!\d)/;
  const mobileMatch = text.match(mobilePattern);
  if (mobileMatch) return mobileMatch[0];
  // 若无手机号，匹配固定电话
  const landlinePattern = /(?<!\d)\d{7,12}(?!\d)/; //由于电话类型数据不接收符号 /(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)/;
  const landlineMatch = text.match(landlinePattern);
  if (landlineMatch) return landlineMatch[0];
  // 均无匹配则返回空字符串
  return null;
}

//封装将多维表返回值，转为对象
function TabToObj(items, mod) {
  // 传入多维表返回的data.items ，返回值可以直接用于修改多维表 。
  if (
    !items ||
    !Array.isArray(items) ||
    !(items instanceof Array) ||
    items.length === 0
  )
    return [];
  return items?.map((item) => {
    const record_id = item.record_id;
    const fields = Object.entries(item.fields).reduce((obj, [key, value]) => {
      if (
        typeof value === "number" ||
        typeof value === "string" ||
        typeof value === "boolean"
      ) {
        obj[key] = value;
      } else if (
        typeof value === "object" &&
        value instanceof Array &&
        value[0]?.hasOwnProperty("id")
      ) {
        if (
          mod &&
          mod.includes("ame") &&
          (mod.includes("id") || mod.includes("ID") || mod.includes("Id"))
        ) {
          obj[key] = value?.map((t) => ({
            name: t.name,
            id: t.id,
          }));
        } else if (mod && mod.includes("ame")) {
          obj[key] = value?.map((t) => t.name).join(",");
        } else {
          obj[key] = value?.map((t) => {
            if (t.id == "") {
              return {
                id: t.name,
              };
            } else {
              return {
                id: t.id,
              };
            }
          });
        }
      } else if (
        typeof value === "object" &&
        value instanceof Array &&
        value[0]?.hasOwnProperty("file_token")
      ) {
        obj[key] = value?.map((t) => {
          return {
            file_token: t.file_token,
          };
        });
      } else if (
        typeof value === "object" &&
        value instanceof Array &&
        value[0]?.hasOwnProperty("type") &&
        (value[0].type === "text" ||
          value[0].type === "mention" ||
          value[0].type === "url")
      ) {
        obj[key] = value
          ?.map((t) => {
            if (t.type === "text" || t.type === "url") {
              return t.text;
            } else if (t.type === "mention") {
              return t.text + "(" + t.token + ") ";
            }
          })
          .join("\n");
      } else if (typeof value === "object" && value instanceof Array) {
        obj[key] = value;
      } else if (
        typeof value === "object" &&
        value instanceof Object &&
        value?.hasOwnProperty("link")
      ) {
        obj[key] = value;
      } else if (
        typeof value === "object" &&
        value instanceof Object &&
        value?.hasOwnProperty("link_record_ids")
      ) {
        obj[key] = value.link_record_ids;
      } else if (
        typeof value === "object" &&
        value instanceof Object &&
        value?.hasOwnProperty("location")
      ) {
        obj[key] = value.location;
      } else if (
        typeof value === "object" &&
        value instanceof Object &&
        value?.hasOwnProperty("type") &&
        value.type === 3 && // 查找引用
        value?.hasOwnProperty("value")
      ) {
        obj[key] = value.value.join(",");
      }
      return obj;
    }, {});
    return {
      record_id,
      ...fields,
    };
  });
}
